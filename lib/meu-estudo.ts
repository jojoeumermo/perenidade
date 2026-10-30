// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o painel "Meu estudo" guarda, neste navegador e só nele: o resultado dos testes de fim de aula, as respostas
// dos exercícios (com a revisão espaçada dos que a pessoa errou), a data em que cada aula foi marcada como feita, a meta
// da semana, a sugestão do nivelamento, o "Isso ajudou?" e as turmas abertas por link. Nada vai para servidor.
// Convive com lib/estudo.ts (caderno de erros, cartões e cópia de segurança), que continua igual: as chaves daqui
// entram na mesma cópia. Sem os atalhos "@/" de propósito: `npm run testar:meu-estudo` roda este arquivo no Node.

import { hoje, INTERVALOS, somarDias } from "./estudo";

export const CHAVES = {
  testes: "lucia:testes",
  exercicios: "lucia:exercicios",
  datas: "lucia:concluidas-em",
  metas: "lucia:metas",
  nivelamento: "lucia:nivelamento",
  ajudou: "lucia:ajudou",
  turmas: "lucia:turmas",
  /** O curso ENEM (lib/enem-aparelho.ts): provas e simulados feitos, diagnóstico, plano de estudos e tempo por questão. */
  enem: "lucia:enem",
} as const;

/** As chaves deste arquivo, para a cópia de segurança e para o "apagar". */
export const CHAVES_DO_MEU_ESTUDO: string[] = Object.values(CHAVES);

/** O que o "Apagar o meu estudo" leva: o progresso, os testes, os erros, os cartões e tudo daqui. Notas e fontes do caderno ficam. */
export const CHAVES_DO_PROGRESSO: string[] = ["lucia:concluidas", "lucia:ultima-aula", "lucia:erros", "lucia:revisao", ...CHAVES_DO_MEU_ESTUDO];

function lerObjeto<T>(chave: string): Record<string, T> {
  try {
    const dado: unknown = JSON.parse(globalThis.localStorage?.getItem(chave) ?? "{}");
    return dado && typeof dado === "object" && !Array.isArray(dado) ? (dado as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    globalThis.localStorage?.setItem(chave, JSON.stringify(valor));
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // armazenamento cheio ou bloqueado: o estudo segue, só não fica guardado
  }
}

// ───────────── Testes de fim de aula ─────────────

export interface Teste {
  quando: number;
  acertos: number;
  total: number;
  /** Quantas vezes a pessoa terminou o teste desta aula. */
  vezes: number;
}

export const lerTestes = () => lerObjeto<Teste>(CHAVES.testes);

/** Guarda o resultado do teste de uma aula quando todas as questões foram respondidas (vale o último). */
export function registrarTeste(aula: string, acertos: number, total: number, agora = Date.now()) {
  if (!aula || total <= 0) return;
  const testes = lerTestes();
  testes[aula] = { quando: agora, acertos: Math.max(0, Math.min(acertos, total)), total, vezes: (testes[aula]?.vezes ?? 0) + 1 };
  gravar(CHAVES.testes, testes);
}

// ───────────── Exercícios e a revisão dos erros ─────────────

export interface RespostaGuardada {
  /** trilha/aula do exercício. */
  aula: string;
  tema: string;
  dificuldade: number;
  tentativas: number;
  acertos: number;
  /** Já errou alguma vez: é o que põe o exercício na revisão. */
  errou: boolean;
  /** Caixa da revisão espaçada (0 a 6), como os cartões do caderno. */
  caixa: number;
  /** Quando refazer, AAAA-MM-DD. */
  proxima: string;
  quando: number;
}

/** A partir desta caixa (acertou quatro vezes, com intervalos crescentes) o exercício sai da revisão. */
export const CAIXA_APRENDIDA = 4;

export const lerRespostas = () => lerObjeto<RespostaGuardada>(CHAVES.exercicios);

/**
 * A conta da revisão dos erros: errou volta para a caixa 0 e reaparece amanhã (não na hora, para dar tempo);
 * acertou sobe uma caixa e espera o intervalo dela (1, 3, 7, 14… dias).
 */
export function proximaRevisao(caixaAtual: number, certo: boolean, dia = hoje()): { caixa: number; proxima: string } {
  if (!certo) return { caixa: 0, proxima: somarDias(dia, 1) };
  const caixa = Math.min(INTERVALOS.length - 1, caixaAtual + 1);
  return { caixa, proxima: somarDias(dia, INTERVALOS[caixa]) };
}

export function responderExercicio(id: string, info: { aula: string; tema: string; dificuldade: number }, certo: boolean, agora = new Date()): RespostaGuardada {
  const respostas = lerRespostas();
  const antes = respostas[id];
  const caixaAtual = antes?.errou ? antes.caixa : 0;
  const agenda = proximaRevisao(caixaAtual, certo, hoje(agora));
  const nova: RespostaGuardada = {
    ...info,
    tentativas: (antes?.tentativas ?? 0) + 1,
    acertos: (antes?.acertos ?? 0) + (certo ? 1 : 0),
    errou: Boolean(antes?.errou) || !certo,
    ...agenda,
    quando: agora.getTime(),
  };
  respostas[id] = nova;
  gravar(CHAVES.exercicios, respostas);
  return nova;
}

/** Os exercícios que a pessoa errou e já está na hora de refazer. */
export function paraRevisar(respostas = lerRespostas(), dia = hoje()): string[] {
  return Object.entries(respostas)
    .filter(([, r]) => r.errou && r.caixa < CAIXA_APRENDIDA && r.proxima <= dia)
    .sort((a, b) => a[1].proxima.localeCompare(b[1].proxima))
    .map(([id]) => id);
}

/** Os que a pessoa errou e ainda não firmou, com a data de cada um (para "vem aí"). */
export function emRevisao(respostas = lerRespostas()): { id: string; proxima: string }[] {
  return Object.entries(respostas)
    .filter(([, r]) => r.errou && r.caixa < CAIXA_APRENDIDA)
    .map(([id, r]) => ({ id, proxima: r.proxima }))
    .sort((a, b) => a.proxima.localeCompare(b.proxima));
}

/** Acertos e tentativas por tema (só dos exercícios). */
export function porTema(respostas = lerRespostas()): { tema: string; acertos: number; tentativas: number }[] {
  const mapa = new Map<string, { acertos: number; tentativas: number }>();
  for (const r of Object.values(respostas)) {
    const t = mapa.get(r.tema) ?? { acertos: 0, tentativas: 0 };
    t.acertos += r.acertos;
    t.tentativas += r.tentativas;
    mapa.set(r.tema, t);
  }
  return [...mapa.entries()].map(([tema, t]) => ({ tema, ...t })).sort((a, b) => a.tema.localeCompare(b.tema));
}

// ───────────── Datas de conclusão e a meta da semana ─────────────

export const lerDatas = () => lerObjeto<number>(CHAVES.datas);

/**
 * Acompanha a lista de aulas feitas (lucia:concluidas, que continua igual): aula que entrou ganha a data de agora,
 * aula desmarcada perde a data. Aulas feitas antes deste recurso ficam sem data (contam no total, não na semana).
 */
export function carimbarConclusoes(feitas: Iterable<string>, agora = Date.now()): boolean {
  // Na primeira vez (a chave ainda não existe), o que já estava feito entra sem data: não foi feito "esta semana".
  let primeiraVez = true;
  try {
    primeiraVez = globalThis.localStorage?.getItem(CHAVES.datas) == null;
  } catch {
    // sem armazenamento: trata como primeira vez
  }
  const datas = lerDatas();
  const conjunto = new Set(feitas);
  let mudou = primeiraVez;
  for (const id of conjunto)
    if (!(id in datas)) {
      datas[id] = primeiraVez ? 0 : agora;
      mudou = true;
    }
  for (const id of Object.keys(datas))
    if (!conjunto.has(id)) {
      delete datas[id];
      mudou = true;
    }
  if (mudou) gravar(CHAVES.datas, datas);
  return mudou;
}

/** Segunda-feira 0h da semana de `agora`, no horário do aparelho. */
export function inicioDaSemana(agora = new Date()): Date {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function aulasNaSemana(datas = lerDatas(), agora = new Date()): number {
  const inicio = inicioDaSemana(agora).getTime();
  const fim = inicio + 7 * 86_400_000;
  return Object.values(datas).filter((t) => t >= inicio && t < fim).length;
}

export interface Metas {
  /** Aulas por semana; 0 é "sem meta". */
  porSemana: number;
  /** Dias do lembrete (0 = domingo … 6 = sábado). */
  dias: number[];
  hora: string;
}

export const metasPadrao: Metas = { porSemana: 0, dias: [], hora: "19:00" };

export function lerMetas(): Metas {
  try {
    const m = JSON.parse(globalThis.localStorage?.getItem(CHAVES.metas) ?? "null") as Partial<Metas> | null;
    if (!m || typeof m !== "object") return metasPadrao;
    return {
      porSemana: Number.isInteger(m.porSemana) && m.porSemana! >= 0 && m.porSemana! <= 21 ? m.porSemana! : 0,
      dias: Array.isArray(m.dias) ? m.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
      hora: typeof m.hora === "string" && /^\d{2}:\d{2}$/.test(m.hora) ? m.hora : "19:00",
    };
  } catch {
    return metasPadrao;
  }
}

export const gravarMetas = (m: Metas) => gravar(CHAVES.metas, m);

// ───────────── Nivelamento ─────────────

export interface Nivelamento {
  /** trilha/aula sugerida para começar; null quando a pessoa foi bem em tudo o que o teste cobre. */
  sugestao: string | null;
  /** O título da aula sugerida, para mostrar sem precisar da lista de aulas. */
  titulo?: string;
  quando: number;
}

export const lerNivelamentos = () => lerObjeto<Nivelamento>(CHAVES.nivelamento);

export function gravarNivelamento(trilha: string, n: Omit<Nivelamento, "quando">, agora = Date.now()) {
  const todos = lerNivelamentos();
  todos[trilha] = { ...n, quando: agora };
  gravar(CHAVES.nivelamento, todos);
}

/**
 * Por onde começar: a primeira aula do roteiro (na ordem) com questão do nivelamento errada ou pulada. Se a pessoa
 * acertou tudo, sugere a aula seguinte à última que o teste cobre (ou nenhuma, se o teste cobre até o fim).
 */
export function sugerirInicio(roteiro: string[], respostas: Record<string, boolean | undefined>, cobertas: string[]): string | null {
  const cobre = new Set(cobertas);
  for (const aula of roteiro) if (cobre.has(aula) && respostas[aula] !== true) return aula;
  const ultima = Math.max(-1, ...roteiro.map((aula, i) => (cobre.has(aula) ? i : -1)));
  return roteiro[ultima + 1] ?? null;
}

// ───────────── "Isso ajudou?" ─────────────

export type Ajuda = "sim" | "em-parte" | "nao";
export const lerAjudas = () => lerObjeto<{ resposta: Ajuda; quando: number }>(CHAVES.ajudou);

export function responderAjuda(aula: string, resposta: Ajuda | null, agora = Date.now()) {
  const todas = lerAjudas();
  if (resposta) todas[aula] = { resposta, quando: agora };
  else delete todas[aula];
  gravar(CHAVES.ajudou, todas);
}

// ───────────── Turmas abertas por link ─────────────

export interface TurmaGuardada {
  codigo: string;
  titulo: string;
  /** O link completo (o fragmento depois do #), para voltar à turma. */
  link: string;
  aulas: string[];
  quando: number;
}

export function lerTurmas(): TurmaGuardada[] {
  try {
    const dado: unknown = JSON.parse(globalThis.localStorage?.getItem(CHAVES.turmas) ?? "[]");
    return Array.isArray(dado) ? (dado as TurmaGuardada[]).filter((t) => t && typeof t.codigo === "string") : [];
  } catch {
    return [];
  }
}

export function lembrarTurma(t: Omit<TurmaGuardada, "quando">, agora = Date.now()) {
  const lista = lerTurmas().filter((x) => x.codigo !== t.codigo);
  lista.unshift({ ...t, quando: agora });
  gravar(CHAVES.turmas, lista.slice(0, 20));
}

export const esquecerTurma = (codigo: string) => gravar(CHAVES.turmas, lerTurmas().filter((t) => t.codigo !== codigo));

// ───────────── Apagar ─────────────

/** Apaga o progresso deste aparelho (as chaves de CHAVES_DO_PROGRESSO). Devolve quantas existiam. */
export function apagarProgresso(armazenamento: Pick<Storage, "getItem" | "removeItem"> | undefined = globalThis.localStorage): number {
  if (!armazenamento) return 0;
  let n = 0;
  for (const chave of CHAVES_DO_PROGRESSO) {
    try {
      if (armazenamento.getItem(chave) !== null) n++;
      armazenamento.removeItem(chave);
    } catch {
      // segue com as outras
    }
  }
  globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  return n;
}
