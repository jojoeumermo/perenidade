// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os passes anônimos por RSA cego da onda R3 (supabase/migracoes/20261125-r3-servidor-chat.sql e lib/rede/passes/**) num
// Postgres local (scripts/banco-local.mjs), com a migração rodada DUAS vezes sobre o install.sql. Os ataques estão escritos como teste:
//   - o arquivo da migração no padrão (cabeçalho, porta no fim, sem endereço, sem parâmetro de linha com valor padrão);
//   - quem chama o quê: as chaves só o servidor do site; a urna só quem entrou (com a porta); o endereço do servidor do chat, ninguém;
//   - uma chave por semana: outra chave para a mesma semana não troca a que está, e o registro tem UMA linha 'passes-rsa' por semana;
//   - a chave privada fica SELADA no banco: quem copia o banco não tem a chave (nem o PKCS#8 em claro, nem o selo abre sem o segredo);
//   - emitir 30, conferir com a chave PÚBLICA; repetido (recusado no banco), de outra semana, de semana velha demais, de outro contexto,
//     adulterado em cada campo, do tipo VOPRF da R2, cabeçalho torto: recusados;
//   - o passe da urna: só quem vota numa votação aberta; uma vez por conta e por votação; não vale como passe geral e vice-versa;
//   - o endereço do servidor do chat no registro; a limpeza tira a privada da semana velha.
// Com R3_SEM_MIGRACAO=1, roda sem a migração e mostra o que falta.
// Uso: npm run testar:r3-passes
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACAO = "supabase/migracoes/20261125-r3-servidor-chat.sql";
const sql = fs.readFileSync(path.join(raiz, MIGRACAO), "utf8");
const semMigracao = process.env.R3_SEM_MIGRACAO === "1";

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ═══════════════════ 0. O arquivo da migração ═══════════════════
ok("a migração tem cabeçalho com a função e a lei", /Reforço 3 · O chat separado/.test(sql) && /Leis: LGPD/.test(sql));
ok("a migração termina com a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("a migração não tem endereço de rede nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(sql));
ok("nenhuma função da migração recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));
ok("nenhum corpo de função fala o nome antigo da rede", !/Rede Lúcia/.test(sql.replace(/^--.*$/gm, "")));
ok("nada de random() (sorteio só com gen_random_bytes)", !/\brandom\(\)/.test(sql));

// ═══════════════════ 1. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const agora = () => Math.floor(Date.now() / 1000);
const rpc = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const nomes = Object.keys(argumentos);
    const papel = quem.papel ?? "authenticated";
    const claims = papel === "authenticated"
      ? JSON.stringify({ role: papel, sub: quem.sub, aal: "aal2", session_id: quem.sessao, iat: agora() - 30, exp: agora() + 3600 })
      : JSON.stringify({ role: papel });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [claims]);
    await banco.pg.exec(`set role ${papel}`);
    try {
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, nomes.map((n) => argumentos[n]))).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
const servidor = { papel: "service_role" };
const visitante = { papel: "anon" };

if (!semMigracao) {
  await espera("a migração instala sobre o install.sql", () => exec(sql));
  await espera("de novo (idempotente)", () => exec(sql));
}
await espera("a porta tranca tudo (nenhuma função aberta)", () => dono("select interno.alumia_trancar() as r"), (r) => (r.rows[0].r.abertas ?? []).length === 0);

// ═══════════════════ 2. Quem chama o quê ═══════════════════
const DO_SERVIDOR = ["rede_passes_chave_ler", "rede_passes_chave_guardar"];
const COM_SESSAO = ["rede_passes_contexto_pode", "rede_passes_contexto_marcar"];
const privs = (await dono(`
  select p.proname as nome, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut,
    has_function_privilege('service_role', p.oid, 'execute') as serv, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    p.prosecdef as definer, coalesce(array_to_string(p.proconfig, ','), '') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [[...DO_SERVIDOR, ...COM_SESSAO]])).rows;
ok("as quatro funções públicas existem", privs.length === 4, `${privs.length}`);
for (const f of privs.filter((x) => DO_SERVIDOR.includes(x.nome))) ok(`${f.nome}: só o servidor do site chama`, !f.anon && !f.aut && f.serv);
for (const f of privs.filter((x) => COM_SESSAO.includes(x.nome))) ok(`${f.nome}: só quem entrou, e com a porta`, !f.anon && f.aut && f.porta);
ok("todas security definer com search_path fixo", privs.length > 0 && privs.every((f) => f.definer && /search_path=interno, pg_temp/.test(f.config)));
const internas = (await dono(`
  select p.proname, has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
    or has_function_privilege('service_role', p.oid, 'execute') as alguem
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and p.proname in ('passes_semana_hoje', 'passes_identidade', 'passes_contexto_permitido', 'rede_servidor_chat_registrar', 'rede_passes_limpeza')`)).rows;
ok("as peças de dentro existem e não são de ninguém (nem do serviço)", internas.length === 5 && internas.every((x) => !x.alguem), JSON.stringify(internas));
const tabelas = (await dono(`select c.relname, c.relrowsecurity as rls, has_table_privilege('service_role', c.oid, 'select') as serv, has_table_privilege('anon', c.oid, 'select') as anon
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('passes_chaves', 'passes_emitidos_contexto')`)).rows;
ok("as tabelas novas: RLS ligada, ninguém lê direto", tabelas.length === 2 && tabelas.every((t) => t.rls && !t.anon), JSON.stringify(tabelas));
await recusa("visitante não lê a chave", () => rpc(visitante, "rede_passes_chave_ler", { p_semana: 1, p_contexto: new Uint8Array(0) }), "permission denied");
await recusa("o serviço não anota o endereço do servidor do chat", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role service_role");
  try {
    return await banco.pg.query("select interno.rede_servidor_chat_registrar('https://chat.exemplo.invalid')");
  } finally {
    await banco.pg.exec("reset role");
  }
}), "permission denied");

// ═══════════════════ 3. As chaves no banco ═══════════════════
const semanaHoje = (await dono("select interno.passes_semana_hoje() as s")).rows[0].s;
const { semanaDe, contextoDaUrna, identidadeNoRegistro, desafio, MODO, PASSES_POR_DIA, cabecalhoDoPasse, resumoDoDesafio } = await import("../lib/rede/passes/comum.ts");
ok("a semana do banco é a mesma do TypeScript", semanaHoje === semanaDe(), `${semanaHoje} × ${semanaDe()}`);
const S = await import("../lib/rede/passes/servidor.ts");
const { publicVerif, genericBatched } = await import("@cloudflare/privacypass-ts");
const SEGREDO = "segredo-dos-passes-de-teste-com-mais-de-32-letras"; // gitleaks:allow (valor de teste)
const OUTRO_SEGREDO = "outro-segredo-dos-passes-de-teste-com-mais-de-32"; // gitleaks:allow (valor de teste)

/** O banco das chaves do servidor do site, sobre o Postgres local (pelo serviço, como a rota). */
const deB64 = (s) => (s == null ? null : new Uint8Array(Buffer.from(s, "base64")));
const bancoDasChaves = {
  async ler(semana, contexto) {
    const r = await rpc(servidor, "rede_passes_chave_ler", { p_semana: semana, p_contexto: contexto });
    return r ? { publica: deB64(r.publica), privadaSelada: deB64(r.privada_selada), seq: r.seq ?? null } : null;
  },
  async guardar(semana, contexto, publica, privadaSelada) {
    const r = await rpc(servidor, "rede_passes_chave_guardar", { p_semana: semana, p_contexto: contexto, p_publica: publica, p_privada_selada: privadaSelada });
    return { publica: deB64(r.publica), privadaSelada: deB64(r.privada_selada), seq: r.seq ?? null };
  },
};
const vazio = new Uint8Array(0);
const linhasRsa = async () => (await dono("select seq, identidade from interno.rede_kt where tipo = 'passes-rsa' order by seq")).rows;

const chave = await espera("a chave desta semana nasce na primeira emissão, guardada e no registro", () => S.chaveDoEmissor(semanaHoje, vazio, bancoDasChaves, SEGREDO, true),
  (c) => c && c.privada && c.seq > 0 && c.publica.length > 290);
const linhas1 = await linhasRsa();
ok("o registro tem a linha 'passes-rsa' com a identidade p3:<semana>::<SPKI>", linhas1.length === 1 && linhas1[0].identidade === identidadeNoRegistro(semanaHoje, vazio, chave.publica));
S._esquecerChaves();
const outra = await espera("outro processo do site, ao mesmo tempo, sorteia OUTRA chave: o banco devolve a primeira", async () => {
  const par = await publicVerif.Issuer.generateKey(MODO, { modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) });
  const pub = await publicVerif.getPublicKeyBytes(par.publicKey);
  const pk = new Uint8Array(await crypto.subtle.exportKey("pkcs8", par.privateKey));
  return bancoDasChaves.guardar(semanaHoje, vazio, pub, S.selarPrivada(SEGREDO, semanaHoje, vazio, pub, pk));
}, (g) => Buffer.from(g.publica).equals(Buffer.from(chave.publica)));
ok("uma linha no registro por semana (a segunda chave não entrou)", (await linhasRsa()).length === 1 && !!outra);
await recusa("chave de semana fora de hoje±1: recusada", () => rpc(servidor, "rede_passes_chave_guardar", { p_semana: semanaHoje + 5, p_contexto: vazio, p_publica: chave.publica, p_privada_selada: new Uint8Array(1200) }), "invalido:chave");
await recusa("contexto com semana diferente de 0: recusado", () => rpc(servidor, "rede_passes_chave_guardar", { p_semana: semanaHoje, p_contexto: new Uint8Array(32), p_publica: chave.publica, p_privada_selada: new Uint8Array(1200) }), "invalido:chave");
await recusa("chave pública curta demais: recusada", () => rpc(servidor, "rede_passes_chave_guardar", { p_semana: semanaHoje, p_contexto: vazio, p_publica: new Uint8Array(64), p_privada_selada: new Uint8Array(1200) }), "invalido:chave");

// Quem copia o banco.
const copia = (await dono("select publica, privada_selada from interno.passes_chaves where semana = $1 and contexto = ''::bytea", [semanaHoje])).rows[0];
const pkcs8Real = await (async () => {
  const p = S.abrirPrivada(SEGREDO, semanaHoje, vazio, chave.publica, new Uint8Array(copia.privada_selada));
  return p ? Buffer.from(p) : null;
})();
ok("com o segredo, o selo abre e é um PKCS#8 RSA", !!pkcs8Real && pkcs8Real[0] === 0x30 && pkcs8Real.length > 1100);
ok("quem copia o banco não acha a chave privada em claro", pkcs8Real && !Buffer.from(copia.privada_selada).includes(pkcs8Real.subarray(40, 120)));
ok("sem o segredo (ou com outro), o selo não abre", S.abrirPrivada(OUTRO_SEGREDO, semanaHoje, vazio, chave.publica, new Uint8Array(copia.privada_selada)) === null);
ok("o selo de uma semana não abre como o de outra", S.abrirPrivada(SEGREDO, semanaHoje - 1, vazio, chave.publica, new Uint8Array(copia.privada_selada)) === null);
const adulterada = new Uint8Array(copia.privada_selada);
adulterada[60] ^= 1;
ok("selo adulterado: não abre", S.abrirPrivada(SEGREDO, semanaHoje, vazio, chave.publica, adulterada) === null);
S._esquecerChaves();
await recusa("o servidor com outro segredo não emite com a chave guardada (nem cria outra)", () => S.chaveDoEmissor(semanaHoje, vazio, bancoDasChaves, OUTRO_SEGREDO, true), "selo_nao_abre");
S._esquecerChaves();
// 2.6, a troca do segredo dos passes: com o segredo de antes em ALUMIA_PASSES_SEGREDO_ANTERIOR, a chave da semana ainda abre (a emissão
// não para até a semana seguinte); com um "anterior" que não é o de antes, continua sem abrir.
process.env.ALUMIA_PASSES_SEGREDO_ANTERIOR = "um-segredo-qualquer-que-nao-e-o-de-antes-32+"; // gitleaks:allow (valor de teste)
await recusa("2.6: o 'anterior' errado não abre a chave da semana", () => S.chaveDoEmissor(semanaHoje, vazio, bancoDasChaves, OUTRO_SEGREDO, true), "selo_nao_abre");
S._esquecerChaves();
process.env.ALUMIA_PASSES_SEGREDO_ANTERIOR = SEGREDO;
await espera("2.6: na troca do segredo, a chave da semana selada com o de antes ainda abre (e é a mesma, sem linha nova no registro)",
  () => S.chaveDoEmissor(semanaHoje, vazio, bancoDasChaves, OUTRO_SEGREDO, true), (c) => c?.privada && Buffer.from(c.publica).equals(Buffer.from(chave.publica)));
ok("2.6: e o registro continua com UMA linha da semana", (await linhasRsa()).filter((l) => l.identidade.startsWith(`p3:${semanaHoje}::`)).length === 1);
delete process.env.ALUMIA_PASSES_SEGREDO_ANTERIOR;
S._esquecerChaves();

// ═══════════════════ 4. Emitir e conferir ═══════════════════
const chaveHoje = await S.chaveDoEmissor(semanaHoje, vazio, bancoDasChaves, SEGREDO, true);
async function lote(c = chaveHoje, contexto = vazio) {
  const clientes = Array.from({ length: PASSES_POR_DIA }, () => new publicVerif.Client(MODO));
  const pedidos = [];
  for (const cl of clientes) pedidos.push(new genericBatched.TokenRequest(await cl.createTokenRequest(desafio(contexto), c.publica)));
  const bytes = new genericBatched.Client().createTokenRequest(pedidos).serialize();
  return { clientes, bytes };
}
const { clientes, bytes } = await lote();
const resposta = await espera("emitir o lote de 30 com a chave da semana", () => S.emitirLote(bytes, chaveHoje), (r) => r instanceof Uint8Array);
const respostas = new genericBatched.Client().deserializeTokenResponse(resposta);
const passes = [];
for (let i = 0; i < PASSES_POR_DIA; i++) passes.push(await clientes[i].finalize(respostas.tokenResponses[i].tokenResponse));
const b64u = (b) => Buffer.from(b).toString("base64url");
const cab = (t) => cabecalhoDoPasse(b64u(t.serialize()));
ok("30 passes de 354 bytes", passes.length === 30 && passes.every((p) => p.serialize().length === 354));
const c1 = await espera("um passe confere só com a chave PÚBLICA", () => S.conferirPasse(cab(passes[0]), { banco: bancoDasChaves }), (r) => r.ok === true && r.resumo.length === 32);
await espera("o resumo do gasto vai ao banco uma vez: a primeira vale", () => rpc(servidor, "rede_passe_gastar", { p_resumo: c1.resumo }), (r) => r === true);
await espera("repetido: o banco recusa", () => rpc(servidor, "rede_passe_gastar", { p_resumo: c1.resumo }), (r) => r === false);
const c2 = await S.conferirPasse(cab(passes[1]), { banco: bancoDasChaves });
ok("dois passes têm resumos diferentes (nada liga um ao outro)", c2.ok && !Buffer.from(c2.resumo).equals(Buffer.from(c1.resumo)));
await espera("o passe da semana vale ainda na semana seguinte", () => S.conferirPasse(cab(passes[2]), { banco: bancoDasChaves, agora: Date.now() + 7 * 86_400_000 }), (r) => r.ok === true);
await espera("e não depois dela", () => S.conferirPasse(cab(passes[2]), { banco: bancoDasChaves, agora: Date.now() + 14 * 86_400_000 }), (r) => !r.ok && r.motivo === "invalido");
await espera("nem antes da semana (relógio voltado)", () => S.conferirPasse(cab(passes[2]), { banco: bancoDasChaves, agora: Date.now() - 7 * 86_400_000 }), (r) => !r.ok);
await espera("o passe geral não vale como passe de urna", () => S.conferirPasse(cab(passes[3]), { banco: bancoDasChaves, contexto: new Uint8Array(32).fill(7) }), (r) => !r.ok);

// Adulterar cada campo.
const serial = passes[4].serialize();
for (const [nome, i] of [["tipo", 1], ["nonce", 10], ["resumo do desafio", 40], ["id da chave", 80], ["assinatura", 200], ["fim da assinatura", 353]]) {
  const t = new Uint8Array(serial);
  t[i] ^= 0x01;
  await espera(`passe com ${nome} trocado: recusado`, () => S.conferirPasse(cabecalhoDoPasse(b64u(t)), { banco: bancoDasChaves }), (r) => !r.ok);
}
await espera("passe com um byte a mais: recusado", () => S.conferirPasse(cabecalhoDoPasse(b64u(Buffer.concat([serial, Buffer.from([0])]))), { banco: bancoDasChaves }), (r) => !r.ok);
await espera("passe do tipo VOPRF da R2 (outro tamanho): recusado", () => S.conferirPasse(cabecalhoDoPasse(b64u(crypto.randomBytes(146))), { banco: bancoDasChaves }), (r) => !r.ok);
await espera("sem cabeçalho: sem_passe", () => S.conferirPasse(null, { banco: bancoDasChaves }), (r) => !r.ok && r.motivo === "sem_passe");
await espera("Bearer no lugar do passe: sem_passe", () => S.conferirPasse("Bearer abc.def.ghi", { banco: bancoDasChaves }), (r) => !r.ok && r.motivo === "sem_passe");

// Passe de outra chave (um servidor que tentasse dar uma chave só a uma pessoa): não confere, porque a chave não está no banco/registro.
await espera("passe assinado por uma chave fora do registro: recusado", async () => {
  const par = await publicVerif.Issuer.generateKey(MODO, { modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) });
  const pub = await publicVerif.getPublicKeyBytes(par.publicKey);
  const cl = new publicVerif.Client(MODO);
  const req = await cl.createTokenRequest(desafio(), pub);
  const resp = await new publicVerif.Issuer(MODO, "alumia.invalid", par.privateKey, par.publicKey).issue(req);
  const t = await cl.finalize(resp);
  return S.conferirPasse(cab(t), { banco: bancoDasChaves });
}, (r) => !r.ok);
// Passe com o desafio de outro emissor (mesma chave): recusado pelo resumo do desafio (na emissão cega o servidor não vê o desafio).
await espera("passe da mesma chave com o desafio de outro emissor: recusado", async () => {
  const { TokenChallenge } = await import("@cloudflare/privacypass-ts");
  const outroDesafio = new TokenChallenge(2, "outro.invalid", new Uint8Array(0), ["outro.invalid"]);
  const cls = Array.from({ length: PASSES_POR_DIA }, () => new publicVerif.Client(MODO));
  const reqs = [];
  for (const cl of cls) reqs.push(new genericBatched.TokenRequest(await cl.createTokenRequest(outroDesafio, chaveHoje.publica)));
  const r = new genericBatched.Client().deserializeTokenResponse(await S.emitirLote(new genericBatched.Client().createTokenRequest(reqs).serialize(), chaveHoje));
  const t = await cls[0].finalize(r.tokenResponses[0].tokenResponse);
  return S.conferirPasse(cab(t), { banco: bancoDasChaves });
}, (r) => !r.ok);
await recusa("pedido cego maior que o módulo (m ≥ n): recusado", async () => {
  const l = genericBatched.BatchedTokenRequest.deserialize((await lote()).bytes);
  const tr = l.tokenRequests[0].tokenRequest;
  const torto = new publicVerif.TokenRequest(tr.truncatedTokenKeyId, new Uint8Array(256).fill(0xff), publicVerif.BLIND_RSA);
  const lista = [new genericBatched.TokenRequest(torto), ...l.tokenRequests.slice(1)];
  return S.emitirLote(new genericBatched.BatchedTokenRequest(lista).serialize(), chaveHoje);
}, "invalido");

// Lote torto.
await recusa("lote com 29 pedidos: recusado", async () => {
  const l = await lote();
  const r = genericBatched.BatchedTokenRequest.deserialize(l.bytes);
  return S.emitirLote(new genericBatched.BatchedTokenRequest(r.tokenRequests.slice(1)).serialize(), chaveHoje);
}, "invalido");
await recusa("lote com um byte a mais: recusado", async () => S.emitirLote(Buffer.concat([(await lote()).bytes, Buffer.from([0])]), chaveHoje), "invalido");
ok("lote com a chave de outro id: recusado", S.loteConferido((await lote({ ...chaveHoje, publica: outra.publica })).bytes, crypto.randomBytes(32)) === null);

// ═══════════════════ 5. O passe da urna ═══════════════════
const P = {};
const pessoa = async (nome) => {
  P[nome] = await criarUsuario(`${nome}@r3p.local`, `Pessoa ${nome}`);
  await rpc({ sub: P[nome], sessao: crypto.randomUUID() }, "eu").catch(() => undefined);
};
for (const nome of ["org", "v1"]) await pessoa(nome);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["org", "v1"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `r3p_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("select interno.alumia_entrada_ligar(true)");
await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada'), ($2, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P.org, P.v1]);
// "fora" chega DEPOIS de a entrada ligar e não é aprovada.
await pessoa("fora");
await dono("update interno.perfis set rede_codinome = 'Codinome fora', rede_codinome_ok = true, rede_handle = 'r3p_fora', rede_18 = true, rede_consentimento = 1 where id = $1", [P.fora]);
await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P.fora]);
await dono("insert into interno.rede_orgs (perfil, tipo) values ($1, 'coletivo')", [P.org]);
const C = (await dono("insert into interno.rede_consultas (org, pergunta, metodo, prazo, compromisso) values ($1, 'Qual pauta levamos?', 'simples', now() + interval '2 days', 'A maioria decide o passo seguinte.') returning id", [P.org])).rows[0].id;
const v1 = { sub: P.v1, sessao: crypto.randomUUID() }, fora = { sub: P.fora, sessao: crypto.randomUUID() };
await espera("quem vota numa consulta aberta pode receber a chave da urna", () => rpc(v1, "rede_passes_contexto_pode", { p_tipo: "consulta", p_alvo: C }), (r) => r === true);
await recusa("quem não entrou na Alumia: a porta recusa", () => rpc(fora, "rede_passes_contexto_pode", { p_tipo: "consulta", p_alvo: C }), "");
await espera("votação que não existe: não pode", () => rpc(v1, "rede_passes_contexto_pode", { p_tipo: "consulta", p_alvo: crypto.randomUUID() }), (r) => r === false);
await espera("tipo que não existe: não pode", () => rpc(v1, "rede_passes_contexto_pode", { p_tipo: "post", p_alvo: C }), (r) => r === false);
const ctx = contextoDaUrna("consulta", C);
const chaveUrna = await espera("a chave da urna nasce (semana 0, com o contexto) e vai ao registro", () => S.chaveDoEmissor(0, ctx, bancoDasChaves, SEGREDO, true), (c) => c && c.seq > 0);
ok("o registro tem a linha da urna com o contexto", (await linhasRsa()).some((l) => l.identidade === identidadeNoRegistro(0, ctx, chaveUrna.publica)));
const marca = S.marcaDoContexto(P.v1, ctx, SEGREDO);
await espera("a primeira marca da conta nesta votação: vale", () => rpc(v1, "rede_passes_contexto_marcar", { p_tipo: "consulta", p_alvo: C, p_marca: marca }), (r) => r === true);
await espera("a segunda: já pegou", () => rpc(v1, "rede_passes_contexto_marcar", { p_tipo: "consulta", p_alvo: C, p_marca: marca }), (r) => r === false);
ok("a marca não diz de quem é (nenhuma coluna de conta na tabela)", !(await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name in ('passes_emitidos_contexto', 'passes_chaves')")).rows
  .some((c) => /usuario|conta|autor|quem|criado_em|hora/.test(c.column_name)));
const clU = new publicVerif.Client(MODO);
const reqU = await clU.createTokenRequest(desafio(ctx), chaveUrna.publica);
const respU = await espera("emitir UM passe da urna", () => S.emitirUm(reqU.serialize(), chaveUrna), (r) => r.length === 256);
const passeU = await clU.finalize(publicVerif.TokenResponse.deserialize(respU));
await espera("o passe da urna confere com o contexto dela", () => S.conferirPasse(cab(passeU), { banco: bancoDasChaves, contexto: ctx }), (r) => r.ok);
await espera("não confere com o contexto de outra votação", () => S.conferirPasse(cab(passeU), { banco: bancoDasChaves, contexto: contextoDaUrna("consulta", crypto.randomUUID()) }), (r) => !r.ok);
await espera("não vale como passe geral", () => S.conferirPasse(cab(passeU), { banco: bancoDasChaves }), (r) => !r.ok);
await recusa("o lote geral com a chave da urna: recusado", async () => S.emitirLote((await lote(chaveUrna, ctx)).bytes, chaveUrna), "sem_servico");
await recusa("um passe só com a chave da semana: recusado", async () => S.emitirUm(reqU.serialize(), chaveHoje), "sem_servico");
await dono("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [C]);
await recusa("votação fechada: não marca mais", () => rpc(v1, "rede_passes_contexto_marcar", { p_tipo: "consulta", p_alvo: C, p_marca: S.marcaDoContexto(P.v1, contextoDaUrna("consulta", C), OUTRO_SEGREDO) }), "sem_permissao");
ok("o contexto da urna depende do tipo e do alvo", !Buffer.from(contextoDaUrna("consulta", C)).equals(Buffer.from(contextoDaUrna("decisao", C))) && contextoDaUrna("consulta", "x") === null);
ok("o resumo do desafio com contexto é outro", !Buffer.from(resumoDoDesafio(ctx)).equals(Buffer.from(resumoDoDesafio())));

// ═══════════════════ 6. O endereço do servidor do chat e a limpeza ═══════════════════
await espera("o dono do banco anota o endereço do servidor do chat no registro", () => dono("select interno.rede_servidor_chat_registrar('https://chat.exemplo.invalid') as r"), (r) => r.rows[0].r.ok === true);
ok("a linha 'servidor-chat' tem o endereço", (await dono("select identidade from interno.rede_kt where tipo = 'servidor-chat' order by seq desc limit 1")).rows[0]?.identidade === "sc1:https://chat.exemplo.invalid");
await recusa("endereço que não é https: recusado", () => dono("select interno.rede_servidor_chat_registrar('http://chat.exemplo.invalid')"), "invalido:endereco");
await recusa("endereço com barra no fim: recusado", () => dono("select interno.rede_servidor_chat_registrar('https://chat.exemplo.invalid/')"), "invalido:endereco");
await espera("vazio volta o chat para o próprio site", () => dono("select interno.rede_servidor_chat_registrar('') as r"), (r) => r.rows[0].r.ok === true);
await dono("insert into interno.passes_chaves (semana, contexto, publica, privada_selada, criada_dia) values ($1, ''::bytea, $2, $3, current_date - 14)", [semanaHoje - 2, chave.publica, new Uint8Array(1200)]);
await dono("insert into interno.passes_chaves (semana, contexto, publica, privada_selada, criada_dia) values ($1, ''::bytea, $2, $3, current_date - 60)", [semanaHoje - 8, chave.publica, new Uint8Array(1200)]);
await espera("a limpeza roda", () => dono("select interno.rede_passes_limpeza() as r"), (r) => r.rows[0].r.privadas >= 1 && r.rows[0].r.chaves >= 1);
const depois = (await dono("select semana, privada_selada is not null as tem from interno.passes_chaves where octet_length(contexto) = 0 order by semana")).rows;
ok("a privada da semana velha saiu do banco; a de hoje ficou; a de 8 semanas atrás saiu inteira",
  depois.find((x) => x.semana === semanaHoje - 2)?.tem === false && depois.find((x) => x.semana === semanaHoje)?.tem === true && !depois.some((x) => x.semana === semanaHoje - 8), JSON.stringify(depois));
ok("a chave da urna (contexto) não sai na limpeza", (await dono("select count(*)::int as n from interno.passes_chaves where octet_length(contexto) = 32")).rows[0].n === 1);

// ═══════════════════ 7. O install.sql rodado de novo (a migração da R2 por cima da R3, e a R3 de novo) ═══════════════════
await espera("a migração das caixas da R2 roda de novo por cima (o install.sql inteiro de novo) sem recusar as linhas novas",
  () => exec(fs.readFileSync(path.join(raiz, "supabase/migracoes/20261124-r2-caixas.sql"), "utf8")));
await espera("e a da R3 de novo", () => exec(sql));
ok("o registro continua aceitando 'passes-rsa' e 'servidor-chat'", /servidor-chat/.test((await dono("select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'rede_kt_tipo_r2'")).rows[0]?.d ?? ""));

// ═══════════════════ Fim ═══════════════════
await banco.pg.close?.();
console.log(`\nPasses anônimos por RSA cego (R3): ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
