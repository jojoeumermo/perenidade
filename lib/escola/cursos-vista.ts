// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as páginas dos cursos (E4-07) mostram de cada curso, montado no servidor a partir de content/escola/cursos e do
// resto do conteúdo: as aulas com título e minutos, as horas, a bibliografia (as fontes das aulas, sem repetir), a
// biblioteca (as obras do Acervo), o patrono (do Memorial), as leituras guiadas e os cursos de cada aula (para a faixa
// na página da aula). Só servidor e montagem: usa fs pelo lib/content. Guardado por processo (o cache() do React não
// guarda fora da renderização; veja docs/escola/cursos.md).

import fs from "node:fs";
import path from "node:path";
import { getBooks, getTracks, getTributes, type Lesson, type Source, type Track } from "@/lib/content";
import { aulasDoCurso, type Curso, arredondarHoras } from "@/lib/escola/cursos";
import { carregarCursos, existeObra, minutosDaAula } from "@/lib/escola/cursos-servidor";
import { type LeituraGuiada, validarLeitura } from "@/lib/escola/leituras";

export interface AulaVista {
  /** "trilha/aula" */
  id: string;
  titulo: string;
  resumo: string;
  trilha: string;
  /** Caminho sem idioma: /trilhas/<trilha>/<aula>. */
  caminho: string;
  minutos: number;
}

export interface ModuloVisto {
  titulo: string;
  aulas: AulaVista[];
  pratica?: string[];
  minutos: number;
}

export interface CursoVisto {
  curso: Curso;
  modulos: ModuloVisto[];
  nAulas: number;
  minutos: number;
  horas: number;
}

// O conteúdo dos cursos é em português: as aulas são lidas na versão original.
let aulasPorId: Map<string, { lesson: Lesson; track: Track }> | null = null;
function indiceDeAulas() {
  if (aulasPorId) return aulasPorId;
  aulasPorId = new Map();
  for (const track of getTracks("pt")) for (const lesson of track.lessons) aulasPorId.set(`${track.slug}/${lesson.slug}`, { lesson, track });
  return aulasPorId;
}

/** A aula de "trilha/aula", como o site a lê (null se não existe). */
export const aulaDoSite = (id: string) => indiceDeAulas().get(id) ?? null;

const minutosGuardados = new Map<string, number>();
export function minutosDe(id: string): number {
  let m = minutosGuardados.get(id);
  if (m === undefined) {
    m = minutosDaAula(id);
    minutosGuardados.set(id, m);
  }
  return m;
}

function aulaVista(id: string): AulaVista {
  const achada = aulaDoSite(id);
  const [trilha, aula] = id.split("/");
  return {
    id,
    titulo: achada?.lesson.title ?? aula,
    resumo: achada?.lesson.summary ?? "",
    trilha: achada?.track.title ?? trilha,
    caminho: `/trilhas/${trilha}/${aula}`,
    minutos: minutosDe(id),
  };
}

const vistos = new Map<string, CursoVisto>();
/** O curso com as aulas, os minutos e as horas estimadas. */
export function verCurso(curso: Curso): CursoVisto {
  const guardado = vistos.get(curso.slug);
  if (guardado) return guardado;
  const modulos = curso.modulos.map((m) => {
    const aulas = m.aulas.map(aulaVista);
    return { titulo: m.titulo, aulas, ...(m.pratica?.length ? { pratica: m.pratica } : {}), minutos: aulas.reduce((s, a) => s + a.minutos, 0) };
  });
  const minutos = modulos.reduce((s, m) => s + m.minutos, 0);
  const visto = { curso, modulos, nAulas: aulasDoCurso(curso).length, minutos, horas: arredondarHoras(minutos) };
  vistos.set(curso.slug, visto);
  return visto;
}

/** As fontes citadas nas aulas do curso, sem repetir (mesmo endereço ou mesmo título e autor), na ordem em que aparecem. */
export function bibliografiaDo(curso: Curso): Source[] {
  const vistas = new Set<string>();
  const lista: Source[] = [];
  const chave = (s: Source) => (s.url ? s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase() : `${s.title}|${s.author ?? ""}`.toLowerCase());
  for (const id of aulasDoCurso(curso)) {
    for (const fonte of aulaDoSite(id)?.lesson.sources ?? []) {
      const k = chave(fonte);
      if (vistas.has(k)) continue;
      vistas.add(k);
      lista.push(fonte);
    }
  }
  return lista;
}

export interface ObraDaBiblioteca {
  obra: string;
  ordem: number;
  porque: string;
  titulo: string;
  autor: string;
  licenca: string;
  fonte: string;
  url: string;
  ano?: string;
  /** Há leitura guiada desta obra na Escola? */
  guiada: boolean;
}

/** As leituras do curso com os dados da ficha do Acervo, na ordem de leitura. Obra escondida ou sem ficha fica de fora. */
export function bibliotecaDo(curso: Curso): ObraDaBiblioteca[] {
  const livros = getBooks("pt");
  const guiadas = new Set(leiturasGuiadas().map((l) => l.obra));
  return [...(curso.leituras ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((l) => {
      const livro = livros.find((b) => b.id === l.obra);
      if (!livro) return [];
      return [{ obra: l.obra, ordem: l.ordem, porque: l.porque, titulo: livro.title, autor: livro.author, licenca: livro.license, fonte: livro.source, url: livro.url, ano: livro.year, guiada: guiadas.has(l.obra) }];
    });
}

export interface PatronoVisto {
  slug: string;
  nome: string;
  nascimento: string;
  morte: string;
  motivo: string;
  confirmado: boolean;
}

/** O patrono do curso, com o nome e as datas da ficha do Memorial (null quando o curso não tem patrono). */
export function patronoDo(curso: Curso): PatronoVisto | null {
  if (!curso.patrono) return null;
  const pessoa = getTributes("pt").find((t) => t.slug === curso.patrono!.memorial);
  if (!pessoa) return null;
  return { slug: pessoa.slug, nome: pessoa.name, nascimento: pessoa.born, morte: pessoa.died, motivo: curso.patrono.motivo, confirmado: curso.patrono.confirmado };
}

// ───────────── Leituras guiadas ─────────────

const PASTA_LEITURAS = path.join(process.cwd(), "content", "escola", "leituras");
let leituras: LeituraGuiada[] | null = null;
/** As leituras guiadas válidas de content/escola/leituras (o nome do arquivo é o slug da obra). */
export function leiturasGuiadas(): LeituraGuiada[] {
  if (leituras) return leituras;
  let nomes: string[] = [];
  try {
    nomes = fs.readdirSync(PASTA_LEITURAS).filter((n) => n.endsWith(".json")).sort();
  } catch {
    nomes = [];
  }
  leituras = nomes.flatMap((nome) => {
    try {
      const dado = JSON.parse(fs.readFileSync(path.join(PASTA_LEITURAS, nome), "utf8")) as LeituraGuiada;
      return validarLeitura(dado, existeObra).length === 0 && `${dado.obra}.json` === nome ? [dado] : [];
    } catch {
      return [];
    }
  });
  return leituras;
}

export const leituraDe = (obra: string) => leiturasGuiadas().find((l) => l.obra === obra) ?? null;

// ───────────── A faixa do curso na aula ─────────────

/** O que a faixa da aula precisa de cada curso: as aulas na ordem, o título de cada uma e o módulo de cada uma. */
export interface CursoDaAula {
  slug: string;
  titulo: string;
  /** "trilha/aula", na ordem do curso. */
  aulas: string[];
  titulos: string[];
  /** O índice do módulo de cada aula (mesma ordem de `aulas`). */
  modulos: number[];
}

let porAula: Map<string, CursoDaAula[]> | null = null;
/** Os cursos de que uma aula faz parte (lista vazia quando não faz parte de nenhum). */
export function cursosDaAula(id: string): CursoDaAula[] {
  if (!porAula) {
    porAula = new Map();
    for (const curso of carregarCursos()) {
      const aulas = aulasDoCurso(curso);
      const dados: CursoDaAula = {
        slug: curso.slug,
        titulo: curso.titulo,
        aulas,
        titulos: aulas.map((a) => aulaDoSite(a)?.lesson.title ?? a),
        modulos: curso.modulos.flatMap((m, i) => m.aulas.map(() => i)),
      };
      for (const a of aulas) porAula.set(a, [...(porAula.get(a) ?? []), dados]);
    }
  }
  return porAula.get(id) ?? [];
}
