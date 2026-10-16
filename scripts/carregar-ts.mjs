// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Deixa os roteiros de conferência importarem os módulos de lib/ direto do Node, sem instalar nada: o Node já lê
// TypeScript, só falta achar "./expressao" como "./expressao.ts" (o site escreve os imports sem a extensão).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-ferramentas.mjs
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(especificador, contexto, proximo) {
  try {
    return await proximo(especificador, contexto);
  } catch (erro) {
    if (/^\\.{1,2}\\//.test(especificador) && !/\\.[a-z]+$/i.test(especificador)) return proximo(especificador + ".ts", contexto);
    throw erro;
  }
}`),
);
