// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fecho da onda 12: as migrações 20261118-alumia-o12-*.sql e o fim (20261118-alumia-onda12-fim.sql) estão coladas, inteiras e
// na ordem, no fim do install.sql; o que as frentes deixaram para quem junta está nas telas; e, num Postgres de verdade
// (scripts/banco-local.mjs):
//   · o install.sql sobe do zero, com a versão 9 e nenhuma função public.rede_*/alumia_* sem porta;
//   · por cima dele, a onda inteira roda DUAS vezes seguidas sem estrago;
//   · nenhuma função recebe linha de tabela com valor padrão (o Postgres do Supabase barra o ALTER TABLE depois);
//   · montado como o banco estava depois da onda 11 (o install.sql até o começo da primeira migração da onda 12), a onda roda duas
//     vezes, sobe a versão de 8 para 9 e deixa o relatório de transparência, o servidor da federação e o diretório sem a porta.
// Uso: npm run testar:alumia-onda12
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8").replace(/\r\n/g, "\n");
const normal = (t) => t.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();

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
/** A ordem da onda 12 (a mesma do fim do install.sql e do SQL único da onda). */
const ORDEM = [
  "20261118-alumia-o12-compositor.sql",
  "20261118-alumia-o12-midia.sql",
  "20261118-alumia-o12-coautoria.sql",
  "20261118-alumia-o12-perfil.sql",
  "20261118-alumia-o12-org.sql",
  "20261118-alumia-onda12-fim.sql",
];
const pasta = path.join(raiz, "supabase", "migracoes");
const daOnda = fs.readdirSync(pasta).filter((n) => /^20261118-alumia-(o12-.+|onda12-fim)\.sql$/.test(n));
ok(`toda migração da onda 12 está na ordem (fora dela: ${daOnda.filter((n) => !ORDEM.includes(n)).join(", ") || "nenhuma"})`, daOnda.length === ORDEM.length && daOnda.every((n) => ORDEM.includes(n)));
const migracoes = ORDEM.map((n) => ({ nome: n, sql: ler(`supabase/migracoes/${n}`) }));
const install = normal(ler("supabase/install.sql"));
const posicoes = migracoes.map(({ sql }) => install.lastIndexOf(normal(sql)));
ok("cada migração da onda está inteira (idêntica) no install.sql", posicoes.every((i) => i > 0));
ok("e na ordem certa, depois do fim da onda 11", posicoes.every((i, k) => k === 0 || i > posicoes[k - 1]) && posicoes[0] > install.lastIndexOf(normal(ler("supabase/migracoes/20261117-alumia-onda11-fim.sql"))));
ok("o fim da onda está no fim do install.sql (depois dele, só migrações datadas que entraram depois)", noFimDoInstall(migracoes.at(-1).sql));
const fim = migracoes.at(-1).sql;
ok("o fim sobe a versão para 9", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 9\s*\$\$/.test(fim));
ok("só o fim mexe na versão", migracoes.slice(0, -1).every(({ sql }) => !/function public\.rede_alumia_versao/.test(sql)));
ok("toda migração da onda termina passando a porta", migracoes.every(({ sql }) => /interno\.alumia_trancar\(\)/.test(normal(sql).slice(-400))));
ok("o código espera a versão 9 do banco ou mais", Number((ler("lib/rede/painel/tipos.ts").match(/VERSAO_ESPERADA_DO_BANCO = (\d+);/) ?? [])[1]) >= 9);
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
  // A da voz e do vídeo refaz a cota e o painel do espaço da onda 11: o depósito do álbum não pode sumir.
  const midia = migracoes.find((m) => m.nome.endsWith("o12-midia.sql")).sql;
  ok("a cota refeita pela voz e vídeo ainda soma as fotos do álbum", /function interno\.alumia_midia_uso\([\s\S]*?rede-album[\s\S]*?end \$\$/.test(midia));
  ok("o painel do espaço refeito ainda mostra o álbum e passa a mostrar o vídeo", /function public\.alumia_painel_espaco\([\s\S]*?'rede-album', coalesce[\s\S]*?'rede-video', coalesce/.test(midia));
  ok("a fila de arquivos aceita os quatro depósitos", /check \(deposito in \('rede-midia', 'rede-stories', 'rede-album', 'rede-video'\)\)/.test(midia));
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
  ok("o encaixe da coautoria está na lista das frentes, logo depois de publicar", /import \{ encaixe as coautoria \} from "\.\/coautoria\/encaixe"/.test(encaixes) && /publicar, coautoria, atos,/.test(encaixes));
  ok("o encaixe da voz e do vídeo está na lista das frentes, depois das conquistas", /import \{ encaixe as midia \} from "\.\/midia\/encaixe"/.test(encaixes) && /conquistas, midia,/.test(encaixes));
  const anexos = ler("components/rede/publicar/alumia2/AnexosDoEscrever.tsx");
  ok("o Escrever pendura a ferramenta e o cartão do vídeo (só com o vídeo ligado)", /compositorDaMidia\.Ferramenta/.test(anexos) && /compositorDaMidia\.Cartao/.test(anexos) && /from "\.\.\/\.\.\/midia\/encaixe"/.test(anexos));
  const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
  ok("o Escrever liga o vídeo ao post antes do aoPublicar (no post e no fio)", (escrever.match(/compositorDaMidia\.depoisDePublicar\(/g) ?? []).length === 2 && /depoisDePublicar\(post, \{ lang, s, situacao \}\) : null;\n\s*aoPublicar\(post\);/.test(escrever));
  ok("o Escrever passa o contexto dos encaixes aos anexos", /ctx=\{\{ lang, s, situacao \}\}/.test(escrever));

  const recursos = ler("lib/recursos.ts");
  for (const r of ["alumia-coautoria", "alumia-video-post"]) {
    ok(`${r} existe e só liga pelo nome (desligado)`, new RegExp(`"${r}": "`).test(recursos) && new RegExp(`SO_PELO_NOME[^;]*"${r}"`).test(recursos) && !new RegExp(`PADRAO[^;]*"${r}"`).test(recursos));
    ok(`o catálogo leva ${r}, só pelo nome, no install.sql, no backend-1 e no fim`, [install, ler("supabase/migracoes/2026-11-backend-1.sql")].every((t) => t.includes(`('${r}', true)`)) && fim.includes(`('${r}', true)`));
  }

  const registro = ler("components/rede/registro.tsx");
  ok("o pacote inicial está no registro com import dinâmico", registro.includes(`"pacote-inicial": { componente: dynamic(() => import("./perfil/secoes/TelaDoPacote"), { ssr: false }), menu: "explorar" }`));
  ok("a página /alumia/pacote/[slug] existe e pede a tela pacote-inicial", /nome: "pacote-inicial"/.test(ler("app/[lang]/alumia/pacote/[slug]/page.tsx")));
  ok("o pacote abre no endereço próprio da Alumia", /"pacote"/.test(ler("lib/rede/alumia.ts")));
  ok("as telas do estudo não marcam Início nem Comunidades (têm item próprio no menu)", ["questoes", "turmas", "agenda", "redacao"].every((n) => new RegExp(`${n}: \\{ componente: [^\\n]*menu: "nenhum" \\}`).test(registro)));
  ok("o painel monta a fila do voluntariado", /FilaDoVoluntariado/.test(ler("components/painel/alumia/Pessoas.tsx")));
  ok("a moderação monta a fila dos links", /FilaDosLinks/.test(ler("components/rede/moderacao/TelaModeracao.tsx")));
  ok("a rota da faxina apaga da fila também o depósito do vídeo", /"rede-video"/.test(ler("app/api/rede/exportar/faxina/route.ts")));

  const pacote = JSON.parse(ler("package.json")).scripts;
  for (const t of ["compositor", "midia", "coautoria", "perfil", "org"]) ok(`package.json: testar:alumia-o12-${t}`, (pacote[`testar:alumia-o12-${t}`] ?? "").includes(`scripts/testar-alumia-o12-${t}.mjs`));
  ok("package.json: testar:alumia-onda12", (pacote["testar:alumia-onda12"] ?? "").includes("scripts/testar-alumia-onda12.mjs"));
  // Nada de lista de pessoas nas peças novas do cartão e do perfil: quem assina junto aparece só depois do aceite.
  ok("a coautoria mostra só quem aceitou", /aceit/i.test(ler("components/rede/coautoria/AnexoDaCoautoria.tsx")));
}

const onda = migracoes.map(({ sql }) => sql).join("\n");
const FUNCOES_DA_REDE = `
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid)) as aberta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`;
const semPorta = async (dono) => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`);
/** As funções públicas que as frentes da onda 12 criaram (pelo texto das migrações): todas têm de ter a porta. */
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

// ═══════════════════ 1. Do zero ═══════════════════
{
  const banco = await criarBanco();
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o install.sql sobe do zero e responde a versão 9 ou mais (as ondas seguintes sobem), para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.5" }, "rede_alumia_versao"), (v) => v >= 9);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera(`as ${DA_ONDA.length} funções públicas da onda 12 passam pela porta (ou só o servidor as chama)`, () => comPorta(dono), todasComPorta);
  await espera("nenhuma função recebe linha de tabela com valor padrão", async () => (await dono(LINHA_COM_PADRAO)).rows.map((r) => r.f), (l) => l.length === 0);
  await espera("os interruptores alumia-coautoria e alumia-video-post estão no catálogo, só pelo nome", async () => (await dono("select nome from interno.recursos_catalogo where nome in ('alumia-coautoria', 'alumia-video-post') and so_pelo_nome order by 1")).rows.map((r) => r.nome), (n) => n.join() === "alumia-coautoria,alumia-video-post");
  await espera("o vídeo nasce desligado no banco", async () => (await dono("select coalesce((select ligado from interno.recursos_vivos where nome = 'alumia-video-post'), false) as l")).rows[0].l, (l) => l === false);
  await espera("a onda roda de novo por cima do install.sql", () => exec(onda));
  await espera("e mais uma vez, sem estrago (idempotente)", () => exec(onda));
  await espera("a versão é a da onda 12 (9), já que o fim dela rodou por último, e sem porta aberta", async () => [await rpc({ papel: "anon", ip: "203.0.113.6" }, "rede_alumia_versao"), (await dono("select interno.alumia_trancar() as r")).rows[0].r], ([v, r]) => v === 9 && r.abertas.length === 0);
  await espera("e sem função pública sem porta", () => semPorta(dono), (l) => l.length === 0);
  await espera("a fila de arquivos tem uma regra só sobre o depósito, com os quatro", async () => (await dono("select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'deposito'")).rows.map((r) => r.d),
    (d) => d.length === 1 && ["rede-midia", "rede-stories", "rede-album", "rede-video"].every((x) => d[0].includes(x)));
  await espera("o gatilho da marcação conferida está lá uma vez só", async () => (await dono("select count(*)::int as n from pg_trigger where tgrelid = 'interno.rede_o9_marcacoes'::regclass and not tgisinternal and tgname = 'rede_marcacao_confere'")).rows[0].n, (n) => n === 1);
  await banco.pg.close?.();
}

// ═══════════════════ 2. O banco depois da onda 11 ═══════════════════
{
  const banco = await criarBanco({ antesDe: migracoes[0].sql });
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o banco de antes responde a versão 8 (onda 11)", () => rpc({ papel: "anon", ip: "203.0.113.7" }, "rede_alumia_versao"), (v) => v === 8);
  await espera("a onda 12 inteira roda sobre o banco da onda 11", () => exec(onda));
  await espera("e de novo, logo em seguida, sem estrago (idempotente)", () => exec(onda));
  await espera("rede_alumia_versao() = 9, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.8" }, "rede_alumia_versao"), (v) => v === 9);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera(`as ${DA_ONDA.length} funções públicas da onda 12 passam pela porta (ou só o servidor as chama)`, () => comPorta(dono), todasComPorta);
  await espera("nenhuma função recebe linha de tabela com valor padrão", async () => (await dono(LINHA_COM_PADRAO)).rows.map((r) => r.f), (l) => l.length === 0);
  await espera("o relatório de transparência, o servidor da federação, o diretório e a revisão de conta continuam sem a porta", async () => (await dono("select bool_or(prosrc ~ 'interno\\.alumia_porta\\(\\)') as t, count(*)::int as n from pg_proc where proname in ('alumia_transparencia', 'rede_fed_servidor', 'rede_org_diretorio', 'rede_org_mapa', 'alumia_lei_minha_conta', 'alumia_triagem_convites')")).rows[0], (r) => r.t === false && r.n >= 6);
  await espera("o resultado do domínio da organização fica só com o servidor (nem visitante nem conta chamam)", async () => (await dono("select has_function_privilege('anon', 'public.rede_org_dominio_resultado(uuid, text, text, boolean, text)', 'execute') as a, has_function_privilege('authenticated', 'public.rede_org_dominio_resultado(uuid, text, text, boolean, text)', 'execute') as b, has_function_privilege('service_role', 'public.rede_org_dominio_resultado(uuid, text, text, boolean, text)', 'execute') as c")).rows[0], (r) => r.a === false && r.b === false && r.c === true);
  await espera("a coordenação liga a trava (nenhuma porta aberta)", async () => (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r?.exigir === true);
  await espera("com a trava ligada, visitante ainda lê o relatório de transparência e o diretório das organizações", async () => [await rpc({ papel: "anon", ip: "203.0.113.9" }, "alumia_transparencia"), await rpc({ papel: "anon", ip: "203.0.113.10" }, "rede_org_diretorio", { p: {} })],
    ([t, d]) => t && typeof t === "object" && Array.isArray(d?.itens));
  await dono("select interno.alumia_entrada_ligar(false)");
  await banco.pg.close?.();
}

console.log(`\nfecho da onda 12: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
