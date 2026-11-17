// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fecho da onda 7: as migrações 20261113-alumia-o7-*.sql e o fim (20261113-alumia-onda7-fim.sql) estão coladas, inteiras e na
// ordem, no fim do install.sql; e, num Postgres de verdade (scripts/banco-local.mjs) montado como o banco estava depois da onda 6
// (o install.sql até o começo da primeira migração da onda 7, com a porta já passada pelas funções do servidor da federação e
// pelo diretório, como aconteceu em produção), a onda inteira roda DUAS vezes seguidas sem estrago e deixa:
//   · public.rede_alumia_versao() = 4, também para visitante;
//   · nenhuma função da rede sem porta (interno.alumia_trancar devolve "abertas" vazia);
//   · as funções do servidor da federação e o diretório das organizações sem a porta (destrancadas);
//   · com a trava ligada, o diretório aberto a visitante e a lista de comunidades fechada.
// Uso: npm run testar:alumia-onda7
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
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
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ═══════════════════ 0. Os arquivos ═══════════════════
/** A ordem da onda 7 (a mesma do fim do install.sql e do SQL único da onda). */
const ORDEM = [
  "20261113-alumia-o7-portas-fediverso.sql",
  "20261113-alumia-o7-entrada.sql",
  "20261113-alumia-o7-identidade-publica.sql",
  "20261113-alumia-o7-painel.sql",
  "20261113-alumia-o7-pedidos.sql",
  "20261113-alumia-o7-linha.sql",
  "20261113-alumia-onda7-fim.sql",
];
const pasta = path.join(raiz, "supabase", "migracoes");
const daOnda = fs.readdirSync(pasta).filter((n) => /^20261113-alumia-(o7-.+|onda7-fim)\.sql$/.test(n));
ok(`toda migração da onda 7 está na ordem (fora dela: ${daOnda.filter((n) => !ORDEM.includes(n)).join(", ") || "nenhuma"})`, daOnda.length === ORDEM.length && daOnda.every((n) => ORDEM.includes(n)));
const migracoes = ORDEM.map((n) => ({ nome: n, sql: ler(`supabase/migracoes/${n}`) }));
const install = normal(ler("supabase/install.sql"));
const posicoes = migracoes.map(({ sql }) => install.lastIndexOf(normal(sql)));
ok("cada migração da onda está inteira (idêntica) no install.sql", posicoes.every((i) => i > 0));
ok("e na ordem certa", posicoes.every((i, k) => k === 0 || i > posicoes[k - 1]));
ok("o fim da onda é a última do install.sql (depois dele, só migrações datadas que entraram depois)", noFimDoInstall(migracoes.at(-1).sql));
const fim = migracoes.at(-1).sql;
ok("o fim sobe a versão para 4", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 4\s*\$\$/.test(fim));
ok("o fim passa a porta nas funções novas", /interno\.alumia_trancar\(\)/.test(fim));
ok("só o fim mexe na versão", migracoes.slice(0, -1).every(({ sql }) => !/function public\.rede_alumia_versao/.test(sql)));
const lista = (s) => (s.match(/create or replace function interno\.alumia_porta_aberta[\s\S]*?\$\$;/) ?? [""])[0];
ok("a lista de exceções da porta é a mesma nas portas, nas portas do Fediverso e na entrada", (() => {
  const [a, b, c] = ["20261112-alumia-portas.sql", "20261113-alumia-o7-portas-fediverso.sql", "20261113-alumia-o7-entrada.sql"].map((n) => normal(lista(ler(`supabase/migracoes/${n}`))));
  return a.length > 0 && a === b && b === c && /rede_fed_servidor/.test(a) && /rede_org_diretorio/.test(a);
})());

// ═══════════════════ 1. O banco depois da onda 6 ═══════════════════
const banco = await criarBanco({ antesDe: migracoes[0].sql });
const { dono, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
let ip = 10;
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
await espera("o banco de antes responde a versão 3 (onda 6)", () => rpc(visitante(), "rede_alumia_versao"), (v) => v === 3);
// Em produção, a onda 6 rodou com a lista de exceções de antes: a porta passou pelas funções do servidor da federação e pelo
// diretório. Aqui, o mesmo: a lista da onda 6 e a regra de novo.
await espera("como em produção: a lista da onda 6 tranca o servidor da federação e o diretório", async () => {
  await exec(`create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
    select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                      'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                      'rede_fed_situacao', 'rede_antigo')
        or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
  $$;`);
  await dono("select interno.alumia_trancar()");
  return (await dono("select string_agg(proname || ':' || (prosrc ~ 'interno\\.alumia_porta\\(\\)')::text, ',' order by proname) as c from pg_proc where proname in ('rede_fed_servidor', 'rede_org_diretorio', 'rede_org_mapa')")).rows[0].c;
}, (c) => c === "rede_fed_servidor:true,rede_org_diretorio:true,rede_org_mapa:true");

// ═══════════════════ 2. A onda, duas vezes ═══════════════════
const onda = migracoes.map(({ sql }) => sql).join("\n");
await espera("a onda 7 inteira roda sobre o banco da onda 6", () => exec(onda));
await espera("e de novo, logo em seguida, sem estrago (idempotente)", () => exec(onda));
await espera("rede_alumia_versao() = 4, para visitante também", () => rpc(visitante(), "rede_alumia_versao"), (v) => v === 4);
await espera("nenhuma função da rede ficou sem porta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("o servidor da federação e o diretório ficaram sem a porta", async () => (await dono("select bool_or(prosrc ~ 'interno\\.alumia_porta\\(\\)') as t, count(*)::int as n from pg_proc where proname in ('rede_fed_servidor', 'rede_org_diretorio', 'rede_org_mapa')")).rows[0], (r) => r.t === false && r.n >= 3);
await espera("as funções novas da onda passam pela porta (painel, linha, identidade)", async () => (await dono("select count(*)::int as n, count(*) filter (where prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)')::int as com from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('alumia_painel_geral', 'rede_roda_regra', 'rede_identidade_foto')")).rows[0], (r) => r.n >= 3 && r.com === r.n);
await espera("a coordenação liga a trava (nenhuma porta aberta)", async () => (await um("select interno.alumia_entrada_ligar(true) as r")).r, (r) => r?.exigir === true);
await espera("com a trava ligada, visitante vê o diretório das organizações com selo", () => rpc(visitante(), "rede_org_diretorio", { p: {} }), (r) => Array.isArray(r?.itens));
await espera("e o mapa dele", () => rpc(visitante(), "rede_org_mapa"), (r) => Array.isArray(r));
await recusa("a lista de comunidades fica fechada para visitante", () => rpc(visitante(), "rede_com_lista"), "alumia_entrada");
await recusa("a linha com regra aberta fica fechada para visitante", () => rpc(visitante(), "rede_roda_regra"), "alumia_entrada");
await dono("select interno.alumia_entrada_ligar(false)");
await banco.pg.close?.();

console.log(`Alumia (fecho da onda 7): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
