// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fecho da onda 13: as migrações 20261119-alumia-o13-*.sql e o fim (20261119-alumia-onda13-fim.sql) estão coladas, inteiras e
// na ordem, no fim do install.sql; o que as frentes deixaram para quem junta está nas telas; e, num Postgres de verdade
// (scripts/banco-local.mjs):
//   · o install.sql sobe do zero, com a versão 10 (ou mais: as ondas seguintes sobem) e nenhuma função public.rede_*/alumia_* sem porta;
//   · por cima dele, a onda inteira roda DUAS vezes seguidas sem estrago;
//   · nenhuma função recebe linha de tabela com valor padrão (o Postgres do Supabase barra o ALTER TABLE depois);
//   · montado como o banco estava depois da onda 12 (o install.sql até o começo da primeira migração da onda 13), a onda roda duas
//     vezes, sobe a versão de 9 para 10, deixa o relatório de transparência, o servidor da federação e o diretório sem a porta, e
//     com a trava da entrada ligada o RSS e o mapa não respondem a visitante.
// Uso: npm run testar:alumia-onda13
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
/** A ordem da onda 13 (a mesma do fim do install.sql e do SQL único da onda). A frente do leve não tem SQL. */
const ORDEM = [
  "20261119-alumia-o13-apoio.sql",
  "20261119-alumia-o13-mapa.sql",
  "20261119-alumia-o13-alcance.sql",
  "20261119-alumia-o13-pontes.sql",
  "20261119-alumia-onda13-fim.sql",
];
/** Os interruptores novos da onda (lib/recursos.ts), todos só pelo nome e desligados. */
const NOVOS = ["alumia-mapa", "alumia-ao-vivo", "alumia-alcance", "alumia-leve", "alumia-traducao", "alumia-telegram"];
const pasta = path.join(raiz, "supabase", "migracoes");
const daOnda = fs.readdirSync(pasta).filter((n) => /^20261119-alumia-(o13-.+|onda13-fim)\.sql$/.test(n));
ok(`toda migração da onda 13 está na ordem (fora dela: ${daOnda.filter((n) => !ORDEM.includes(n)).join(", ") || "nenhuma"})`, daOnda.length === ORDEM.length && daOnda.every((n) => ORDEM.includes(n)));
const migracoes = ORDEM.map((n) => ({ nome: n, sql: ler(`supabase/migracoes/${n}`) }));
const install = normal(ler("supabase/install.sql"));
const posicoes = migracoes.map(({ sql }) => install.lastIndexOf(normal(sql)));
ok("cada migração da onda está inteira (idêntica) no install.sql", posicoes.every((i) => i > 0));
ok("e na ordem certa, depois do fim da onda 12", posicoes.every((i, k) => k === 0 || i > posicoes[k - 1]) && posicoes[0] > install.lastIndexOf(normal(ler("supabase/migracoes/20261118-alumia-onda12-fim.sql"))));
ok("o fim da onda está no fim do install.sql (depois dele, só migrações datadas que entraram depois)", noFimDoInstall(migracoes.at(-1).sql));
const fim = migracoes.at(-1).sql;
ok("o fim sobe a versão para 10", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 10\s*\$\$/.test(fim));
ok("só o fim mexe na versão", migracoes.slice(0, -1).every(({ sql }) => !/function public\.rede_alumia_versao/.test(sql)));
ok("toda migração da onda termina passando a porta", migracoes.every(({ sql }) => /interno\.alumia_trancar\(\)/.test(normal(sql).slice(-400))));
ok("o código espera a versão 10 do banco ou mais", Number((ler("lib/rede/painel/tipos.ts").match(/VERSAO_ESPERADA_DO_BANCO = (\d+);/) ?? [])[1]) >= 10);
ok("nenhuma migração da onda redefine a lista de exceções da porta (a da onda 9, com a federação e o diretório, vale)", migracoes.every(({ sql }) => !/function interno\.alumia_porta_aberta\(/.test(sql)));
{
  // Duas migrações da onda não redefinem a mesma função (o git não acusa esse conflito; a segunda apagaria a primeira).
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
  ok("nenhuma frente redefine a regra de quem vê (rede2_pode_ver, rede_ve, rede_silenciado, rede_post_v2)", migracoes.every(({ sql }) => !/function interno\.(rede2_pode_ver|rede_ve|rede_silenciado|rede_post_v2)\(/.test(sql)));
  // O mapa guarda só o município: nenhuma coluna de posição.
  const mapa = migracoes.find((m) => m.nome.endsWith("o13-mapa.sql")).sql.replace(/--.*$/gm, "");
  ok("o mapa não tem coluna de posição", !/\b(lat|lng|lon|latitude|longitude|geom|geometria)\s+(numeric|double|real|float|point|geometry|geography)/i.test(mapa));
}
// Nenhuma tabela nova da onda guarda endereço de rede (decisão de 13/11).
for (const { nome, sql } of migracoes) {
  const tabelas = [...sql.matchAll(/create table if not exists (interno\.[a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi)];
  const comIp = tabelas.filter(([, , corpo]) => /\b(ip|endereco_ip|ip_origem|inet)\b/i.test(corpo.replace(/--.*$/gm, ""))).map(([, t]) => t);
  ok(`${nome}: nenhuma tabela com coluna de endereço de rede (${comIp.join(", ") || "nenhuma"})`, comIp.length === 0);
  ok(`${nome}: nenhuma tabela nova fora do esquema interno`, !/create table (?:if not exists )?(?!interno\.)[a-z_]+\./i.test(sql.replace(/--.*$/gm, "")));
}

// ═══════════════════ 0b. O que as frentes deixaram para quem junta ═══════════════════
{
  const encaixes = ler("components/rede/encaixes.tsx");
  for (const f of ["alcance", "pontes", "leve"]) ok(`o encaixe ${f} está importado`, encaixes.includes(`import { encaixe as ${f} } from "./${f}/encaixe";`));
  ok("o leve é o último da lista das frentes (o antesDePublicar dele roda depois dos outros), com as pontes logo antes", /midia, pontes, leve,\n\];/.test(encaixes));
  ok("levar para fora vem depois da Estrutura (a aba Levar depois dela)", /estrutura,\n\s+alcance,/.test(encaixes));

  const recursos = ler("lib/recursos.ts");
  const backend = ler("supabase/migracoes/2026-11-backend-1.sql");
  for (const r of NOVOS) {
    ok(`${r} existe e só liga pelo nome (desligado)`, recursos.includes(`"${r}": "`) && new RegExp(`SO_PELO_NOME[^;]*"${r}"`).test(recursos) && !new RegExp(`PADRAO[^;]*"${r}"`).test(recursos));
    ok(`o catálogo leva ${r}, só pelo nome, no install.sql, no backend-1 e no fim`, [install, backend, fim].every((x) => x.includes(`('${r}', true)`)));
  }

  const registro = ler("components/rede/registro.tsx");
  for (const [nome, caminho] of [["mapa", "./mapa/TelaDoMapa"], ['"ao-vivo"', "./aovivo/TelaAoVivo"], ["pontes", "./pontes/TelaDasPontes"], ["trabalhadores", "./pontes/TelaDosTrabalhadores"]]) {
    ok(`a tela ${nome} está no registro com import dinâmico`, new RegExp(`\\n\\s+${nome}: \\{ componente: dynamic(<PropsDaTelaDoPacote>)?\\(\\(\\) => import\\("${caminho.replace(/\./g, "\\.")}"\\), \\{ ssr: false \\}\\)`).test(registro));
  }
  const rotas = ler("lib/rede/rotas-novas.ts");
  ok("a rota leve tem interruptor próprio (não é mais tela em construção)", rotas.includes(`{ nome: "leve", caminho: "/leve", flag: "alumia-leve"`));
  ok("as rotas pontes e trabalhadores vêm com as organizações, sem indexar",
    rotas.includes(`{ nome: "pontes", caminho: "/pontes", flag: "alumia-org", frente: "13E", indexar: false }`) && rotas.includes(`{ nome: "trabalhadores", caminho: "/trabalhadores", flag: "alumia-org", frente: "13E", indexar: false }`));
  for (const n of ["pontes", "trabalhadores"]) ok(`a página /alumia/${n} existe e pede a tela ${n}`, ler(`app/[lang]/alumia/${n}/page.tsx`).includes(`<PaginaNova nome="${n}"`));
  const alumia = ler("lib/rede/alumia.ts");
  ok("o mapa, as pontes e o mural abrem no endereço próprio da Alumia", ['"mapa"', '"pontes"', '"trabalhadores"'].every((x) => alumia.includes(x)));
  const achar = (o, k) => (o && typeof o === "object" ? (k in o ? o[k] : Object.values(o).map((v) => achar(v, k)).find(Boolean)) : undefined);
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler(`i18n/rede/onda5/${l}.json`));
    ok(`o título das pontes e do mural em ${l}`, !!achar(j, "pontes")?.titulo && !!achar(j, "trabalhadores")?.titulo);
  }
  ok("o perfil mostra o rótulo de robô no alto, só com as organizações ligadas", ler("components/rede/perfil/PerfilDaAlumia2.tsx").includes("pontesLigadas() && !previa() ? <RotuloDoPerfil"));
  // O mapa não carrega nada de fora: nenhum endereço http(s) nas telas e na biblioteca do mapa (fora dos comentários).
  const doMapa = ["components/rede/mapa/TelaDoMapa.tsx", "components/rede/mapa/MapaDoBrasil.tsx", "lib/rede/mapa/cliente.ts"]
    .map(ler).join("\n").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  ok("o mapa não carrega nada de fora", !/https?:\/\//.test(doMapa));

  const pacote = JSON.parse(ler("package.json")).scripts;
  for (const t of ["apoio", "mapa", "alcance", "leve", "pontes"]) ok(`package.json: testar:alumia-o13-${t}`, (pacote[`testar:alumia-o13-${t}`] ?? "").includes(`scripts/testar-alumia-o13-${t}.mjs`));
  ok("package.json: testar:alumia-onda13", (pacote["testar:alumia-onda13"] ?? "").includes("scripts/testar-alumia-onda13.mjs"));
}

const onda = migracoes.map(({ sql }) => sql).join("\n");
const FUNCOES_DA_REDE = `
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid)) as aberta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`;
const semPorta = async (dono) => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`);
/** As funções públicas que as frentes da onda 13 criaram (pelo texto das migrações): todas têm de ter a porta. */
const DA_ONDA = [...new Set([...onda.matchAll(/create (?:or replace )?function public\.([a-z0-9_]+)\s*\(/gi)].map((m) => m[1].toLowerCase()))].filter((n) => n !== "rede_alumia_versao");
const comPorta = async (dono) =>
  (await dono(`select p.proname, bool_and(p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' or interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))
        or not (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) as porta
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any ($1::text[]) group by p.proname`, [DA_ONDA])).rows;
const todasComPorta = (r) => {
  const faltam = DA_ONDA.filter((n) => !r.some((x) => x.proname === n && x.porta));
  if (faltam.length) console.log("  sem porta ou ausentes:", faltam.join(", "));
  return DA_ONDA.length > 40 && faltam.length === 0;
};
/** Função (public ou interno) com parâmetro do tipo linha de tabela que tem valor padrão: o Supabase de verdade barra o ALTER TABLE. */
const LINHA_COM_PADRAO = `
  select p.oid::regprocedure::text as f
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'interno') and p.pronargdefaults > 0
    and exists (select 1 from unnest(p.proargtypes::oid[]) with ordinality t(o, i)
                join pg_type ty on ty.oid = t.o join pg_class c on c.oid = ty.typrelid
                where ty.typtype = 'c' and c.relkind in ('r', 'p') and t.i > p.pronargs - p.pronargdefaults)`;
/** O caixa e a petição do B1 que o apoio refaz: com a mesma assinatura, cada um fica com uma versão só. */
const DO_B1 = ["rede_org_caixa", "rede_org_caixa_criar", "rede_peticao", "rede_peticao_criar", "rede_peticao_assinar", "rede_peticao_encerrar"];
const versoesDoB1 = async (dono) => (await dono("select proname, count(*)::int as n from pg_proc where pronamespace = 'public'::regnamespace and proname = any ($1::text[]) group by 1", [DO_B1])).rows;
const umaVersaoCada = (r) => r.length === DO_B1.length && r.every((x) => x.n === 1);

// ═══════════════════ 1. Do zero ═══════════════════
{
  const banco = await criarBanco();
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o install.sql sobe do zero e responde a versão 10 ou mais (as ondas seguintes sobem), para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.5" }, "rede_alumia_versao"), (v) => v >= 10);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera(`as ${DA_ONDA.length} funções públicas da onda 13 passam pela porta (ou só o servidor as chama)`, () => comPorta(dono), todasComPorta);
  await espera("nenhuma função recebe linha de tabela com valor padrão", async () => (await dono(LINHA_COM_PADRAO)).rows.map((r) => r.f), (l) => l.length === 0);
  await espera("os seis interruptores da onda estão no catálogo, só pelo nome", async () => (await dono("select nome from interno.recursos_catalogo where nome = any ($1::text[]) and so_pelo_nome order by 1", [NOVOS])).rows.map((r) => r.nome), (n) => n.join() === [...NOVOS].sort().join());
  await espera("e nascem desligados no banco", async () => (await dono("select count(*)::int as n from interno.recursos_vivos where nome = any ($1::text[]) and ligado", [NOVOS])).rows[0].n, (n) => n === 0);
  await espera("o caixa e a petição do B1 têm uma versão só cada (a do apoio)", () => versoesDoB1(dono), umaVersaoCada);
  await espera("a onda roda de novo por cima do install.sql", () => exec(onda));
  await espera("e mais uma vez, sem estrago (idempotente)", () => exec(onda));
  await espera("a versão é a da onda 13 (10), já que o fim dela rodou por último, e sem porta aberta", async () => [await rpc({ papel: "anon", ip: "203.0.113.6" }, "rede_alumia_versao"), (await dono("select interno.alumia_trancar() as r")).rows[0].r], ([v, r]) => v === 10 && r.abertas.length === 0);
  await espera("e sem função pública sem porta", () => semPorta(dono), (l) => l.length === 0);
  await espera("e o caixa e a petição continuam com uma versão só", () => versoesDoB1(dono), umaVersaoCada);
  await espera("nenhuma tabela nova da onda tem coluna de endereço de rede ou de posição", async () => (await dono(`select table_name || '.' || column_name as c from information_schema.columns
      where table_schema = 'interno' and table_name in ('rede_ama', 'rede_ama_perguntas', 'rede_org_caixa_contas')
        and (data_type = 'inet' or column_name ~ '(^ip$|_ip$|^ip_|latitude|longitude|^lat$|^lng$)')`)).rows.map((r) => r.c), (l) => l.length === 0);
  await banco.pg.close?.();
}

// ═══════════════════ 2. O banco depois da onda 12 ═══════════════════
{
  const banco = await criarBanco({ antesDe: migracoes[0].sql });
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o banco de antes responde a versão 9 (onda 12)", () => rpc({ papel: "anon", ip: "203.0.113.7" }, "rede_alumia_versao"), (v) => v === 9);
  await espera("a onda 13 inteira roda sobre o banco da onda 12", () => exec(onda));
  await espera("e de novo, logo em seguida, sem estrago (idempotente)", () => exec(onda));
  await espera("rede_alumia_versao() = 10, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.8" }, "rede_alumia_versao"), (v) => v === 10);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera(`as ${DA_ONDA.length} funções públicas da onda 13 passam pela porta (ou só o servidor as chama)`, () => comPorta(dono), todasComPorta);
  await espera("nenhuma função recebe linha de tabela com valor padrão", async () => (await dono(LINHA_COM_PADRAO)).rows.map((r) => r.f), (l) => l.length === 0);
  await espera("os seis interruptores da onda estão no catálogo, só pelo nome", async () => (await dono("select count(*)::int as n from interno.recursos_catalogo where nome = any ($1::text[]) and so_pelo_nome", [NOVOS])).rows[0].n, (n) => n === NOVOS.length);
  await espera("o caixa e a petição do B1 têm uma versão só cada (a do apoio)", () => versoesDoB1(dono), umaVersaoCada);
  await espera("o relatório de transparência, o servidor da federação, o diretório e a revisão de conta continuam sem a porta", async () => (await dono("select bool_or(prosrc ~ 'interno\\.alumia_porta\\(\\)') as t, count(*)::int as n from pg_proc where proname in ('alumia_transparencia', 'rede_fed_servidor', 'rede_org_diretorio', 'rede_org_mapa', 'alumia_lei_minha_conta', 'alumia_triagem_convites')")).rows[0], (r) => r.t === false && r.n >= 6);
  await espera("o RSS, o cartão, o mapa e o ao vivo abertos a visitante passam pela porta", async () => (await dono("select bool_and(prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)') as p, count(*)::int as n from pg_proc where pronamespace = 'public'::regnamespace and proname in ('rede_alc_rss', 'rede_alc_post', 'rede_mapa', 'rede_ama_lista', 'rede_ama', 'rede_ama_agenda')")).rows[0], (r) => r.p === true && r.n === 6);
  await espera("a coordenação liga a trava (nenhuma porta aberta)", async () => (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r?.exigir === true);
  await espera("com a trava ligada, visitante não lê o RSS nem o mapa", async () => {
    const recusou = async (f, a) => {
      try {
        await rpc({ papel: "anon", ip: "203.0.113.11" }, f, a);
        return false;
      } catch {
        return true;
      }
    };
    return [await recusou("rede_alc_rss", { p_tipo: "comunidade", p_nome: "qualquer" }), await recusou("rede_mapa")];
  }, (r) => r.every(Boolean));
  await espera("com a trava ligada, visitante ainda lê o relatório de transparência e o diretório das organizações", async () => [await rpc({ papel: "anon", ip: "203.0.113.9" }, "alumia_transparencia"), await rpc({ papel: "anon", ip: "203.0.113.10" }, "rede_org_diretorio", { p: {} })],
    ([t, d]) => t && typeof t === "object" && Array.isArray(d?.itens));
  await dono("select interno.alumia_entrada_ligar(false)");
  await banco.pg.close?.();
}

console.log(`\nfecho da onda 13: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
