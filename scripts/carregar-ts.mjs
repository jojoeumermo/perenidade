// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Deixa os roteiros de conferência importarem os módulos de lib/ direto do Node, sem instalar nada: o Node já lê
// TypeScript, só falta achar "./expressao" como "./expressao.ts" (o site escreve os imports sem a extensão).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-ferramentas.mjs
import { register } from "node:module";

// O "@/" dos imports do site é a raiz do projeto (tsconfig "paths").
const RAIZ = new URL("../", import.meta.url).href;

register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(especificador, contexto, proximo) {
  if (especificador.startsWith("@/")) especificador = ${JSON.stringify(RAIZ)} + especificador.slice(2);
  // O site importa JSON sem "with { type: 'json' }" (o Next aceita); aqui o atributo entra sozinho.
  if (/\\.json$/i.test(especificador)) {
    const achado = await proximo(especificador, { ...contexto, importAttributes: { ...contexto.importAttributes, type: "json" } });
    return { ...achado, importAttributes: { ...achado.importAttributes, type: "json" } };
  }
  try {
    return await proximo(especificador, contexto);
  } catch (erro) {
    if ((/^\\.{1,2}\\//.test(especificador) || especificador.startsWith("file:")) && !/\\.[a-z]+$/i.test(especificador)) return proximo(especificador + ".ts", contexto);
    throw erro;
  }
}`),
);
