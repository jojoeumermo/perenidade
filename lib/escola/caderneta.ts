// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caderneta do trabalhador (E4-14; docs/escola/formatura.md): remover, editar e ordenar os registros, o texto da
// exportação e o resumo de horas. Tudo no aparelho (lucia:escola:caderneta). Sem React e sem "@/" de propósito: o teste
// roda este arquivo direto no Node. Escreve direto em CHAVES_DA_ESCOLA.caderneta para não editar estudante.ts (E4-01).

import {
  CHAVES_DA_ESCOLA,
  type Inscricao,
  lerCaderneta,
  MAX_DETALHE,
  MAX_TITULO,
  type RegistroDaCaderneta,
  type TipoDeRegistro,
} from "./estudante";

// ───────────── Armazenamento (cópia curta dos ajudantes de estudante.ts, que não os exporta) ─────────────

const armazenamento = (): Storage | undefined => {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

function avisar() {
  try {
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // fora do navegador não há quem ouvir
  }
}

/** Lê e interpreta uma chave da Escola. Nunca lança. */
export function lerChaveDaEscola(chave: string): unknown {
  try {
    const texto = armazenamento()?.getItem(chave);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

/** Grava uma chave da Escola e avisa (evento lucia:estudo). Sem armazenamento ou cheio: false, sem quebrar. */
export function gravarChaveDaEscola(chave: string, valor: unknown): boolean {
  try {
    const a = armazenamento();
    if (!a) return false;
    a.setItem(chave, JSON.stringify(valor));
    avisar();
    return true;
  } catch {
    return false;
  }
}

/** Tira uma chave (para o rascunho do Mural). */
export function apagarChaveDaEscola(chave: string): boolean {
  try {
    const a = armazenamento();
    if (!a) return false;
    a.removeItem(chave);
    avisar();
    return true;
  } catch {
    return false;
  }
}

// ───────────── Remover, editar, ordenar ─────────────

/** Tipos que a pessoa pode editar; os outros vêm de outras telas e só se removem. */
export const TIPOS_EDITAVEIS: readonly TipoDeRegistro[] = ["outro", "tarefa", "caso"];

const ehFormatura = (r: RegistroDaCaderneta) => r.id.startsWith("formatura-");

/** Este registro pode ser editado à mão? (Os de saberes, banca, turma e formatura, não.) */
export const registroEditavel = (r: RegistroDaCaderneta) => TIPOS_EDITAVEIS.includes(r.tipo) && !ehFormatura(r);

/** Tira o registro com este id. Devolve true se ele estava lá e a lista foi guardada. */
export function removerRegistro(id: string): boolean {
  const lista = lerCaderneta();
  const nova = lista.filter((r) => r.id !== id);
  if (nova.length === lista.length) return false;
  return gravarChaveDaEscola(CHAVES_DA_ESCOLA.caderneta, nova);
}

/** Troca título e detalhe de um registro editável, mantendo o id. Devolve false se recusado ou não guardado. */
export function editarRegistro(id: string, novo: { titulo: string; detalhe: string }): boolean {
  const lista = lerCaderneta();
  const alvo = lista.find((r) => r.id === id);
  if (!alvo || !registroEditavel(alvo)) return false;
  const titulo = novo.titulo.replace(/\s+/g, " ").trim().slice(0, MAX_TITULO);
  if (!titulo) return false;
  alvo.titulo = titulo;
  alvo.detalhe = novo.detalhe.trim().slice(0, MAX_DETALHE);
  return gravarChaveDaEscola(CHAVES_DA_ESCOLA.caderneta, lista);
}

/** Do mais novo para o mais velho; no mesmo dia, o que entrou por último vem primeiro. */
export function ordenarCaderneta(registros: readonly RegistroDaCaderneta[]): RegistroDaCaderneta[] {
  return registros
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.data === b.r.data ? b.i - a.i : a.r.data < b.r.data ? 1 : -1))
    .map((x) => x.r);
}

// ───────────── Seções, texto e resumo ─────────────

export const SECOES_DA_CADERNETA = ["formatura", "saberes", "banca", "turma", "tarefaECaso", "outros"] as const;
export type SecaoDaCaderneta = (typeof SECOES_DA_CADERNETA)[number];

export function secaoDoRegistro(r: RegistroDaCaderneta): SecaoDaCaderneta {
  if (ehFormatura(r)) return "formatura";
  if (r.tipo === "saberes" || r.tipo === "banca" || r.tipo === "turma") return r.tipo;
  if (r.tipo === "tarefa" || r.tipo === "caso") return "tarefaECaso";
  return "outros";
}

export interface RotulosDaCaderneta {
  /** Nome da seção, por SecaoDaCaderneta. */
  secoes: Record<SecaoDaCaderneta, string>;
  /** "Estudante", usado quando não há apelido. */
  estudante: string;
  titulo: string;
  matricula: string;
  data: string;
  quemAvaliou: string;
  curso: string;
  /** O aviso fixo (chave naoEhDocumento). */
  naoEhDocumento: string;
  vazio: string;
}

export interface OpcoesDaCaderneta {
  rotulos: RotulosDaCaderneta;
  /** Dia AAAA-MM-DD do cabeçalho. */
  dia: string;
  /** Registros a sair; sem lista, todos. */
  ids?: readonly string[];
  /** Nomes de quem avaliou ou fez parte da banca (eles permitiram). Padrão: não. */
  incluirNomesDeTerceiros?: boolean;
  /** Número de matrícula. Padrão: não. */
  incluirMatricula?: boolean;
  matricula?: string;
  apelido?: string;
  /** Só em memória, nunca gravado. */
  nomeNaFolha?: string;
  /** Título de cada curso, por slug (para a linha "Curso: ..."). */
  titulosDosCursos?: Record<string, string>;
}

/** Os registros que vão para a folha: os escolhidos, na ordem da caderneta. */
export function registrosParaExportar(registros: readonly RegistroDaCaderneta[], ids?: readonly string[]): RegistroDaCaderneta[] {
  const lista = ordenarCaderneta(registros);
  return ids ? lista.filter((r) => ids.includes(r.id)) : lista;
}

/** O cabeçalho da folha e do .txt: nome na folha (só em memória) ou apelido ou "Estudante". */
export function cabecalhoDaCaderneta(o: OpcoesDaCaderneta): string[] {
  const quem = o.nomeNaFolha?.trim() || o.apelido?.trim() || o.rotulos.estudante;
  const linhas = [o.rotulos.titulo, quem];
  if (o.incluirMatricula && o.matricula) linhas.push(`${o.rotulos.matricula}: ${o.matricula}`);
  linhas.push(`${o.rotulos.data}: ${o.dia}`);
  return linhas;
}

/** O texto simples do .txt. Nomes de terceiros e matrícula só entram se pedidos. Termina com o aviso fixo. */
export function textoDaCaderneta(registros: readonly RegistroDaCaderneta[], o: OpcoesDaCaderneta): string {
  const linhas: string[] = [...cabecalhoDaCaderneta(o), ""];
  const escolhidos = registrosParaExportar(registros, o.ids);
  if (escolhidos.length === 0) linhas.push(o.rotulos.vazio, "");
  for (const secao of SECOES_DA_CADERNETA) {
    const doGrupo = escolhidos.filter((r) => secaoDoRegistro(r) === secao);
    if (doGrupo.length === 0) continue;
    linhas.push(o.rotulos.secoes[secao].toUpperCase());
    for (const r of doGrupo) {
      linhas.push(`- ${r.data}  ${r.titulo}`);
      if (r.curso) linhas.push(`  ${o.rotulos.curso}: ${o.titulosDosCursos?.[r.curso] ?? r.curso}`);
      if (r.detalhe) linhas.push(`  ${r.detalhe.replace(/\s*\n\s*/g, " ")}`);
      if (o.incluirNomesDeTerceiros && r.pessoas?.length) linhas.push(`  ${o.rotulos.quemAvaliou}: ${r.pessoas.join(", ")}`);
    }
    linhas.push("");
  }
  linhas.push(o.rotulos.naoEhDocumento, "");
  return linhas.join("\n");
}

export interface CursoParaResumo {
  slug: string;
  titulo: string;
  /** Horas estimadas já feitas e do curso todo (cursos.ts: horasFeitas e horasDoCurso). */
  horasFeitas: number;
  horasTotais: number;
}

export interface ResumoDaCaderneta {
  total: number;
  porSecao: Record<SecaoDaCaderneta, number>;
  /** Soma das horas ESTIMADAS dos cursos em que a pessoa está inscrita. */
  horasFeitas: number;
  cursos: { slug: string; titulo: string; horasFeitas: number; horasTotais: number; formado: boolean }[];
}

/** Conta os registros por seção e soma as horas estimadas dos cursos inscritos. */
export function resumoDaCaderneta(
  registros: readonly RegistroDaCaderneta[],
  inscricoes: readonly Inscricao[],
  cursos: readonly CursoParaResumo[],
): ResumoDaCaderneta {
  const porSecao = Object.fromEntries(SECOES_DA_CADERNETA.map((s) => [s, 0])) as Record<SecaoDaCaderneta, number>;
  for (const r of registros) porSecao[secaoDoRegistro(r)]++;
  const lista = inscricoes.flatMap((i) => {
    const c = cursos.find((x) => x.slug === i.curso);
    return c ? [{ slug: c.slug, titulo: c.titulo, horasFeitas: c.horasFeitas, horasTotais: c.horasTotais, formado: Boolean(i.formadoEm) }] : [];
  });
  const horasFeitas = Math.round(lista.reduce((s, c) => s + c.horasFeitas, 0) * 2) / 2;
  return { total: registros.length, porSecao, horasFeitas, cursos: lista };
}
