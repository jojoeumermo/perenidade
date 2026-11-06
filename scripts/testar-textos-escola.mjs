// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere os textos de interface da Escola Revolucionária Lúcia Maria: TODAS as pastas i18n/escola/<pacote>/ precisam ter os 6
// idiomas (pt, en, es, fr, ru, zh) com todas as chaves do português, nenhum valor vazio, e nenhum texto pode dizer
// que a Escola é universidade ou dá diploma. Só ficam liberadas as chaves com "nao" no nome, que são as negações
// ("não é universidade", "não dá diploma"). Na interface a Escola nunca se chama universidade (docs/ESCOLA.md).
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const pasta = path.join(raiz, "i18n", "escola");
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const PROIBIDAS = ["universidade", "universidad", "university", "université", "университет", "大学", "diploma", "diplôme", "диплом", "文凭", "学位"];

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

/** Achata o JSON em { "a.b.0.c": valor } (listas entram pelo índice, para conferir o tamanho também). */
function achatar(valor, prefixo = "", saida = new Map()) {
  if (Array.isArray(valor)) {
    if (valor.length === 0) saida.set(prefixo, valor);
    valor.forEach((v, i) => achatar(v, prefixo ? `${prefixo}.${i}` : String(i), saida));
  } else if (valor && typeof valor === "object") {
    const chaves = Object.keys(valor);
    if (chaves.length === 0) saida.set(prefixo, valor);
    for (const k of chaves) achatar(valor[k], prefixo ? `${prefixo}.${k}` : k, saida);
  } else saida.set(prefixo, valor);
  return saida;
}

const vazio = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && v !== null && Object.keys(v).length === 0);
const liberada = (chave) => chave.split(".").some((parte) => /nao/i.test(parte));

const pacotes = fs.existsSync(pasta) ? fs.readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
conferir("existe ao menos a pasta base", pacotes.includes("base"));

for (const pacote of pacotes) {
  const ler = (lang) => {
    const arquivo = path.join(pasta, pacote, `${lang}.json`);
    if (!fs.existsSync(arquivo)) return { erro: "arquivo não existe" };
    try {
      return { dados: JSON.parse(fs.readFileSync(arquivo, "utf8")) };
    } catch (e) {
      return { erro: `JSON inválido (${e.message})` };
    }
  };
  const base = ler("pt");
  if (!base.dados) {
    conferir(`${pacote}/pt.json`, false, base.erro);
    continue;
  }
  const referencia = achatar(base.dados);
  for (const lang of IDIOMAS) {
    const lido = lang === "pt" ? base : ler(lang);
    if (!lido.dados) {
      conferir(`${pacote}/${lang}.json`, false, lido.erro);
      continue;
    }
    const plano = achatar(lido.dados);
    const faltam = [...referencia.keys()].filter((k) => !plano.has(k));
    conferir(`${pacote}/${lang}.json tem todas as chaves do português`, faltam.length === 0, faltam.slice(0, 8).join(", "));
    const vazios = [...plano].filter(([, v]) => vazio(v)).map(([k]) => k);
    conferir(`${pacote}/${lang}.json sem valor vazio`, vazios.length === 0, vazios.slice(0, 8).join(", "));
    for (const [chave, valor] of plano) {
      if (typeof valor !== "string" || liberada(chave)) continue;
      const minusculo = valor.toLocaleLowerCase(lang);
      const achada = PROIBIDAS.find((p) => minusculo.includes(p));
      conferir(`${pacote}/${lang}.json "${chave}" não chama a Escola de universidade nem promete diploma`, !achada, achada ? `"${achada}" em: ${valor.slice(0, 120)}` : "");
    }
  }
}

console.log(`textos da escola: ${pacotes.length} pastas, ${ok} conferências certas, ${falhas.length} falhas`);
if (falhas.length) {
  console.error(falhas.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}
