// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (15): a urna anônima (supabase/migracoes/20261125-r3-resto-r2.sql, lib/rede/voto/urna-anonima.ts,
// app/api/alumia/urna/depositar/route.ts), num Postgres local, com os passes de verdade (RSA cego, RFC 9578, lib/rede/passes/**, da
// frente do servidor do chat) e o tratador de verdade da rota. Prova:
//   - ANTES (a função da R2, com a sessão): a cédula e a linha de "já votou" da pessoa saem na MESMA transação (o mesmo xmin): quem
//     tem o banco liga a pessoa à cédula. É o ataque da auditoria da R2 (A10), rodado aqui contra o banco antes da migração;
//   - DEPOIS: o passe é pego com a sessão (a emissão marca "já pegou a cédula"), a cédula vai sem a sessão; pelo xmin e pela ordem das
//     transações, nenhuma cédula se liga a ninguém; as cédulas são regravadas juntas, em ordem sorteada;
//   - ATAQUES: pedido com sessão (cookie ou Bearer), passe de outra votação, passe geral, passe adulterado, passe repetido, votação
//     fechada, a função de serviço chamada por uma conta, e as funções com sessão que recebiam a cédula: todos recusados;
//   - o aparelho: espera sorteada quando o passe acabou de ser pego; o passe sai depois do depósito aceito; nada de Math.random.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-resto-urna.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
const sql = ler("supabase/migracoes/20261125-r3-resto-r2.sql");
const sqlPasses = ler("supabase/migracoes/20261125-r3-servidor-chat.sql");
/**
 * O trecho que a junção põe em 20261125-r3-fim.sql (a emissão do passe da urna é da frente do servidor do chat e roda DEPOIS desta
 * migração): quem pega o passe da urna fica como "já pegou a cédula", na mesma transação da marca. O mesmo texto vai no relatório.
 */
const TRECHO_DA_JUNCAO = `
create or replace function public.rede_passes_contexto_marcar(p_tipo text, p_alvo uuid, p_marca bytea) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.diretorio_eu(); n integer;
begin
  if octet_length(p_marca) is distinct from 32 or p_alvo is null then perform interno.erro('invalido:marca'); end if;
  if not interno.passes_contexto_permitido(p_tipo, p_alvo, v) then perform interno.erro('sem_permissao'); end if;
  insert into passes_emitidos_contexto (marca, dia) values (p_marca, interno.caixa_hoje()) on conflict (marca) do nothing;
  get diagnostics n = row_count;
  -- A urna anônima (20261125-r3-resto-r2.sql): quem pega o passe da urna fica como "já pegou a cédula", nesta mesma transação. A
  -- votação da equipe conta só pelo servidor do site (public.rede_urna_cedula_contar): a marca que vem da conta não pode mover o
  -- contador (o banco não confere o HMAC).
  if n = 1 and p_tipo <> 'equipe' then perform interno.voto_cedula_tomada(p_tipo, p_alvo, v); end if;
  return n = 1;
end $$;
create or replace function public.rede_urna_cedula_contar(p_tipo text, p_alvo uuid) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_tipo is distinct from 'equipe' or p_alvo is null then perform interno.erro('invalido:tipo'); end if;
  if coalesce(interno.voto_situacao('equipe', p_alvo), '') <> 'aberta' then perform interno.erro('encerrada'); end if;
  insert into votacao_cedulas_emitidas (votacao, n) values (p_alvo, 1) on conflict (votacao) do update set n = votacao_cedulas_emitidas.n + 1;
  return true;
end $$;
revoke all on function public.rede_urna_cedula_contar(text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.rede_urna_cedula_contar(text, uuid) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.rede_urna_cedula_contar(text, uuid) to service_role; end if;
end $$;
create or replace function interno.rede_passes_limpeza() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_semana integer := interno.passes_semana_hoje(); a integer; b integer; c integer; d integer;
begin
  update passes_chaves set privada_selada = null where octet_length(contexto) = 0 and semana < v_semana and privada_selada is not null;
  get diagnostics a = row_count;
  delete from passes_chaves where octet_length(contexto) = 0 and semana < v_semana - 3; get diagnostics b = row_count;
  delete from passes_emitidos_contexto where dia < interno.caixa_hoje() - 180; get diagnostics c = row_count;
  delete from urna_passes_gastos g where
    (not exists (select 1 from rede_consultas x where x.id = g.alvo)
     and not exists (select 1 from alumia_decisoes x where x.id = g.alvo)
     and not exists (select 1 from votacoes x where x.id = g.alvo))
    or (exists (select 1 from rede_consultas x where x.id = g.alvo) and interno.voto_situacao('consulta', g.alvo) is distinct from 'aberta')
    or (exists (select 1 from alumia_decisoes x where x.id = g.alvo) and interno.voto_situacao('decisao', g.alvo) is distinct from 'aberta')
    or (exists (select 1 from votacoes x where x.id = g.alvo) and interno.voto_situacao('equipe', g.alvo) is distinct from 'aberta');
  get diagnostics d = row_count;
  return jsonb_build_object('privadas', a, 'chaves', b, 'marcas', c, 'urnas', d);
end $$;
select interno.alumia_trancar();
`;

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
const sorteio = (n) => crypto.getRandomValues(new Uint8Array(n));
const B64U = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const cedulaFalsa = () => `v2.${Array.from(sorteio(2230), (x) => B64U[x & 63]).join("")}`;

// ═══════════════════ 0. Os arquivos ═══════════════════
ok("a migração tem a parte (15)", /\(15\) A urna anônima/.test(sql));
const rota = ler("app/api/alumia/urna/depositar/route.ts");
ok("a rota usa o tratador testado aqui e o passe com contexto", /tratarDeposito\(/.test(rota) && /contextoDaUrna/.test(rota) && /conferirPasse/.test(rota) && /rede_urna_depositar_anonimo/.test(rota));
const cliente = ler("lib/rede/voto/cliente.ts");
ok("o voto do aparelho deposita pela urna anônima (sem o caminho com sessão)", /depositar: async/.test(cliente) && !/votarNaEquipe/.test(cliente) && /credentials: "omit"/.test(cliente));
ok("a urna do aparelho não tem mais o caminho com sessão", !/rede_org_consulta_votar_cifrada|alumia_decisao_votar_cifrada/.test(ler("lib/rede/voto/urna.ts")));
ok("nada de Math.random no voto", !/Math\.random\(/.test(ler("lib/rede/voto/urna-anonima.ts") + cliente));

// ═══════════════════ 1. O banco de antes (R2) ═══════════════════
// Montado até antes desta migração (se ela já estiver colada no install.sql, depois da junção): o estado de antes é o da R2.
const banco = await criarBanco({ antesDe: sql }).catch(() => criarBanco());
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
const P = {};
const S = {};
for (const nome of ["org", "v0", "v1", "v2", "v3"]) {
  P[nome] = await criarUsuario(`${nome}@r3u.local`, `Pessoa ${nome}`);
  S[nome] = { sub: P[nome], sessao: crypto.randomUUID() };
  await rpc(S[nome], "eu").catch(() => undefined);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `r3u_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("select interno.alumia_entrada_ligar(true)");
for (const nome of Object.keys(P)) await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P[nome]]);
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('r3-urna', 'Urna R3', 'lutas', 'fechada') on conflict do nothing");
for (const nome of ["v0", "v1", "v2", "v3"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('r3-urna', $1, 'ativo')", [P[nome]]);
await dono("update interno.rede_comunidade_membros set entrou_em = now() - interval '60 days' where comunidade = 'r3-urna'").catch(() => undefined);
const novaDecisao = async (pergunta) => {
  const id = (await dono("insert into interno.alumia_decisoes (comunidade, pergunta, modo, quorum, prazo) values ('r3-urna', $1, 'secreta', 3, now() + interval '2 days') returning id", [pergunta])).rows[0].id;
  for (const [i, t] of ["Sim", "Não"].entries()) await dono("insert into interno.alumia_decisao_opcoes (decisao, ordem, texto) values ($1, $2, $3)", [id, i + 1, t]);
  // O registro da chave da votação (o conteúdo não importa aqui: ninguém abre; a urna só exige que exista).
  await dono(`insert into interno.rede_consulta_chaves (consulta, tipo, pk, n, k, guardias, guardias_chaves, partes, assinatura, criador, criada_por_identidade)
              values ($1, 'decisao', $2, 3, 2, $3, '[]'::jsonb, '[]'::jsonb, $4, $5, $6)`, [id, sorteio(1216), [P.v1, P.v2, P.v3], sorteio(64), P.org, sorteio(32)]);
  return id;
};
const D0 = await novaDecisao("A decisão de antes (R2)?");

/** Pela ordem das transações: as linhas (de qualquer tabela) com o mesmo xmin da cédula que trazem o id de alguém. */
async function ligadasPeloXmin(xmin) {
  const tabelas = (await dono("select n.nspname as e, c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('interno','public') and c.relkind = 'r'")).rows;
  const achados = [];
  for (const { e, t } of tabelas) {
    const linhas = (await dono(`select row_to_json(x)::text as j from ${e}."${t}" x where x.xmin::text = $1`, [xmin]).catch(() => ({ rows: [] }))).rows;
    for (const l of linhas) for (const [nome, id] of Object.entries(P)) if (l.j.includes(id)) achados.push(`${t}→${nome}`);
  }
  return achados;
}

{
  // ANTES: o voto da R2, com a sessão. A cédula e a linha de "já votou" na mesma transação.
  const c0 = cedulaFalsa();
  const r = await rpc(S.v0, "alumia_decisao_votar_cifrada", { p_id: D0, p_cedula: c0 }).catch((e) => ({ erro: e.message }));
  const xmin = (await dono("select xmin::text as x from interno.alumia_decisao_cifradas where decisao = $1 limit 1", [D0])).rows[0]?.x;
  const achados = xmin ? await ligadasPeloXmin(xmin) : [];
  ok("ANTES (R2): o voto com sessão entra, e o xmin da cédula liga a cédula à pessoa (o ataque A10 funciona)", r?.votei === true && achados.includes("alumia_decisao_votantes→v0"), JSON.stringify({ r, achados }));
}

// ═══════════════════ 2. A migração (e a dos passes, e o trecho da junção) ═══════════════════
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("a migração dos passes (frente do servidor do chat) por cima", () => exec(sqlPasses));
await espera("e o trecho da junção (a emissão do passe da urna marca quem pegou a cédula)", () => exec(TRECHO_DA_JUNCAO));
const fim = fs.existsSync(path.join(raiz, "supabase/migracoes/20261125-r3-fim.sql")) ? ler("supabase/migracoes/20261125-r3-fim.sql") : null;
ok("se a junção já escreveu o 20261125-r3-fim.sql, ele chama interno.voto_cedula_tomada na emissão", fim === null || /voto_cedula_tomada\(p_tipo, p_alvo, v\)/.test(fim));
ok("e a emissão NÃO move o contador da equipe (só o servidor do site, por rede_urna_cedula_contar)", fim === null || (/p_tipo <> 'equipe' then perform interno\.voto_cedula_tomada/.test(fim) && fim.includes("rede_urna_cedula_contar")));
ok("esta migração gasta o passe da urna na tabela durável, não na das caixas", sql.includes("interno.urna_passe_gastar(p_passe_resumo, p_alvo)") && sql.includes("create table if not exists interno.urna_passes_gastos"));

const privs = (await dono(`select has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut,
  has_function_privilege('service_role', p.oid, 'execute') as serv from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rede_urna_depositar_anonimo'`)).rows[0];
ok("o depósito anônimo: só o serviço chama", privs && !privs.anon && !privs.aut && privs.serv, JSON.stringify(privs));
ok("a peça de dentro (já pegou a cédula) não é de ninguém", (await dono(`select bool_and(not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) as ok from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname = 'voto_cedula_tomada'`)).rows[0].ok === true);
const D = await novaDecisao("A decisão da onda R3?");
await recusa("uma conta não chama o depósito anônimo", () => rpc(S.v1, "rede_urna_depositar_anonimo", { p_tipo: "decisao", p_alvo: D, p_cedula: cedulaFalsa(), p_passe_resumo: sorteio(32) }), "permission denied");
await recusa("DEPOIS: a função com sessão não recebe mais a cédula (comunidade)", () => rpc(S.v1, "alumia_decisao_votar_cifrada", { p_id: D, p_cedula: cedulaFalsa() }), "voto_anonimo");
await recusa("nem a da consulta", () => rpc(S.v1, "rede_org_consulta_votar_cifrada", { p_consulta: D, p_cedula: cedulaFalsa() }), "voto_anonimo");
await recusa("nem a da equipe (pelo servidor do site)", () => rpc(servidor, "alumia_voto_equipe_cifrada", { p_usuario: P.v1, p_votacao: D, p_cedula: cedulaFalsa(), p_marca: "0".repeat(64) }), "voto_anonimo");

// ═══════════════════ 3. Os passes da urna (RSA cego) e a rota ═══════════════════
const Pc = await import("../lib/rede/passes/comum.ts");
const Ps = await import("../lib/rede/passes/servidor.ts");
const { publicVerif, genericBatched } = await import("@cloudflare/privacypass-ts");
const SEGREDO = "segredo-dos-passes-do-teste-da-urna-com-32-letras"; // gitleaks:allow (valor de teste)
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
const cabecalho = (passe) => Pc.cabecalhoDoPasse(Buffer.from(passe.serialize()).toString("base64url"));
/** O que a rota de emissão faz (app/api/alumia/passes/emitir), COM a sessão: a marca da conta e UM passe cego da urna. */
async function pegarPasse(quem, tipo, alvo) {
  const ctx = Pc.contextoDaUrna(tipo, alvo);
  const marcou = await rpc(S[quem], "rede_passes_contexto_marcar", { p_tipo: tipo, p_alvo: alvo, p_marca: Ps.marcaDoContexto(P[quem], ctx, SEGREDO) });
  if (marcou !== true) throw new Error("ja_pegou");
  const chave = await Ps.chaveDoEmissor(0, ctx, bancoDasChaves, SEGREDO, true);
  const cl = new publicVerif.Client(Pc.MODO);
  const req = await cl.createTokenRequest(Pc.desafio(ctx), chave.publica);
  return cl.finalize(publicVerif.TokenResponse.deserialize(await Ps.emitirUm(req.serialize(), chave)));
}
const Rota = await import("../lib/rede/caixas/rota.ts");
const { paraBytea } = await import("../lib/rede/caixas/base.ts");
const { tratarDeposito, criarUrnaAnonima, ESPERA_MINIMA_MS, ESPERA_SORTEADA } = await import("../lib/rede/voto/urna-anonima.ts");
const tratar = tratarDeposito({
  trazSessao: Rota.trazSessao,
  lerCorpo: Rota.lerCorpo,
  responder: Rota.responder,
  contextoDaUrna: Pc.contextoDaUrna,
  conferirPasse: (c, o) => Ps.conferirPasse(c, { ...o, banco: bancoDasChaves }),
  paraBytea,
  depositar: async (args) => {
    try {
      // O PostgREST converte o texto "\x…" em bytea; o Postgres local quer os bytes.
      await rpc(servidor, "rede_urna_depositar_anonimo", { ...args, p_passe_resumo: new Uint8Array(Buffer.from(args.p_passe_resumo.slice(2), "hex")) });
      return { ok: true };
    } catch (e) {
      const m = /([a-z_]+(:[a-z_]+)?)/.exec(String(e.message))?.[1] ?? "banco";
      return { ok: false, status: 400, codigo: String(e.message).match(/passe_usado|encerrada|sem_chave|invalido:cedula|cedula_repetida|invalido:tipo/)?.[0] ?? m };
    }
  },
});
const post = async (corpo, cabecalhos = {}) => {
  const r = await tratar(new Request("https://alumia.invalid/api/alumia/urna/depositar", { method: "POST", headers: { "Content-Type": "application/json", ...cabecalhos }, body: JSON.stringify(corpo) }));
  return { status: r.status, corpo: await r.json() };
};

const passes = {};
for (const quem of ["v1", "v2", "v3"]) passes[quem] = await espera(`${quem} pega o passe da urna (com a sessão)`, () => pegarPasse(quem, "decisao", D), (p) => !!p);
await recusa("a mesma conta não pega um segundo passe da mesma votação", () => pegarPasse("v1", "decisao", D), "ja_pegou");
ok("a emissão marcou quem pegou a cédula (as três contas, como o 'já votou' de sempre)", (await dono("select count(*)::int as n from interno.alumia_decisao_votantes where decisao = $1", [D])).rows[0].n === 3);
const xminsDaEmissao = new Set((await dono("select xmin::text as x from interno.alumia_decisao_votantes where decisao = $1", [D])).rows.map((r) => r.x));

// Os ataques à rota.
const pc = (quem) => ({ Authorization: cabecalho(passes[quem]) });
await espera("ATAQUE pedido com o cookie da sessão: recusado sem olhar o resto", () => post({ tipo: "decisao", alvo: D, cedula: cedulaFalsa() }, { ...pc("v1"), Cookie: "sb-abc-auth-token=x" }), (r) => r.status === 400 && r.corpo.erro === "sem_sessao_aqui");
await espera("ATAQUE pedido com Bearer (a sessão) no lugar do passe: recusado", () => post({ tipo: "decisao", alvo: D, cedula: cedulaFalsa() }, { Authorization: "Bearer abc" }), (r) => r.status === 400 && r.corpo.erro === "sem_sessao_aqui");
await espera("ATAQUE sem passe: recusado", () => post({ tipo: "decisao", alvo: D, cedula: cedulaFalsa() }), (r) => r.status === 401);
const Doutra = await novaDecisao("Outra decisão?");
await espera("ATAQUE passe desta votação usado em outra: recusado", () => post({ tipo: "decisao", alvo: Doutra, cedula: cedulaFalsa() }, pc("v1")), (r) => r.status === 401 && r.corpo.erro === "passe");
await espera("ATAQUE o mesmo alvo com outro tipo (outro contexto): recusado", () => post({ tipo: "consulta", alvo: D, cedula: cedulaFalsa() }, pc("v1")), (r) => r.status === 401);
{
  const torto = new Uint8Array(passes.v1.serialize());
  torto[torto.length - 1] ^= 1;
  await espera("ATAQUE passe adulterado: recusado", () => post({ tipo: "decisao", alvo: D, cedula: cedulaFalsa() }, { Authorization: Pc.cabecalhoDoPasse(Buffer.from(torto).toString("base64url")) }), (r) => r.status === 401);
}
{
  // Um passe GERAL (sem contexto), de verdade: não vale na urna.
  const semana = (await dono("select interno.passes_semana_hoje() as s")).rows[0].s;
  const chave = await Ps.chaveDoEmissor(semana, new Uint8Array(0), bancoDasChaves, SEGREDO, true);
  const clientes = Array.from({ length: Pc.PASSES_POR_DIA }, () => new publicVerif.Client(Pc.MODO));
  const pedidos = [];
  for (const cl of clientes) pedidos.push(new genericBatched.TokenRequest(await cl.createTokenRequest(Pc.desafio(), chave.publica)));
  const bytes = new genericBatched.Client().createTokenRequest(pedidos).serialize();
  const respostas = new genericBatched.Client().deserializeTokenResponse(await Ps.emitirLote(bytes, chave));
  const geral = await clientes[0].finalize(respostas.tokenResponses[0].tokenResponse);
  await espera("ATAQUE passe geral (de outra finalidade) na urna: recusado", () => post({ tipo: "decisao", alvo: D, cedula: cedulaFalsa() }, { Authorization: cabecalho(geral) }), (r) => r.status === 401);
}
await espera("cédula fora do formato: recusada antes do passe", () => post({ tipo: "decisao", alvo: D, cedula: "v2.curta" }, pc("v1")), (r) => r.status === 400 && r.corpo.erro === "invalido");

// Os depósitos de verdade, em ordem trocada (v2, v1, v3).
for (const quem of ["v2", "v1", "v3"]) await espera(`${quem} deposita sem sessão, só com o passe`, () => post({ tipo: "decisao", alvo: D, cedula: cedulaFalsa() }, pc(quem)), (r) => r.status === 200 && r.corpo.ok === true);
await espera("ATAQUE o mesmo passe de novo: recusado (gasto)", () => post({ tipo: "decisao", alvo: D, cedula: cedulaFalsa() }, pc("v1")), (r) => r.status === 409 && r.corpo.erro === "passe_usado");
ok("três cédulas na urna, sem coluna de conta", (await dono("select count(*)::int as n from interno.alumia_decisao_cifradas where decisao = $1", [D])).rows[0].n === 3
  && !(await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'alumia_decisao_cifradas'")).rows.some((c) => /usuario|conta|autor|quem|criad|_em$/.test(c.column_name)));

// Pelo xmin e pela ordem das transações.
{
  const xmins = (await dono("select xmin::text as x from interno.alumia_decisao_cifradas where decisao = $1", [D])).rows.map((r) => r.x);
  ok("as três cédulas têm o MESMO xmin (regravadas juntas no último depósito): a ordem de chegada não aparece", new Set(xmins).size === 1, JSON.stringify(xmins));
  ok("nenhuma cédula tem o xmin de uma emissão (pegar o passe e depositar são transações diferentes)", xmins.every((x) => !xminsDaEmissao.has(x)));
  const achados = [];
  for (const x of new Set(xmins)) achados.push(...(await ligadasPeloXmin(x)));
  ok("DEPOIS: pelo xmin da cédula, nenhuma linha de nenhuma tabela traz o id de alguém", achados.length === 0, achados.join(" | "));
  const gastos = (await dono("select xmin::text as x from interno.urna_passes_gastos")).rows.map((r) => r.x);
  ok("o passe gasto fica na tabela durável da urna, no mesmo lote da cédula, sem conta", gastos.some((x) => xmins.includes(x)) && !(await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'urna_passes_gastos'")).rows.some((c) => /usuario|conta|quem/.test(c.column_name)));
  ok("e NÃO na tabela das caixas (que o expurgo de 14 dias alcançaria)", (await dono("select count(*)::int as n from interno.passes_gastos where resumo in (select resumo from interno.urna_passes_gastos)")).rows[0].n === 0);
}
// O passe gasto da urna fica guardado enquanto a votação está aberta (o passe vale 2 semanas e a votação, até 60 dias) e sai quando ela fecha.
{
  ok("os passes gastos da urna estão guardados (3 depósitos)", (await dono("select count(*)::int as n from interno.urna_passes_gastos where alvo = $1", [D])).rows[0].n === 3);
  await dono("select interno.rede_passes_limpeza()");
  ok("a limpeza NÃO tira o passe gasto com a votação aberta (sem o resumo, o mesmo passe depositava de novo)", (await dono("select count(*)::int as n from interno.urna_passes_gastos where alvo = $1", [D])).rows[0].n === 3);
  await dono("update interno.alumia_decisoes set criada_em = now() - interval '2 days', prazo = now() - interval '1 minute' where id = $1", [D]);
  await dono("select interno.rede_passes_limpeza()");
  ok("fechada a votação, a limpeza tira os passes gastos dela", (await dono("select count(*)::int as n from interno.urna_passes_gastos where alvo = $1", [D])).rows[0].n === 0);
}
await dono("update interno.alumia_decisoes set criada_em = now() - interval '2 days', prazo = now() - interval '1 minute' where id = $1", [Doutra]);
{
  const p = await pegarPasse("v2", "decisao", Doutra).catch((e) => e.message);
  ok("votação fechada: a conta nem pega o passe", p === "sem_permissao" || /sem_permissao/.test(String(p)), String(p));
}

// A equipe: o banco conta as cédulas entregues sem a pessoa.
{
  const V = (await dono("insert into interno.votacoes (titulo, opcoes, secreta, encerra_em) values ('Votação da equipe R3', array['A','B'], true, now() + interval '1 day') returning id").catch(() => ({ rows: [] }))).rows[0]?.id;
  if (V) {
    // ATAQUE contido: a marca que a conta manda NÃO move mais o contador (o banco não confere o HMAC); só o servidor do site conta.
    await rpc(S.v1, "rede_passes_contexto_marcar", { p_tipo: "equipe", p_alvo: V, p_marca: sorteio(32) }).catch(() => null);
    ok("a marca que a conta manda NÃO move o contador da urna da equipe", (await dono("select count(*)::int as n from interno.votacao_cedulas_emitidas where votacao = $1", [V])).rows[0].n === 0);
    await recusa("uma conta não conta a cédula da urna", () => rpc(S.v1, "rede_urna_cedula_contar", { p_tipo: "equipe", p_alvo: V }), "permission denied");
    await espera("o servidor do site conta a cédula entregue", () => rpc(servidor, "rede_urna_cedula_contar", { p_tipo: "equipe", p_alvo: V }), (r) => r === true);
    await espera("e a segunda", () => rpc(servidor, "rede_urna_cedula_contar", { p_tipo: "equipe", p_alvo: V }), (r) => r === true);
    const linha = (await dono("select row_to_json(x)::text as j from interno.votacao_cedulas_emitidas x where votacao = $1", [V])).rows[0]?.j ?? "";
    ok("equipe: o contador de cédulas entregues sobe, sem a pessoa", /"n":2/.test(linha) && !linha.includes(P.v1) && !linha.includes(P.v2), linha);
  } else {
    ok("equipe: a tabela de votações aceitou a votação de teste", false, "não deu para criar a votação da equipe no banco local");
  }
  ok("a abridora compara as cédulas com as entregues (o contador entra na conta da equipe)", /votacao_cedulas_emitidas where votacao = r\.consulta/.test(sql));
}

// ═══════════════════ 4. O aparelho ═══════════════════
{
  const relogio = { t: 1_000_000 };
  const esperas = [];
  const guardados = new Map();
  const pegos = new Map();
  const enviados = [];
  const u = criarUrnaAnonima({
    carregar: async () => undefined,
    pegarPasse: async (tipo, alvo) => void guardados.set(`${tipo}:${alvo}`, "PrivateToken token=\"x\""),
    passe: (tipo, alvo) => guardados.get(`${tipo}:${alvo}`) ?? null,
    esquecerPasse: (tipo, alvo) => void guardados.delete(`${tipo}:${alvo}`),
    postarSemSessao: async (caminho, corpo, passe) => {
      enviados.push({ caminho, corpo, passe });
      return { status: 200, corpo: { ok: true } };
    },
    pegoEm: (tipo, alvo) => pegos.get(`${tipo}:${alvo}`) ?? null,
    marcarPego: (tipo, alvo, em) => void pegos.set(`${tipo}:${alvo}`, em),
    esperar: async (ms) => void esperas.push(ms),
    sortear: (m) => m - 1,
    agora: () => relogio.t,
  });
  await u.depositar("decisao", D, "v2.x");
  ok("sem passe guardado: pega agora e ESPERA um tempo sorteado antes de depositar", esperas.length === 1 && esperas[0] >= ESPERA_SORTEADA.de && esperas[0] < ESPERA_SORTEADA.ate && enviados.length === 1);
  ok("o depósito vai à rota anônima com o passe e sem a sessão, e o passe sai do aparelho", enviados[0].caminho === "/api/alumia/urna/depositar" && enviados[0].passe.startsWith("PrivateToken") && !guardados.size);
  await u.prepararCedula("decisao", Doutra);
  relogio.t += ESPERA_MINIMA_MS + 1;
  await u.depositar("decisao", Doutra, "v2.y");
  ok("com o passe pego cedo (ao abrir a votação), deposita sem esperar", esperas.length === 1 && enviados.length === 2);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
