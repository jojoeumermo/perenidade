// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A matrícula sem cadastro da Escola Revolucionária Lúcia Maria (E4-08, D1-9 e D1-10): a sugestão de cursos a partir das três
// perguntas de vida e do nivelamento, a edição das respostas e os dados da carteirinha. Puro: sem React, sem fs e sem
// os atalhos "@/" (`npm run testar:escola-matricula` roda este arquivo direto no Node). A matrícula em si (número,
// gravação, inscrições, apagar) mora em lib/escola/estudante.ts (E4-01) e não muda aqui. Explicação em
// docs/escola/matricula.md.

import type { Ciclo } from "./cursos";
import { type Acesso, type Inscricao, type Matricula, MAX_APELIDO, type Objetivo, type RespostasDaMatricula, type Tempo } from "./estudante";
import { semestreDe } from "./tempo";

/** O que o aparelho recebe de cada curso (o servidor monta a partir de content/escola/cursos, em português). */
export interface CursoDoAparelho {
  slug: string;
  titulo: string;
  resumo: string;
  ciclo: Ciclo;
  objetivos: Objetivo[];
  requisitos: string[];
  /** Horas estimadas do curso inteiro (lib/escola/cursos.ts: horasDoCurso). Estimativa, não carga horária oficial. */
  horas: number;
  modulos: { titulo: string; aulas: string[] }[];
}

/** Os títulos e os minutos estimados de cada aula "trilha/aula" dos cursos. */
export type AulasDoAparelho = Record<string, { titulo: string; minutos: number }>;

/** O curso de "aprender a estudar": quando existe, aparece à parte, "antes de um curso longo, se quiser". */
export const CURSO_PARA_ESTUDAR = "aprender-a-estudar";
/** Acima disto (em horas), quem tem até 1 h por semana recebe "comece pelo módulo 1". */
export const HORAS_DE_CURSO_LONGO = 80;
export const MAX_SUGESTOES = 3;

/**
 * O que vale quando a pessoa aperta "Pular" numa pergunta: o objetivo fica "outro" e o tempo fica o menor (o plano
 * nasce pequeno, sem cobrar). A internet fica "wi-fi em casa", para não oferecer o modo leve a quem não pediu.
 * Tudo dá para mudar depois em "Editar as respostas".
 */
export const PADROES_AO_PULAR: { objetivo: Objetivo; tempo: Tempo; acesso: Acesso } = { objetivo: "outro", tempo: "ate-1h", acesso: "wifi-em-casa" };

export type MotivoDaSugestao = "pedido" | "objetivo" | "comeco";

export interface SugestaoDeCurso {
  slug: string;
  motivo: MotivoDaSugestao;
  /** Curso de mais de 80 h para quem tem até 1 h por semana: a tela diz "comece pelo módulo 1". */
  comeceDoModulo1: boolean;
  /** O curso tem aula de uma trilha que o nivelamento sugeriu. */
  nivelado: boolean;
}

export interface Sugestoes {
  /** De 1 a 3 cursos (nenhum só quando não há curso). */
  cursos: SugestaoDeCurso[];
  /** O "aprender a estudar", se existir e não estiver na lista. */
  antes: SugestaoDeCurso | null;
}

const ORDEM_DO_CICLO: Record<Ciclo, number> = { basico: 0, profissional: 1, avancado: 2 };
const trilhasDoCurso = (c: Pick<CursoDoAparelho, "modulos">) => new Set(c.modulos.flatMap((m) => m.aulas.map((a) => a.split("/")[0])));
const comecoLivre = (c: Pick<CursoDoAparelho, "ciclo" | "requisitos">) => c.ciclo === "basico" && c.requisitos.length === 0;

/**
 * De 1 a 3 cursos para começar, pelas respostas. Cruza o objetivo com `curso.objetivos`; entre os que combinam,
 * prefere o ciclo básico sem requisitos, depois o que tem aula das trilhas que o nivelamento sugeriu, depois menos
 * requisitos, o ciclo mais cedo e o slug (para a ordem ser sempre a mesma). Se nenhum combina, sugere os de começo
 * livre (ciclo básico sem requisitos); se nem esses existem, os outros. `pedido` (o ?curso= vindo do catálogo) vem
 * primeiro quando o curso existe. O "aprender-a-estudar" sai da lista e volta em `antes`, a não ser que tenha sido o
 * pedido.
 */
export function sugerirCursos(
  matricula: Pick<Matricula, "objetivo" | "tempo">,
  cursos: readonly CursoDoAparelho[],
  nivelamento: readonly string[] = [],
  pedido?: string | null,
): Sugestoes {
  const trilhasNiveladas = new Set(nivelamento);
  const nivelado = (c: CursoDoAparelho) => [...trilhasDoCurso(c)].some((t) => trilhasNiveladas.has(t));
  const sugestao = (c: CursoDoAparelho, motivo: MotivoDaSugestao): SugestaoDeCurso => ({
    slug: c.slug,
    motivo,
    comeceDoModulo1: matricula.tempo === "ate-1h" && c.horas > HORAS_DE_CURSO_LONGO,
    nivelado: nivelado(c),
  });
  const ordem = (a: CursoDoAparelho, b: CursoDoAparelho) =>
    Number(comecoLivre(b)) - Number(comecoLivre(a)) ||
    Number(nivelado(b)) - Number(nivelado(a)) ||
    a.requisitos.length - b.requisitos.length ||
    ORDEM_DO_CICLO[a.ciclo] - ORDEM_DO_CICLO[b.ciclo] ||
    (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

  const pedidoAchado = pedido ? cursos.find((c) => c.slug === pedido) : undefined;
  const resto = cursos.filter((c) => c.slug !== pedidoAchado?.slug && c.slug !== CURSO_PARA_ESTUDAR);
  const combinam = resto.filter((c) => Array.isArray(c.objetivos) && c.objetivos.includes(matricula.objetivo)).sort(ordem);
  let lista: SugestaoDeCurso[] = combinam.map((c) => sugestao(c, "objetivo"));
  if (lista.length === 0) {
    const livres = resto.filter(comecoLivre).sort(ordem);
    lista = (livres.length ? livres : [...resto].sort(ordem)).map((c) => sugestao(c, "comeco"));
  }
  if (pedidoAchado) lista = [sugestao(pedidoAchado, "pedido"), ...lista];
  lista = lista.slice(0, MAX_SUGESTOES);

  const estudar = cursos.find((c) => c.slug === CURSO_PARA_ESTUDAR);
  const antes = estudar && !lista.some((s) => s.slug === CURSO_PARA_ESTUDAR) ? sugestao(estudar, "comeco") : null;
  return { cursos: lista, antes };
}

/** O resultado do nivelamento como lib/meu-estudo.ts guarda ('lucia:nivelamento'): trilha → sugestão. */
export type RegistrosDoNivelamento = Record<string, { sugestao: string | null; quando?: number } | undefined>;

/**
 * As trilhas em que o nivelamento sugeriu por onde começar (sugestão diferente de null), as mais recentes primeiro,
 * até 12. Viram `matricula.nivelamento`. Trilha em que a pessoa foi bem em tudo não entra: não há o que sugerir.
 */
export function trilhasDoNivelamento(registros: RegistrosDoNivelamento | null | undefined): string[] {
  if (!registros || typeof registros !== "object") return [];
  return Object.entries(registros)
    .filter((par): par is [string, { sugestao: string; quando?: number }] => Boolean(par[1]) && typeof par[1]?.sugestao === "string" && /^[a-z0-9-]+$/.test(par[0]))
    .sort((a, b) => (b[1].quando ?? 0) - (a[1].quando ?? 0))
    .map(([trilha]) => trilha)
    .slice(0, 12);
}

/** Troca as respostas de uma matrícula que já existe, mantendo o número e a data (a pessoa é a mesma). */
export function editarMatricula(m: Matricula, respostas: Partial<RespostasDaMatricula>): Matricula {
  const apelido = respostas.apelido === undefined ? m.apelido : respostas.apelido.trim().slice(0, MAX_APELIDO);
  return {
    versao: 1,
    numero: m.numero,
    criadaEm: m.criadaEm,
    ...(apelido ? { apelido } : {}),
    objetivo: respostas.objetivo ?? m.objetivo,
    tempo: respostas.tempo ?? m.tempo,
    acesso: respostas.acesso ?? m.acesso,
    nivelamento: respostas.nivelamento ? [...new Set(respostas.nivelamento)] : m.nivelamento,
  };
}

/** O apelido limpo, como entra na matrícula: sem espaços nas pontas, sem quebra de linha, até 40 caracteres. */
export const limparApelido = (texto: string) => texto.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").slice(0, MAX_APELIDO);

/** As inscrições em andamento (sem trancar e sem formatura), na ordem em que a pessoa entrou. */
export const inscricoesAtivas = (inscricoes: readonly Inscricao[]) => inscricoes.filter((i) => !i.trancadoEm && !i.formadoEm);

/** O curso atual: a inscrição em andamento mais recente; null quando não há. */
export function cursoAtual(inscricoes: readonly Inscricao[]): Inscricao | null {
  const ativas = inscricoesAtivas(inscricoes);
  if (ativas.length === 0) return null;
  return [...ativas].sort((a, b) => (a.entrouEm < b.entrouEm ? 1 : a.entrouEm > b.entrouEm ? -1 : 0))[0];
}

/** Até duas iniciais do apelido (para o lugar da foto). Sem apelido, vazio. */
export function iniciais(apelido: string | undefined): string {
  const partes = (apelido ?? "").trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
  return letras.map((p) => [...p][0] ?? "").join("").toLocaleUpperCase("pt-BR");
}

export interface DadosDaCarteirinha {
  /** O apelido; sem ele, null (a tela escreve "Estudante"). */
  apelido: string | null;
  numero: string;
  /** O título do curso atual, ou null. */
  curso: string | null;
  /** "AAAA.1" ou "AAAA.2", pelo calendário da Escola (semestreDe). */
  semestre: string;
  /** O ano em que a matrícula foi feita. */
  desde: string;
  iniciais: string;
}

/** O que vai escrito na carteirinha. Só sai do que está no aparelho; nada de documento, nome completo ou foto obrigatória. */
export function dadosDaCarteirinha(m: Matricula, inscricoes: readonly Inscricao[], tituloDoCurso: (slug: string) => string | null, hoje: string): DadosDaCarteirinha {
  const atual = cursoAtual(inscricoes);
  return {
    apelido: m.apelido ?? null,
    numero: m.numero,
    curso: atual ? (tituloDoCurso(atual.curso) ?? atual.curso) : null,
    semestre: semestreDe(hoje).id,
    desde: m.criadaEm.slice(0, 4),
    iniciais: iniciais(m.apelido),
  };
}
