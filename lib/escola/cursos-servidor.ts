// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Lê os cursos da Escola de content/escola/cursos/<slug>.json e confere cada um contra o que existe no repositório
// (aulas, Memorial, Acervo e os outros cursos). Roda só no servidor ou na montagem (usa fs). Pasta vazia é válida: a
// Escola abre sem curso nenhum até o E4-07 escrever os arquivos. Sem os atalhos "@/" de propósito: `npm run
// testar:escola` valida TODOS os cursos com este arquivo, direto no Node.

import fs from "node:fs";
import path from "node:path";
import { exerciciosDaAula } from "../exercicios-conteudo";
import { parseFrontmatter } from "../frontmatter";
import { plainText } from "../text";
import { type Curso, tempoDaAula, validarCurso } from "./cursos";

const RAIZ = process.cwd();
const PASTA_CURSOS = path.join(RAIZ, "content", "escola", "cursos");
const existe = (...partes: string[]) => {
  try {
    return fs.statSync(path.join(RAIZ, ...partes)).isFile();
  } catch {
    return false;
  }
};

// As aulas de cada trilha, como o site as lê (lib/content.ts): "NN-slug.md" ou "slug.md", sem traduções ("x.en.md"),
// sem versões fáceis ("x.facil.md") e sem as marcadas com "ativo: false". Guardado por processo.
const ARQUIVO_DE_AULA = /^(?:\d+-)?([a-z0-9-]+)\.md$/;
const aulasPorTrilha = new Map<string, Map<string, string>>();
function aulasDa(trilha: string): Map<string, string> {
  let mapa = aulasPorTrilha.get(trilha);
  if (mapa) return mapa;
  mapa = new Map();
  const pasta = path.join(RAIZ, "content", "trilhas", trilha);
  try {
    for (const nome of fs.readdirSync(pasta)) {
      if (nome.startsWith("_") || /\.[a-z]{2}\.md$/.test(nome) || /\.facil(\.[a-z]{2})?\.md$/.test(nome)) continue;
      const m = ARQUIVO_DE_AULA.exec(nome);
      if (!m) continue;
      const { data } = parseFrontmatter(fs.readFileSync(path.join(pasta, nome), "utf8"));
      if (data.ativo === false) continue;
      mapa.set(m[1], nome);
    }
  } catch {
    // trilha que não existe: nenhuma aula
  }
  aulasPorTrilha.set(trilha, mapa);
  return mapa;
}
/** O arquivo de uma aula "trilha/aula" (null se a aula não existe ou está desativada). */
function arquivoDaAula(trilhaAula: string): string | null {
  const [trilha, aula, ...resto] = trilhaAula.split("/");
  if (!trilha || !aula || resto.length || !/^[a-z0-9-]+$/.test(trilha)) return null;
  const nome = aulasDa(trilha).get(aula);
  return nome ? path.join(RAIZ, "content", "trilhas", trilha, nome) : null;
}

/** "trilha/aula" existe (e está ativa) em content/trilhas? O slug é o do endereço, sem o número do arquivo. */
export const existeAula = (trilhaAula: string) => arquivoDaAula(trilhaAula) !== null;
export const existeMemorial = (slug: string) => Boolean(slug) && existe("content", "memorial", `${slug}.md`);
export const existeObra = (slug: string) => Boolean(slug) && existe("content", "acervo", `${slug}.md`);

/** Os arquivos .json da pasta de cursos (o LEIA-ME e outros arquivos ficam de fora). */
function arquivosDeCurso(): string[] {
  try {
    return fs
      .readdirSync(PASTA_CURSOS)
      .filter((n) => n.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

export interface CursoLido {
  arquivo: string;
  curso: Curso | null;
  erros: string[];
}

/** Lê cada arquivo e confere a forma e as referências. O nome do arquivo precisa ser o slug. */
export function lerCursosComErros(): CursoLido[] {
  const lidos: { arquivo: string; curso: Curso | null; erros: string[] }[] = arquivosDeCurso().map((arquivo) => {
    try {
      const curso = JSON.parse(fs.readFileSync(path.join(PASTA_CURSOS, arquivo), "utf8")) as Curso;
      return { arquivo, curso, erros: [] };
    } catch (e) {
      return { arquivo, curso: null, erros: [`JSON inválido: ${(e as Error).message}`] };
    }
  });
  const porSlug = new Map(lidos.filter((l) => l.curso).map((l) => [l.curso!.slug, l.curso!]));
  for (const l of lidos) {
    if (!l.curso) continue;
    if (`${l.curso.slug}.json` !== l.arquivo) l.erros.push(`o nome do arquivo precisa ser o slug (${l.curso.slug}.json)`);
    l.erros.push(
      ...validarCurso(l.curso, {
        existeAula,
        existeMemorial,
        existeObra,
        existeCurso: (s) => porSlug.has(s),
        requisitosDe: (s) => porSlug.get(s)?.requisitos,
      }),
    );
  }
  return lidos;
}

let memo: Curso[] | null = null;
/** Os cursos válidos, em ordem de slug. Curso com erro fica de fora (e o teste falha). */
export function carregarCursos(): Curso[] {
  if (memo) return memo;
  memo = lerCursosComErros()
    .filter((l) => l.curso && l.erros.length === 0)
    .map((l) => l.curso!);
  return memo;
}

export const cursoPorSlug = (slug: string) => carregarCursos().find((c) => c.slug === slug) ?? null;

/** Minutos estimados de uma aula: leitura (180 palavras por minuto, como no resto do site) + teste + exercícios. */
export function minutosDaAula(trilhaAula: string): number {
  const [trilha, aula] = trilhaAula.split("/");
  const arquivo = arquivoDaAula(trilhaAula);
  if (!arquivo) return 0;
  try {
    const { data, content } = parseFrontmatter(fs.readFileSync(arquivo, "utf8"));
    const minutes = Math.max(1, Math.ceil(plainText(content).split(" ").length / 180));
    const quiz = Array.isArray(data.quiz) ? data.quiz.length : 0;
    let exercicios = 0;
    try {
      exercicios = exerciciosDaAula(trilha, aula).length;
    } catch {
      exercicios = 0;
    }
    return tempoDaAula({ minutes, quiz, exercicios });
  } catch {
    return 0;
  }
}
