// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a F7 da Escola (docs/plano-2026-11/PLANO-ESCOLA.md, prancha Mapa): os cursos, o campus e a vida real saíram de
// /escola para endereços abertos; os antigos redirecionam (308) com e sem idioma, levando o resto do caminho; as rotas
// novas estão na interdição, no "Mais", nos prédios do campus e no mapa do site; nenhum link interno aponta para o
// endereço antigo (fora os arquivos da F1, que o redirecionamento cobre); os textos novos estão nos 6 idiomas.
// Sem rede, sem navegador. Uso: npm run testar:escola-reorganizacao
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { areaDoCaminho } from "../lib/interdicao.ts";
import { PREDIOS } from "../lib/escola/campus.ts";
import { CURSOS_DA_FORMACAO, cursoAberto, PAGINAS_DA_VIDA, SAIRAM_DA_ESCOLA } from "../lib/escola/site-aberto.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const existe = (...p) => fs.existsSync(path.join(raiz, ...p));
let certos = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];

// ───────────── As pastas ─────────────
for (const { de, para } of SAIRAM_DA_ESCOLA) {
  conferir(`${de} não existe mais dentro da Escola`, !existe("app", "[lang]", ...de.split("/").filter(Boolean)));
  conferir(`${para} tem página`, existe("app", "[lang]", para.slice(1), "page.tsx"));
  conferir(`${para} continua preso ao recurso "escola" (nada abre em produção pela mudança de endereço)`, /if \(!ligado\("escola"\)\) notFound\(\);/.test(ler("app", "[lang]", para.slice(1), "layout.tsx")));
  conferir(`${para} não usa a porta da Escola`, !/PortaDaEscola/.test(ler("app", "[lang]", para.slice(1), "layout.tsx")));
}
for (const p of PAGINAS_DA_VIDA) conferir(`página ${p} existe`, existe("app", "[lang]", ...p.split("/").filter(Boolean), "page.tsx"));
for (const p of ["cursos/[curso]", "cursos/[curso]/modulo/[n]", "cursos/[curso]/zine"]) conferir(`página /${p} existe`, existe("app", "[lang]", ...p.split("/"), "page.tsx"));

// ───────────── Redirecionamentos (next.config.ts) ─────────────
const config = (await import("../next.config.ts")).default;
const regras = await config.redirects();
/** Casa um endereço com as regras como o Next faz para estes formatos (":nome(a|b)", ":nome*" no fim). */
const destinoDe = (url) => {
  for (const r of regras) {
    const nomes = [];
    const fonte = r.source.replace(/\/:([a-z]+)(\(([^)]+)\))?(\*)?/gi, (_, nome, _g, alternativas, estrela) => {
      nomes.push(nome);
      if (estrela) return `(?:/(.*))?`;
      return `/(${alternativas ?? "[^/]+"})`;
    });
    const m = new RegExp(`^${fonte}$`).exec(url);
    if (!m) continue;
    let destino = r.destination;
    nomes.forEach((nome, i) => {
      const valor = m[i + 1] ?? "";
      destino = destino.replace(new RegExp(`/:${nome}\\*`), valor ? `/${valor}` : "").replace(`:${nome}`, valor);
    });
    return { destino, permanente: r.permanent === true };
  }
  return null;
};
const casos = [
  ["/pt/escola/cursos", "/pt/cursos"],
  ["/en/escola/cursos/costura", "/en/cursos/costura"],
  ["/zh/escola/cursos/costura/modulo/2", "/zh/cursos/costura/modulo/2"],
  ["/pt/escola/cursos/aprender-a-estudar/zine", "/pt/cursos/aprender-a-estudar/zine"],
  ["/escola/cursos", "/pt/cursos"],
  ["/escola/cursos/eja-de-ponta-a-ponta", "/pt/cursos/eja-de-ponta-a-ponta"],
  ["/fr/escola/campus", "/fr/campus"],
  ["/escola/campus", "/pt/campus"],
  ["/ru/escola/vida", "/ru/vida"],
  ["/es/escola/vida/caso-do-bairro", "/es/vida/caso-do-bairro"],
  ["/escola/vida/tarefas", "/pt/vida/tarefas"],
];
for (const [de, para] of casos) {
  const achado = destinoDe(de);
  conferir(`${de} → ${para} (308)`, achado?.destino === para && achado.permanente, JSON.stringify(achado));
}
for (const fica of ["/pt/escola", "/pt/escola/cursosx", "/pt/escola/vidas", "/pt/escola/turmas", "/pt/escola/vozes", "/pt/escola/lutas", "/pt/escola/calendario", "/pt/cursos", "/xx/escola/cursos"]) {
  conferir(`${fica} não redireciona`, destinoDe(fica) === null, JSON.stringify(destinoDe(fica)));
}

// ───────────── Interdição, "Mais", campus e mapa do site ─────────────
for (const { para } of SAIRAM_DA_ESCOLA) {
  conferir(`${para} na interdição (área estudo)`, areaDoCaminho(para) === "estudo" && areaDoCaminho(`${para}/qualquer`) === "estudo");
}
const mais = ler("lib", "secoes-do-site.ts");
for (const p of ["/cursos", "/vida"]) {
  conferir(`${p} no "Mais", só com o recurso escola`, new RegExp(`se\\("escola", \\[[^\\]]*"${p}"`).test(mais));
  conferir(`${p} num prédio do campus`, PREDIOS.filter((x) => x.secoes.includes(p)).length === 1);
}
conferir("/campus é página do prédio da escola (passaporte)", PREDIOS.find((x) => x.id === "escola").outras.includes("/campus"));
const mapa = ler("app", "sitemap.ts");
conferir("mapa do site: cursos, campus e vida com o recurso escola", /if \(ligado\("escola"\)\) \{\s*paths\.push\("\/cursos", "\/campus", \.\.\.PAGINAS_DA_VIDA\);/.test(mapa));
conferir("mapa do site: só os cursos abertos", /if \(cursoAberto\(curso\.slug\)\) paths\.push\(`\/cursos\/\$\{curso\.slug\}`\)/.test(mapa));
conferir("Ano de formação política fica para a Formação", CURSOS_DA_FORMACAO.includes("ano-de-formacao-politica") && !cursoAberto("ano-de-formacao-politica") && cursoAberto("costura"));
conferir("o catálogo aberto filtra", /cursos\.filter\(\(c\) => cursoAberto\(c\.slug\)\)/.test(ler("app", "[lang]", "cursos", "page.tsx")));
conferir("campus e vida sem link de volta para a Escola fechada", !/localePath\(lang, "\/escola"\)/.test(ler("app", "[lang]", "campus", "page.tsx") + ler("app", "[lang]", "vida", "page.tsx")));

// ───────────── Nenhum link interno no endereço antigo ─────────────
// Ficam de fora os arquivos da F1 (lib/escola/rotas.ts, a entrada e o layout da Escola, a porta e a faixa), que a F1
// reescreve; enquanto isso, o redirecionamento cobre os links deles. Também os roteiros que conferem rotas.ts e a
// lista de redirecionamentos. Só caminhos de endereço contam ("@/lib/escola/cursos" é um módulo, não um link).
const DA_F1 = new Set(["lib/escola/rotas.ts", "app/[lang]/escola/page.tsx", "app/[lang]/escola/layout.tsx", "components/escola/PortaDaEscola.tsx", "components/escola/NavDaEscola.tsx"]);
const PERMITIDOS = new Set(["next.config.ts", "lib/escola/site-aberto.ts", "scripts/testar-escola-reorganizacao.mjs", "scripts/testar-escola.mjs", "scripts/testar-escola-vida.mjs"]);
const linkAntigo = /(^|[^A-Za-z0-9_.\]-])\/escola\/(cursos|campus|vida)(?![a-z0-9-])/;
let arquivos = [];
try {
  arquivos = execFileSync("git", ["ls-files", "app", "components", "lib", "e2e", "scripts", "next.config.ts"], { cwd: raiz, encoding: "utf8" }).split("\n").filter((a) => /\.(tsx?|mjs|json)$/.test(a));
} catch {
  arquivos = [];
}
conferir("a lista de arquivos do git foi lida", arquivos.length > 100, String(arquivos.length));
const sobraram = arquivos.filter((a) => !DA_F1.has(a) && !PERMITIDOS.has(a) && existe(a) && ler(a).split("\n").some((linha) => linkAntigo.test(linha)));
conferir("nenhum link interno no endereço antigo", sobraram.length === 0, sobraram.join(", "));

// ───────────── Textos nos 6 idiomas ─────────────
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
const textos = Object.fromEntries(IDIOMAS.map((l) => [l, JSON.parse(ler("i18n", "escola", "reorganizacao", `${l}.json`))]));
const base = chaves(textos.pt).join();
for (const l of IDIOMAS) {
  conferir(`textos ${l}: mesmas chaves do português`, chaves(textos[l]).join() === base);
  conferir(`textos ${l}: nada vazio`, chaves(textos[l]).every((k) => String(k.split(".").reduce((o, c) => o[c], textos[l])).trim().length > 0));
}
conferir("textos: sem universidade nem diploma", !/universidade|universidad|university|université|университет|大学|diploma|diplôme|диплом|文凭|学位/i.test(JSON.stringify(textos)));
conferir("o teste está no package.json", /"testar:escola-reorganizacao"/.test(ler("package.json")));

console.log(`escola-reorganizacao: ${certos} conferências certas, ${falhas.length} falha(s).`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
