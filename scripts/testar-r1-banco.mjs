// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o reforço do banco (supabase/migracoes/20261123-r1-banco.sql) num Postgres local (scripts/banco-local.mjs), com a migração
// rodada DUAS vezes sobre o install.sql e as tabelas do serviço de contas criadas como no serviço real:
//   A1.1 a porta nega em toda falha: sem leitura de auth.sessions, TODA função pública da Alumia (rede_*, alumia_*) que uma conta
//        aprovada e com segundo fator chama recusa com "alumia_entrada", antes de qualquer outra coisa; o ramo do "próprio banco"
//        não abre para a conexão da API; e o painel da equipe (interno.eu) também para.
//   A1.2 o pgcrypto só no esquema extensions (como no Supabase): nenhuma função chama crypt, gen_salt, hmac, digest ou
//        gen_random_bytes sem o esquema, e bcrypt, HMAC e convites funcionam com o search_path sem "extensions".
//   A1.3 o gancho da senha no contrato do Supabase, só para o serviço de contas, que conta as próprias falhas; as políticas do Storage.
//   A1.4 a caixa de críticas sem sal no banco e a rotina de limpeza das urnas.
//   B3   todas as permissões de anon e authenticated (nenhuma tabela, nenhum esquema a mais), search_path fixo, SQL dinâmico,
//        números de pessoas só a partir de 3.
// A falta de permissão é simulada como o Postgres a dá (erro 42501). Com R1_SEM_MIGRACAO=1, roda sobre o install.sql cortado antes da
// migração (criarBanco com antesDe): mostra o que falhava.
// Uso: node scripts/testar-r1-banco.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const MIGRACAO = "supabase/migracoes/20261123-r1-banco.sql";
const sql = ler(MIGRACAO);
const semMigracao = process.env.R1_SEM_MIGRACAO === "1";

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
ok("a migração tem cabeçalho com a função e a lei", /Reforço 1 · Banco/.test(sql) && /Leis: LGPD/.test(sql));
ok("a migração termina com a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("a migração não tem endereço de rede, porta nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(sql));
ok("nenhuma função da migração recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));

// ═══════════════════ 1. O banco ═══════════════════
// Sem a migração: o install.sql só até antes dela (ela já está colada no fim dele), para mostrar o que falhava antes do conserto.
const banco = await criarBanco(semMigracao ? { antesDe: sql } : {});
const { dono, criarUsuario } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const agora = () => Math.floor(Date.now() / 1000);
/** Chama uma função como a API faria: o token com a conta, a sessão, "iat" e "exp". */
const rpc = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const nomes = Object.keys(argumentos);
    const claims = JSON.stringify({
      role: quem.papel ?? "authenticated", ...(quem.sub ? { sub: quem.sub } : {}), aal: quem.aal ?? "aal2",
      ...(quem.sessao ? { session_id: quem.sessao } : {}), iat: quem.iat ?? agora() - 30, exp: quem.exp ?? agora() + 3600,
    });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [claims]);
    await banco.pg.exec(`set role ${quem.papel === "anon" ? "anon" : quem.papel === "service_role" ? "service_role" : "authenticated"}`);
    try {
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, nomes.map((n) => argumentos[n]))).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
/** Chama uma função pública com todos os argumentos nulos (o tipo de cada um vem do catálogo). */
const rpcNulos = (quem, oid) =>
  banco.exclusivo(async () => {
    const f = (await banco.pg.query("select p.proname, array(select format_type(t, null) from unnest(p.proargtypes) t) as tipos from pg_proc p where p.oid = $1", [oid])).rows[0];
    const claims = JSON.stringify({ role: "authenticated", sub: quem.sub, aal: "aal2", session_id: quem.sessao, iat: agora() - 30, exp: agora() + 3600 });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [claims]);
    await banco.pg.exec("set role authenticated");
    try {
      const args = f.tipos.map((t) => `null::${t}`).join(", ");
      const ehConjunto = (await banco.pg.query("select proretset from pg_proc where oid = $1", [oid])).rows[0].proretset;
      return (await banco.pg.query(ehConjunto ? `select * from public.${f.proname}(${args}) limit 1` : `select public.${f.proname}(${args}) as r`)).rows[0] ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });

// O serviço de contas como no Supabase (as colunas que o banco usa) e o papel dele, antes da migração (as permissões do gancho).
await exec(`
  create role supabase_auth_admin nologin;
  create table auth.sessions (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, created_at timestamptz default now(), updated_at timestamptz default now(),
    factor_id uuid, aal text, not_after timestamptz, refreshed_at timestamp, user_agent text, ip inet, tag text);
  create table auth.refresh_tokens (
    id bigserial primary key, token varchar(255), user_id varchar(255), revoked boolean default false, created_at timestamptz default now(),
    session_id uuid references auth.sessions (id) on delete cascade);
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null, factor_type text default 'totp', created_at timestamptz default now());
`);

// ═══════════════════ A1.2. O pgcrypto só em extensions ═══════════════════
ok("o pgcrypto está só no esquema extensions", (await dono("select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto'")).rows[0]?.nspname === "extensions");
ok("nenhuma função crypt/hmac/gen_salt fora de extensions", (await dono(`
  select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.proname in ('crypt', 'gen_salt', 'hmac', 'digest', 'gen_random_bytes', 'pgp_sym_encrypt') and n.nspname <> 'extensions'`)).rows[0].n === 0);
ok("o caminho de busca da sessão não tem extensions (como as funções com search_path fixo)", !/extensions/.test((await dono("show search_path")).rows[0].search_path));

if (!semMigracao) {
  await espera("a migração instala sobre o install.sql", () => exec(sql));
  await espera("de novo (idempotente)", () => exec(sql));
}
await espera("a porta tranca tudo (nenhuma função aberta)", () => dono("select interno.alumia_trancar() as r"), (r) => (r.rows[0].r.abertas ?? []).length === 0);

const PGCRYPTO = /(^|[^.\w%"])(crypt|gen_salt|hmac|digest|gen_random_bytes|pgp_[a-z_]+|armor|dearmor|encrypt|decrypt)\s*\(/;
const semEsquema = (await dono(`select p.oid::regprocedure::text as f, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno')`))
  .rows.filter((x) => PGCRYPTO.test(x.prosrc.replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''"))).map((x) => x.f);
ok(`nenhuma função chama o pgcrypto sem o esquema (achadas: ${semEsquema.join(", ")})`, semEsquema.length === 0);
const comExtensions = (await dono(`
  select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'interno') and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%extensions%')`)).rows.map((x) => x.f);
ok(`nenhuma função depende de "extensions" no search_path (achadas: ${comExtensions.join(", ")})`, comExtensions.length === 0);
await exec("set search_path = public, pg_temp");
await espera("bcrypt dos códigos de recuperação funciona com o search_path sem extensions", () => dono("select interno.codigo_confere('ABCDE-12345', interno.codigo_bf('ABCDE-12345')) as a, interno.codigo_confere('ABCDE-12346', interno.codigo_bf('ABCDE-12345')) as b"),
  (r) => r.rows[0].a === true && r.rows[0].b === false);
await dono("insert into interno.rede_fed_apelido_segredo (valor) select repeat('s', 64) where not exists (select 1 from interno.rede_fed_apelido_segredo)").catch(() => undefined);
await espera("o HMAC do apelido de fora funciona sem extensions no caminho", () => dono("select interno.rede_fed_apelido_ator('https://exemplo.test/u/x') as h"), (r) => /^[a-z]+:[0-9a-f]{64}$/.test(r.rows[0].h));
await exec("reset search_path");

// ═══════════════════ A1.1. A porta nega em toda falha ═══════════════════
const P = {};
for (const nome of ["ana", "bia", "coord"]) {
  P[nome] = await criarUsuario(`${nome}@r1.local`, `Pessoa ${nome}`);
  await rpc({ sub: P[nome] }, "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia", "coord"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `r1_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [P.coord]);
await espera("a entrada liga (sem função aberta)", () => dono("select interno.alumia_entrada_ligar(true) as r"), (r) => r.rows[0].r.exigir === true);
await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada'), ($2, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P.ana, P.bia]);
const sessao = async (u) => (await dono("insert into auth.sessions (user_id, aal) values ($1, 'aal2') returning id", [u])).rows[0].id;
const sAna = await sessao(P.ana), sCoord = await sessao(P.coord);
const ana = { sub: P.ana, sessao: sAna };

await espera("com a sessão lida e viva, a conta aprovada passa", () => rpc(ana, "alumia_conta_situacao"), (r) => r !== null);
await recusa("sem segundo fator, não passa", () => rpc({ ...ana, aal: "aal1" }, "alumia_conta_situacao"), "alumia_entrada");
await recusa("sessão que o serviço de contas não tem mais, não passa", () => rpc({ sub: P.ana, sessao: "aaaaaaaa-0000-4000-8000-00000000000a" }, "alumia_conta_situacao"), "alumia_entrada");
await recusa("token sem a sessão, depois de um corte de todas, não passa", async () => {
  await dono("insert into interno.alumia_sessoes_cortadas (usuario, ate) values ($1, now() + interval '1 hour')", [P.bia]);
  try { return await rpc({ sub: P.bia, iat: agora() - 3600 }, "alumia_conta_situacao"); } finally { await dono("delete from interno.alumia_sessoes_cortadas where usuario = $1", [P.bia]); }
}, "alumia_entrada");
await recusa("token vencido não passa", () => rpc({ ...ana, exp: agora() - 5 }, "alumia_conta_situacao"), "alumia_entrada");
await espera("o painel da equipe (interno.eu) passa com a sessão viva", () => rpc({ sub: P.coord, sessao: sCoord }, "ferias_ver"), (r) => r !== null);
await recusa("e para com a sessão que não existe mais", () => rpc({ sub: P.coord, sessao: "aaaaaaaa-0000-4000-8000-00000000000b" }, "ferias_ver"), "entre_primeiro");

// Sem leitura de auth.sessions (o projeto não deixa): a tabela vira uma vista que dá o erro de permissão do Postgres.
await exec(`
  alter table auth.sessions rename to sessions_real;
  create function auth.sessoes_negadas() returns setof auth.sessions_real language plpgsql as $$
    begin raise exception 'permission denied for table sessions' using errcode = '42501'; end $$;
  create view auth.sessions as select * from auth.sessoes_negadas();
`);
ok("o banco sabe que não lê as sessões", (await dono("select interno.alumia_sessoes_legiveis() as l")).rows[0].l === false);
await recusa("sem leitura das sessões, a conta aprovada com segundo fator NÃO passa", () => rpc(ana, "alumia_conta_situacao"), "alumia_entrada");
await recusa("nem o painel da equipe", () => rpc({ sub: P.coord, sessao: sCoord }, "ferias_ver"), "entre_primeiro");

const publicas = (await dono(`
  select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosrc ~ '^\\s*select interno\\.alumia_passa\\(\\) and ' as regra from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')
    and has_function_privilege('authenticated', p.oid, 'execute')
    and not interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))
  order by p.proname`)).rows;
ok(`a varredura achou as funções da Alumia (${publicas.length})`, publicas.length > 600);
const passaram = [];
const outroErro = [];
for (const f of publicas) {
  try {
    const r = await rpcNulos(ana, f.oid);
    // As regras dos depósitos do Storage não podem dar erro: negam devolvendo falso, com a porta na frente.
    if (!(f.regra && r?.r === false)) passaram.push(`${f.proname}(${f.args})`);
  } catch (erro) {
    if (!String(erro.message).includes("alumia_entrada")) outroErro.push(`${f.proname}: ${String(erro.message).slice(0, 80)}`);
  }
}
ok(`sem leitura das sessões, NENHUMA função da Alumia responde (responderam ${passaram.length}: ${passaram.slice(0, 15).join(", ")})`, passaram.length === 0);
ok(`e todas recusam pela porta, antes de olhar o pedido (outro erro em ${outroErro.length}: ${outroErro.slice(0, 15).join(" | ")})`, outroErro.length === 0);
await exec(`drop view auth.sessions; drop function auth.sessoes_negadas(); alter table auth.sessions_real rename to sessions;`);
await espera("com a leitura de volta, passa de novo", () => rpc(ana, "alumia_conta_situacao"), (r) => r !== null);

// ═══════════════════ A1.3. O gancho da senha e o Storage ═══════════════════
const gancho = (await dono(`select pg_get_function_identity_arguments(p.oid) as args, format_type(p.prorettype, null) as volta,
    has_function_privilege('supabase_auth_admin', p.oid, 'execute') as servico_de_contas, has_function_privilege('anon', p.oid, 'execute') as anon,
    has_function_privilege('authenticated', p.oid, 'execute') as autenticado, has_function_privilege('service_role', p.oid, 'execute') as chave
  from pg_proc p where p.oid = 'public.alumia_porta_gancho_senha(jsonb)'::regprocedure`)).rows[0];
ok("o gancho tem a assinatura do contrato do Supabase (event jsonb) → jsonb", gancho.args === "event jsonb" && gancho.volta === "jsonb");
ok("só o serviço de contas chama o gancho", gancho.servico_de_contas && !gancho.anon && !gancho.autenticado && !gancho.chave);
const chamarGancho = (evento) => banco.exclusivo(async () => {
  await banco.pg.exec("set role supabase_auth_admin");
  try {
    return (await banco.pg.query("select public.alumia_porta_gancho_senha($1::jsonb) as r", [JSON.stringify(evento)])).rows[0].r;
  } finally {
    await banco.pg.exec("reset role");
  }
});
await espera("senha certa: continue", () => chamarGancho({ user_id: P.bia, valid: true }), (r) => r.decision === "continue");
let ultima;
for (let i = 0; i < 12; i++) ultima = await chamarGancho({ user_id: P.bia, valid: false }).catch((e) => ({ erro: e.message }));
ok(`depois de muitas erradas: reject, com mensagem e sem derrubar a sessão (${JSON.stringify(ultima)})`, ultima?.decision === "reject" && typeof ultima.message === "string" && ultima.should_logout_user === false);
const falhasAntes = Number((await dono("select coalesce((valor ->> 'n')::int, 0) as n from interno.configuracoes where chave = 'gancho_senha_falhas'")).rows[0]?.n ?? 0);
await espera("erro dentro do gancho não derruba a entrada (continue)", () => chamarGancho({ user_id: "isto-nao-e-uuid", valid: false }), (r) => r.decision === "continue");
const falhasDepois = Number((await dono("select coalesce((valor ->> 'n')::int, 0) as n from interno.configuracoes where chave = 'gancho_senha_falhas'")).rows[0]?.n ?? 0);
ok("e a falha fica contada para a Saúde (sem a pessoa)", falhasDepois === falhasAntes + 1);
await espera("a Saúde do reforço, para a coordenação", () => rpc({ sub: P.coord, sessao: sCoord }, "alumia_painel_r1_banco"),
  (r) => r.sessoes_legiveis === true && r.sessoes_apagaveis === true && r.gancho_falhas >= 1);
await recusa("e só para quem administra o painel", () => rpc(ana, "alumia_painel_r1_banco"), "sem_permissao");

// O pânico com o banco sem poder apagar as sessões: não quebra, e o token já emitido para na porta.
await exec(`
  create function auth.negar() returns trigger language plpgsql as $$ begin raise exception 'permission denied for table %', tg_table_name using errcode = '42501'; end $$;
  create trigger negar before delete on auth.sessions for each statement execute function auth.negar();
  create trigger negar before delete on auth.refresh_tokens for each statement execute function auth.negar();
`);
const sBia = await sessao(P.bia), sBia2 = await sessao(P.bia);
await espera("o pânico sem permissão de apagar não quebra", () => rpc({ sub: P.bia, sessao: sBia }, "alumia_conta_panico", { p_esconder: false }), (r) => r.ok === true);
await recusa("o outro aparelho para na porta", () => rpc({ sub: P.bia, sessao: sBia2 }, "alumia_conta_situacao"), "alumia_entrada");
await recusa("e no painel da equipe também (antes, interno.eu não olhava o corte)", () => rpc({ sub: P.bia, sessao: sBia2 }, "ferias_ver"), "entre_primeiro");
await exec("drop trigger negar on auth.sessions; drop trigger negar on auth.refresh_tokens;");

// As políticas do Storage (leitura do install.sql: o banco local não tem o esquema storage).
const install = ler("supabase/install.sql");
const politicas = [...install.matchAll(/create policy "([^"]+)" on storage\.objects for (\w+) to ([a-z, ]+?) (using|with check) \((.*?)\)';/g)];
ok(`as políticas do Storage foram achadas (${politicas.length})`, politicas.length >= 10);
ok("toda política do Storage amarra o depósito (bucket_id)", politicas.every((m) => /bucket_id = ''[a-z-]+''/.test(m[5])));
ok("nenhuma política do Storage libera tudo (true) nem escreve para anon", politicas.every((m) => !/^\s*true\s*$/.test(m[5]) && !(m[2] !== "select" && /anon/.test(m[3]))));

// ═══════════════════ A1.4. A caixa de críticas e as urnas ═══════════════════
await dono("insert into interno.papeis (usuario, papel) values ($1, 'educacao') on conflict do nothing", [P.bia]);
const sBia3 = await sessao(P.bia);
await dono("delete from interno.alumia_sessoes_cortadas where usuario = $1", [P.bia]);
await recusa("a crítica direta pelo banco não vale mais (vai pelo servidor)", () => rpc({ sub: P.bia, sessao: sBia3 }, "critica_enviar", { p_texto: "Uma crítica de teste sobre a reunião.", p_para: "geral" }), "pelo_servidor");
await recusa("a função do servidor não é da pessoa", () => rpc({ sub: P.bia, sessao: sBia3 }, "alumia_cuidado_critica", { p_texto: "Uma crítica de teste sobre a reunião.", p_para: "geral" }), "permission denied");
await espera("o servidor confere a pessoa (é da equipe)", () => rpc({ papel: "service_role" }, "alumia_cuidado_pode_criticar", { p_usuario: P.bia }), (r) => r === true);
await espera("quem não é da equipe não manda", () => rpc({ papel: "service_role" }, "alumia_cuidado_pode_criticar", { p_usuario: P.ana }), (r) => r === false);
await espera("o servidor grava só o texto e o destino", () => rpc({ papel: "service_role" }, "alumia_cuidado_critica", { p_texto: "Uma crítica de teste sobre a reunião.", p_para: "geral" }), (r) => r.ok === true);
await recusa("texto curto não entra", () => rpc({ papel: "service_role" }, "alumia_cuidado_critica", { p_texto: "curta", p_para: "geral" }), "invalido");
ok("a tabela da crítica não tem pessoa, marca nem hora", (await dono("select array_agg(column_name::text order by column_name) as c from information_schema.columns where table_schema = 'interno' and table_name = 'criticas'")).rows[0].c.join(",") === "dia,id,lida,para,texto");
ok("não sobra cota guardada nem sal da marca no banco", (await dono("select (select count(*) from interno.criticas_cotas)::int as c, (select count(*) from interno.configuracoes where chave = 'cuidado_sal')::int as s")).rows.every((r) => r.c === 0 && r.s === 0));
ok("as funções da marca com o sal saíram", (await dono("select to_regprocedure('interno.cuidado_marca(uuid, date)') is null and to_regprocedure('interno.votacao_marca(uuid, uuid)') is null as saiu")).rows[0].saiu === true);
ok("nenhuma função do banco lê mais o sal", (await dono("select count(*)::int as n from pg_proc where prosrc like '%cuidado_sal%'")).rows[0].n === 0);
const rota = ler("app/api/alumia/voto/marca/route.ts");
ok("a rota do servidor manda a crítica em duas chamadas, a que grava sem a pessoa (pela fila, em lote)", /"alumia_cuidado_pode_criticar", \{ p_usuario: conta \}/.test(rota) && /"alumia_cuidado_critica", \{ p_texto: c\.texto, p_para: c\.para \}/.test(rota) && /criarCotaDaCritica\(3\)/.test(rota) && /filaDaCritica\.por\(\{ texto: t, para: p \}\)/.test(rota));
ok("a tela manda a crítica pelo servidor", !/"critica_enviar"/.test(ler("components/painel/Cuidado.tsx")) && /tipo: "critica"/.test(ler("components/painel/Cuidado.tsx")));
ok("a limpeza das urnas é agendada (VACUUM FULL de madrugada, com o pg_cron)", /cron\.schedule\('alumia-urnas-limpeza', '37 4 \* \* \*', 'vacuum \(full, analyze\) '/.test(sql));
ok("a limpeza pega as urnas que regravam as cédulas", ["rede_consulta_cedulas", "alumia_decisao_cedulas", "votacao_votos", "rede_votos", "bem_estar_urna"].every((t) => sql.includes(`'${t}'`)));

// ═══════════════════ B3. Permissões, search_path, SQL dinâmico, números ═══════════════════
// Todas as permissões de anon e authenticated, em todo esquema que não é do sistema (a mesma consulta vai no relatório).
const tabelas = (await dono(`
  select r.rolname as papel, n.nspname || '.' || c.relname as rel, string_agg(distinct a.privilege_type, ',') as privs
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault((case when c.relkind = 'S' then 's' else 'r' end)::"char", c.relowner))) a
  join pg_roles r on r.oid = a.grantee
  where r.rolname in ('anon', 'authenticated') and n.nspname not in ('pg_catalog', 'information_schema') and c.relkind in ('r', 'v', 'm', 'S', 'f', 'p')
  group by 1, 2`)).rows;
ok(`anon e authenticated não têm permissão em tabela, vista ou sequência nenhuma (têm em: ${tabelas.map((t) => `${t.papel} ${t.rel} ${t.privs}`).join("; ")})`, tabelas.length === 0);
const esquemas = (await dono(`select n.nspname, has_schema_privilege('anon', n.oid, 'USAGE') as anon, has_schema_privilege('authenticated', n.oid, 'USAGE') as aut,
  has_schema_privilege('anon', n.oid, 'CREATE') or has_schema_privilege('authenticated', n.oid, 'CREATE') as cria
  from pg_namespace n where n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'`)).rows;
ok("ninguém de fora cria objeto em esquema nenhum", esquemas.every((e) => !e.cria));
ok("o esquema interno não é usável por anon nem authenticated", esquemas.filter((e) => e.nspname === "interno").every((e) => !e.anon && !e.aut));
const interno = (await dono(`select p.oid::regprocedure::text as f, p.prosecdef as sd from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows;
ok(`função security definer de interno não é chamável de fora (são: ${interno.filter((x) => x.sd).map((x) => x.f).join(", ")})`, interno.every((x) => !x.sd));
const semCaminho = (await dono(`select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'interno') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`)).rows.map((x) => x.f);
ok(`toda função security definer tem search_path fixo (sem: ${semCaminho.join(", ")})`, semCaminho.length === 0);
const caminhoPublico = (await dono(`select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'interno') and p.prosecdef and exists (select 1 from unnest(p.proconfig) c where c ~ '^search_path=.*(public|"\\$user")')`)).rows.map((x) => x.f);
ok(`nenhuma função security definer procura em public ou no esquema da pessoa (procuram: ${caminhoPublico.join(", ")})`, caminhoPublico.length === 0);
const invocadoras = (await dono(`select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((x) => x.f);
ok(`as funções de public sem security definer são só as que não leem tabela (são: ${invocadoras.join(", ")})`, invocadoras.every((f) => f === "rede_alumia_versao()"));

// SQL dinâmico: só %I e %L (ou parâmetro com USING). %s só nos casos conferidos (regclass, número, lista montada com %I).
const CONFERIDOS = new Set(["interno.alumia_md_parte(text,uuid)", "interno.alumia_md_sair_de_vez(uuid)", "alumia_painel_servico_de_contas()", "interno.vencer_sessoes()"]);
const dinamicos = (await dono(`select p.oid::regprocedure::text as f, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and p.prosrc ~* '\\mexecute\\M'`)).rows;
const suspeitos = [];
for (const x of dinamicos) {
  const corpo = x.prosrc.replace(/--[^\n]*/g, "");
  for (const m of corpo.matchAll(/\bexecute\s+(?!function\b|procedure\b)([^;]*);/gis)) {
    const t = m[1];
    if (/\|\|\s*p_[a-z_]+/i.test(t) || /\|\|\s*quote_ident|\|\|\s*v_[a-z_]+\s*\|\|/i.test(t)) suspeitos.push(`${x.f}: concatena`);
    else if (/%s/.test(t) && !CONFERIDOS.has(x.f)) suspeitos.push(`${x.f}: %s`);
  }
}
ok(`SQL dinâmico só com %I, %L ou USING (suspeitos: ${suspeitos.join(" | ")})`, suspeitos.length === 0);

// Números de pessoas só a partir de 3.
ok("o número de pessoas abaixo de 3 volta nulo", (await dono("select interno.alumia_r1_n3(0) is null and interno.alumia_r1_n3(2) is null and interno.alumia_r1_n3(3) = 3 as ok").catch(() => ({ rows: [{}] }))).rows[0].ok === true);
const embrulhadas = (await dono(`select p.oid::regprocedure::text as f, p.prosrc ~ 'alumia_r1_n3\\(\\(select count\\(\\*\\)' as ok from pg_proc p
  where p.oid in ('interno.rede_post_json(interno.rede_posts, boolean)'::regprocedure, 'interno.rede_post_v2(interno.rede_posts, uuid, boolean)'::regprocedure,
    'interno.rede_ato_json(interno.rede_posts, interno.rede_chamados, uuid)'::regprocedure, 'public.rede_vou(uuid, boolean)'::regprocedure,
    'public.rede_ato_vou(uuid, boolean)'::regprocedure, 'public.rede_meus_espacos()'::regprocedure, 'public.alumia_painel_comunidades()'::regprocedure,
    'public.rede_painel_semeadura()'::regprocedure)`)).rows;
ok(`o total de "eu vou", de membros do espaço, de membros da comunidade no painel e de quem modera só a partir de 3 (faltam: ${embrulhadas.filter((x) => !x.ok).map((x) => x.f).join(", ")})`, embrulhadas.length === 8 && embrulhadas.every((x) => x.ok));
// Depois da R2 (membros escondidos) a lista dos núcleos fechados do painel não conta pessoas (o banco não sabe quem é do núcleo).
ok("a lista dos núcleos fechados do painel não conta pessoas (R2)", !/count\(/.test((await dono("select prosrc from pg_proc where oid = 'public.rede_nucleos_fechados_listar()'::regprocedure")).rows[0]?.prosrc ?? "count("));
if (!semMigracao) {
  // Com 1 pessoa no núcleo e 1 na moderação, a coordenação recebe nulo ("menos de 3"), não o número.
  const nucleo = (await dono("insert into interno.nucleos (nome, cidade, uf) values ('Núcleo do teste', 'Recife', 'PE') returning id")).rows[0].id;
  const rede = (await dono("insert into interno.rede_nucleos (nucleo, nome, cidade) values ($1, 'Núcleo do teste', 'Recife') returning id", [nucleo])).rows[0].id;
  // (R2, membros escondidos: o servidor não guarda mais quem é de qual núcleo; a filiação mora no grupo, nos aparelhos.)
  await espera("o núcleo aparece para a coordenação sem número de pessoas", () => rpc({ sub: P.coord, sessao: sCoord }, "rede_nucleos_fechados_listar"),
    (l) => Array.isArray(l) && l.some((n) => n.nucleo === nucleo && !("pessoas" in n)));
  await dono("insert into interno.rede_comunidades (slug, nome, categoria) values ('teste-n3', 'Comunidade n3', 'lutas') on conflict do nothing");
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('teste-n3', $1, 'moderacao') on conflict do nothing", [P.ana]);
  await espera("com 1 pessoa na moderação, a semeadura mostra nulo", () => rpc({ sub: P.coord, sessao: sCoord }, "rede_painel_semeadura"),
    (r) => JSON.stringify(r).includes('"teste-n3"') && (Array.isArray(r) ? r : (r?.itens ?? r?.comunidades ?? [])).some((c) => c.slug === "teste-n3" && c.moderacao === null));
}
const duplas = (await dono("select count(*)::int as n from pg_proc where prosrc like '%alumia_r1_n3(interno.alumia_r1_n3(%'")).rows[0].n;
ok("rodar duas vezes não embrulha duas vezes", duplas === 0);

// ═══════════════════ A1.1 (fim). O ramo do "próprio banco" ═══════════════════
// O SQL Editor passa; a conexão da API (authenticator), mesmo sem papel e sem token, não. O PGlite não volta da troca de conexão,
// por isso este é o último passo.
await exec("create role authenticator noinherit; grant usage on schema interno to authenticator; grant execute on function interno.alumia_passa() to authenticator;");
await espera("o próprio banco (papel none, sem token) passa", () => dono("select interno.alumia_passa() as p"), (r) => r.rows[0].p === true);
await espera("a conexão da API sem papel e sem token NÃO passa", () => banco.exclusivo(async () => {
  await banco.pg.exec("set session authorization authenticator");
  await banco.pg.query("select set_config('request.jwt.claims', '', false)");
  return (await banco.pg.query("select current_setting('role') as papel, session_user::text as sessao, interno.alumia_passa() as p")).rows[0];
}), (r) => r.papel === "none" && r.sessao === "authenticator" && r.p === false);

console.log(`\ntestar-r1-banco${semMigracao ? " (SEM a migração)" : ""}: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
