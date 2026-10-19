// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Lista os textos em português que o painel mostra, para a tradução do painel (i18n/painel/<idioma>.json).
// Lê o código com o compilador do TypeScript: textos de JSX, textos entre aspas e modelos com ${...} (que viram
// "{0}", "{1}"...). Deixa de fora nomes de classe, chaves, nomes de funções do serviço e o que não parece frase.
//
//   node scripts/textos-do-painel.mjs            → escreve i18n/painel/textos.json (a lista de origem)
//   npm run conferir:painel                      → diz o que falta traduzir em cada idioma (sai com erro se faltar)
//
// Frase nova no painel: rode a conferência e acrescente a frase, escrita igual à da tela (entidades como &ldquo;
// já viram “), em i18n/painel/en.json, es.json, fr.json, ru.json e zh.json, com a tradução de cada idioma. As partes
// variáveis ficam como {0}, {1}... na mesma ordem do código; na tradução, podem mudar de lugar. Enquanto faltar,
// a frase simplesmente aparece em português. Quem aplica os dicionários é components/painel/Idioma.tsx.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const raiz = path.resolve(import.meta.dirname, "..");
const pastas = ["components/painel"];
const arquivosSoltos = ["lib/videoaula.ts", "components/VideoPlayer.tsx", "components/Editor.tsx"];
const idiomas = ["en", "es", "fr", "ru", "zh"];
const destino = path.join(raiz, "i18n/painel");

/** Atributos que nunca são texto para pessoas. */
const atributosTecnicos = new Set(["className", "key", "id", "href", "type", "name", "role", "accept", "autoComplete", "inputMode", "lang", "rel", "target", "htmlFor", "value", "method", "encType", "pattern", "src", "viewBox", "d", "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin", "xmlns", "aria-controls", "aria-labelledby", "aria-describedby", "aria-live", "aria-current", "aria-haspopup", "aria-expanded", "aria-pressed", "aria-hidden", "srcLang", "kind", "preload", "dir", "spellCheck", "capture", "download", "form", "list", "step", "min", "max", "wrap"]);
/** Chamadas cujo primeiro argumento é técnico (função do serviço, chave guardada, evento, seletor). */
const chamadasTecnicas = new Set(["rpc", "agir", "useLista", "getItem", "setItem", "removeItem", "addEventListener", "removeEventListener", "dispatchEvent", "Event", "querySelector", "querySelectorAll", "getElementById", "createElement", "fetch", "require", "import", "from", "includes", "startsWith", "endsWith", "split", "replace", "replaceAll", "join", "indexOf", "test", "match", "getAttribute", "setAttribute", "has", "get", "set", "delete", "postMessage", "signedStorageUrl", "storage", "upload", "remove", "localeCompare", "toLocaleDateString", "toLocaleString", "toLocaleTimeString", "Intl", "NumberFormat", "DateTimeFormat", "padStart", "erro", "VideoErro", "Blob", "File", "MediaRecorder", "isTypeSupported", "getContext", "captureStream", "toBlob", "toDataURL", "open", "registrar"]);

/** Palavras soltas, em minúscula, que aparecem na tela (o filtro as tomaria por chaves técnicas). */
const palavrasSoltas = new Set(["pessoa", "pessoas", "iniciante"]);

/** Textos que o filtro deixaria passar, mas não são para gente ler. */
const ignorar = new Set(["use client", "system-ui, sans-serif", "grayscale(1) contrast(1.15)", "ativo: false"]);

/** Parece texto para gente ler? */
function frase(texto) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length < 2 || ignorar.has(limpo)) return false;
  // Modelos que vão para dentro de um texto, de uma janela de impressão ou de uma busca, nunca para a tela do painel.
  if (/^(<!doctype|@page|> \*\*|- \[\*|a o as os de )/i.test(limpo)) return false;
  if (/^\[[\w-]+(=|\])/.test(limpo)) return false; // seletores
  if (!/\p{L}/u.test(limpo)) return false;
  if (/^[a-z0-9_.:/#?&=-]+$/.test(limpo) && !/[áéíóúâêôãõç]/.test(limpo) && !limpo.includes(" ")) return false; // chaves, caminhos, códigos
  if (/^(https?:|mailto:|\/|#|\.\/|@\/)/.test(limpo)) return false;
  if (/^[\w-]+\/[\w.+-]+$/.test(limpo)) return false; // tipos de arquivo
  if (/^[MmLlHhVvCcSsQqTtAaZz][\d\s.,MmLlHhVvCcSsQqTtAaZz-]*$/.test(limpo)) return false; // desenho de ícone
  if (/^\(.*:.*\)$/.test(limpo) || /\{\d+\}px/.test(limpo) || /^[\d\s{}px%.,-]+$/.test(limpo)) return false; // regras de estilo
  // Listas de classes: só palavras sem acento, com hífen ou dois-pontos, e pelo menos uma classe conhecida.
  if (limpo.split(" ").every((parte) => /^[\w:[\]#%.()/!-]+$/.test(parte)) && /(^|\s)!?(flex|grid|block|hidden|px-|py-|p-|mt-|mb-|ml-|mr-|mx-|my-|text-|bg-|border|font-|w-|h-|max-|min-|gap-|rounded|hover:|focus|sm:|md:|lg:|app:|cursor-|underline|sr-only|space-|divide-|items-|justify-)/.test(limpo)) return false;
  return true;
}

/** O JSX escreve "&ldquo;" e a tela mostra "“": a chave do dicionário é o que aparece na tela. */
const entidades = { ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", apos: "'" };
const decodificar = (texto) =>
  texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (inteiro, nome) =>
    nome[0] === "#" ? String.fromCodePoint(parseInt(nome.slice(1).replace(/^x/i, ""), nome[1].toLowerCase() === "x" ? 16 : 10)) : (entidades[nome] ?? inteiro),
  );

function nomeDaChamada(no) {
  const alvo = no.expression;
  if (ts.isIdentifier(alvo)) return alvo.text;
  if (ts.isPropertyAccessExpression(alvo)) return alvo.name.text;
  return "";
}

function tecnico(no) {
  let pai = no.parent;
  // Comparações e chaves de objeto: "x === 'pendente'", { pendente: ... }
  if (ts.isBinaryExpression(pai) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.InKeyword].includes(pai.operatorToken.kind)) return true;
  if (ts.isPropertyAssignment(pai) && pai.name === no) return true;
  if (ts.isCaseClause(pai)) return true;
  if (ts.isImportDeclaration(pai) || ts.isExportDeclaration(pai) || ts.isExternalModuleReference(pai)) return true;
  if (ts.isLiteralTypeNode(pai) || ts.isElementAccessExpression(pai)) return true;
  if (ts.isCallExpression(pai) || ts.isNewExpression(pai)) {
    const nome = nomeDaChamada(pai);
    if (chamadasTecnicas.has(nome) && pai.arguments?.[0] === no) return true;
  }
  // Atributo técnico de JSX, mesmo dentro de expressão: className={x ? "a" : "b"}
  for (let acima = no.parent; acima; acima = acima.parent) {
    if (ts.isJsxAttribute(acima)) return atributosTecnicos.has(acima.name.getText()) || acima.name.getText().startsWith("data-");
    if (ts.isJsxElement(acima) || ts.isJsxSelfClosingElement(acima) || ts.isFunctionLike(acima) || ts.isVariableStatement(acima)) break;
  }
  // Variáveis com nome de classe: const botao = "painel-botao ..."
  if (ts.isVariableDeclaration(pai) && /^(botao|campo|elo|rotulo|classe|estilo|caixa|cartao)/i.test(pai.name.getText())) return true;
  return false;
}

function modelo(no) {
  // `Escreva “${titulo}”` vira "Escreva “{0}”".
  let texto = no.head.text;
  no.templateSpans.forEach((parte, i) => {
    texto += `{${i}}${parte.literal.text}`;
  });
  return texto;
}

function textosDe(arquivo) {
  const codigo = fs.readFileSync(arquivo, "utf8");
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, arquivo.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const achados = [];
  const visitar = (no) => {
    if (ts.isJsxText(no)) {
      const texto = decodificar(no.text).replace(/\s+/g, " ").trim();
      if (frase(texto)) achados.push(texto);
    } else if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && !tecnico(no)) {
      const texto = no.text.replace(/\s+/g, " ").trim();
      if (palavrasSoltas.has(texto) || (frase(texto) && /[\s]|[áéíóúâêôãõçÁÉÍÓÚ]|^[A-ZÁÉÍÓÚ][a-záéíóúâêôãõç]+$/.test(texto))) achados.push(texto);
    } else if (ts.isTemplateExpression(no) && !tecnico(no)) {
      const texto = modelo(no).replace(/\s+/g, " ").trim();
      if (frase(texto.replace(/\{\d+\}/g, "")) && /\s/.test(texto.replace(/\{\d+\}/g, "").trim())) achados.push(texto);
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

function arquivos() {
  const lista = [];
  const andar = (pasta) => {
    for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
      const caminho = path.join(pasta, item.name);
      if (item.isDirectory()) andar(caminho);
      else if (/\.tsx?$/.test(item.name)) lista.push(caminho);
    }
  };
  for (const pasta of pastas) andar(path.join(raiz, pasta));
  return [...lista, ...arquivosSoltos.map((arquivo) => path.join(raiz, arquivo))];
}

const textos = [...new Set(arquivos().flatMap(textosDe))].sort((a, b) => a.localeCompare(b, "pt"));

if (process.argv.includes("--conferir")) {
  let faltas = 0;
  for (const idioma of idiomas) {
    const arquivo = path.join(destino, `${idioma}.json`);
    const dicionario = fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, "utf8")) : {};
    const faltando = textos.filter((texto) => !(texto in dicionario));
    faltas += faltando.length;
    console.log(`${idioma}: ${textos.length - faltando.length} de ${textos.length} traduzidos${faltando.length ? `; faltam ${faltando.length}` : ""}`);
    for (const texto of faltando.slice(0, 5)) console.log(`   falta: ${texto}`);
  }
  process.exit(faltas ? 1 : 0);
} else {
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, "textos.json"), `${JSON.stringify(textos, null, 2)}\n`);
  console.log(`${textos.length} textos em i18n/painel/textos.json`);
}
