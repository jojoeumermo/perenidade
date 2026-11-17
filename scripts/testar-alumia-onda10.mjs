// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fecho da onda 10: as migrações 20261116-alumia-o10-*.sql e o fim (20261116-alumia-onda10-fim.sql) estão coladas, inteiras e
// na ordem, no fim do install.sql; e, num Postgres de verdade (scripts/banco-local.mjs):
//   · o install.sql sobe do zero, com a versão 7 e nenhuma função public.rede_*/alumia_* sem porta;
//   · por cima dele, a onda inteira roda DUAS vezes seguidas sem estrago;
//   · os avisos de marcação, "Estou bem" e "Fui detido" são tipos que a pessoa liga e desliga (desligado no site, não chega);
//   · os seletores da moderação recebem o nome de cada comunidade (rede_mod_escopo → nomes);
//   · montado como o banco estava depois da onda 9 (o install.sql até o começo da primeira migração da onda 10), a onda roda duas
//     vezes, sobe a versão de 6 para 7 e deixa o relatório de transparência, o servidor da federação e o diretório sem a porta.
// Uso: npm run testar:alumia-onda10
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
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
/** A ordem da onda 10 (a mesma do fim do install.sql e do SQL único da onda). */
const ORDEM = [
  "20261116-alumia-o10-forum.sql",
  "20261116-alumia-o10-cargos.sql",
  "20261116-alumia-o10-estrutura.sql",
  "20261116-alumia-o10-acervo.sql",
  "20261116-alumia-o10-decisao.sql",
  "20261116-alumia-o10-atos.sql",
  "20261116-alumia-onda10-fim.sql",
];
const pasta = path.join(raiz, "supabase", "migracoes");
const daOnda = fs.readdirSync(pasta).filter((n) => /^20261116-alumia-(o10-.+|onda10-fim)\.sql$/.test(n));
ok(`toda migração da onda 10 está na ordem (fora dela: ${daOnda.filter((n) => !ORDEM.includes(n)).join(", ") || "nenhuma"})`, daOnda.length === ORDEM.length && daOnda.every((n) => ORDEM.includes(n)));
const migracoes = ORDEM.map((n) => ({ nome: n, sql: ler(`supabase/migracoes/${n}`) }));
const install = normal(ler("supabase/install.sql"));
const posicoes = migracoes.map(({ sql }) => install.lastIndexOf(normal(sql)));
ok("cada migração da onda está inteira (idêntica) no install.sql", posicoes.every((i) => i > 0));
ok("e na ordem certa, depois do fim da onda 9", posicoes.every((i, k) => k === 0 || i > posicoes[k - 1]) && posicoes[0] > install.lastIndexOf(normal(ler("supabase/migracoes/20261115-alumia-onda9-fim.sql"))));
ok("o fim da onda está no install.sql (depois dele, só migrações datadas que entraram depois)", noFimDoInstall(migracoes.at(-1).sql));
const fim = migracoes.at(-1).sql;
ok("o fim sobe a versão para 7", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 7\s*\$\$/.test(fim));
ok("só o fim mexe na versão", migracoes.slice(0, -1).every(({ sql }) => !/function public\.rede_alumia_versao/.test(sql)));
ok("toda migração da onda termina passando a porta", migracoes.every(({ sql }) => /interno\.alumia_trancar\(\)/.test(normal(sql).slice(-400))));
ok("o código espera a versão 7 do banco ou mais", Number((ler("lib/rede/painel/tipos.ts").match(/VERSAO_ESPERADA_DO_BANCO = (\d+);/) ?? [])[1]) >= 7);
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
  const pisadas = [...nomes(fim)].filter((f) => vistos.has(f));
  ok(`o fim não redefine função de nenhuma frente (${pisadas.join(", ") || "nenhuma"})`, pisadas.length === 0);
  ok("nenhuma frente redefine a regra de quem vê (rede2_pode_ver, rede_ve, rede_silenciado, rede_post_v2)", migracoes.every(({ sql }) => !/function interno\.(rede2_pode_ver|rede_ve|rede_silenciado|rede_post_v2)\(/.test(sql)));
}
// Os tipos de aviso: a lista do banco é a mesma de lib/rede/tipos-avisos.ts, na mesma ordem.
{
  const doTs = [...(ler("lib/rede/tipos-avisos.ts").match(/export const TIPOS_DE_AVISO = \[([\s\S]*?)\] as const;/)?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  const doSql = [...(fim.match(/function interno\.rede_alumia_tipos_de_aviso\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  ok(`os tipos de aviso do banco e da tela são os mesmos, na mesma ordem (${doTs.join(",")} / ${doSql.join(",")})`, doTs.length > 0 && doTs.join() === doSql.join());
  ok("marcação, estou bem e detido entram na lista", ["marcacao", "estou_bem", "detido"].every((t) => doTs.includes(t)));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const a = JSON.parse(ler(`i18n/rede/avisos/${l}.json`));
    ok(`${l}: cada tipo ligável tem rótulo e frases`, doTs.every((t) => typeof a.prefs.site.tipos[t] === "string") && ["marcacao", "estou_bem", "detido"].every((t) => typeof a.frases[t]?.um === "string"));
  }
}
// Nenhuma tabela nova da onda guarda endereço de rede (decisão de 13/11).
for (const { nome, sql } of migracoes) {
  const tabelas = [...sql.matchAll(/create table if not exists (interno\.[a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi)];
  const comIp = tabelas.filter(([, , corpo]) => /\b(ip|endereco_ip|ip_origem|inet)\b/i.test(corpo.replace(/--.*$/gm, ""))).map(([, t]) => t);
  ok(`${nome}: nenhuma tabela com coluna de endereço de rede (${comIp.join(", ") || "nenhuma"})`, comIp.length === 0);
  ok(`${nome}: nenhuma tabela nova fora do esquema interno`, !/create table (?:if not exists )?(?!interno\.)[a-z_]+\./i.test(sql.replace(/--.*$/gm, "")));
}
// As abas da comunidade entram só pelo encaixe, numa ordem só.
{
  const pagina = ler("components/rede/comunidades/PaginaDaComunidadeAlumia.tsx");
  ok("a página da comunidade desenha as abas do encaixe abasDaComunidade (sem importar nenhuma aba da onda 10 direto)", /ENCAIXES\.abasDaComunidade\.filter\(\(a\) => a\.chave !== "atos"\)/.test(pagina) && !/from "\.\/(forum|cargos|estrutura|acervo|decisao)\//.test(pagina));
  const encaixes = ler("components/rede/encaixes.tsx");
  ok("os encaixes da onda 10 estão na lista das frentes", ["decisao", "acervo", "cargos", "estrutura"].every((n) => new RegExp(`import \\{ encaixe as ${n} \\} from "\\./comunidades/${n}/encaixe"`).test(encaixes)) && /modoato, decisao, acervo, cargos, estrutura[,\]]/.test(encaixes));
  ok("o alto do Início tem a ordem no código (a barra do modo ato primeiro), não no CSS", /ordenarTopoDaLinha\(FRENTES, modoato,/.test(encaixes) && !/\.ma-barra \{ order:/.test(ler("styles/alumia.css")));
}

const onda = migracoes.map(({ sql }) => sql).join("\n");
const FUNCOES_DA_REDE = `
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid)) as aberta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`;
const semPorta = async (dono) => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`);
/** As funções públicas que as frentes da onda 10 criaram (pelo texto das migrações): todas têm de ter a porta. */
const DA_ONDA = [...new Set([...onda.matchAll(/create (?:or replace )?function public\.([a-z0-9_]+)\s*\(/gi)].map((m) => m[1].toLowerCase()))].filter((n) => n !== "rede_alumia_versao");

// ═══════════════════ 1. Do zero ═══════════════════
{
  const banco = await criarBanco();
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o install.sql sobe do zero e responde a versão 7 ou mais, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.5" }, "rede_alumia_versao"), (v) => v >= 7);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  // As que só o servidor do site chama (service_role, como a apuração da votação secreta) não precisam da porta: anon e
  // authenticated nem as executam.
  await espera(`as ${DA_ONDA.length} funções públicas da onda 10 passam pela porta (ou só o servidor as chama)`, async () => (await dono(`select p.proname, bool_and(p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' or interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))
        or not (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) as porta
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any ($1::text[]) group by p.proname`, [DA_ONDA])).rows,
    (r) => {
      const faltam = DA_ONDA.filter((n) => !r.some((x) => x.proname === n && x.porta));
      if (faltam.length) console.log("  sem porta ou ausentes:", faltam.join(", "));
      return DA_ONDA.length > 10 && faltam.length === 0;
    });
  await espera("a onda roda de novo por cima do install.sql", () => exec(onda));
  await espera("e mais uma vez, sem estrago (idempotente)", () => exec(onda));
  await espera("fica na versão 7 (o fim da onda 10 rodado de novo) e sem porta aberta", async () => [await rpc({ papel: "anon", ip: "203.0.113.6" }, "rede_alumia_versao"), (await dono("select interno.alumia_trancar() as r")).rows[0].r], ([v, r]) => v === 7 && r.abertas.length === 0);
  await espera("e sem função pública sem porta", () => semPorta(dono), (l) => l.length === 0);

  // ── Os tipos de aviso ligáveis e o nome nos seletores da moderação ──
  let ip = 20;
  const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  const P = {};
  for (const nome of ["ana", "bia"]) {
    P[nome] = await banco.criarUsuario(`${nome}@onda10.local`, nome);
    await rpc(como(P[nome]), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1, rede_modo = 'aberto', rede_invisivel = false where id = $1", [P[nome], `Codinome ${nome}`, `onda10_${nome}`]);
    await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
  }
  await dono("delete from interno.papeis");
  await dono("update auth.users set created_at = now() - interval '30 days'");
  await espera("as preferências mostram marcação, estou bem e detido (ligados no site)", () => rpc(como(P.ana), "rede_aviso_prefs_ver"),
    (r) => ["marcacao", "estou_bem", "detido"].every((t) => r?.site?.[t] === true));
  await espera("ana desliga o aviso de detido no site", () => rpc(como(P.ana), "rede_aviso_prefs_salvar", { p_tipo: "detido", p_canal: "site", p_ligado: false }));
  await espera("e o de estou bem continua ligado", () => rpc(como(P.ana), "rede_aviso_prefs_ver"), (r) => r?.site?.detido === false && r?.site?.estou_bem === true);
  await espera("o recado de detido não vira aviso para ela; o de estou bem vira", async () => {
    await dono("select interno.alumia_ato_avisar($1, 'detido', $2)", [P.ana, P.bia]);
    await dono("select interno.alumia_ato_avisar($1, 'estou_bem', $2)", [P.ana, P.bia]);
    return (await dono("select tipo from interno.avisos where para = $1 and tipo in ('detido', 'estou_bem')", [P.ana])).rows.map((r) => r.tipo);
  }, (t) => t.length === 1 && t[0] === "estou_bem");
  await espera("tipo fora da lista continua recusado", () => rpc(como(P.ana), "rede_aviso_prefs_salvar", { p_tipo: "inventado", p_canal: "site", p_ligado: false }).then(() => "passou", (e) => String(e.message)), (m) => m !== "passou");

  await dono("insert into interno.rede_comunidades (slug, nome, descricao, categoria, tipo) values ('moradia-onda10', 'Moradia digna', 'Comunidade do teste do fecho da onda 10.', 'lutas', 'aberta') on conflict do nothing");
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ('moradia-onda10', $1, 'moderacao', 'ativo') on conflict do nothing", [P.ana]);
  await espera("rede_mod_escopo devolve o nome de cada comunidade que ela modera", () => rpc(como(P.ana), "rede_mod_escopo"),
    (r) => r?.comunidades?.includes("moradia-onda10") && r?.nomes?.["moradia-onda10"] === "Moradia digna");
  await espera("e nada de nomes para quem não modera", () => rpc(como(P.bia), "rede_mod_escopo"), (r) => r && Object.keys(r.nomes ?? {}).length === 0);
  await banco.pg.close?.();
}

// ═══════════════════ 2. O banco depois da onda 9 ═══════════════════
{
  const banco = await criarBanco({ antesDe: migracoes[0].sql });
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o banco de antes responde a versão 6 (onda 9)", () => rpc({ papel: "anon", ip: "203.0.113.7" }, "rede_alumia_versao"), (v) => v === 6);
  await espera("a onda 10 inteira roda sobre o banco da onda 9", () => exec(onda));
  await espera("e de novo, logo em seguida, sem estrago (idempotente)", () => exec(onda));
  await espera("rede_alumia_versao() = 7, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.8" }, "rede_alumia_versao"), (v) => v === 7);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", () => semPorta(dono), (l) => l.length === 0);
  await espera("o relatório de transparência, o servidor da federação, o diretório e a revisão de conta continuam sem a porta", async () => (await dono("select bool_or(prosrc ~ 'interno\\.alumia_porta\\(\\)') as t, count(*)::int as n from pg_proc where proname in ('alumia_transparencia', 'rede_fed_servidor', 'rede_org_diretorio', 'rede_org_mapa', 'alumia_lei_minha_conta', 'alumia_triagem_convites')")).rows[0], (r) => r.t === false && r.n >= 6);
  await espera("a regra das preferências aceita os três tipos novos sem perder os de antes", async () => (await dono("select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'interno.rede_avisos_prefs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~* '[^_]tipo'")).rows.map((r) => r.d).join(" "),
    (d) => ["marcacao", "estou_bem", "detido", "resposta", "lembrete", "resumo"].every((t) => d.includes(t)));
  await espera("a coordenação liga a trava (nenhuma porta aberta)", async () => (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r?.exigir === true);
  await espera("com a trava ligada, visitante ainda lê o relatório de transparência e o diretório das organizações", async () => [await rpc({ papel: "anon", ip: "203.0.113.9" }, "alumia_transparencia"), await rpc({ papel: "anon", ip: "203.0.113.10" }, "rede_org_diretorio", { p: {} })],
    ([t, d]) => t && typeof t === "object" && Array.isArray(d?.itens));
  await dono("select interno.alumia_entrada_ligar(false)");
  await banco.pg.close?.();
}

console.log(`\nfecho da onda 10: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
