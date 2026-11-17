// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas do banco de questões (onda 11, frente 11A) que não dependem de tela: a lista das matérias (a mesma do banco,
// supabase/migracoes/20261117-alumia-o11-texto.sql), a conferência da questão antes de enviar (espelho da do banco, que decide) e os
// ACERTOS NO APARELHO: o banco não guarda nada da resposta, então o histórico da pessoa mora só aqui, no armazenamento do navegador,
// com o prefixo da Alumia (o "Sair rápido" apaga junto, lib/rede/saida.ts). Sem ranking, sem envio, sem perfil de comportamento.
// Sem "@/": roda no Node dos testes.
import { limparFonte } from "../../../../lib/rede/texto/limpar";

export const MATERIAS = [
  "matematica", "fisica", "quimica", "biologia", "portugues", "literatura", "redacao", "ingles", "espanhol", "artes",
  "historia", "geografia", "filosofia", "sociologia", "economia-politica", "programacao", "outras",
] as const;
export type Materia = (typeof MATERIAS)[number];

export const LIMITES = { tema: [2, 60], enunciado: [10, 4000], alternativa: [1, 500], explicacao: [10, 4000], alternativas: [2, 5] } as const;

/** A letra de cada alternativa. */
export const letra = (i: number): string => "ABCDE"[i] ?? String(i + 1);

export interface QuestaoParaEnviar {
  materia: string;
  tema: string;
  enunciado: string;
  alternativas: string[];
  certa: number;
  explicacao: string;
}

export type ProblemaDaQuestao = "materia" | "tema" | "enunciado" | "alternativas" | "alternativa" | "repetida" | "certa" | "explicacao";

const normal = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const tamanho = (t: string, [min, max]: readonly [number, number]) => {
  const n = limparFonte(t).trim().length;
  return n >= min && n <= max;
};

/** O que impede de enviar (a mesma régua do banco; vazio = pode enviar). */
export function problemasDaQuestao(q: QuestaoParaEnviar): ProblemaDaQuestao[] {
  const p: ProblemaDaQuestao[] = [];
  if (!(MATERIAS as readonly string[]).includes(q.materia)) p.push("materia");
  if (!tamanho(q.tema.replace(/\s+/g, " "), LIMITES.tema)) p.push("tema");
  if (!tamanho(q.enunciado, LIMITES.enunciado)) p.push("enunciado");
  if (q.alternativas.length < LIMITES.alternativas[0] || q.alternativas.length > LIMITES.alternativas[1]) p.push("alternativas");
  else if (q.alternativas.some((a) => !tamanho(a, LIMITES.alternativa))) p.push("alternativa");
  else if (new Set(q.alternativas.map(normal)).size < q.alternativas.length) p.push("repetida");
  if (!Number.isInteger(q.certa) || q.certa < 0 || q.certa >= q.alternativas.length) p.push("certa");
  if (!tamanho(q.explicacao, LIMITES.explicacao)) p.push("explicacao");
  return p;
}

// ── Os acertos no aparelho ──

/** A chave no armazenamento (com o prefixo da Alumia: o "Sair rápido" apaga). */
export const CHAVE_DOS_ACERTOS = "lucia:rede:questoes:v1";

/** Uma resposta guardada no aparelho: a escolha da primeira vez, se acertou, a matéria e o dia (sem hora). */
export interface RespostaNoAparelho {
  e: number;
  a: boolean;
  m: string;
  d: string;
}
export type AcertosNoAparelho = Record<string, RespostaNoAparelho>;

/** O mínimo de um armazenamento (localStorage, ou um falso nos testes). */
export interface Guarda {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

const MAXIMO_GUARDADO = 2000;

export function lerAcertos(g: Guarda | null | undefined): AcertosNoAparelho {
  try {
    const cru = g?.getItem(CHAVE_DOS_ACERTOS);
    const x = cru ? (JSON.parse(cru) as unknown) : null;
    if (!x || typeof x !== "object" || Array.isArray(x)) return {};
    const saida: AcertosNoAparelho = {};
    for (const [id, r] of Object.entries(x as Record<string, unknown>)) {
      const v = r as Partial<RespostaNoAparelho>;
      if (/^[0-9a-f-]{36}$/.test(id) && typeof v?.e === "number" && typeof v.a === "boolean" && typeof v.m === "string" && typeof v.d === "string") saida[id] = { e: v.e, a: v.a, m: v.m, d: v.d };
    }
    return saida;
  } catch {
    return {};
  }
}

/** Guarda a resposta (a primeira vale; "Responder de novo" apaga antes). Os mais velhos saem quando passa do teto. */
export function guardarResposta(g: Guarda | null | undefined, id: string, r: RespostaNoAparelho): AcertosNoAparelho {
  const todos = lerAcertos(g);
  if (!todos[id]) todos[id] = r;
  const ids = Object.keys(todos);
  if (ids.length > MAXIMO_GUARDADO) {
    ids.sort((x, y) => todos[x].d.localeCompare(todos[y].d));
    for (const velho of ids.slice(0, ids.length - MAXIMO_GUARDADO)) delete todos[velho];
  }
  try {
    g?.setItem(CHAVE_DOS_ACERTOS, JSON.stringify(todos));
  } catch {
    // armazenamento cheio ou bloqueado: o acerto só não fica guardado
  }
  return todos;
}

export function esquecerResposta(g: Guarda | null | undefined, id: string): AcertosNoAparelho {
  const todos = lerAcertos(g);
  delete todos[id];
  try {
    g?.setItem(CHAVE_DOS_ACERTOS, JSON.stringify(todos));
  } catch {
    // sem armazenamento: nada a apagar
  }
  return todos;
}

export function apagarAcertos(g: Guarda | null | undefined): void {
  try {
    g?.removeItem(CHAVE_DOS_ACERTOS);
  } catch {
    // sem armazenamento: nada a apagar
  }
}

/** O resumo da própria pessoa: total e por matéria (só dela, só no aparelho). */
export function resumoDosAcertos(todos: AcertosNoAparelho): { feitas: number; certas: number; porMateria: { materia: string; feitas: number; certas: number }[] } {
  const por = new Map<string, { feitas: number; certas: number }>();
  let feitas = 0;
  let certas = 0;
  for (const r of Object.values(todos)) {
    feitas++;
    if (r.a) certas++;
    const m = por.get(r.m) ?? { feitas: 0, certas: 0 };
    m.feitas++;
    if (r.a) m.certas++;
    por.set(r.m, m);
  }
  return { feitas, certas, porMateria: [...por].map(([materia, x]) => ({ materia, ...x })).sort((a, b) => b.feitas - a.feitas || a.materia.localeCompare(b.materia)) };
}

/** O dia de hoje (sem hora: o aparelho não precisa saber quando, só a ordem para jogar fora os mais velhos). */
export const hoje = (agora = new Date()): string => agora.toISOString().slice(0, 10);
