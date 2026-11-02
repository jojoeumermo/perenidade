// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Lê e confere o léxico de pronúncia das vozes naturais (content/vozes/lexico.yml). Roda no servidor, na montagem da
// página da aula, que entrega o léxico já pronto ao "Ouvir a aula". Sem os atalhos "@/": `npm run testar:vozes` usa.
import fs from "node:fs";
import path from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import type { Lexico } from "./normalizar";

/** Os problemas do léxico (vazio quando está certo). */
export function conferirLexico(dados: unknown): string[] {
  const erros: string[] = [];
  if (!dados || typeof dados !== "object") return ["o léxico precisa ter siglas e palavras"];
  const d = dados as Record<string, unknown>;
  for (const chave of Object.keys(d)) if (chave !== "siglas" && chave !== "palavras") erros.push(`seção desconhecida: ${chave}`);
  for (const secao of ["siglas", "palavras"] as const) {
    const lista = d[secao];
    if (lista == null) continue;
    if (typeof lista !== "object" || Array.isArray(lista)) {
      erros.push(`${secao} precisa ser uma lista de "escrita: pronúncia"`);
      continue;
    }
    const vistas = new Set<string>();
    for (const [escrita, pronuncia] of Object.entries(lista as Record<string, unknown>)) {
      if (typeof pronuncia !== "string" || !pronuncia.trim()) erros.push(`${secao}.${escrita}: pronúncia vazia`);
      if (secao === "siglas" && !/^\p{Lu}{2,8}s?$/u.test(escrita)) erros.push(`siglas.${escrita}: sigla precisa ter de 2 a 8 maiúsculas`);
      const chave = secao === "palavras" ? escrita.toLowerCase() : escrita;
      if (vistas.has(chave)) erros.push(`${secao}.${escrita}: repetida`);
      vistas.add(chave);
    }
  }
  return erros;
}

let memo: Lexico | null = null;
// Caminho fixo dentro de content/vozes: o rastreamento do build leva só este arquivo, não o projeto inteiro.
const ARQUIVO = path.join(process.cwd(), "content", "vozes", "lexico.yml");

/** O léxico pronto para o normalizador. Com erro de forma, o build para (melhor que uma voz lendo errado em silêncio). */
export function lerLexico(): Lexico {
  if (memo) return memo;
  const dados = load(fs.readFileSync(ARQUIVO, "utf8"), { schema: CORE_SCHEMA });
  const erros = conferirLexico(dados);
  if (erros.length) throw new Error(`content/vozes/lexico.yml: ${erros.join("; ")}`);
  const d = dados as Lexico;
  memo = { siglas: d.siglas ?? {}, palavras: d.palavras ?? {} };
  return memo;
}
