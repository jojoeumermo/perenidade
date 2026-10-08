// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
//
// Confere se os cinco dicionários têm exatamente as mesmas chaves que o português (a referência)
// e se nenhum texto ficou vazio. Uso: npm run conferir:i18n
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../i18n");
const ler = (idioma) => JSON.parse(fs.readFileSync(path.join(pasta, `${idioma}.json`), "utf8"));
// Formas de plural mudam de idioma para idioma ("one", "few", "many"...): só "other" é obrigatória.
const ePlural = (valor) => valor && typeof valor === "object" && !Array.isArray(valor) && typeof valor.other === "string";

function chaves(valor, prefixo = "", saida = new Map()) {
  if (ePlural(valor)) saida.set(prefixo, "plural");
  else if (Array.isArray(valor)) {
    saida.set(prefixo, `lista:${valor.length}`);
    valor.forEach((item, i) => chaves(item, `${prefixo}[${i}]`, saida));
  } else if (valor && typeof valor === "object") for (const [chave, filho] of Object.entries(valor)) chaves(filho, prefixo ? `${prefixo}.${chave}` : chave, saida);
  else saida.set(prefixo, typeof valor === "string" && valor.trim() === "" ? "vazio" : "texto");
  return saida;
}

const referencia = chaves(ler("pt"));
let problemas = 0;
for (const idioma of ["pt", "en", "es", "zh", "ru"]) {
  const atual = chaves(ler(idioma));
  const avisos = [];
  for (const [chave, tipo] of referencia) {
    if (!atual.has(chave)) avisos.push(`falta        ${chave}`);
    else if (atual.get(chave) !== tipo) avisos.push(`diferente    ${chave} (${tipo} em pt, ${atual.get(chave)} aqui)`);
  }
  for (const [chave, tipo] of atual) {
    if (!referencia.has(chave)) avisos.push(`sobrando     ${chave}`);
    if (tipo === "vazio") avisos.push(`texto vazio  ${chave}`);
  }
  // Marcadores como {n} precisam existir nos dois lados, senão o número some da frase.
  const marcas = (texto) => (typeof texto === "string" ? (texto.match(/\{\w+\}/g) ?? []).sort().join() : "");
  const plano = (valor, prefixo = "", saida = {}) => {
    if (valor && typeof valor === "object") for (const [chave, filho] of Object.entries(valor)) plano(filho, `${prefixo}.${chave}`, saida);
    else saida[prefixo] = valor;
    return saida;
  };
  const [a, b] = [plano(ler("pt")), plano(ler(idioma))];
  for (const chave of Object.keys(a)) if (chave in b && marcas(a[chave]) !== marcas(b[chave])) avisos.push(`marcadores   ${chave.slice(1)}: ${marcas(a[chave])} em pt, ${marcas(b[chave])} aqui`);

  console.log(`${idioma}: ${avisos.length === 0 ? "ok" : `${avisos.length} problema(s)`}`);
  avisos.forEach((aviso) => console.log(`  ${aviso}`));
  problemas += avisos.length;
}
process.exit(problemas ? 1 : 0);
