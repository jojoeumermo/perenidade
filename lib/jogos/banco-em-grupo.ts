// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Só o servidor importa este arquivo (a página /jogos e a rota estática /api/jogos-em-grupo/<banco>): monta, a partir do
// conteúdo do site, o banco dos jogos em grupo. As questões de escolha dos exercícios das aulas (content/exercicios),
// agrupadas pela disciplina (área) da trilha, e os cartões de debate. Lido com pasta literal, uma vez por montagem.
import fs from "node:fs";
import path from "node:path";
import pt from "../../i18n/pt.json";
import { getDebates } from "../content";
import { todosOsExercicios } from "../exercicios-conteudo";
import type { QuestaoDoBanco, TemaDeDebate } from "./grupo/banco";

/** Quantas questões, no máximo, por disciplina (o arquivo fica leve; o sorteio escolhe as da partida). */
export const MAXIMO_POR_DISCIPLINA = 160;
/** A disciplina só aparece na lista dos jogos com pelo menos isto de questões (uma partida tem até 20). */
export const MINIMO_POR_DISCIPLINA = 8;

const TRILHAS = path.join(process.cwd(), "content", "trilhas");

function lerCampo(arquivo: string, campo: string): string {
  try {
    const texto = fs.readFileSync(arquivo, "utf8");
    const fim = texto.indexOf("\n---", 4);
    const cabecalho = fim > 0 ? texto.slice(0, fim) : texto.slice(0, 2000);
    const achado = new RegExp(`^${campo}:\\s*"?(.*?)"?\\s*$`, "m").exec(cabecalho);
    return achado?.[1]?.replace(/\\"/g, '"') ?? "";
  } catch {
    return "";
  }
}

let porArea: Map<string, QuestaoDoBanco[]> | null = null;

/** As questões de escolha de cada disciplina, já no formato do jogo. */
export function questoesPorDisciplina(): Map<string, QuestaoDoBanco[]> {
  if (porArea && process.env.NODE_ENV === "production") return porArea;
  const mapa = new Map<string, QuestaoDoBanco[]>();
  const areaDaTrilha = new Map<string, string>();
  for (const grupo of todosOsExercicios()) {
    if (!areaDaTrilha.has(grupo.trilha)) areaDaTrilha.set(grupo.trilha, lerCampo(path.join(TRILHAS, grupo.trilha, "_trilha.md"), "area"));
    const area = areaDaTrilha.get(grupo.trilha);
    if (!area) continue;
    const titulo = lerCampo(path.join(TRILHAS, grupo.trilha, `${grupo.aula}.md`), "titulo") || grupo.aula;
    const lista = mapa.get(area) ?? [];
    for (const ex of grupo.exercicios) {
      if (ex.tipo !== "escolha") continue;
      const certa = ex.alternativas.findIndex((a) => a.certa);
      if (certa < 0 || ex.alternativas.length < 2) continue;
      lista.push({
        enunciado: ex.enunciado,
        alternativas: ex.alternativas.map((a) => a.texto),
        certa,
        explicacao: ex.explicacao,
        fonte: ex.fonte,
        aula: { titulo, href: `/trilhas/${grupo.trilha}/${grupo.aula}` },
      });
    }
    mapa.set(area, lista);
  }
  for (const [area, lista] of mapa) mapa.set(area, lista.slice(0, MAXIMO_POR_DISCIPLINA));
  porArea = mapa;
  return mapa;
}

export interface DisciplinaDoJogo {
  area: string;
  nome: string;
  n: number;
}

/** A lista que a sala mostra para escolher a disciplina (o nome vem do dicionário em português). */
export function disciplinasDosJogos(): DisciplinaDoJogo[] {
  const nomes = (pt as { areas: Record<string, [string, string]> }).areas;
  return [...questoesPorDisciplina()]
    .filter(([, lista]) => lista.length >= MINIMO_POR_DISCIPLINA)
    .map(([area, lista]) => ({ area, nome: nomes[area]?.[0] ?? area, n: lista.length }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

/** Os cartões de debate (/debates) como temas da Assembleia: a frase, a resposta do instituto e as fontes. */
export function temasDeDebate(): TemaDeDebate[] {
  return getDebates("pt").map((d) => ({
    slug: d.slug,
    afirmacao: d.claim,
    resposta: d.answer,
    fontes: d.sources.map((s) => ({ titulo: s.title, ...(s.url ? { url: s.url } : {}) })),
  }));
}
