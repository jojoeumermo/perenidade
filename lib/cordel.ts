// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cordel da aula (Etapa 4, pacote E4-06, ideia R1-71; docs/escola/som.md e content/cordel/LEIA-ME.md). Cada folheto
// fica em content/cordel/<trilha>/<aula>.md (o slug do endereço da aula): no cabeçalho, a aula, o título, a autoria, se
// foi revisado e por quem, a aula em que se baseia e a vinheta de xilogravura; no corpo, as estrofes (sextilhas: seis
// versos de sete sílabas, rima ABCBDB), separadas por uma linha em branco.
//
// Enquanto ninguém revisa, a autoria é "rascunho, em revisão" e o folheto mostra a faixa "Rascunho em revisão: confira
// na aula". Ninguém é dado como autor sem ter revisado: quem revisa põe revisado: true e o próprio nome.
// Sem os atalhos "@/" de propósito (os testes rodam no Node).

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";
import { LISTA_CEUS, LISTA_CHAOS, LISTA_MOTIVOS } from "./xilogravuras";

export const PASTA_DO_CORDEL = "content/cordel";
export const AUTORIA_RASCUNHO = "rascunho, em revisão";
export const VERSOS_POR_ESTROFE = 6;
/** O plano da etapa pede no máximo 5 folhetos escritos pelo pacote, todos de aulas do "Por onde começar". */
export const MAX_FOLHETOS = 5;
const XILO_PADRAO = "livro/sol/chao";

export interface Folheto {
  trilha: string;
  aula: string;
  titulo: string;
  autoria: string;
  revisado: boolean;
  revisadoPor: string;
  /** O arquivo da aula em que o folheto se baseia ("content/trilhas/<trilha>/<arquivo>.md"). */
  baseadoEm: string;
  /** A vinheta ("motivo/ceu/chao", de lib/xilogravuras.ts). */
  xilogravura: string;
  estrofes: string[][];
  /** O caminho do próprio folheto ("content/cordel/<trilha>/<aula>.md"). */
  arquivo: string;
  /** Os campos do cabeçalho como vieram, para a validação ("aula" precisa bater com o caminho; "revisado", ser booleano). */
  cabecalho: { aula: unknown; revisado: unknown };
}

/** O folheto ainda não foi revisado: mostra a faixa de rascunho e o link da aula. */
export const emRascunho = (f: Pick<Folheto, "revisado">) => f.revisado !== true;

/** O texto da autoria que a página mostra: nunca um nome de quem não revisou. */
export const autoriaDe = (f: Pick<Folheto, "revisado" | "autoria">) => (emRascunho(f) ? AUTORIA_RASCUNHO : f.autoria);

/** As estrofes do corpo: blocos separados por linha em branco; cada linha não vazia é um verso. */
export function estrofesDe(corpo: string): string[][] {
  return corpo
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((bloco) =>
      bloco
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .filter((estrofe) => estrofe.length > 0);
}

/** A última sílaba de rima de um verso, aproximada (as duas últimas letras sem acento): só para o aviso de rima. */
export function finalDeRima(verso: string): string {
  const letras = verso
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return letras.slice(-2);
}

const eTexto = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Lê um folheto. `arquivo` é o caminho a partir da raiz ("content/cordel/<trilha>/<aula>.md"). */
export function lerFolheto(texto: string, arquivo: string): Folheto {
  const { data, content } = parseFrontmatter(texto);
  const partes = arquivo.replace(/\\/g, "/").split("/");
  const aula = (partes.at(-1) ?? "").replace(/\.md$/, "");
  const trilha = partes.at(-2) ?? "";
  return {
    trilha,
    aula,
    titulo: eTexto(data.titulo) ? data.titulo.trim() : "",
    autoria: typeof data.autoria === "string" ? data.autoria.trim() : "",
    revisado: data.revisado === true,
    revisadoPor: typeof data.revisadoPor === "string" ? data.revisadoPor.trim() : "",
    baseadoEm: typeof data.baseado_em === "string" ? data.baseado_em.trim() : "",
    xilogravura: typeof data.xilogravura === "string" ? data.xilogravura.trim() : XILO_PADRAO,
    estrofes: estrofesDe(content),
    arquivo: arquivo.replace(/\\/g, "/"),
    cabecalho: { aula: data.aula, revisado: data.revisado },
  };
}

/**
 * Os erros de um folheto (lista vazia: válido). `existe` diz se um caminho a partir da raiz existe (nos testes, o
 * disco; o padrão também é o disco). Confere: a aula do cabeçalho bate com o caminho; título; autoria de rascunho
 * enquanto não revisado (e nenhum nome); nome de quem revisou quando revisado; a aula de base existe e é da mesma
 * trilha; seis versos por estrofe, nenhum verso sem letra; e a vinheta existe.
 */
export function validarFolheto(f: Folheto, existe: (caminho: string) => boolean = (c) => fs.existsSync(path.join(process.cwd(), c))): string[] {
  const erros: string[] = [];
  if (typeof f.cabecalho.aula !== "string" || f.cabecalho.aula.trim() !== `${f.trilha}/${f.aula}`) erros.push(`"aula" deve ser "${f.trilha}/${f.aula}" (o caminho do arquivo)`);
  if (typeof f.cabecalho.revisado !== "boolean") erros.push(`"revisado" deve ser true ou false`);
  if (!f.titulo) erros.push("falta o título");
  if (emRascunho(f)) {
    if (f.autoria !== AUTORIA_RASCUNHO) erros.push(`sem revisão, a autoria é "${AUTORIA_RASCUNHO}"`);
    if (f.revisadoPor) erros.push(`"revisadoPor" só com revisado: true`);
  } else {
    if (!f.revisadoPor) erros.push(`revisado: true precisa do nome em "revisadoPor"`);
    if (!f.autoria || f.autoria === AUTORIA_RASCUNHO) erros.push(`revisado: true precisa da autoria`);
  }
  const base = f.baseadoEm.replace(/\\/g, "/");
  if (!/^content\/trilhas\/[\w-]+\/[\w-]+\.md$/.test(base)) erros.push(`"baseado_em" deve ser o arquivo da aula (content/trilhas/<trilha>/<aula>.md)`);
  else if (!base.startsWith(`content/trilhas/${f.trilha}/`)) erros.push(`"baseado_em" deve ser uma aula da trilha ${f.trilha}`);
  else if (!existe(base)) erros.push(`a aula de base não existe: ${base}`);
  if (f.estrofes.length === 0) erros.push("o folheto não tem estrofes");
  f.estrofes.forEach((estrofe, i) => {
    if (estrofe.length !== VERSOS_POR_ESTROFE) erros.push(`a estrofe ${i + 1} tem ${estrofe.length} versos (são ${VERSOS_POR_ESTROFE})`);
    if (estrofe.some((v) => !/\p{L}/u.test(v))) erros.push(`a estrofe ${i + 1} tem verso vazio`);
  });
  const [motivo, ceu, chao, ...resto] = f.xilogravura.split("/");
  if (resto.length || !LISTA_MOTIVOS.includes(motivo) || !LISTA_CEUS.includes(ceu ?? "") || !LISTA_CHAOS.includes(chao ?? "")) erros.push(`xilogravura desconhecida: ${f.xilogravura}`);
  return erros;
}

/** Avisos que não impedem publicar: o 2º, o 4º e o 6º verso de cada estrofe deveriam rimar (ABCBDB). */
export function avisosDeRima(f: Folheto): string[] {
  return f.estrofes.flatMap((estrofe, i) => {
    if (estrofe.length !== VERSOS_POR_ESTROFE) return [];
    const finais = [estrofe[1], estrofe[3], estrofe[5]].map(finalDeRima);
    return new Set(finais).size === 1 ? [] : [`estrofe ${i + 1}: o 2º, o 4º e o 6º verso não parecem rimar (${finais.join(", ")})`];
  });
}

/** Todos os arquivos da pasta (menos o LEIA-ME), lidos, com os erros de cada um. */
export function lerFolhetosComErros(raiz: string = process.cwd()): { arquivo: string; folheto: Folheto; erros: string[] }[] {
  const pasta = path.join(raiz, PASTA_DO_CORDEL);
  if (!fs.existsSync(pasta)) return [];
  const saida: { arquivo: string; folheto: Folheto; erros: string[] }[] = [];
  for (const trilha of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (!trilha.isDirectory()) continue;
    for (const nome of fs.readdirSync(path.join(pasta, trilha.name)).sort()) {
      if (!nome.endsWith(".md")) continue;
      const arquivo = `${PASTA_DO_CORDEL}/${trilha.name}/${nome}`;
      const folheto = lerFolheto(fs.readFileSync(path.join(raiz, arquivo), "utf8"), arquivo);
      saida.push({ arquivo, folheto, erros: validarFolheto(folheto, (c) => fs.existsSync(path.join(raiz, c))) });
    }
  }
  return saida;
}

/** Os folhetos válidos (o inválido não aparece no site; o teste aponta o erro). */
export function listarFolhetos(raiz: string = process.cwd()): Folheto[] {
  return lerFolhetosComErros(raiz)
    .filter((l) => l.erros.length === 0)
    .map((l) => l.folheto);
}

/** O folheto de uma aula, se existe e é válido. */
export function folhetoDe(trilha: string, aula: string, raiz: string = process.cwd()): Folheto | null {
  if (!/^[\w-]+$/.test(trilha) || !/^[\w-]+$/.test(aula)) return null;
  const arquivo = `${PASTA_DO_CORDEL}/${trilha}/${aula}.md`;
  const absoluto = path.join(raiz, arquivo);
  if (!fs.existsSync(absoluto)) return null;
  const folheto = lerFolheto(fs.readFileSync(absoluto, "utf8"), arquivo);
  return validarFolheto(folheto, (c) => fs.existsSync(path.join(raiz, c))).length === 0 ? folheto : null;
}
