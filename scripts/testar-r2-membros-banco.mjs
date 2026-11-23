// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a migração dos membros escondidos (supabase/migracoes/20261124-r2-membros.sql) num Postgres local (scripts/banco-local.mjs),
// rodada DUAS vezes sobre o install.sql, com um banco que já tinha núcleos, membros, mediação, pedidos de entrada, posts e convites
// de núcleo e o MLS de hoje. Os ataques de quem tem o banco inteiro estão escritos como teste:
//   - procurar, em TODAS as linhas de TODAS as tabelas, uma linha que traga a conta de quem era membro junto do núcleo: nenhuma;
//   - nenhuma tabela com uma coluna que aponte para conta e outra que aponte para núcleo; nenhuma função que leia a filiação;
//   - a lista de quem é de um núcleo pelo servidor (rede_grupo_membros, rede_com_nucleo, perfil da organização): vazia, sem número;
//   - a entrada: só quem cria publica; trocar exige o passe de gestão, sem sessão, e passe errado não diz mais nada; anon e contas
//     não chamam a troca; a porta: só as exceções escritas ficam sem ela.
// Com R2_MEMBROS_SEM_MIGRACAO=1, roda sem a migração: mostra o que falhava antes (a lista de membros sai do banco).
// Uso: node scripts/testar-r2-membros-banco.mjs
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACAO = "supabase/migracoes/20261124-r2-membros.sql";
const sql = fs.readFileSync(path.join(raiz, MIGRACAO), "utf8");
const semMigracao = process.env.R2_MEMBROS_SEM_MIGRACAO === "1";

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

// ═══════════════════ 0. O arquivo ═══════════════════
ok("cabeçalho com a função e a lei", /Reforço 2 · Membros escondidos/.test(sql) && /Leis: LGPD/.test(sql));
ok("termina com a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("sem endereço de rede, porta nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(sql));
ok("nenhuma função recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));
ok('"Rede Lúcia" não aparece em corpo de função', !/\$function\$[^$]*Rede Lúcia[^$]*\$function\$/.test(sql) && !/\$\$[^$]*Rede Lúcia[^$]*\$\$/.test(sql));

// ═══════════════════ 1. O banco de antes, com núcleos e membros ═══════════════════
// O install.sql já traz a R2 inteira no fim: o banco de antes é o install.sql até antes desta migração (as das caixas, da conversa a
// dois, da equipe, da franquia e dos grupos, que vêm antes dela na ordem do desenho, ficam).
const banco = await criarBanco({ antesDe: sql });
const { rpc, dono, criarUsuario } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await exec(`
  create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null, created_at timestamptz default now(),
    updated_at timestamptz default now(), factor_id uuid, aal text, not_after timestamptz, refreshed_at timestamp, user_agent text, ip inet, tag text);
  create table if not exists auth.refresh_tokens (id bigserial primary key, token varchar(255), user_id varchar(255), revoked boolean default false,
    created_at timestamptz default now(), session_id uuid references auth.sessions (id) on delete cascade);
  create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null,
    factor_type text default 'totp', created_at timestamptz default now());
`);
const agora = () => Math.floor(Date.now() / 1000);
const P = {};
for (const nome of ["gestora", "mediadora", "membro1", "membro2", "membro3", "pedinte", "coord", "org"]) {
  P[nome] = await criarUsuario(`${nome}@r2m.local`, `Pessoa ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Codinome ${nome}`, `r2m_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [P.coord]);
await dono("select interno.alumia_entrada_ligar(true)");
for (const nome of Object.keys(P)) await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P[nome]]);
const S = {};
for (const nome of Object.keys(P)) S[nome] = (await dono("insert into auth.sessions (user_id, aal) values ($1, 'aal2') returning id", [P[nome]])).rows[0].id;
/** Chama como a API, com a sessão viva da pessoa. */
const chamar = (nome, funcao, args = {}) =>
  banco.exclusivo(async () => {
    const claims = JSON.stringify({ role: "authenticated", sub: P[nome], aal: "aal2", session_id: S[nome], iat: agora() - 30, exp: agora() + 3600 });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [claims]);
    await banco.pg.exec("set role authenticated");
    try {
      const nomes = Object.keys(args);
      const valores = nomes.map((n) => (args[n] !== null && typeof args[n] === "object" && !Array.isArray(args[n]) && !(args[n] instanceof Uint8Array) ? JSON.stringify(args[n]) : args[n]));
      return (await banco.pg.query(`select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });

await dono("insert into interno.rede_orgs (perfil, tipo, cidade, verificada_em) values ($1, 'movimento', 'São Paulo', now()) on conflict (perfil) do nothing", [P.org]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono') on conflict do nothing", [P.org, P.gestora]);
const nucleo = (await dono("insert into interno.rede_nucleos (nome, cidade, criado_por, org) values ('Núcleo Leste', 'São Paulo', $1, $1) returning id", [P.org])).rows[0].id;
// O que o banco de hoje guarda de quem é do núcleo (e o que sai).
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'mediacao'), ($1, $3, 'membro'), ($1, $4, 'membro'), ($1, $5, 'membro')",
  [nucleo, P.mediadora, P.membro1, P.membro2, P.membro3]);
await dono("insert into interno.rede_org_nucleo_pedidos (nucleo, usuario) values ($1, $2)", [nucleo, P.pedinte]);
await dono("insert into interno.rede_posts (autor, texto, nucleo) values ($1, 'post do núcleo', $2)", [P.membro1, nucleo]);
await dono("insert into interno.rede_mls_commits (grupo, epoca, autor, commit) values ($1, 1, $2, 'x')", [`nucleo:${nucleo}`, P.mediadora]).catch(() => undefined);
await dono("insert into interno.rede_mls_boasvindas (grupo, epoca, para, welcome) values ($1, 1, $2, 'x')", [`nucleo:${nucleo}`, P.membro2]).catch(() => undefined);
// A Escola de hoje também guarda o núcleo de cada militante, o da banca e quem criou o encontro do núcleo.
await dono("insert into interno.escola_militancia (usuario, nucleo) values ($1, $2)", [P.membro2, nucleo]);
await dono("insert into interno.escola_bancas (militante, degrau, nucleo, por) values ($1, 1, $2, $3)", [P.membro3, nucleo, P.mediadora]);
await dono("insert into interno.escola_encontros (nucleo, quando, criado_por) values ($1, now(), $2)", [nucleo, P.mediadora]);
await dono("insert into interno.escola_recados (texto, ate, nucleo, por) values ('recado', current_date + 7, $1, $2)", [nucleo, P.mediadora]);
const membros = [P.mediadora, P.membro1, P.membro2, P.membro3, P.pedinte];

if (!semMigracao) {
  await espera("a migração instala sobre o install.sql", () => exec(sql));
  await espera("de novo (idempotente)", () => exec(sql));
}

// ═══════════════════ 2. Quem tem o banco inteiro ═══════════════════
// 2.1 Cada linha de cada tabela (todos os esquemas do projeto), como texto: nenhuma traz uma conta que era do núcleo junto do núcleo.
const tabelas = (await dono(`select table_schema as s, table_name as t from information_schema.tables
  where table_schema in ('interno', 'public') and table_type = 'BASE TABLE'`)).rows;
const achadas = [];
for (const { s, t } of tabelas) {
  const linhas = (await dono(`select x::text as l from ${s}.${t} x`)).rows;
  for (const { l } of linhas) if (l.includes(nucleo) && membros.some((m) => l.includes(m))) achadas.push(`${s}.${t}`);
}
ok("nenhuma linha do banco liga uma conta que era do núcleo ao núcleo", achadas.length === 0, [...new Set(achadas)].join(", "));

// 2.2 Nenhuma tabela com uma coluna de conta e outra de núcleo (pelo nome e pelas chaves estrangeiras).
const ligadas = (await dono(`
  select c.table_schema || '.' || c.table_name as t from information_schema.columns c
  where c.table_schema = 'interno' and c.column_name in ('nucleo', 'nucleos')
    and c.table_name not in ('nucleos', 'rede_nucleos')
    and exists (select 1 from information_schema.columns d where d.table_schema = c.table_schema and d.table_name = c.table_name
                and d.column_name in ('usuario', 'autor', 'para', 'membro', 'pessoa'))`)).rows.map((r) => r.t);
// Três tabelas ainda têm as duas colunas, mas uma regra do banco (check) não deixa a linha ter as duas: o post não tem mais núcleo, a
// ficha da Escola e a banca não têm mais núcleo, e a pasta é do núcleo OU da pessoa. Conferido tentando gravar.
const comRegra = new Set(["interno.rede_posts", "interno.escola_militancia", "interno.escola_bancas", "interno.rede_alumia_pastas"]);
ok("nenhuma tabela da Rede tem conta e núcleo na mesma linha (fora as que têm a regra)", ligadas.filter((t) => !comRegra.has(t)).length === 0, ligadas.join(", "));
if (!semMigracao) {
  await recusa("o banco não aceita post com núcleo", () => dono("insert into interno.rede_posts (autor, texto, nucleo) values ($1, 'x', $2)", [P.membro1, nucleo]), "rede_posts_sem_nucleo");
  await recusa("o banco não aceita a ficha da Escola com núcleo", () => dono("insert into interno.escola_militancia (usuario, nucleo) values ($1, $2)", [P.membro2, nucleo]), "escola_militancia_sem_nucleo");
  await recusa("o banco não aceita banca com núcleo", () => dono("insert into interno.escola_bancas (militante, degrau, nucleo) values ($1, 1, $2)", [P.membro2, nucleo]), "escola_bancas_sem_nucleo");
  await recusa("o banco não aceita pasta da pessoa no núcleo", () => dono("insert into interno.rede_alumia_pastas (usuario, nucleo, nome) values ($1, $2, 'x')", [P.membro2, nucleo]), "check constraint");
}
const sobrou = (await dono(`select table_name as t from information_schema.tables where table_schema = 'interno'
  and table_name in ('rede_nucleo_membros', 'rede_org_nucleo_pedidos', 'rede_mls_commits', 'rede_mls_boasvindas', 'rede_mls_pacotes', 'rede_mls_info')`)).rows;
ok("as tabelas da filiação e do MLS de hoje saíram (DROP, não DELETE)", sobrou.length === 0, sobrou.map((r) => r.t).join(", "));
const leem = (await dono(`select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('interno', 'public') and regexp_replace(p.prosrc, '''[a-z_]+''', '', 'g') ~ 'rede_nucleo_membros|rede_org_nucleo_pedidos|rede_mls_(commits|boasvindas|pacotes|info)'`)).rows.map((r) => r.f);
// (Os nomes entre aspas simples são chaves de freio, interno.limite('rede_mls_pacotes', ...), não tabelas: ficam de fora da busca.)
ok("nenhuma função lê a filiação nem o MLS de hoje", leem.length === 0, leem.join(", "));
ok("nenhum post de núcleo (autor + núcleo) sobrou", (await dono("select count(*)::int as n from interno.rede_posts where nucleo is not null")).rows[0].n === 0);

// 2.3 O servidor não lista membros: nem pela função dos grupos, nem pela página do núcleo, nem pelo perfil da organização.
if (!semMigracao) {
  ok("rede_grupo_membros de um núcleo: ninguém", (await dono("select count(*)::int as n from interno.rede_grupo_membros($1)", [`nucleo:${nucleo}`])).rows[0].n === 0);
  const pagina = await espera("a página do núcleo abre para conta aprovada", () => chamar("membro1", "rede_com_nucleo", { p_id: nucleo }), (r) => r?.id === nucleo);
  ok("a página do núcleo não tem papel, mediação nem número de pessoas", pagina && !("papel" in pagina) && !("mediacao" in pagina) && !("pessoas" in pagina));
  const perfil = await espera("o perfil da organização abre", () => chamar("membro1", "rede_org_perfil", { p_handle: "r2m_org" }), (r) => Array.isArray(r?.nucleos));
  const n0 = perfil?.nucleos?.[0] ?? {};
  ok("o núcleo no perfil da organização: sem 'sou', 'pedi' nem 'chama'", !("sou" in n0) && !("pedi" in n0) && n0.chama == null);
  const fontes = (await dono("select string_agg(prosrc, ' ') as s from pg_proc where proname in ('rede_meusdados_exportar', 'rede_meusdados_mais')")).rows[0].s;
  ok("'Meus dados' sem núcleos nem pedidos de núcleo (o servidor não tem mais o que entregar)", !fontes.includes("'nucleos'") && !fontes.includes("'pedidos_de_nucleo'"));
  const fechados = await espera("a coordenação lista os núcleos fechados", () => chamar("coord", "rede_nucleos_fechados_listar"), (r) => Array.isArray(r));
  ok("a lista dos núcleos fechados não tem número de pessoas", Array.isArray(fechados) && fechados.every((x) => !("pessoas" in x)));

  // ═══════════════════ 3. A entrada do núcleo ═══════════════════
  const b64 = (b) => Buffer.from(b).toString("base64url");
  const sorte = (n) => new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + n) & 255));
  const gestao = new Uint8Array(32).fill(7);
  const gestaoH = createHash("sha256").update(Buffer.concat([Buffer.from("alumia/r2/grupo/gestao/v1"), Buffer.from(gestao)])).digest();
  const entrada = { caixa: b64(sorte(32)), pd: b64(sorte(32)), xwing: b64(sorte(1216)), chave: b64(sorte(32)), assinatura: b64(sorte(64)), gestao_h: b64(gestaoH) };
  await recusa("conta comum não publica a entrada", () => chamar("membro1", "rede_nucleo_entrada_iniciar", { p_nucleo: nucleo, p: entrada }), "sem_permissao");
  await recusa("entrada com tamanho errado é recusada", () => chamar("gestora", "rede_nucleo_entrada_iniciar", { p_nucleo: nucleo, p: { ...entrada, xwing: b64(sorte(32)) } }), "invalido:entrada");
  await espera("a gestão da organização publica a entrada", () => chamar("gestora", "rede_nucleo_entrada_iniciar", { p_nucleo: nucleo, p: entrada }), (r) => r?.ok === true);
  const comEntrada = await espera("a página do núcleo traz a entrada", () => chamar("membro2", "rede_com_nucleo", { p_id: nucleo }), (r) => r?.entrada?.caixa === entrada.caixa);
  ok("a entrada traz a chave X-Wing, a chave de gestão e a assinatura", comEntrada?.entrada?.xwing === entrada.xwing && comEntrada?.entrada?.chave === entrada.chave && comEntrada?.entrada?.assinatura === entrada.assinatura);
  ok("o banco guarda só o resumo do passe de gestão", (await dono("select count(*)::int as n from interno.rede_nucleos where entrada_gestao_h = $1 and position($2 in entrada_gestao_h) = 0", [gestaoH, Buffer.from(gestao)])).rows[0].n === 1);

  const nova = { caixa: Buffer.from(sorte(32).reverse()), pd: Buffer.from(sorte(32).reverse()), xwing: Buffer.from(sorte(1216).reverse()), ass: Buffer.from(sorte(64).reverse()) };
  // Os bytea vão como Uint8Array (o rpc do banco local mandaria objeto como JSON).
  const trocar = (quem, passe) =>
    banco.exclusivo(async () => {
      const claims = JSON.stringify({ role: quem.papel, ...(quem.sub ? { sub: quem.sub } : {}) });
      await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [claims]);
      await banco.pg.exec(`set role ${quem.papel}`);
      try {
        const u8 = (b) => new Uint8Array(b);
        return (await banco.pg.query("select public.rede_nucleo_entrada_trocar($1, $2, $3, $4, $5, $6, null) as r",
          [nucleo, u8(passe), u8(nova.caixa), u8(nova.pd), u8(nova.xwing), u8(nova.ass)])).rows[0].r;
      } finally {
        await banco.pg.exec("reset role");
      }
    });
  await recusa("anon não chama a troca", () => trocar({ papel: "anon" }, Buffer.from(gestao)), "permission denied");
  await recusa("conta não chama a troca (nem com o passe certo)", () => trocar({ papel: "authenticated", sub: P.mediadora }, Buffer.from(gestao)), "permission denied");
  await espera("passe errado: {ok:false} e nada muda", () => trocar({ papel: "service_role" }, Buffer.alloc(32, 9)), (r) => r?.ok === false && Object.keys(r).length === 1);
  await espera("passe curto: {ok:false}", () => trocar({ papel: "service_role" }, Buffer.alloc(31, 7)), (r) => r?.ok === false);
  ok("depois do passe errado, a entrada é a mesma", (await dono("select entrada_caixa = $2 as igual from interno.rede_nucleos where id = $1", [nucleo, Buffer.from(sorte(32))])).rows[0].igual === true);
  await espera("o servidor do site, com o passe de gestão, troca a entrada", () => trocar({ papel: "service_role" }, Buffer.from(gestao)), (r) => r?.ok === true);
  ok("a troca não muda a chave de gestão", (await dono("select entrada_chave = $2 as igual, entrada_caixa = $3 as nova from interno.rede_nucleos where id = $1", [nucleo, Buffer.from(sorte(32)), nova.caixa])).rows[0].igual === true);

  // ═══════════════════ 4. Entrar e sair não passam mais pelo servidor ═══════════════════
  for (const f of ["rede_org_nucleo_entrar", "rede_org_nucleo_decidir", "rede_org_nucleo_pedidos", "rede_com_nucleo_sair"]) {
    ok(`a função ${f} saiu`, (await dono("select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1", [f])).rows[0].n === 0);
  }
  // As rede_mls_* da ts-mls (por conta) saíram; as do OpenMLS da frente dos grupos (20261124-r2-grupos.sql, por nome de folha, que
  // roda antes desta) ficam, e para núcleo respondem nao_encontrado (a filiação dos grupos é só das comunidades).
  for (const f of ["public.rede_mls_estado(text, integer)", "public.rede_mls_pacotes_pegar(text, uuid[])", "public.rede_mls_pacotes_publicar(text[])", "public.rede_mls_meus_pacotes()"]) {
    ok(`a assinatura velha ${f} saiu`, (await dono("select to_regprocedure($1) is null as saiu", [f])).rows[0].saiu === true);
  }
  const criado = await espera("a gestão cria núcleo sem entrar nele", () => chamar("gestora", "rede_org_nucleo_criar", { p_handle: "r2m_org", p: { nome: "Núcleo Norte", onde: "Centro" } }), (r) => typeof r?.id === "string");
  ok("quem cria não fica ligado ao núcleo novo (criado_por é a organização)", criado && (await dono("select criado_por = $2 as org from interno.rede_nucleos where id = $1", [criado.id, P.org])).rows[0].org === true);
  await espera("o convite de núcleo de antes não existe mais", () => dono("select count(*)::int as n from interno.rede_convites where nucleo is not null"), (r) => r.rows[0].n === 0);

  // ═══════════════════ 5. A porta ═══════════════════
  await espera("a porta tranca tudo (nenhuma função aberta)", () => dono("select interno.alumia_trancar() as r"), (r) => (r.rows[0].r.abertas ?? []).length === 0);
  ok("a troca da entrada está na lista de exceções escrita", (await dono("select interno.alumia_porta_aberta('rede_nucleo_entrada_trocar', '') as a")).rows[0].a === true);
  ok("a troca da entrada não chama a porta (não usa sessão)", !/alumia_porta\(\)/.test((await dono("select prosrc from pg_proc where proname = 'rede_nucleo_entrada_trocar'")).rows[0].prosrc));
  ok("a publicação da entrada passa pela porta", /alumia_porta\(\)/.test((await dono("select prosrc from pg_proc where proname = 'rede_nucleo_entrada_iniciar'")).rows[0].prosrc));
  const semPorta = (await dono(`select p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%') and p.prorettype <> 'trigger'::regtype
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
      and p.prosrc !~ 'interno\\.alumia_(porta|passa)\\(\\)' and not interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))`)).rows.map((r) => r.f);
  ok("toda função rede_*/alumia_* que conta chama tem a porta ou está na lista", semPorta.length === 0, semPorta.join(", "));
  const novasSemRevoke = (await dono(`select p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname in ('rede_nucleo_sem_membros', 'rede_nucleo_b64url', 'rede_nucleo_gestao_h')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((r) => r.f);
  ok("as funções novas de interno não abrem para anon nem authenticated", novasSemRevoke.length === 0, novasSemRevoke.join(", "));
}

console.log(`${certos} certos, ${falhas.length} falhas${semMigracao ? " (SEM a migração)" : ""}`);
for (const f of falhas) console.log(`  FALHA: ${f}`);
process.exit(falhas.length ? 1 : 0);
