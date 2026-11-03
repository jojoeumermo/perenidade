// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O orçamento de peso da aula: o que a primeira visita a uma aula custa a quem estuda pelo plano de dados do celular.
// Confere, contra limites fixos, (1) o JS da primeira carga da rota de aula, (2) as fontes pré-carregadas no HTML da aula
// e (3) os textos do núcleo de tradução que o layout manda ao navegador em toda página, por idioma. O CI roda depois do
// `npm run build` e falha quando algum passa do limite, para o peso não crescer sem ninguém ver (de 14/10 a 29/10 o JS da
// aula foi de 515 KB a 702 KB). Não é postbuild de propósito: na Vercel, passar do orçamento derrubaria a publicação.
//
// Uso:  npm run orcamento:peso              (depois do build: tudo)
//       npm run orcamento:peso -- --sem-build   (só os textos do núcleo, que não precisam de build)
// Limites ajustáveis por variável de ambiente (bytes):
//   ORCAMENTO_JS_AULA        JS da primeira carga da aula, descomprimido (padrão 716800, 700 KiB)
//   ORCAMENTO_FONTES_AULA    fontes pré-carregadas pela aula (padrão 0: nenhuma, para o modo leve não baixar fonte)
//   ORCAMENTO_I18N_PT, _EN, _ES, _FR, _ZH, _RU   núcleo de tradução de cada idioma, em JSON
//   ORCAMENTO_RSC_AULA       carga RSC inteira de uma aula (só avisa; padrão 130000 caracteres)
//   ORCAMENTO_AULA_HTML      qual aula prerenderizada medir (padrão: a primeira em .next/server/app/pt/trilhas/*/)
//
// Os arquivos lidos (.next/diagnostics/route-bundle-stats.json, .next/server/next-font-manifest.json e o fluxo
// self.__next_f do HTML) são internos do Next 16, não API documentada. Se uma versão nova mudar nome ou formato, este
// roteiro falha dizendo o que não achou, e nunca passa calado.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { baseSections, pickBase, pickCore } from "../i18n/core.ts";

const RAIZ = path.resolve(import.meta.dirname, "..");
const NEXT = path.join(RAIZ, ".next");
const ROTA_DA_AULA = "/[lang]/trilhas/[track]/[lesson]";
const CHAVE_FONTES_DA_AULA = "[project]/app/[lang]/trilhas/[track]/[lesson]/page";
const IDIOMAS = ["pt", "en", "es", "fr", "zh", "ru"];

const numero = (nome, padrao) => {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto === "") return padrao;
  const n = Number(bruto.replace(/[_.]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error(`${nome}="${bruto}" não é um número de bytes`);
  return n;
};

// Os limites começam logo acima do que se mede hoje (02/11/2026), para travar o crescimento sem quebrar o CI no primeiro
// dia. Descem conforme os cortes entram. Núcleo de tradução hoje (JSON, sem as áreas, que agora vão só às rotas que as
// usam): pt 41.148, en 39.761, es 42.473, fr 44.610, zh 37.973, ru 63.014. Antes de tirar as áreas: pt 51.755,
// en 50.375, es 53.564, fr 56.116, zh 47.310, ru 80.220. O russo pesa mais porque o cirílico ocupa 2 bytes em UTF-8.
// JS da aula: 702.349 bytes no build de 29/10; o limite de 700 KiB (716.800 bytes) deixa uns 2% de folga.
const LIMITE_JS = numero("ORCAMENTO_JS_AULA", 716_800);
const LIMITE_FONTES = numero("ORCAMENTO_FONTES_AULA", 0);
const LIMITE_RSC = numero("ORCAMENTO_RSC_AULA", 130_000);
const LIMITE_I18N = {
  pt: numero("ORCAMENTO_I18N_PT", 43_000),
  en: numero("ORCAMENTO_I18N_EN", 42_000),
  es: numero("ORCAMENTO_I18N_ES", 44_500),
  fr: numero("ORCAMENTO_I18N_FR", 46_500),
  zh: numero("ORCAMENTO_I18N_ZH", 40_000),
  ru: numero("ORCAMENTO_I18N_RU", 65_500),
};

const semBuild = process.argv.includes("--sem-build");
const falhas = [];
const avisos = [];
const kb = (n) => `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
const relativo = (p) => path.relative(RAIZ, p).split(path.sep).join("/");
const lerJson = (p, oQue) => {
  if (!fs.existsSync(p)) {
    falhas.push(`${oQue}: não achei ${relativo(p)}. Rode "npm run build" (com Turbopack, o padrão) antes; se o build rodou, o Next mudou o arquivo de medida e este roteiro precisa de ajuste.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (erro) {
    falhas.push(`${oQue}: ${relativo(p)} não é JSON válido (${erro.message}).`);
    return null;
  }
};

// 3. Textos do núcleo de tradução (não precisa de build). É o que o layout põe no contexto do navegador em toda página
//    (pickBase em i18n/core.ts) e que vai serializado no HTML de cada visita.
console.log("Textos do núcleo de tradução (enviados em toda página), em bytes de JSON:");
for (const lang of IDIOMAS) {
  const dicionario = JSON.parse(fs.readFileSync(path.join(RAIZ, "i18n", `${lang}.json`), "utf8"));
  const base = Buffer.byteLength(JSON.stringify(pickBase(dicionario)));
  const nucleo = Buffer.byteLength(JSON.stringify(pickCore(dicionario)));
  const passou = base > LIMITE_I18N[lang];
  console.log(`  ${lang}: ${kb(base)} (limite ${kb(LIMITE_I18N[lang])}; com as seções extras seriam ${kb(nucleo)})${passou ? "  <- PASSOU" : ""}`);
  if (passou) {
    const maiores = baseSections
      .map((secao) => [secao, Buffer.byteLength(JSON.stringify(dicionario[secao] ?? null))])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([secao, n]) => `${secao} ${kb(n)}`)
      .join(", ");
    falhas.push(`Núcleo de tradução em ${lang}: ${kb(base)}, acima do limite de ${kb(LIMITE_I18N[lang])}. Maiores seções: ${maiores}. Texto de uma página só vai por propriedade do componente ou numa seção extra (extraSections em i18n/core.ts), não no núcleo.`);
  }
}

if (!semBuild) {
  // 1. JS da primeira carga da aula.
  const linhas = lerJson(path.join(NEXT, "diagnostics", "route-bundle-stats.json"), "JS da aula");
  if (linhas) {
    if (!Array.isArray(linhas)) falhas.push("JS da aula: route-bundle-stats.json não é uma lista; o formato do Next mudou.");
    else {
      const aula = linhas.find((r) => r && r.route === ROTA_DA_AULA);
      if (!aula || typeof aula.firstLoadUncompressedJsBytes !== "number" || !Array.isArray(aula.firstLoadChunkPaths)) {
        falhas.push(`JS da aula: a rota ${ROTA_DA_AULA} não está em route-bundle-stats.json (ou mudou de formato).`);
      } else {
        const pedacos = aula.firstLoadChunkPaths.map((p) => {
          const caminho = path.join(RAIZ, p);
          const conteudo = fs.existsSync(caminho) ? fs.readFileSync(caminho) : null;
          return { p, bytes: conteudo ? conteudo.length : 0, gzip: conteudo ? zlib.gzipSync(conteudo).length : 0, achou: Boolean(conteudo) };
        });
        const gzip = pedacos.reduce((s, x) => s + x.gzip, 0);
        const sumidos = pedacos.filter((x) => !x.achou).length;
        const passou = aula.firstLoadUncompressedJsBytes > LIMITE_JS;
        console.log(`\nJS da primeira carga da aula: ${kb(aula.firstLoadUncompressedJsBytes)} descomprimido, ${kb(gzip)} com gzip, ${pedacos.length} arquivos (limite ${kb(LIMITE_JS)})${passou ? "  <- PASSOU" : ""}`);
        if (sumidos) avisos.push(`${sumidos} pedaço(s) do JS da aula listados no route-bundle-stats.json não existem no disco; o gzip ficou menor que o real.`);
        if (passou) {
          const maiores = [...pedacos].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
          falhas.push(
            `JS da primeira carga da aula: ${kb(aula.firstLoadUncompressedJsBytes)}, acima do limite de ${kb(LIMITE_JS)}. Os maiores pedaços (abra para ver o que entrou):\n` +
              maiores.map((x) => `      ${kb(x.bytes).padStart(9)}  (${kb(x.gzip)} gzip)  ${x.p}`).join("\n") +
              "\n    O que não aparece na primeira tela da aula pode carregar depois (next/dynamic, como PraticaSobDemanda).",
          );
        }
        // Só para informar: as rotas mais pesadas do site.
        const top = linhas
          .filter((r) => r && typeof r.firstLoadUncompressedJsBytes === "number")
          .sort((a, b) => b.firstLoadUncompressedJsBytes - a.firstLoadUncompressedJsBytes)
          .slice(0, 10);
        console.log("  As 10 rotas com mais JS na primeira carga (só aviso):");
        for (const r of top) console.log(`    ${kb(r.firstLoadUncompressedJsBytes).padStart(9)}  ${r.route}`);
      }
    }
  }

  // Uma aula prerenderizada, para as fontes que o HTML manda pré-carregar e para a carga RSC.
  const pastaTrilhas = path.join(NEXT, "server", "app", "pt", "trilhas");
  let htmlDaAula = process.env.ORCAMENTO_AULA_HTML ? path.resolve(RAIZ, process.env.ORCAMENTO_AULA_HTML) : null;
  if (!htmlDaAula && fs.existsSync(pastaTrilhas)) {
    const candidatos = fs
      .readdirSync(pastaTrilhas, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((d) =>
        fs
          .readdirSync(path.join(pastaTrilhas, d.name))
          // Na pasta da trilha ficam também as páginas irmãs da aula (trilhas/[track]/nucleo e /prova), que não são aula.
          .filter((f) => f.endsWith(".html") && f !== "nucleo.html" && f !== "prova.html")
          .sort()
          .map((f) => path.join(pastaTrilhas, d.name, f)),
      );
    htmlDaAula = candidatos[0] ?? null;
  }
  const html = htmlDaAula && fs.existsSync(htmlDaAula) ? fs.readFileSync(htmlDaAula, "utf8") : null;
  if (!html) avisos.push(`Não achei uma aula prerenderizada em ${relativo(pastaTrilhas)}/*/; as fontes foram medidas só pelo manifesto e a carga RSC ficou sem medida.`);

  // 2. Fontes pré-carregadas pela aula: pelo manifesto do next/font e, quando há aula prerenderizada, pelo próprio HTML.
  const manifesto = lerJson(path.join(NEXT, "server", "next-font-manifest.json"), "Fontes da aula");
  if (manifesto) {
    if (!manifesto.app || typeof manifesto.app !== "object") falhas.push('Fontes da aula: next-font-manifest.json sem a parte "app"; o formato do Next mudou.');
    else {
      // Sem nenhuma fonte com pré-carga, o Next nem cria a chave da página: lista vazia.
      const doManifesto = [...new Set(manifesto.app[CHAVE_FONTES_DA_AULA] ?? [])];
      let arquivos = doManifesto.map((f) => path.join(NEXT, f));
      let origem = "manifesto";
      if (html) {
        const doHtml = [];
        for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
          if (!/\brel="preload"/.test(tag) || !/\bas="font"/.test(tag)) continue;
          const href = tag.match(/\bhref="([^"]+)"/)?.[1];
          if (href) doHtml.push(href.startsWith("/_next/") ? path.join(NEXT, href.slice("/_next/".length).split("?")[0]) : href);
        }
        if (doHtml.length !== arquivos.length) avisos.push(`Fontes da aula: o manifesto lista ${arquivos.length} e o HTML de ${relativo(htmlDaAula)} pré-carrega ${doHtml.length}; vale o HTML, que é o que o navegador recebe.`);
        arquivos = [...new Set(doHtml)];
        origem = relativo(htmlDaAula);
      }
      let peso = 0;
      for (const f of arquivos) {
        if (/^https?:/.test(f)) falhas.push(`Fontes da aula: pré-carga de fonte de fora do site (${f}).`);
        else if (!fs.existsSync(f)) falhas.push(`Fontes da aula: ${relativo(f)} está na pré-carga mas não existe no build.`);
        else peso += fs.statSync(f).size;
      }
      const passou = peso > LIMITE_FONTES;
      console.log(`\nFontes pré-carregadas pela aula: ${arquivos.length} arquivo(s), ${kb(peso)} (limite ${kb(LIMITE_FONTES)}; medido em ${origem})${passou ? "  <- PASSOU" : ""}`);
      if (passou) falhas.push(`Fontes pré-carregadas pela aula: ${kb(peso)}, acima do limite de ${kb(LIMITE_FONTES)}. Fonte pré-carregada é baixada antes de o modo leve trocar as letras pelas do aparelho; use preload: false no next/font (app/[lang]/layout.tsx). Arquivos: ${arquivos.map(relativo).join(", ")}.`);
    }
  }

  // Carga RSC da aula (os pedaços self.__next_f.push do HTML): o núcleo de tradução, os textos passados por propriedade
  // a componentes do navegador e o resto da árvore. Muda com o conteúdo da aula, por isso só avisa.
  if (html) {
    const pedacos = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)];
    if (pedacos.length === 0) falhas.push(`Carga RSC da aula: nenhum pedaço self.__next_f.push em ${relativo(htmlDaAula)}; o formato do Next mudou e esta medida precisa de ajuste.`);
    else {
      let total = 0;
      for (const [, texto] of pedacos) total += JSON.parse(texto).length;
      const passou = total > LIMITE_RSC;
      console.log(`\nCarga RSC de ${relativo(htmlDaAula)}: ${total.toLocaleString("pt-BR")} caracteres em ${pedacos.length} pedaços (aviso acima de ${LIMITE_RSC.toLocaleString("pt-BR")})${passou ? "  <- PASSOU (só aviso)" : ""}`);
      if (passou) avisos.push(`A carga RSC da aula medida passou de ${LIMITE_RSC.toLocaleString("pt-BR")} caracteres. Veja o que vai por propriedade a componentes do navegador (textos inteiros em vez das frases usadas).`);
    }
  }
}

for (const aviso of avisos) console.log(`\nAviso: ${aviso}`);
if (falhas.length) {
  console.error(`\nOrçamento de peso: ${falhas.length} problema(s).`);
  for (const falha of falhas) console.error(`  - ${falha}`);
  process.exit(1);
}
console.log(`\nOrçamento de peso: tudo dentro do limite${semBuild ? " (só os textos do núcleo; rode sem --sem-build depois do build para o resto)" : ""}.`);
