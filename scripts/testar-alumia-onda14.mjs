// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fecho da onda 14: as migrações 20261120-alumia-o14-conta.sql, -o14-banco.sql e o fim (20261120-alumia-onda14-fim.sql) estão
// coladas, inteiras e na ordem, no fim do install.sql; a 20261120-alumia-o14-tipo-linha.sql fica antes da o9-publicar (lá ela
// conserta a função que barraria o ALTER TABLE). E, num Postgres de verdade (scripts/banco-local.mjs):
//   · o install.sql sobe do zero, com a versão 11 e nenhuma função public.rede_*/alumia_* sem porta;
//   · por cima dele, a onda inteira roda DUAS vezes seguidas sem estrago;
//   · nenhuma função recebe linha de tabela com valor padrão (o Postgres do Supabase barra o ALTER TABLE depois);
//   · a última definição das funções que as duas faixas redefinem é a completa (a lista sem porta com a federação, o diretório e
//     as três da Faixa 2; a federação começando pela vida do post);
//   · montado como o banco estava depois da onda 13 (o install.sql até o começo da primeira migração do fim da onda 14), a onda
//     roda duas vezes e sobe a versão de 10 para 11.
// Uso: npm run testar:alumia-onda14
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8").replace(/\r\n/g, "\n");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

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

// ═══════════════════ 0. Os arquivos ═══════════════════
/** A ordem do fim da onda 14 (a mesma do fim do install.sql e do SQL da onda). A do banco vem depois da conta (o passo 5 dela). */
const ORDEM = ["20261120-alumia-o14-conta.sql", "20261120-alumia-o14-banco.sql", "20261120-alumia-onda14-fim.sql"];
const TIPO_LINHA = "20261120-alumia-o14-tipo-linha.sql";
const pasta = path.join(raiz, "supabase", "migracoes");
const daOnda = fs.readdirSync(pasta).filter((n) => /^20261120-alumia-(o14-.+|onda14-fim)\.sql$/.test(n));
const fora = daOnda.filter((n) => !ORDEM.includes(n) && n !== TIPO_LINHA);
ok(`toda migração da onda 14 está na ordem (fora dela: ${fora.join(", ") || "nenhuma"})`, fora.length === 0 && ORDEM.every((n) => daOnda.includes(n)));
const migracoes = ORDEM.map((n) => ({ nome: n, sql: ler(`supabase/migracoes/${n}`) }));
const install = normal(ler("supabase/install.sql"));
const posicoes = migracoes.map(({ sql }) => install.lastIndexOf(normal(sql)));
ok("cada migração do fim da onda está inteira (idêntica) no install.sql", posicoes.every((i) => i > 0));
ok("e na ordem certa, depois do fim da onda 13", posicoes.every((i, k) => k === 0 || i > posicoes[k - 1]) && posicoes[0] > install.lastIndexOf(normal(ler("supabase/migracoes/20261119-alumia-onda13-fim.sql"))));
ok("o fim da onda está no fim do install.sql (depois dele, só migrações datadas que entraram depois)", noFimDoInstall(migracoes.at(-1).sql));
{
  const tl = normal(ler(`supabase/migracoes/${TIPO_LINHA}`));
  const i = install.indexOf(tl);
  const publicar = install.indexOf(normal(ler("supabase/migracoes/20261115-alumia-o9-publicar.sql")));
  ok("a tipo-linha está no install.sql uma vez só, logo antes da o9-publicar", i > 0 && install.lastIndexOf(tl) === i && publicar > i && install.slice(i + tl.length, publicar).trim() === "");
}
const fim = migracoes.at(-1).sql;
ok("o fim sobe a versão para 11", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 11\s*\$\$/.test(fim));
ok("só o fim mexe na versão", migracoes.slice(0, -1).every(({ sql }) => !/function public\.rede_alumia_versao/.test(sql)));
ok("toda migração da onda termina passando a porta", migracoes.every(({ sql }) => /interno\.alumia_trancar\(\)/.test(normal(sql).slice(-400))));
ok("o código espera a versão 11 do banco ou mais", Number((ler("lib/rede/painel/tipos.ts").match(/VERSAO_ESPERADA_DO_BANCO = (\d+);/) ?? [])[1]) >= 11);
{
  const nomes = (sql) => new Set([...sql.matchAll(/create (?:or replace )?function ([a-z_]+\.[a-z0-9_]+)\s*\(/gi)].map((m) => m[1].toLowerCase()));
  const vistos = new Map();
  const repetidas = [];
  for (const { nome, sql } of migracoes.slice(0, -1)) {
    for (const f of nomes(sql)) {
      if (vistos.has(f)) repetidas.push(`${f} (${vistos.get(f)} e ${nome})`);
      else vistos.set(f, nome);
    }
  }
  ok(`nenhuma função redefinida por duas migrações da onda (${repetidas.join("; ") || "nenhuma"})`, repetidas.length === 0);
  ok("o fim só redefine a versão", [...nomes(fim)].join() === "public.rede_alumia_versao");
  ok("só a do banco redefine a lista sem porta", migracoes.filter(({ sql }) => /function interno\.alumia_porta_aberta\(/.test(sql)).map((m) => m.nome).join() === "20261120-alumia-o14-banco.sql");
}
for (const { nome, sql } of migracoes) {
  const tabelas = [...sql.matchAll(/create table if not exists (interno\.[a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi)];
  const comIp = tabelas.filter(([, , corpo]) => /\b(ip|endereco_ip|ip_origem|inet)\b/i.test(corpo.replace(/--.*$/gm, ""))).map(([, t]) => t);
  ok(`${nome}: nenhuma tabela com coluna de endereço de rede (${comIp.join(", ") || "nenhuma"})`, comIp.length === 0);
  ok(`${nome}: nenhuma tabela nova fora do esquema interno`, !/create table (?:if not exists )?(?!interno\.)[a-z_]+\./i.test(sql.replace(/--.*$/gm, "")));
}
{
  const pacote = JSON.parse(ler("package.json")).scripts;
  for (const t of ["o14-banco", "o14-conta", "onda14"]) ok(`package.json: testar:alumia-${t}`, (pacote[`testar:alumia-${t}`] ?? "").includes(`scripts/testar-alumia-${t}.mjs`));
}

const onda = migracoes.map(({ sql }) => sql).join("\n");
const FUNCOES_DA_REDE = `
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid)) as aberta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`;
const semPorta = async (dono) => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`);
/** Função (public ou interno) com parâmetro do tipo linha de tabela que tem valor padrão: o Supabase de verdade barra o ALTER TABLE. */
const LINHA_COM_PADRAO = `
  select p.oid::regprocedure::text as f
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'interno') and p.pronargdefaults > 0
    and exists (select 1 from unnest(p.proargtypes::oid[]) with ordinality t(o, i)
                join pg_type ty on ty.oid = t.o join pg_class c on c.oid = ty.typrelid
                where ty.typtype = 'c' and c.relkind in ('r', 'p') and t.i > p.pronargs - p.pronargdefaults)`;
/** O corpo final das funções que as duas faixas redefinem. */
const FINAIS = `
  select interno.alumia_porta_aberta('rede_fed_servidor', '') and interno.alumia_porta_aberta('rede_org_diretorio', 'p jsonb')
         and interno.alumia_porta_aberta('alumia_transparencia', '') and interno.alumia_porta_aberta('rede_sel_depositar', '')
         and interno.alumia_porta_aberta('rede_kt_ponta', '') and interno.alumia_porta_aberta('rede_kt_trecho', '') as lista,
         (select prosrc ~ 'rede_vida_federa' from pg_proc where oid = to_regprocedure('interno.rede_fed_federavel(interno.rede_posts, integer)')) as federa,
         (select count(*)::int from pg_proc where oid = to_regprocedure('interno.alumia_passa()') or oid = to_regprocedure('interno.rede_ve(interno.rede_posts, uuid)')) as passa_e_ve,
         (select bool_and(prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)') from pg_proc where pronamespace = 'public'::regnamespace and proname = 'rede_publicar') as publicar`;
const finaisCompletos = (r) => r?.lista === true && r.federa === true && r.publicar === true;
const versao = (rpc, ip) => rpc({ papel: "anon", ip }, "rede_alumia_versao");
const semAbertas = async (dono) => (await dono("select interno.alumia_trancar() as r")).rows[0].r;

// ═══════════════════ 1. Do zero ═══════════════════
{
  const banco = await criarBanco();
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o install.sql sobe do zero e responde a versão 11 ou mais (a integração sobe), para visitante também", () => versao(rpc, "203.0.113.5"), (v) => v >= 11);
  await espera("nenhuma função da rede ficou sem porta", () => semAbertas(dono), (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera("nenhuma função recebe linha de tabela com valor padrão", async () => (await dono(LINHA_COM_PADRAO)).rows.map((r) => r.f), (l) => l.length === 0);
  await espera("a última definição das funções das duas faixas é a completa", async () => (await dono(FINAIS)).rows[0], finaisCompletos);
  await espera("a onda roda de novo por cima do install.sql", () => exec(onda));
  await espera("e mais uma vez, sem estrago (idempotente)", () => exec(onda));
  await espera("continua na versão 11 e sem porta aberta", async () => [await versao(rpc, "203.0.113.6"), await semAbertas(dono)], ([v, r]) => v === 11 && r.abertas.length === 0);
  await espera("e sem função pública sem porta", () => semPorta(dono), (l) => l.length === 0);
  await espera("e nenhuma função recebe linha de tabela com valor padrão", async () => (await dono(LINHA_COM_PADRAO)).rows.map((r) => r.f), (l) => l.length === 0);
  await espera("e as funções das duas faixas continuam completas", async () => (await dono(FINAIS)).rows[0], finaisCompletos);
  await banco.pg.close?.();
}

// ═══════════════════ 2. O banco depois da onda 13 ═══════════════════
{
  const banco = await criarBanco({ antesDe: migracoes[0].sql });
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o banco de antes responde a versão 10 (onda 13)", () => versao(rpc, "203.0.113.7"), (v) => v === 10);
  await espera("a onda 14 inteira roda sobre o banco da onda 13", () => exec(onda));
  await espera("e de novo, logo em seguida, sem estrago (idempotente)", () => exec(onda));
  await espera("rede_alumia_versao() = 11, para visitante também", () => versao(rpc, "203.0.113.8"), (v) => v === 11);
  await espera("nenhuma função da rede ficou sem porta", () => semAbertas(dono), (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera("nenhuma função recebe linha de tabela com valor padrão", async () => (await dono(LINHA_COM_PADRAO)).rows.map((r) => r.f), (l) => l.length === 0);
  await espera("a última definição das funções das duas faixas é a completa", async () => (await dono(FINAIS)).rows[0], finaisCompletos);
  await espera("o gancho da senha não é de anon nem de authenticated", async () => (await dono("select has_function_privilege('anon', 'public.alumia_porta_gancho_senha(jsonb)', 'execute') or has_function_privilege('authenticated', 'public.alumia_porta_gancho_senha(jsonb)', 'execute') as x")).rows[0].x, (x) => x === false);
  await banco.pg.close?.();
}

console.log(`\nfecho da onda 14: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
