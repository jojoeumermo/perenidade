// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o voto sem confiar no servidor (onda R2, item 1.7): supabase/migracoes/20261124-r2-voto.sql num Postgres de verdade
// (scripts/banco-local.mjs), rodada DUAS vezes sobre o install.sql e a migração das caixas (de quem ela depende), com a cifra de
// verdade (lib/rede/voto/limiar.ts) nos aparelhos simulados:
//   - as guardiãs publicam a chave de voto; quem abre a votação escolhe as guardiãs e publica a chave; quem vota confere e cifra;
//     fechada, as guardiãs repassam as partes à abridora, que abre no "aparelho" dela e manda só as escolhas embaralhadas;
//   - consulta à base (ranqueada), votação secreta da comunidade e votação secreta da equipe;
//   - ataques: quem não é da coordenação publica ou vira guardiã; chave de guardiã trocada; identidade de quem cria trocada; chave
//     publicada duas vezes ou depois do primeiro voto; voto às claras; cédula do formato de antes; cédula repetida; voto sem chave;
//     abrir com a votação aberta; parte repetida; a abridora manda escolha a mais; quem não é abridora lê a urna ou apura;
//   - O ACEITE: o banco inteiro (todas as tabelas, como um pg_dump) mais o segredo do servidor não abrem nenhuma cédula: a privada
//     da votação e as partes não aparecem em lugar nenhum, e a derivação de antes não dá a chave;
//   - as funções que abriam as cédulas no servidor sumiram; permissões, porta, RLS sem políticas.
// A migração das caixas: o arquivo do ramo, se já estiver aqui; senão, a do ramo r2-caixas (git show), até a junção.
// Uso: npm run testar:r2-voto
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ed25519 } from "@noble/curves/ed25519.js";
import { criarBanco } from "./banco-local.mjs";
import * as L from "../lib/rede/voto/limiar.ts";
import { carregarSodio } from "../lib/rede/cifra/sodio.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
// R2_VOTO_MIGRACAO: outra cópia da migração (para provar que um teste falha sem um conserto).
const MIGRACAO = process.env.R2_VOTO_MIGRACAO ?? "supabase/migracoes/20261124-r2-voto.sql";
const CAIXAS = "supabase/migracoes/20261124-r2-caixas.sql";
const sql = path.isAbsolute(MIGRACAO) ? fs.readFileSync(MIGRACAO, "utf8") : ler(MIGRACAO);
const sqlCaixas = fs.existsSync(path.join(raiz, CAIXAS)) ? ler(CAIXAS) : execFileSync("git", ["-C", raiz, "show", `r2-caixas:${CAIXAS}`], { encoding: "utf8" });
const S = await carregarSodio();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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
ok("a migração tem cabeçalho com a função e a lei", /Alumia · R2 · voto sem confiar no servidor/.test(sql) && /Leis e princípios:/.test(sql) && /LGPD/.test(sql));
ok("a migração termina com a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("a migração não tem endereço de rede, porta nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\/|x-forwarded-for|interno\.origem\(\)/i.test(sql));
ok("nenhuma função da migração recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));
ok("'Rede Lúcia' não aparece na migração", !/Rede Lúcia/.test(sql));
ok("toda função security definer tem search_path fixo", (() => {
  const defs = sql.match(/create or replace function [\s\S]*?(?:\$\$|\$function\$|\$g\$)/gi) ?? [];
  return defs.length >= 25 && defs.filter((f) => /security definer/i.test(f)).every((f) => /set search_path (=|TO) '?interno'?, '?pg_temp'?/i.test(f));
})());
ok("as urnas sorteiam com gen_random_uuid", (sql.match(/order by gen_random_uuid\(\)/g) ?? []).length >= 6);
ok("nada de random() nem de hora nas tabelas novas", !/\brandom\(\)/.test(sql) && !/timestamptz/.test(sql.split("-- ── 2.")[0].split("-- ── 1.")[1] ?? "x"));

// ── O código: o servidor não tem mais como abrir cédula; nada de Math.random; os textos nos seis idiomas ──
const existe = (c) => fs.existsSync(path.join(raiz, c));
ok("as rotas com que o servidor dava a chave e abria as cédulas sumiram", ["app/api/alumia/voto/chave/route.ts", "app/api/alumia/voto/abrir/route.ts", "app/api/alumia/decisao/chave/route.ts", "app/api/alumia/decisao/abrir/route.ts", "lib/rede/voto/cedula.ts"].every((c) => !existe(c)));
ok("o lado do servidor do voto só faz marcas (sem ECDH, sem decifrar)", !/createECDH|createDecipheriv|hkdfSync|abrirCedula|chavePublicaDaConsulta/.test(ler("lib/rede/voto/servidor.ts")));
ok("a rota das marcas só confere o formato da cédula da equipe, sem libsodium nem chave", /alumia_voto_equipe_cifrada/.test(ler("app/api/alumia/voto/marca/route.ts")) && !/^import .*(limiar|sodio)|abrirCedula/m.test(ler("app/api/alumia/voto/marca/route.ts")));
const codigoDoVoto = ["lib/rede/voto/limiar.ts", "lib/rede/voto/urna.ts", "lib/rede/voto/guarda.ts", "lib/rede/voto/cliente.ts", "lib/rede/voto/identidade.ts", "components/rede/voto/UrnaSecreta.tsx"];
ok("nenhum Math.random no código do voto", codigoDoVoto.every((c) => !/Math\.random/.test(ler(c))));
ok("nenhum arquivo do navegador do voto lê segredo do servidor ou chave de serviço", codigoDoVoto.every((c) => !/ALUMIA_VOTO_SEGREDO|SERVICE_ROLE|process\.env\.(?!NEXT_PUBLIC_)/.test(ler(c))));
ok("nenhuma cifra feita à mão: só libsodium, shamir-secret-sharing e @noble no voto", !/createCipheriv|subtle\.(encrypt|decrypt)/.test(ler("lib/rede/voto/limiar.ts")) && /crypto_kem_xwing_enc/.test(ler("lib/rede/voto/limiar.ts")) && /from "shamir-secret-sharing"/.test(ler("lib/rede/voto/limiar.ts")));
ok("o aparelho cifra o repasse para a abridora do REGISTRO assinado (não a que o servidor diz na hora)", /chave\.guardias\.find\(\(x\) => x\.indice === ab\.abridora\)/.test(ler("lib/rede/voto/urna.ts")) && !/ab\.voto/.test(ler("lib/rede/voto/urna.ts")));
{
  const chavesDe = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" ? chavesDe(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
  const marcas = (t) => (t.match(/\{\w+\}/g) ?? []).sort().join();
  const pt = new Map(chavesDe(JSON.parse(ler("i18n/rede/voto/pt.json"))));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler(`i18n/rede/voto/${l}.json`));
    const m = new Map(chavesDe(j));
    ok(`textos do voto em ${l}: as mesmas chaves e marcadores do português, marcados como rascunho`, j._rascunho === true && m.size === pt.size && [...pt].every(([k, v]) => m.has(k) && m.get(k).trim() !== "" && marcas(m.get(k)) === marcas(v)));
  }
  ok("o português do voto é o texto final (sem _rascunho)", !("_rascunho" in JSON.parse(ler("i18n/rede/voto/pt.json"))));
  const usados = [...ler("components/rede/voto/UrnaSecreta.tsx").matchAll(/\bt[ueg]?\.(\w+)/g)].map((x) => x[1]);
  ok("a tela não usa texto que não existe", usados.every((k) => [...pt.keys()].some((c) => c.endsWith(`.${k}`) || c === k) || ["urna", "escolha", "guardia", "erros", "titulo", "carregando"].includes(k)));
}

// ═══════════════════ 1. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (t, v = []) => (await dono(t, v)).rows[0];
const linhas = async (t, v = []) => (await dono(t, v)).rows;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const agora = () => Math.floor(Date.now() / 1000);
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const chamar = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const amr = [{ method: "password", timestamp: agora() - 3600 }, { method: "totp", timestamp: agora() - 60 }];
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [JSON.stringify({ role: "authenticated", sub: quem.sub, aal: "aal2", amr, iat: agora() - 60 }), JSON.stringify({ "x-forwarded-for": quem.ip })]);
    await banco.pg.exec("set role authenticated");
    try {
      const nomes = Object.keys(argumentos);
      const valores = nomes.map((n) => (argumentos[n] !== null && typeof argumentos[n] === "object" && !Array.isArray(argumentos[n]) ? JSON.stringify(argumentos[n]) : argumentos[n]));
      return (await banco.pg.query(`select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
const servico = (funcao, argumentos = {}) => rpc({ papel: "service_role" }, funcao, argumentos);

await espera("a migração das caixas instala (dependência)", () => exec(sqlCaixas));
await espera("a migração do voto instala", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.rede_*/alumia_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("as funções novas com sessão passam pela porta", () => linhas(`select p.proname, pg_get_functiondef(p.oid) s from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'rede\\_voto\\_%'`),
  (l) => l.length === 10 && l.every((x) => x.s.includes("interno.alumia_porta()")));
await espera("nenhuma função do voto entrou na lista de exceções da porta", () => um(`select count(*)::int n from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'rede\\_voto%' or p.proname like 'alumia\\_voto%') and interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))`), (x) => x.n === 0);
await espera("visitante sem conta não chama nada do voto", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'rede\\_voto\\_%' or p.proname = 'alumia_voto_equipe_cifrada') and has_function_privilege('anon', p.oid, 'execute')`), (l) => l.length === 0);
await espera("o voto da equipe só pela chave de serviço", () => um(`select has_function_privilege('authenticated', 'public.alumia_voto_equipe_cifrada(uuid, uuid, text, text)', 'execute') a, has_function_privilege('service_role', 'public.alumia_voto_equipe_cifrada(uuid, uuid, text, text)', 'execute') s`), (x) => !x.a && x.s);
await espera("as funções de dentro (interno.voto_*) não são chamáveis de fora", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'interno'::regnamespace and p.proname like 'voto\\_%' and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`), (l) => l.length === 0);
await espera("as tabelas novas têm RLS e nenhuma política", () => linhas(`select c.relname, c.relrowsecurity, (select count(*) from pg_policy p where p.polrelid = c.oid)::int pol from pg_class c
    where c.relnamespace = 'interno'::regnamespace and c.relname in ('rede_consulta_chaves', 'rede_consulta_aberturas', 'votacao_cifradas')`), (l) => l.length === 3 && l.every((x) => x.relrowsecurity && x.pol === 0));
await espera("as tabelas novas não têm hora (só o dia) nem id sequencial", () => linhas(`select table_name, column_name, data_type, column_default from information_schema.columns where table_schema = 'interno' and table_name in ('rede_consulta_chaves', 'rede_consulta_aberturas', 'votacao_cifradas')`),
  (l) => l.every((x) => !/timestamp|time with/.test(x.data_type) && !/nextval/.test(x.column_default ?? "")));
await espera("as funções com que o servidor abria as cédulas sumiram", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('alumia_voto_cifradas', 'alumia_voto_apurar', 'alumia_decisao_cifradas', 'alumia_decisao_apurar', 'alumia_voto_equipe')`), (l) => l.length === 0);

// ═══════════════════ 2. As pessoas ═══════════════════
const nomes = ["g1", "g2", "g3", "g4", "g5", "fora", "org", "v1", "v2", "v3", "v4", "v5", "m1", "m2", "m3", "c1", "c2", "c3", "e1", "e2", "e3", "e4"];
const P = {};
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@r2voto.local`, `Nome Civil ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${String(i + 1).padStart(2, "0")}`, `${nome}_r2v`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("delete from interno.papeis");
for (const c of ["c1", "c2", "c3"]) await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P[c]]);
for (const e of ["e1", "e2", "e3", "e4"]) await dono("insert into interno.papeis (usuario, papel) values ($1, 'curadoria')", [P[e]]);

// A organização, o núcleo e quem vota; a gestão (guardiãs possíveis).
await dono("insert into interno.rede_orgs (perfil, tipo) values ($1, 'coletivo')", [P.org]);
const NUCLEO = (await um("insert into interno.rede_nucleos (nome, org) values ('Núcleo do teste', $1) returning id", [P.org])).id;
// Depois da R2 (membros escondidos, que roda antes desta) o banco não sabe quem é de qual núcleo: quem vota na consulta à base sai de
// interno.rede_nucleo_sem_membros(), que em produção não devolve ninguém (a consulta à base fica fechada no servidor até haver
// credencial anônima: pendência da R2). A cerimônia do voto em limiar é a mesma nos três tipos; para prová-la na consulta, a filiação
// de teste (scripts/banco-local.mjs, filiacaoDeTeste) entra no lugar onde a credencial anônima entraria.
ok("em produção, a elegibilidade da consulta lê a filiação que o banco não tem", ((await um("select prosrc from pg_proc where oid = 'interno.voto_consulta_elegivel(uuid, uuid)'::regprocedure"))?.prosrc ?? "").includes("rede_nucleo_sem_membros()")
  && (await um("select count(*)::int as n from interno.rede_nucleo_sem_membros()")).n === 0);
await banco.filiacaoDeTeste();
for (const n of ["v1", "v2", "v3", "v4", "v5", "g1"]) await dono("insert into interno.teste_nucleo_membros (nucleo, usuario) values ($1, $2)", [NUCLEO, P[n]]);
for (const g of ["g1", "g2", "g3", "g4", "g5"]) await dono("insert into interno.rede_org_gestores (org, gestor) values ($1, $2) on conflict do nothing", [P.org, P[g]]);
// A comunidade e a mediação.
const SLUG = "moradia-r2v";
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ($1, 'Moradia', 'lutas', 'aberta') on conflict do nothing", [SLUG]);
for (const m of ["m1", "m2", "m3"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, entrou_em) values ($1, $2, 'moderacao', now() - interval '20 days')", [SLUG, P[m]]);
for (const n of ["v1", "v2", "v3", "v4", "v5", "fora"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, entrou_em) values ($1, $2, now() - interval '10 days')", [SLUG, P[n]]);

// ── Os "aparelhos": cada pessoa com a identidade da conta (Ed25519) no diretório do chat novo ──
const A = {};
const b64 = (b) => Buffer.from(b).toString("base64");
for (const nome of nomes) {
  const privada = ed25519.utils.randomSecretKey();
  A[nome] = { privada, identidade: ed25519.getPublicKey(privada) };
  await dono(`insert into interno.diretorio_contas (usuario, identidade, pedidos_xwing, pedidos_assinatura, pedidos_caixa, pedidos_pd)
    values ($1, $2, $3, $4, $5, $6)`, [P[nome], A[nome].identidade, S.randombytes_buf(1216), S.randombytes_buf(64), S.randombytes_buf(32), S.randombytes_buf(32)]);
}
async function virarGuardia(nome) {
  const par = await L.novaChaveDeGuardia();
  A[nome].voto = par;
  const assinatura = ed25519.sign(L.textoDaGuardia(P[nome], par.publica), A[nome].privada);
  return chamar(como(P[nome]), "rede_voto_minha_chave", { p: { voto: b64(par.publica), assinatura: b64(assinatura) } });
}
/** O registro da chave como o aparelho o recebe (base64 → bytes). */
function registro(r) {
  const c = r.chave;
  return { tipo: c.tipo, alvo: c.alvo, publica: L.deBase64(c.pk), n: c.n, k: c.k, criador: c.criador, criadorIdentidade: L.deBase64(c.criador_identidade), assinatura: L.deBase64(c.assinatura),
    guardias: c.guardias.map((g) => ({ indice: g.indice, usuario: g.usuario, voto: L.deBase64(g.voto), identidade: L.deBase64(g.identidade), assinatura: L.deBase64(g.assinatura) })) };
}
/** Quem cria: lê as guardiãs possíveis, escolhe, cria a chave no aparelho e publica. */
async function publicarChave(criador, tipo, alvo, escolhidas, k, mexer = (x) => x) {
  const possiveis = await chamar(como(P[criador]), "rede_voto_guardias_possiveis", { p_tipo: tipo, p_alvo: alvo });
  const guardias = escolhidas.map((n) => possiveis.find((g) => g.usuario === P[n])).map((g) => ({ usuario: g.usuario, voto: L.deBase64(g.voto), identidade: L.deBase64(g.identidade), assinatura: L.deBase64(g.assinatura) }));
  const { chave, partes } = await L.criarChaveDaVotacao({ tipo, alvo, k, guardias, criador: P[criador], criadorIdentidade: A[criador].identidade, assinar: (t) => ed25519.sign(t, A[criador].privada) });
  const p = mexer({ tipo, alvo, pk: b64(chave.publica), k, assinatura: b64(chave.assinatura), criador_identidade: b64(chave.criadorIdentidade),
    guardias: chave.guardias.map((g) => ({ indice: g.indice, usuario: g.usuario, voto: b64(g.voto), identidade: b64(g.identidade), assinatura: b64(g.assinatura) })),
    partes: partes.map((x) => b64(x.cifrada)) });
  return chamar(como(P[criador]), "rede_voto_chave_publicar", { p });
}
/** Quem vota: lê o registro, confere e cifra. */
async function cedulaDe(nome, tipo, alvo, escolha) {
  const r = await chamar(como(P[nome]), "rede_voto_chave", { p_tipo: tipo, p_alvo: alvo });
  const c = registro(r);
  if (L.conferirChave(c) !== "ok") throw new Error("chave_nao_confere");
  return L.cifrarCedula(c, escolha);
}
/** A guardiã: abre a parte dela, pede a abertura e repassa à abridora. */
async function entregar(nome, tipo, alvo) {
  const r = await chamar(como(P[nome]), "rede_voto_chave", { p_tipo: tipo, p_alvo: alvo });
  const c = registro(r);
  const minha = await chamar(como(P[nome]), "rede_voto_minha_parte", { p_tipo: tipo, p_alvo: alvo });
  const parte = await L.abrirParte(A[nome].voto.privada, c, minha.indice, L.deBase64(minha.parte));
  if (!parte) throw new Error("parte_nao_abre");
  const ab = await chamar(como(P[nome]), "rede_voto_abrir", { p_tipo: tipo, p_alvo: alvo });
  const repasse = await L.repassarParte(L.deBase64(ab.voto), c, minha.indice, parte);
  return chamar(como(P[nome]), "rede_voto_parte_entregar", { p_tipo: tipo, p_alvo: alvo, p_parte: b64(repasse) });
}
/** A abridora: refaz a privada no aparelho dela, abre as cédulas e manda as escolhas embaralhadas. */
async function apurar(nome, tipo, alvo, mexer = (x) => x) {
  const r = await chamar(como(P[nome]), "rede_voto_chave", { p_tipo: tipo, p_alvo: alvo });
  const c = registro(r);
  const urna = await chamar(como(P[nome]), "rede_voto_urna", { p_tipo: tipo, p_alvo: alvo });
  const partes = [];
  for (const p of urna.partes) partes.push({ indice: p.indice, parte: await L.abrirRepasse(A[nome].voto.privada, c, p.indice, L.deBase64(p.parte)) });
  const refeita = await L.refazerChave(c, partes.filter((p) => p.parte));
  if (!refeita) throw new Error("nao_refez");
  const escolhas = [];
  for (const ced of urna.cedulas) {
    const e = await L.abrirCedula(refeita.privada, c, ced);
    if (e !== null) escolhas.push(e);
  }
  ULTIMA_PRIVADA = refeita.privada;
  return chamar(como(P[nome]), "rede_voto_apurar", { p_tipo: tipo, p_alvo: alvo, p_escolhas: mexer(L.embaralhar(escolhas)), p_quantas: urna.cedulas.length });
}
let ULTIMA_PRIVADA = null;

try {
// ═══════════════════ 3. A chave de voto das guardiãs ═══════════════════
await recusa("chave de voto com tamanho errado é recusada", () => chamar(como(P.g1), "rede_voto_minha_chave", { p: { voto: b64(S.randombytes_buf(100)), assinatura: b64(S.randombytes_buf(64)) } }), "invalido:chave");
await recusa("chave sem assinatura é recusada", () => chamar(como(P.g1), "rede_voto_minha_chave", { p: { voto: b64(S.randombytes_buf(1216)) } }), "invalido:chave");
for (const g of ["g1", "g2", "g3", "g4", "g5", "fora", "m1", "m2", "m3", "c1", "c2", "c3"]) await espera(`${g} publica a chave de voto`, () => virarGuardia(g), (x) => x.ok === true);
await dono("delete from interno.diretorio_contas where usuario = $1", [P.e4]);
await recusa("sem o chat novo (sem diretório), não publica chave de voto", () => chamar(como(P.e4), "rede_voto_minha_chave", { p: { voto: b64(S.randombytes_buf(1216)), assinatura: b64(S.randombytes_buf(64)) } }), "sem_diretorio");
await espera("a guardiã lê a própria chave no diretório (para o aparelho conferir)", () => chamar(como(P.g1), "rede_voto_minha_chave_ler"), (x) => x.diretorio === true && x.voto === b64(A.g1.voto.publica));

// ═══════════════════ 4. Consulta à base ═══════════════════
const C = (await um("insert into interno.rede_consultas (org, pergunta, metodo, prazo, compromisso) values ($1, 'Qual pauta levamos?', 'ranqueada', now() + interval '2 days', 'A vencedora abre a próxima plenária.') returning id", [P.org])).id;
const OPS = [];
for (const [i, t] of ["Tarifa zero", "Moradia", "Creche"].entries()) OPS.push((await um("insert into interno.rede_consulta_opcoes (consulta, ordem, texto) values ($1, $2, $3) returning id", [C, i + 1, t])).id);

await recusa("quem não é da gestão não vê as guardiãs possíveis", () => chamar(como(P.v1), "rede_voto_guardias_possiveis", { p_tipo: "consulta", p_alvo: C }), "sem_permissao");
await espera("a gestão vê as guardiãs possíveis: só a gestão da organização com chave publicada", () => chamar(como(P.g1), "rede_voto_guardias_possiveis", { p_tipo: "consulta", p_alvo: C }),
  (l) => l.length === 5 && l.every((g) => ["g1", "g2", "g3", "g4", "g5"].some((n) => P[n] === g.usuario)) && !l.some((g) => g.usuario === P.fora));
await espera("sem chave, quem vota fica sabendo (e a gestão pode criar)", () => chamar(como(P.g1), "rede_voto_chave", { p_tipo: "consulta", p_alvo: C }), (r) => r.chave === null && r.possoCriar === true);
const C_SEM = (await um("insert into interno.rede_consultas (org, pergunta, metodo, prazo, compromisso) values ($1, 'Consulta sem chave', 'simples', now() + interval '2 days', 'A maioria decide o passo seguinte.') returning id", [P.org])).id;
await um("insert into interno.rede_consulta_opcoes (consulta, ordem, texto) values ($1, 1, 'Sim'), ($1, 2, 'Não') returning id", [C_SEM]);

// Ataques na publicação da chave.
await recusa("quem não é da gestão não publica a chave", () => publicarChave("v1", "consulta", C, ["g1", "g2", "g3"], 2), "sem_permissao");
await recusa("guardiã de fora da gestão é recusada", async () => {
  const possiveis = await chamar(como(P.g1), "rede_voto_guardias_possiveis", { p_tipo: "consulta", p_alvo: C });
  const guardias = [...possiveis.slice(0, 2), { usuario: P.fora, voto: b64(A.fora.voto.publica), identidade: b64(A.fora.identidade), assinatura: b64(ed25519.sign(L.textoDaGuardia(P.fora, A.fora.voto.publica), A.fora.privada)) }]
    .map((g) => ({ usuario: g.usuario, voto: L.deBase64(g.voto), identidade: L.deBase64(g.identidade), assinatura: L.deBase64(g.assinatura) }));
  const { chave, partes } = await L.criarChaveDaVotacao({ tipo: "consulta", alvo: C, k: 2, guardias, criador: P.g1, criadorIdentidade: A.g1.identidade, assinar: (t) => ed25519.sign(t, A.g1.privada) });
  return chamar(como(P.g1), "rede_voto_chave_publicar", { p: { tipo: "consulta", alvo: C, pk: b64(chave.publica), k: 2, assinatura: b64(chave.assinatura), criador_identidade: b64(A.g1.identidade),
    guardias: chave.guardias.map((g) => ({ indice: g.indice, usuario: g.usuario, voto: b64(g.voto), identidade: b64(g.identidade), assinatura: b64(g.assinatura) })), partes: partes.map((x) => b64(x.cifrada)) } });
}, "invalido:guardias");
const servidorPar = S.crypto_kem_xwing_keypair();
await recusa("chave de voto de guardiã trocada (a do servidor no lugar da dela) é recusada", () => publicarChave("g1", "consulta", C, ["g1", "g2", "g3"], 2, (p) => ({ ...p, guardias: p.guardias.map((g, i) => (i === 1 ? { ...g, voto: b64(servidorPar.publicKey) } : g)) })), "invalido:guardias");
await recusa("identidade de quem cria que não é a do diretório é recusada", () => publicarChave("g1", "consulta", C, ["g1", "g2", "g3"], 2, (p) => ({ ...p, criador_identidade: b64(A.g2.identidade) })), "identidade_trocada");
await recusa("parte com tamanho errado é recusada", () => publicarChave("g1", "consulta", C, ["g1", "g2", "g3"], 2, (p) => ({ ...p, partes: [b64(S.randombytes_buf(40)), ...p.partes.slice(1)] })), "invalido:partes");
await recusa("K maior que N é recusado", () => publicarChave("g1", "consulta", C, ["g1", "g2", "g3"], 2, (p) => ({ ...p, k: 4 })), "invalido:chave");
await recusa("guardiã fora de ordem é recusada", () => publicarChave("g1", "consulta", C, ["g1", "g2", "g3"], 2, (p) => ({ ...p, guardias: [p.guardias[1], p.guardias[0], p.guardias[2]] })), "invalido:guardias");
await recusa("voto às claras na consulta: recusado (só cifrado)", () => chamar(como(P.v1), "rede_org_consulta_votar", { p_consulta: C, p_ranking: `{${OPS[0]}}` }), "voto_cifrado");
await recusa("voto cifrado sem chave publicada: recusado", async () => chamar(como(P.v1), "rede_org_consulta_votar_cifrada", { p_consulta: C_SEM, p_cedula: `v2.${"A".repeat(2230)}` }), "sem_chave");

await espera("a gestão publica a chave: 5 guardiãs, 3 abrem", () => publicarChave("g1", "consulta", C, ["g1", "g2", "g3", "g4", "g5"], 3), (x) => x.ok === true);
await recusa("a chave não se publica duas vezes", () => publicarChave("g2", "consulta", C, ["g1", "g2", "g3"], 2), "ja_tem_chave");
const regC = await espera("quem vota lê o registro: confere a assinatura de quem criou e de cada guardiã", async () => registro(await chamar(como(P.v1), "rede_voto_chave", { p_tipo: "consulta", p_alvo: C })), (c) => L.conferirChave(c) === "ok" && c.n === 5 && c.k === 3);
await espera("todos que leem o registro veem a mesma impressão", async () => [L.impressaoDaChave(registro(await chamar(como(P.v2), "rede_voto_chave", { p_tipo: "consulta", p_alvo: C }))), L.impressaoDaChave(registro(await chamar(como(P.g3), "rede_voto_chave", { p_tipo: "consulta", p_alvo: C })))],
  (l) => l[0] === l[1] && l[0] === L.impressaoDaChave(regC));
await espera("cada guardiã abre a sua parte já agora (confere que a chave é a dela)", async () => {
  const minha = await chamar(como(P.g4), "rede_voto_minha_parte", { p_tipo: "consulta", p_alvo: C });
  return L.abrirParte(A.g4.voto.privada, regC, minha.indice, L.deBase64(minha.parte));
}, (p) => p?.length === 33);
await recusa("quem não é guardiã não pega parte", () => chamar(como(P.v1), "rede_voto_minha_parte", { p_tipo: "consulta", p_alvo: C }), "sem_permissao");

// Votar.
const rankings = { v1: [0, 1, 2], v2: [1, 0, 2], v3: [2, 1, 0], v4: [0, 2, 1] };
const cedC = {};
for (const [n, r] of Object.entries(rankings)) {
  cedC[n] = await cedulaDe(n, "consulta", C, r.map((k) => OPS[k]));
  await espera(`${n} vota com a cédula cifrada para a chave das guardiãs`, () => chamar(como(P[n]), "rede_org_consulta_votar_cifrada", { p_consulta: C, p_cedula: cedC[n] }), (x) => x.votei === true);
}
await recusa("a chave não se publica depois do primeiro voto (nem numa consulta sem chave que já tem voto)", () => publicarChave("g1", "consulta", C, ["g1", "g2", "g3"], 2), "ja_tem_chave");
await recusa("cédula do formato de antes (c1): recusada", () => chamar(como(P.v5), "rede_org_consulta_votar_cifrada", { p_consulta: C, p_cedula: `c1.${"A".repeat(87)}.${"A".repeat(16)}.${"A".repeat(30)}` }), "invalido:cedula");
await recusa("cédula com uma letra a menos: recusada", () => chamar(como(P.v5), "rede_org_consulta_votar_cifrada", { p_consulta: C, p_cedula: cedC.v1.slice(0, -1) }), "invalido:cedula");
await recusa("cédula copiada de outra pessoa: recusada (resumo único)", () => chamar(como(P.v5), "rede_org_consulta_votar_cifrada", { p_consulta: C, p_cedula: cedC.v1 }), "cedula_repetida");
await recusa("quem já votou não vota de novo", async () => chamar(como(P.v1), "rede_org_consulta_votar_cifrada", { p_consulta: C, p_cedula: await cedulaDe("v1", "consulta", C, [OPS[2]]) }), "ja_votou");
await espera("a cédula repetida não deixou marca de quem tentou", () => um("select count(*)::int n from interno.rede_consulta_votantes where consulta = $1 and usuario = $2", [C, P.v5]), (x) => x.n === 0);
const urnaC = await linhas("select xmin::text x, cedula from interno.rede_consulta_cifradas where consulta = $1", [C]);
ok("a urna cifrada foi regravada junta (um xmin só): a ordem de chegada some", new Set(urnaC.map((u) => u.x)).size === 1 && urnaC.length === 4);
ok("a urna cifrada não tem id, hora nem pessoa", (await linhas("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_consulta_cifradas'")).map((x) => x.column_name).sort().join(",") === "cedula,consulta,resumo");

// Aberta: nada se abre.
await recusa("aberta, a guardiã não começa a abrir", () => chamar(como(P.g2), "rede_voto_abrir", { p_tipo: "consulta", p_alvo: C }), "aberta");
await recusa("aberta, ninguém lê a urna", () => chamar(como(P.g1), "rede_voto_urna", { p_tipo: "consulta", p_alvo: C }), "aberta");

// ── O ACEITE: o servidor sozinho, com o banco inteiro e todos os segredos dele ──
// Tudo o que o banco tem (todas as tabelas de interno e public, como um pg_dump), mais o segredo do servidor.
async function bancoInteiro() {
  const tabelas = await linhas(`select format('%I.%I', table_schema, table_name) t from information_schema.tables where table_schema in ('interno', 'public', 'auth') and table_type = 'BASE TABLE'`);
  let tudo = "";
  for (const { t } of tabelas) for (const l of await linhas(`select x::text s from ${t} x`)) tudo += `${l.s}\n`;
  return tudo;
}
const SEGREDO = "segredo-do-voto-para-o-teste-0123456789"; // gitleaks:allow (valor de teste)
{
  const dump = await bancoInteiro();
  const procurar = (bytes) => dump.includes(Buffer.from(bytes).toString("hex")) || dump.includes(b64(bytes)) || dump.includes(L.paraBase64url(bytes));
  // O servidor procura as privadas: das guardiãs (no aparelho delas) e a da votação (que só existe no aparelho da abridora, depois).
  ok("ACEITE: nenhuma privada de guardiã está no banco", ["g1", "g2", "g3", "g4", "g5"].every((g) => !procurar(A[g].voto.privada)));
  // A derivação de antes: a chave da consulta saía do segredo do servidor. Agora não dá a chave publicada.
  const antes = createHmac("sha256", createHmac("sha256", SEGREDO).update("alumia:voto:consulta").digest()).update(`consulta:${C}:0`).digest();
  ok("ACEITE: a chave derivada do segredo do servidor não é a da consulta", Buffer.compare(Buffer.from(S.crypto_kem_xwing_seed_keypair(antes).publicKey), Buffer.from(regC.publica)) !== 0);
  ok("ACEITE: e não abre nenhuma cédula", (await Promise.all(Object.values(cedC).map((c) => L.abrirCedula(S.crypto_kem_xwing_seed_keypair(antes).privateKey, regC, c)))).every((x) => x === null));
  // As partes que o banco guarda estão cifradas para as guardiãs: o servidor, com qualquer chave dele, não abre nenhuma.
  const partesNoBanco = (await um("select partes from interno.rede_consulta_chaves where consulta = $1", [C])).partes;
  const chavesDoServidor = [servidorPar.privateKey, S.crypto_kem_xwing_seed_keypair(createHmac("sha256", SEGREDO).update("guardia").digest()).privateKey];
  let abriu = 0;
  for (const k of chavesDoServidor) for (const [i, p] of partesNoBanco.entries()) if (await L.abrirParte(k, regC, i + 1, L.deBase64(p))) abriu++;
  ok("ACEITE: com as chaves dele, o servidor não abre nenhuma parte", abriu === 0);
  // Juntar as partes cifradas como se fossem partes (o que o banco tem) não refaz a chave.
  ok("ACEITE: as partes cifradas do banco não refazem a chave", (await L.refazerChave(regC, partesNoBanco.map((p, i) => ({ indice: i + 1, parte: L.deBase64(p).subarray(0, 33) })))) === null);
}

// Fecha.
await dono("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [C]);
await espera("fechada com cédula cifrada: o resultado não sai e a tela sabe que falta abrir", async () => (await chamar(como(P.v1), "rede_org_perfil", { p_handle: "org_r2v" })).consultas.find((c) => c.id === C),
  (c) => c.situacao === "fechada" && c.apurar === true && c.opcoes.every((o) => o.proporcao === null));
await recusa("quem não é guardiã não começa a abrir", () => chamar(como(P.v1), "rede_voto_abrir", { p_tipo: "consulta", p_alvo: C }), "sem_permissao");
await espera("a primeira guardiã que pede vira a abridora", () => chamar(como(P.g2), "rede_voto_abrir", { p_tipo: "consulta", p_alvo: C }), (x) => x.abridora === 2 && x.eu === true && x.voto === b64(A.g2.voto.publica));
await espera("a próxima recebe a mesma abridora, com a chave dela do registro assinado", () => chamar(como(P.g1), "rede_voto_abrir", { p_tipo: "consulta", p_alvo: C }), (x) => x.abridora === 2 && x.eu === false);
await recusa("parte com tamanho errado: recusada", () => chamar(como(P.g1), "rede_voto_parte_entregar", { p_tipo: "consulta", p_alvo: C, p_parte: b64(S.randombytes_buf(33)) }), "invalido:parte");
await espera("g1 repassa a parte", () => entregar("g1", "consulta", C), (x) => x.ok && x.entregues === 1);
await recusa("a mesma guardiã não repassa duas vezes", () => entregar("g1", "consulta", C), "ja_entregue");
await espera("g3 repassa a parte", () => entregar("g3", "consulta", C), (x) => x.entregues === 2);
await espera("com 2 de 3, a abridora ainda não recebe partes nem cédulas", () => chamar(como(P.g2), "rede_voto_urna", { p_tipo: "consulta", p_alvo: C }), (x) => x.entregues === 2 && !("partes" in x) && !("cedulas" in x));
await recusa("com 2 de 3, não se apura", () => chamar(como(P.g2), "rede_voto_apurar", { p_tipo: "consulta", p_alvo: C, p_escolhas: [], p_quantas: 4 }), "faltam_partes");
await espera("a abridora repassa a própria parte (para ela mesma)", () => entregar("g2", "consulta", C), (x) => x.entregues === 3);
await recusa("quem não é abridora não lê a urna", () => chamar(como(P.g1), "rede_voto_urna", { p_tipo: "consulta", p_alvo: C }), "sem_permissao");
await recusa("quem não é abridora não apura", () => chamar(como(P.g1), "rede_voto_apurar", { p_tipo: "consulta", p_alvo: C, p_escolhas: [], p_quantas: 4 }), "sem_permissao");
await espera("a abridora recebe as partes repassadas e as cédulas", () => chamar(como(P.g2), "rede_voto_urna", { p_tipo: "consulta", p_alvo: C }), (x) => x.partes.length === 3 && x.cedulas.length === 4 && x.opcoes.length === 3);
// O banco no meio da abertura: as partes repassadas também estão cifradas (para a abridora); o servidor não abre.
{
  const ab = await linhas("select indice, parte from interno.rede_consulta_aberturas where consulta = $1", [C]);
  let abriu = 0;
  for (const a of ab) if (await L.abrirRepasse(servidorPar.privateKey, regC, a.indice, a.parte)) abriu++;
  ok("ACEITE: as partes repassadas no banco não abrem com chave do servidor", ab.length === 3 && abriu === 0);
}
await recusa("a abridora que manda escolha a mais é recusada", () => apurar("g2", "consulta", C, (l) => [...l, [OPS[0]]]), "invalido:apuracao");
await espera("a abridora apura: refaz a chave no aparelho, abre e manda as escolhas embaralhadas (uma nula)", () => apurar("g2", "consulta", C, (l) => [...l.slice(1), ["isto-nao-e-opcao"]]), (x) => x.apuradas === 3 && x.nulas === 1);
await espera("as cifradas, as partes repassadas e as partes do registro sumiram", () => um(`select (select count(*)::int from interno.rede_consulta_cifradas where consulta = $1) c, (select count(*)::int from interno.rede_consulta_aberturas where consulta = $1) a,
    (select jsonb_array_length(partes) from interno.rede_consulta_chaves where consulta = $1) p, (select apurada from interno.rede_consulta_chaves where consulta = $1) ap, (select count(*)::int from interno.rede_consulta_cedulas where consulta = $1) u`, [C]),
  (x) => x.c === 0 && x.a === 0 && x.p === 0 && x.ap === true && x.u === 3);
await espera("o resultado sai (3 cédulas válidas)", async () => (await chamar(como(P.v1), "rede_org_perfil", { p_handle: "org_r2v" })).consultas.find((c) => c.id === C), (c) => c.apurar === false && c.opcoes.some((o) => o.proporcao !== null));
await recusa("apurar de novo: recusado", () => chamar(como(P.g2), "rede_voto_apurar", { p_tipo: "consulta", p_alvo: C, p_escolhas: [], p_quantas: 0 }), "apurada");
{
  const dump = await bancoInteiro();
  ok("ACEITE: depois de apurar, a privada da votação (que existiu só no aparelho da abridora) não está no banco",
    ULTIMA_PRIVADA && !dump.includes(Buffer.from(ULTIMA_PRIVADA).toString("hex")) && !dump.includes(b64(ULTIMA_PRIVADA)));
  const ced = await linhas("select xmin::text x from interno.rede_consulta_cedulas where consulta = $1", [C]);
  ok("a urna aberta foi gravada junta (um xmin só) e sem pessoa", new Set(ced.map((u) => u.x)).size === 1);
}

// ═══════════════════ 5. Votação secreta da comunidade ═══════════════════
const emDias = (d) => new Date(Date.now() + d * 86_400_000).toISOString();
const DEC = await chamar(como(P.m1), "alumia_decisao_criar", { p_slug: SLUG, p: { pergunta: "Qual dia fazemos o mutirão?", explicacao: "", opcoes: ["Sábado", "Domingo"], modo: "secreta", quorum: 3, prazo: emDias(3) } });
const OD = DEC.opcoes.map((o) => o.id);
await recusa("membro que não modera não publica a chave da decisão", () => publicarChave("v1", "decisao", DEC.id, ["m1", "m2", "m3"], 2), "sem_permissao");
await espera("a mediação vê como guardiãs só quem modera", () => chamar(como(P.m1), "rede_voto_guardias_possiveis", { p_tipo: "decisao", p_alvo: DEC.id }), (l) => l.length === 3);
await espera("a mediação publica a chave da decisão (3 guardiãs, 2 abrem)", () => publicarChave("m1", "decisao", DEC.id, ["m1", "m2", "m3"], 2), (x) => x.ok === true);
await recusa("voto secreto às claras na decisão: recusado", () => chamar(como(P.v1), "alumia_decisao_votar", { p_id: DEC.id, p_opcao: OD[0] }), "voto_cifrado");
const escolhasD = { v1: 0, v2: 1, v3: 0, v4: 0 };
for (const [n, o] of Object.entries(escolhasD)) {
  await espera(`${n} vota na decisão com a cédula cifrada`, async () => chamar(como(P[n]), "alumia_decisao_votar_cifrada", { p_id: DEC.id, p_cedula: await cedulaDe(n, "decisao", DEC.id, [OD[o]]) }), (x) => x.votei === true);
}
// A cédula da consulta não serve na decisão (outro tipo e outra votação no dado autenticado), nem vice-versa.
await espera("cédula de outra votação cai na urna mas não abre (nula na apuração)", async () => chamar(como(P.v5), "alumia_decisao_votar_cifrada", { p_id: DEC.id, p_cedula: await L.cifrarCedula({ tipo: "consulta", alvo: C, publica: regC.publica }, [OD[0]]) }), (x) => x.votei === true);
await dono("update interno.alumia_decisoes set criada_em = now() - interval '3 days', prazo = now() - interval '1 minute' where id = $1", [DEC.id]);
await espera("m3 repassa", () => entregar("m3", "decisao", DEC.id), (x) => x.ok);
await espera("m1 repassa", () => entregar("m1", "decisao", DEC.id), (x) => x.ok);
const abridoraDec = (await chamar(como(P.m1), "rede_voto_abrir", { p_tipo: "decisao", p_alvo: DEC.id })).abridora;
const nomeAbridoraDec = ["m1", "m2", "m3"].find((m, i) => i + 1 === abridoraDec);
await espera("a abridora da decisão apura (a cédula de outra votação é nula)", () => apurar(nomeAbridoraDec, "decisao", DEC.id), (x) => x.apuradas === 4 && x.nulas === 1);
await espera("o resultado da decisão sai", async () => (await chamar(como(P.v1), "alumia_decisao_lista", { p_slug: SLUG })).decisoes.find((d) => d.id === DEC.id),
  (d) => d.resultado === true && d.apurar === false && d.opcoes.find((o) => o.id === OD[0]).vencedora === true);

// ═══════════════════ 6. Votação secreta da equipe ═══════════════════
const VOT = await chamar(como(P.c1), "votacao_criar", { p: { titulo: "Qual horário da reunião geral?", descricao: "", opcoes: ["Manhã", "Tarde", "Noite"], secreta: true, encerra_em: emDias(2) } });
await espera("a votação secreta da equipe nasce sem chave", async () => VOT, (v) => v.secreta === true && v.chave === false && v.apurar === false);
await espera("a coordenação publica a chave da votação da equipe", () => publicarChave("c1", "equipe", VOT.id, ["c1", "c2", "c3"], 2), (x) => x.ok === true);
const MARCA = (u) => createHmac("sha256", SEGREDO).update(`equipe:${VOT.id}:${u}`).digest("hex");
for (const [n, o] of Object.entries({ e1: 0, e2: 2, e3: 0, c2: 1 })) {
  const ced = await cedulaDe(n === "c2" ? "c2" : "c1", "equipe", VOT.id, [o]);
  await espera(`${n} vota cifrado pelo servidor do site (só a marca no banco)`, () => servico("alumia_voto_equipe_cifrada", { p_usuario: P[n], p_votacao: VOT.id, p_cedula: ced, p_marca: MARCA(P[n]) }), (x) => x.ok === true);
}
await recusa("a mesma marca não vota de novo", async () => servico("alumia_voto_equipe_cifrada", { p_usuario: P.e1, p_votacao: VOT.id, p_cedula: await cedulaDe("c1", "equipe", VOT.id, [1]), p_marca: MARCA(P.e1) }), "ja_votou");
await recusa("conta comum não chama o voto da equipe direto", async () => chamar(como(P.e4), "alumia_voto_equipe_cifrada", { p_usuario: P.e4, p_votacao: VOT.id, p_cedula: "x", p_marca: MARCA(P.e4) }), "permission denied");
await espera("o banco da equipe guarda a cédula cifrada e a marca, nunca a pessoa", () => um(`select (select count(*)::int from interno.votacao_cifradas where votacao = $1) c, (select count(*)::int from interno.votacao_votantes where votacao = $1) p, (select count(*)::int from interno.votacao_votos where votacao = $1) v`, [VOT.id]),
  (x) => x.c === 4 && x.p === 0 && x.v === 0);
await chamar(como(P.c1), "votacao_encerrar", { p_id: VOT.id });
await espera("encerrada com cédula cifrada: sem resultado, a tela sabe que falta abrir", async () => (await linhas("select interno.votacao_json(v) j from interno.votacoes v where id = $1", [VOT.id]))[0].j, (j) => j.apurar === true && j.resultado === null);
await espera("c2 repassa", () => entregar("c2", "equipe", VOT.id), (x) => x.ok);
await espera("c3 repassa", () => entregar("c3", "equipe", VOT.id), (x) => x.ok);
const abridoraEq = ["c1", "c2", "c3"][(await chamar(como(P.c2), "rede_voto_abrir", { p_tipo: "equipe", p_alvo: VOT.id })).abridora - 1];
await espera("a abridora da equipe apura", () => apurar(abridoraEq, "equipe", VOT.id), (x) => x.apuradas === 4 && x.nulas === 0);
await espera("o resultado da equipe sai, sem quem", async () => (await linhas("select interno.votacao_json(v) j from interno.votacoes v where id = $1", [VOT.id]))[0].j,
  (j) => j.apurar === false && j.resultado.find((o) => o.opcao === 0).votos === 2 && j.resultado.every((o) => o.quem === null));

// ═══════════════════ 8. O aparelho (lib/rede/voto/urna.ts) contra um servidor que mente ═══════════════════
{
  const { criarUrna } = await import("../lib/rede/voto/urna.ts");
  const guardaDe = new Map();
  const trocadas = new Set();
  // Cada pessoa com o "aparelho" dela: a identidade (fonte), a chave de voto guardada e o banco com a sessão dela. `mentir` deixa
  // o servidor trocar respostas no caminho.
  const aparelho = (nome, mentir = (_f, r) => r) => criarUrna({
    chamar: async (f, a) => mentir(f, await chamar(como(P[nome]), f, a ?? {})),
    // Onda R3: a cédula vai pela urna anônima (provada em scripts/testar-r3-resto-urna.mjs). Este teste roda sobre o banco da R2, onde
    // a cédula ainda entra pela função com a sessão: o depósito aqui é esse caminho, para provar o resto (registro, guardiãs, apuração).
    depositar: async (tipo, alvo, cedula) => chamar(como(P[nome]), tipo === "consulta" ? "rede_org_consulta_votar_cifrada" : "alumia_decisao_votar_cifrada", tipo === "consulta" ? { p_consulta: alvo, p_cedula: cedula } : { p_id: alvo, p_cedula: cedula }),
    fonte: () => ({
      minha: async () => ({ usuario: P[nome], publica: A[nome].identidade, assinar: async (t) => ed25519.sign(t, A[nome].privada) }),
      conferir: async (u) => (trocadas.has(u) ? "trocada" : "conferida"),
    }),
    guarda: { ler: async (u) => (guardaDe.get(u) ? { publica: guardaDe.get(u).publica.slice(), privada: guardaDe.get(u).privada.slice() } : null), guardar: async (u, par) => {
      guardaDe.set(u, { publica: par.publica.slice(), privada: par.privada.slice() });
      // A chave nova também vale para os ajudantes do teste (entregar, apurar), que leem A[nome].voto.
      A[Object.keys(P).find((n) => P[n] === u)].voto = { publica: par.publica.slice(), privada: par.privada.slice() };
    } },
  });
  for (const g of ["g1", "g2", "g3", "g4", "g5"]) {
    await espera(`${g} cria a chave de voto pelo aparelho (guarda aqui, publica a pública assinada)`, () => aparelho(g).criarMinhaChave());
    await espera(`${g}: a chave do diretório é a deste aparelho`, () => aparelho(g).minhaChave(), (x) => x.diretorio && x.publicada && x.aqui && x.confere);
  }
  const C2 = (await um("insert into interno.rede_consultas (org, pergunta, metodo, prazo, compromisso) values ($1, 'Segunda consulta', 'ranqueada', now() + interval '2 days', 'A vencedora abre a próxima plenária.') returning id", [P.org])).id;
  const O2 = [];
  for (const [i, t] of ["A", "B", "C"].entries()) O2.push((await um("insert into interno.rede_consulta_opcoes (consulta, ordem, texto) values ($1, $2, $3) returning id", [C2, i + 1, t])).id);
  const possiveis = await aparelho("g1").guardiasPossiveis("consulta", C2);
  ok("as guardiãs possíveis vêm com a assinatura conferida no aparelho", possiveis.length === 5 && possiveis.every((g) => g.assinada));
  const imp = await espera("a gestão publica a chave pelo aparelho (3 de 5) e recebe a impressão", () => aparelho("g1").publicarChave("consulta", C2, possiveis.map((g) => g.usuario), 3), (x) => /^\d{4} \d{4} \d{4}$/.test(x));
  await espera("quem vota vê a mesma impressão, com o registro e as identidades conferidos", () => aparelho("v1").estado("consulta", C2), (e) => e.impressao === imp && e.conferencia === "ok" && e.identidades === "conferida" && e.guardias.length === 5);
  await espera("cada guardiã confere que a parte dela abre com a chave deste aparelho", async () => Promise.all(["g1", "g2", "g3", "g4", "g5"].map((g) => aparelho(g).conferirMinhaParte("consulta", C2))), (l) => l.every((x) => x === "ok"));

  // O servidor troca o registro (a chave de outra consulta no lugar desta): o aparelho recusa antes de cifrar.
  const outro = await chamar(como(P.v1), "rede_voto_chave", { p_tipo: "consulta", p_alvo: C });
  await recusa("registro de outra votação entregue pelo servidor: o aparelho não vota", () => aparelho("v1", (f, r) => (f === "rede_voto_chave" ? { ...r, chave: outro.chave } : r)).votar("consulta", C2, [O2[0]]), "chave_nao_confere");
  await recusa("registro com a chave pública trocada: o aparelho não vota", () => aparelho("v1", (f, r) => (f === "rede_voto_chave" ? { ...r, chave: { ...r.chave, pk: b64(servidorPar.publicKey) } } : r)).votar("consulta", C2, [O2[0]]), "chave_nao_confere");
  trocadas.add(P.g1);
  await recusa("identidade de quem criou trocada no registro de transparência: o aparelho não vota", () => aparelho("v1").votar("consulta", C2, [O2[0]]), "identidade_trocada");
  trocadas.clear();
  for (const [n, r] of Object.entries({ v1: [0, 1], v2: [1], v3: [2, 0, 1] })) await espera(`${n} vota pelo aparelho`, () => aparelho(n).votar("consulta", C2, r.map((k) => O2[k])), (x) => x.votei === true);
  await dono("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [C2]);

  // O servidor mente a chave da abridora na hora de abrir (põe a dele): o aparelho usa a do registro assinado.
  const mentirAbridora = (f, r) => (f === "rede_voto_abrir" ? { ...r, voto: b64(servidorPar.publicKey) } : r);
  await espera("g4 repassa a parte (o servidor mentiu a chave da abridora)", () => aparelho("g4", mentirAbridora).entregarParte("consulta", C2), (x) => x.entregues === 1);
  const repassada = (await um("select parte from interno.rede_consulta_aberturas where consulta = $1", [C2])).parte;
  const regC2 = (await aparelho("v1").estado("consulta", C2)).chave;
  ok("a chave falsa da abridora não abre a parte repassada: o aparelho cifrou para a abridora do registro", (await L.abrirRepasse(servidorPar.privateKey, regC2, 4, repassada)) === null);
  await espera("g5 repassa", () => aparelho("g5").entregarParte("consulta", C2), (x) => x.entregues === 2);
  const abr = (await um("select abridora from interno.rede_consulta_chaves where consulta = $1", [C2])).abridora;
  const nomeAbr = ["g1", "g2", "g3", "g4", "g5"][abr - 1];
  await espera("com 2 de 3, a abridora fica sabendo que falta 1", () => aparelho(nomeAbr).apurar("consulta", C2), (x) => x.faltam === 1);
  await espera("g3 repassa", () => aparelho("g3").entregarParte("consulta", C2), (x) => x.entregues === 3);
  // O servidor enche a urna: uma cédula a mais que as pessoas que votaram (ele tem a chave pública, qualquer um cifra).
  const extra = await L.cifrarCedula(regC2, [O2[2]]);
  await dono("insert into interno.rede_consulta_cifradas (consulta, cedula, resumo) values ($1, $2, sha256(convert_to($2, 'UTF8')))", [C2, extra]);
  await recusa("urna com mais cédulas que pessoas: a abridora para e não apura", () => aparelho(nomeAbr).apurar("consulta", C2), "urna_inchada");
  await dono("delete from interno.rede_consulta_cifradas where consulta = $1 and cedula = $2", [C2, extra]);
  await espera("a abridora apura pelo aparelho", () => aparelho(nomeAbr).apurar("consulta", C2), (x) => x.apuradas === 3 && x.nulas === 0);
  await espera("o resultado sai", async () => (await chamar(como(P.v1), "rede_org_perfil", { p_handle: "org_r2v" })).consultas.find((c) => c.id === C2), (c) => c.apurar === false && c.opcoes.some((o) => o.proporcao !== null));
  await recusa("sem a identidade ligada no aparelho, não cria chave de voto", () => criarUrna({ chamar: (f, a) => chamar(como(P.v1), f, a ?? {}), fonte: () => null, guarda: { ler: async () => null, guardar: async () => {} } }).criarMinhaChave(), "sem_identidade");

  // ATAQUE da revisão final: um servidor (ou banco) ATIVO troca o registro da chave por um feito só com chaves dele (criador e
  // guardiãs inventados, tudo auto-assinado). A coerência interna passa; só o registro público das chaves pega. Antes do conserto, a
  // cédula saía sem fonte ligada ou com a fonte dizendo "nao_conferida", e o servidor abria: {ranking: [B, A]}.
  const falsas = [];
  for (let i = 0; i < 3; i++) {
    const sk = ed25519.utils.randomSecretKey();
    const par = await L.novaChaveDeGuardia();
    const usuario = crypto.randomUUID();
    falsas.push({ usuario, voto: par.publica, identidade: ed25519.getPublicKey(sk), assinatura: ed25519.sign(L.textoDaGuardia(usuario, par.publica), sk) });
  }
  const skCriador = ed25519.utils.randomSecretKey();
  const alvoFalso = crypto.randomUUID();
  const { chave: falsa } = await L.criarChaveDaVotacao({ tipo: "consulta", alvo: alvoFalso, k: 2, guardias: falsas, criador: crypto.randomUUID(), criadorIdentidade: ed25519.getPublicKey(skCriador), assinar: (t) => ed25519.sign(t, skCriador) });
  const registroFalso = { tipo: "consulta", alvo: alvoFalso, pk: L.paraBase64(falsa.publica), n: falsa.n, k: falsa.k, criador: falsa.criador, criador_identidade: L.paraBase64(falsa.criadorIdentidade), assinatura: L.paraBase64(falsa.assinatura),
    guardias: falsa.guardias.map((g) => ({ indice: g.indice, usuario: g.usuario, nome: "x", voto: L.paraBase64(g.voto), identidade: L.paraBase64(g.identidade), assinatura: L.paraBase64(g.assinatura) })) };
  ok("o registro falso é coerente por dentro (a conferência interna sozinha não pega)", L.conferirChave(falsa) === "ok");
  const comFonte = (fonte) => criarUrna({ chamar: async () => ({ chave: registroFalso, situacao: "aberta", possoCriar: false }), fonte: () => fonte, guarda: { ler: async () => null, guardar: async () => {} } });
  await recusa("ATAQUE registro trocado, sem a identidade ligada no aparelho: a cédula não sai", () => comFonte(null).cedula("consulta", alvoFalso, ["B", "A"]), "sem_identidade");
  await recusa("ATAQUE registro trocado, com o registro público sem confirmar: a cédula não sai", () => comFonte({ minha: async () => null, conferir: async () => "nao_conferida" }).cedula("consulta", alvoFalso, ["B", "A"]), "chave_nao_confere");
  await recusa("ATAQUE registro trocado, com o registro público mostrando outra identidade: a cédula não sai", () => comFonte({ minha: async () => null, conferir: async () => "trocada" }).cedula("consulta", alvoFalso, ["B", "A"]), "identidade_trocada");
  await recusa("ATAQUE fonte que falha ao conferir conta como não conferida", () => comFonte({ minha: async () => null, conferir: async () => { throw new Error("rede"); } }).cedula("consulta", alvoFalso, ["B", "A"]), "chave_nao_confere");
  ok("a fonte assíncrona (a urna do navegador abre o chat na hora) também vale", await comFonte(null).estado("consulta", alvoFalso).then((e) => e.identidades === null));

  // A fonte de verdade: o chat do aparelho liga a fonte do voto (antes, ligarIdentidadeDoVoto não tinha quem chamasse).
  const nav = ler("lib/rede/chat/r2/navegador.ts");
  ok("o chat do navegador liga a fonte da identidade do voto ao abrir e ao ativar, e desliga ao esquecer",
    (nav.match(/ligarIdentidadeDoVoto\(fonteDoVoto\(/g) ?? []).length === 2 && (nav.match(/ligarIdentidadeDoVoto\(null\)/g) ?? []).length === 2);
  ok("a urna do navegador abre o chat quando a fonte ainda não está ligada", /abrirIdentidadeDoVoto/.test(ler("lib/rede/voto/cliente.ts")));
  const cert = await import("../lib/rede/chat/r2/certificados.ts");
  const id = cert.novoParEd25519();
  const doVoto = L.textoDaGuardia(crypto.randomUUID(), A.g1.voto.publica);
  ok("a identidade assina texto do voto, e a assinatura confere", ed25519.verify(cert.assinarTextoDoVoto(id, doVoto), doVoto, id.publica));
  let recusou = false;
  try {
    cert.assinarTextoDoVoto(id, new TextEncoder().encode("alumia/r2/franquia/remetente/v1 qualquer coisa"));
  } catch {
    recusou = true;
  }
  ok("ATAQUE a fonte do voto não vira assinador genérico da identidade (texto de outro uso é recusado)", recusou);
  // A fonte do navegador mapeia o registro: "nao_confere" (outra identidade ou nenhuma) vira "trocada"; registro quebrado, "nao_conferida".
  const { fonteDoVoto } = await import("../lib/rede/chat/r2/navegador.ts").catch(() => ({}));
  if (fonteDoVoto) {
    const respostas = { a: "confere", b: "nao_confere", c: "quebrado" };
    const f = fonteDoVoto("eu", { identidadePublica: () => "AA", assinarParaOVoto: (t) => t, conferirNoRegistro: async (u) => respostas[u] });
    ok("a fonte do navegador: confere → conferida, nao_confere → trocada, quebrado → nao_conferida",
      (await f.conferir("a", new Uint8Array(32))) === "conferida" && (await f.conferir("b", new Uint8Array(32))) === "trocada" && (await f.conferir("c", new Uint8Array(32))) === "nao_conferida");
  }
}

// ═══════════════════ 9. A eleição (uma consulta) espera as guardiãs ═══════════════════
{
  const FUN = (await um("insert into interno.rede_org_funcoes (org, tipo, nome) values ($1, 'comunicacao', 'Comunicação') returning id", [P.org])).id;
  const EL = (await um(`insert into interno.rede_org_eleicoes (org, funcao, inscricoes_ate, prazo, mandato_fim, quorum)
    values ($1, $2, now() - interval '2 days', now() + interval '2 days', current_date + 300, 3) returning id`, [P.org, FUN])).id;
  for (const n of ["v1", "v2"]) await dono("insert into interno.rede_org_eleicao_candidatos (eleicao, pessoa) values ($1, $2)", [EL, P[n]]);
  await dono("select interno.alumia_eleicao_avancar($1)", [EL]);
  const CE = (await um("select consulta from interno.rede_org_eleicoes where id = $1", [EL])).consulta;
  const opc = await linhas("select o.id, k.pessoa from interno.rede_consulta_opcoes o left join interno.rede_org_eleicao_candidatos k on k.opcao = o.id where o.consulta = $1 order by o.ordem", [CE]);
  const deV1 = opc.find((o) => o.pessoa === P.v1).id;
  await espera("a gestão publica a chave da consulta da eleição", () => publicarChave("g1", "consulta", CE, ["g1", "g2", "g3"], 2), (x) => x.ok === true);
  for (const n of ["v2", "v3", "v4", "v5"]) await chamar(como(P[n]), "rede_org_consulta_votar_cifrada", { p_consulta: CE, p_cedula: await cedulaDe(n, "consulta", CE, [n === "v2" ? opc.find((o) => o.pessoa === P.v2).id : deV1]) });
  await dono("update interno.rede_org_eleicoes set prazo = now() - interval '1 minute' where id = $1", [EL]);
  await dono("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [CE]);
  await dono("select interno.alumia_eleicao_avancar($1)", [EL]);
  await espera("prazo vencido com cédula cifrada fechada: a eleição NÃO apura a urna vazia (espera as guardiãs)", () => um("select situacao, eleito from interno.rede_org_eleicoes where id = $1", [EL]), (x) => x.situacao === "votacao" && x.eleito === null);
  await espera("g1 repassa", () => entregar("g1", "consulta", CE), (x) => x.ok);
  await espera("g3 repassa", () => entregar("g3", "consulta", CE), (x) => x.ok);
  const nomeAbr = ["g1", "g2", "g3"][(await um("select abridora from interno.rede_consulta_chaves where consulta = $1", [CE])).abridora - 1];
  await espera("a abridora apura a consulta da eleição", () => apurar(nomeAbr, "consulta", CE), (x) => x.apuradas === 4);
  await espera("logo depois da contagem, a eleição sai com a vencedora (3 de 4 votos em v1)", () => um(`select e.situacao, m.pessoa from interno.rede_org_eleicoes e left join interno.rede_org_mandatos m on m.id = e.eleito where e.id = $1`, [EL]),
    (x) => x.situacao === "apurada" && x.pessoa === P.v1);
}

// ═══════════════════ 7. A conferência de antes de rodar ═══════════════════
// Como estava antes desta migração: sem o "check" novo, com uma cédula c1 esperando.
await dono("alter table interno.rede_consulta_cifradas drop constraint rede_consulta_cifradas_v2");
await dono("insert into interno.rede_consulta_cifradas (consulta, cedula, resumo) values ($1, 'c1.velha', '\\x00')", [C_SEM]);
await recusa("com cédula do formato de antes esperando, a migração para", () => exec(sql), "formato de antes");
await dono("delete from interno.rede_consulta_cifradas where consulta = $1", [C_SEM]);
await espera("sem ela, a migração roda de novo e o formato novo volta a ser exigido pela tabela", () => exec(sql));
await recusa("a tabela recusa cédula fora do formato novo, mesmo pelo dono", () => dono("insert into interno.rede_consulta_cifradas (consulta, cedula, resumo) values ($1, 'c1.velha', sha256('x'))", [C_SEM]), "rede_consulta_cifradas_v2");
} catch (erro) {
  falhas.push(`o teste parou: ${erro.stack}`);
}

console.log(`r2-voto: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
