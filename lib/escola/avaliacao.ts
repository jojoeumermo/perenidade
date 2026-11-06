// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Avaliação e aprender ativo da Escola Revolucionária Lúcia Maria (Etapa 4, pacote E4-13; docs/escola/avaliacao.md): o retorno por
// competência (sem nota), as provas guardadas no aparelho, a regra da dispensa pela prova de proficiência, o cartão
// "lembra da aula anterior", as explicações com as próprias palavras e o lembrete da semana de provas (.ics).
// Tudo fica no aparelho, nas chaves "lucia:escola:provas", "lucia:escola:avaliacoes" e "lucia:escola:explicacoes"
// (entram na cópia de segurança pelo prefixo "lucia:escola:"). Nada vai para servidor.
// Sem React e sem os atalhos "@/" de propósito: `npm run testar:escola-avaliacao` roda este arquivo direto no Node.

import { CHAVES_DA_ESCOLA, diaEmBrasilia } from "./estudante";
import { semanaDeProvas, semestreDe, type Semestre } from "./tempo";
import { porTema, type RespostaGuardada, type Teste } from "../meu-estudo";

// ───────────── Armazenamento ─────────────

function lerJSON(chave: string): unknown {
  try {
    const texto = globalThis.localStorage?.getItem(chave);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

function gravarJSON(chave: string, valor: unknown): boolean {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(chave, JSON.stringify(valor));
    try {
      globalThis.dispatchEvent?.(new Event("lucia:estudo"));
    } catch {
      // fora do navegador não há quem ouvir
    }
    return true;
  } catch {
    // armazenamento cheio ou bloqueado: o estudo segue, só não fica guardado
    return false;
  }
}

const objeto = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const inteiro = (v: unknown, min = 0): v is number => typeof v === "number" && Number.isInteger(v) && v >= min;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

// ───────────── Retorno por competência (R1-30) ─────────────

/** O resultado de um tema: "ja-sabe" (80% ou mais, com 3 questões ou mais), "quase" (50 a 79%), "rever" (abaixo de 50%) ou "pouco-dado" (menos de 3 questões). */
export type Competencia = "ja-sabe" | "quase" | "rever" | "pouco-dado";
export const COMPETENCIAS: readonly Competencia[] = ["rever", "quase", "pouco-dado", "ja-sabe"];

export const MINIMO_DE_QUESTOES = 3;

/** Um pedaço de resultado: um tema (ou aula), quantas acertou e de quantas, e a aula onde rever. */
export interface RegistroDeCompetencia {
  tema: string;
  /** "trilha/aula" para rever. */
  aula?: string;
  acertos: number;
  total: number;
}

export interface RetornoDoTema {
  tema: string;
  competencia: Competencia;
  /** As aulas para rever esse tema ("trilha/aula"), sem repetir, na ordem em que apareceram. */
  aulas: string[];
}

/** A competência de um tema pelos números (a interface nunca mostra os números, só a palavra). */
export function competenciaDe(acertos: number, total: number): Competencia {
  if (!(total >= MINIMO_DE_QUESTOES)) return "pouco-dado";
  const fracao = Math.max(0, Math.min(acertos, total)) / total;
  return fracao >= 0.8 ? "ja-sabe" : fracao >= 0.5 ? "quase" : "rever";
}

/** Junta os registros por tema e diz a competência de cada um, na ordem: rever, quase, pouco dado, já sabe. */
export function retornoPorCompetencia(registros: readonly RegistroDeCompetencia[]): RetornoDoTema[] {
  const temas = new Map<string, { acertos: number; total: number; aulas: string[]; ordem: number }>();
  for (const r of registros) {
    if (!r || typeof r.tema !== "string" || !r.tema || !(r.total > 0)) continue;
    const t = temas.get(r.tema) ?? { acertos: 0, total: 0, aulas: [], ordem: temas.size };
    t.acertos += Math.max(0, Math.min(r.acertos, r.total));
    t.total += r.total;
    if (r.aula && !t.aulas.includes(r.aula)) t.aulas.push(r.aula);
    temas.set(r.tema, t);
  }
  return [...temas.entries()]
    .map(([tema, t]) => ({ tema, competencia: competenciaDe(t.acertos, t.total), aulas: t.aulas, ordem: t.ordem }))
    .sort((a, b) => COMPETENCIAS.indexOf(a.competencia) - COMPETENCIAS.indexOf(b.competencia) || a.ordem - b.ordem)
    .map(({ tema, competencia, aulas }) => ({ tema, competencia, aulas }));
}

/**
 * A prova de proficiência dispensa a trilha? Só se TODOS os temas (as aulas da trilha que têm questão) foram
 * respondidos e deram "ja-sabe". Aula com menos de 3 questões no total não chega a "ja-sabe" pela regra geral; nela
 * vale acertar todas as que existem (`disponiveis`: quantas questões cada aula tem). Sem registro, nunca dispensa.
 */
export function podeDispensar(registros: readonly RegistroDeCompetencia[], disponiveis: Readonly<Record<string, number>>): boolean {
  const temas = Object.keys(disponiveis).filter((t) => disponiveis[t] > 0);
  if (temas.length === 0) return false;
  const somas = new Map<string, { acertos: number; total: number }>();
  for (const r of registros) {
    if (!r || !(r.total > 0)) continue;
    const s = somas.get(r.tema) ?? { acertos: 0, total: 0 };
    s.acertos += Math.max(0, Math.min(r.acertos, r.total));
    s.total += r.total;
    somas.set(r.tema, s);
  }
  return temas.every((tema) => {
    const s = somas.get(tema);
    if (!s) return false;
    if (s.total >= MINIMO_DE_QUESTOES) return competenciaDe(s.acertos, s.total) === "ja-sabe";
    return s.total >= disponiveis[tema] && s.acertos === s.total;
  });
}

/**
 * Os registros de um módulo: o teste de fim de aula de cada aula (o tema é a própria aula) e os exercícios dessas
 * aulas, somados por tema com `porTema` (lib/meu-estudo.ts). Puro.
 */
export function registrosDoModulo(aulas: readonly string[], testes: Record<string, Teste>, respostas: Record<string, RespostaGuardada>): RegistroDeCompetencia[] {
  const doModulo = new Set(aulas);
  const registros: RegistroDeCompetencia[] = [];
  for (const aula of aulas) {
    const t = testes[aula];
    if (t && t.total > 0) registros.push({ tema: aula, aula, acertos: t.acertos, total: t.total });
  }
  const daqui = Object.fromEntries(Object.entries(respostas).filter(([, r]) => doModulo.has(r.aula)));
  for (const t of porTema(daqui)) {
    // A aula para rever o tema: a do exercício desse tema com mais erros.
    const aula = Object.values(daqui)
      .filter((r) => r.tema === t.tema)
      .sort((a, b) => b.tentativas - b.acertos - (a.tentativas - a.acertos))[0]?.aula;
    registros.push({ tema: t.tema, aula, acertos: t.acertos, total: t.tentativas });
  }
  return registros;
}


// ───────────── As provas guardadas ─────────────

export const MODOS_DE_PROVA = ["normal", "dupla", "proficiencia"] as const;
export type ModoDeProva = (typeof MODOS_DE_PROVA)[number];
export const MAX_PROVAS_POR_TRILHA = 20;

export interface ProvaGuardada {
  /** AAAA-MM-DD (Brasília) */
  data: string;
  acertos: number;
  total: number;
  modo: ModoDeProva;
  /** Por tema (a aula, "trilha/aula"): acertos e total. */
  porTema: Record<string, { acertos: number; total: number }>;
}

/** O modo pedido no endereço (?modo=...); qualquer outra coisa é a prova normal. O parâmetro não identifica ninguém. */
export const modoDoEndereco = (busca: string): ModoDeProva => {
  const m = new URLSearchParams(busca).get("modo");
  return m === "dupla" || m === "proficiencia" ? m : "normal";
};

function validarProva(dado: unknown): ProvaGuardada | null {
  if (!objeto(dado)) return null;
  const { data, acertos, total, modo, porTema } = dado;
  if (typeof data !== "string" || !DIA.test(data) || !inteiro(acertos) || !inteiro(total, 1) || acertos > total) return null;
  if (!MODOS_DE_PROVA.includes(modo as ModoDeProva) || !objeto(porTema)) return null;
  const temas: ProvaGuardada["porTema"] = {};
  for (const [tema, v] of Object.entries(porTema)) if (objeto(v) && inteiro(v.acertos) && inteiro(v.total, 1) && v.acertos <= v.total) temas[tema] = { acertos: v.acertos, total: v.total };
  return { data, acertos, total, modo: modo as ModoDeProva, porTema: temas };
}

/** As provas de cada trilha guardadas no aparelho ({trilha: [prova, ...]}, a mais nova por último). */
export function lerProvas(): Record<string, ProvaGuardada[]> {
  const dado = lerJSON(CHAVES_DA_ESCOLA.provas);
  if (!objeto(dado)) return {};
  const saida: Record<string, ProvaGuardada[]> = {};
  for (const [trilha, lista] of Object.entries(dado)) {
    if (!Array.isArray(lista)) continue;
    const validas = lista.map(validarProva).filter((p): p is ProvaGuardada => p !== null);
    if (validas.length) saida[trilha] = validas.slice(-MAX_PROVAS_POR_TRILHA);
  }
  return saida;
}

/** Soma as respostas por tema: [{tema, certo}] vira {tema: {acertos, total}}. */
export function porTemaDe(respostas: readonly { tema: string; certo: boolean }[]): ProvaGuardada["porTema"] {
  const saida: ProvaGuardada["porTema"] = {};
  for (const r of respostas) {
    if (!r.tema) continue;
    const t = (saida[r.tema] ??= { acertos: 0, total: 0 });
    t.total += 1;
    if (r.certo) t.acertos += 1;
  }
  return saida;
}

/** Os registros de competência de uma prova (cada tema é uma aula, que é também onde rever). */
export const registrosDaProva = (porTema: ProvaGuardada["porTema"]): RegistroDeCompetencia[] =>
  Object.entries(porTema).map(([tema, v]) => ({ tema, aula: tema, acertos: v.acertos, total: v.total }));

/** Guarda a prova terminada (no máximo 20 por trilha: as mais velhas saem). Devolve a prova guardada ou null. */
export function gravarProva(trilha: string, respostas: readonly { tema: string; certo: boolean }[], modo: ModoDeProva, agora: Date = new Date()): ProvaGuardada | null {
  if (!trilha || respostas.length === 0) return null;
  const prova = validarProva({
    data: diaEmBrasilia(agora),
    acertos: respostas.filter((r) => r.certo).length,
    total: respostas.length,
    modo,
    porTema: porTemaDe(respostas),
  });
  if (!prova) return null;
  const todas = lerProvas();
  todas[trilha] = [...(todas[trilha] ?? []), prova].slice(-MAX_PROVAS_POR_TRILHA);
  gravarJSON(CHAVES_DA_ESCOLA.provas, todas);
  return prova;
}

// ───────────── Avaliações: o "lembra?" e a recuperação ─────────────

export const MAX_RECUPERACOES = 200;

export interface Recuperacao {
  /** A aula de onde vieram as questões ("trilha/aula"). */
  aula: string;
  /** AAAA-MM-DD */
  data: string;
  acertos: number;
  total: number;
  origem: "recuperacao";
}

export interface Avaliacoes {
  /** O dia (AAAA-MM-DD) em que o cartão "lembra?" apareceu em cada aula: não aparece duas vezes no mesmo dia. */
  lembrados: Record<string, string>;
  recuperacoes: Recuperacao[];
}

export function lerAvaliacoes(): Avaliacoes {
  const dado = lerJSON(CHAVES_DA_ESCOLA.avaliacoes);
  const saida: Avaliacoes = { lembrados: {}, recuperacoes: [] };
  if (!objeto(dado)) return saida;
  if (objeto(dado.lembrados)) for (const [aula, dia] of Object.entries(dado.lembrados)) if (typeof dia === "string" && DIA.test(dia)) saida.lembrados[aula] = dia;
  if (Array.isArray(dado.recuperacoes))
    for (const r of dado.recuperacoes)
      if (objeto(r) && typeof r.aula === "string" && typeof r.data === "string" && DIA.test(r.data) && inteiro(r.acertos) && inteiro(r.total, 1) && r.acertos <= r.total)
        saida.recuperacoes.push({ aula: r.aula, data: r.data, acertos: r.acertos, total: r.total, origem: "recuperacao" });
  return saida;
}

/** Marca que o cartão "lembra?" apareceu hoje nesta aula (guarda só as marcas dos últimos dias). */
export function marcarLembrado(aula: string, agora: Date = new Date()): void {
  const a = lerAvaliacoes();
  const hoje = diaEmBrasilia(agora);
  const corte = diaEmBrasilia(new Date(agora.getTime() - 7 * 86_400_000));
  const lembrados: Record<string, string> = {};
  for (const [k, dia] of Object.entries(a.lembrados)) if (dia >= corte) lembrados[k] = dia;
  lembrados[aula] = hoje;
  gravarJSON(CHAVES_DA_ESCOLA.avaliacoes, { ...a, lembrados });
}

/** Guarda as respostas do "lembra?" (origem "recuperacao"), no máximo 200. */
export function registrarRecuperacao(aula: string, acertos: number, total: number, agora: Date = new Date()): void {
  if (!aula || !(total > 0)) return;
  const a = lerAvaliacoes();
  const nova: Recuperacao = { aula, data: diaEmBrasilia(agora), acertos: Math.max(0, Math.min(acertos, total)), total, origem: "recuperacao" };
  gravarJSON(CHAVES_DA_ESCOLA.avaliacoes, { ...a, recuperacoes: [...a.recuperacoes, nova].slice(-MAX_RECUPERACOES) });
}

/** Uma aula candidata ao "lembra?": a anterior da trilha ou do curso, com quantas questões tem. */
export interface AulaAnterior {
  aula: string;
  questoes: number;
  /** O curso de onde veio (para preferir a do curso em que a pessoa está inscrita); sem ele é a anterior da trilha. */
  curso?: string;
}

export const UM_DIA = 86_400_000;

/**
 * A regra do cartão "lembra da aula anterior": a primeira candidata (as do curso inscrito antes da da trilha) que tem
 * questão e foi concluída há mais de 1 dia. Conclusão com data 0 é antiga (feita antes de o site guardar a data). Não
 * aparece se já apareceu hoje nesta aula. Devolve a aula escolhida ou null.
 */
export function aulaParaLembrar(
  atual: string,
  candidatas: readonly AulaAnterior[],
  contexto: { concluidasEm: Readonly<Record<string, number>>; cursosInscritos: readonly string[]; lembrados: Readonly<Record<string, string>>; agora: Date },
): string | null {
  if (contexto.lembrados[atual] === diaEmBrasilia(contexto.agora)) return null;
  const inscritos = new Set(contexto.cursosInscritos);
  const ordem = [...candidatas.filter((c) => c.curso && inscritos.has(c.curso)), ...candidatas.filter((c) => !c.curso)];
  for (const c of ordem) {
    if (c.aula === atual || !(c.questoes > 0)) continue;
    const quando = contexto.concluidasEm[c.aula];
    if (typeof quando !== "number") continue;
    if (quando === 0 || contexto.agora.getTime() - quando > UM_DIA) return c.aula;
  }
  return null;
}

/** Duas questões (índices) escolhidas pelo dia: o mesmo dia e a mesma aula dão as mesmas, outro dia dá outras. */
export function questoesDoDia(n: number, aula: string, dia: string, quantas = 2): number[] {
  if (!(n > 0)) return [];
  let h = 2166136261;
  for (const c of `${aula}\u0000${dia}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    const j = h % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, Math.min(quantas, n)).sort((a, b) => a - b);
}

/**
 * A ordem das alternativas na tela: uma permutação de 0..n-1 sorteada a partir do texto da pergunta, sempre a mesma
 * para a mesma questão (a mesma conta do teste da aula, components/Quiz.tsx: a certa não fica sempre em cima).
 */
export function ordemDasOpcoes(n: number, texto: string): number[] {
  let semente = 2166136261;
  for (let i = 0; i < texto.length; i++) semente = Math.imul(semente ^ texto.charCodeAt(i), 16777619) >>> 0;
  const ordem = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    semente = Math.imul(semente ^ (semente >>> 15), 2246822507) >>> 0;
    semente = (semente ^ (semente >>> 13)) >>> 0;
    const j = semente % (i + 1);
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return ordem;
}

// ───────────── Explique com suas palavras (R1-34) ─────────────

export const MAX_EXPLICACAO = 1000;
/** A base do IndexedDB com os áudios (fora da cópia de segurança; o "apagar meus dados" apaga). */
export const BASE_DOS_AUDIOS = "lucia-explicacoes";
export const SEGUNDOS_DE_GRAVACAO = 120;

export interface Explicacao {
  texto: string;
  /** Quando foi guardada (milissegundos). */
  em: number;
}

export function lerExplicacoes(): Record<string, Explicacao> {
  const dado = lerJSON(CHAVES_DA_ESCOLA.explicacoes);
  const saida: Record<string, Explicacao> = {};
  if (!objeto(dado)) return saida;
  for (const [aula, v] of Object.entries(dado)) if (objeto(v) && typeof v.texto === "string" && v.texto.trim() && typeof v.em === "number") saida[aula] = { texto: v.texto.slice(0, MAX_EXPLICACAO), em: v.em };
  return saida;
}

export const explicacaoDe = (aula: string): Explicacao | null => lerExplicacoes()[aula] ?? null;

/** Guarda (ou, com texto vazio, apaga) a explicação de uma aula, cortada em 1000 caracteres. */
export function gravarExplicacao(aula: string, texto: string, agora: number = Date.now()): Explicacao | null {
  if (!aula) return null;
  const todas = lerExplicacoes();
  const limpo = String(texto ?? "").slice(0, MAX_EXPLICACAO);
  if (!limpo.trim()) {
    delete todas[aula];
    gravarJSON(CHAVES_DA_ESCOLA.explicacoes, todas);
    return null;
  }
  todas[aula] = { texto: limpo, em: agora };
  gravarJSON(CHAVES_DA_ESCOLA.explicacoes, todas);
  return todas[aula];
}

export const apagarExplicacao = (aula: string) => void gravarExplicacao(aula, "");

// ───────────── Semana de provas (D1-8) ─────────────

export interface SemanaDaProva {
  semestre: string;
  inicio: string;
  fim: string;
  /** "antes": ainda vai chegar; "durante": é agora. (Depois da semana, vale a do semestre seguinte, que está "antes".) */
  quando: "antes" | "durante";
}

/** A semana de provas que importa num dia: a do semestre de agora, ou a do próximo se a deste já passou ou é férias. */
export function semanaParaMostrar(dia: string, semestre: Semestre = semestreDe(dia)): SemanaDaProva {
  const desta = semanaDeProvas(semestre);
  // Dentro das datas do semestre (em aula ou num recesso), vale a semana deste semestre; entre semestres, a do próximo.
  if (dia >= semestre.inicio && dia <= desta.fim) return { semestre: semestre.id, ...desta, quando: dia >= desta.inicio ? "durante" : "antes" };
  const proxima = semanaDeProvas(semestre.proximo);
  return { semestre: semestre.proximo.id, ...proxima, quando: dia >= proxima.inicio && dia <= proxima.fim ? "durante" : "antes" };
}

const escaparIcs = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
function dobrarIcs(linha: string): string {
  const partes: string[] = [];
  let resto = linha;
  while (resto.length > 75) {
    partes.push(resto.slice(0, 75));
    resto = ` ${resto.slice(75)}`;
  }
  partes.push(resto);
  return partes.join("\r\n");
}

/**
 * O lembrete da semana de provas como arquivo de agenda (.ics), no mesmo formato do lembrete da meta (lib/agenda.ts):
 * um evento de dia inteiro do primeiro ao último dia, com aviso às 9h do primeiro dia. Nasce no aparelho; nada é enviado.
 */
export function icsDaSemanaDeProvas(s: { inicio: string; fim: string; titulo: string; descricao: string; url: string; semestre: string }, agora: Date = new Date()): string {
  const sem = (d: string) => d.replace(/-/g, "");
  const diaSeguinte = new Date(Date.parse(`${s.fim}T00:00:00Z`) + UM_DIA).toISOString().slice(0, 10);
  const carimbo = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Instituto Lucia//Semana de provas//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:semana-de-provas-${s.semestre.replace(/[^0-9.]/g, "")}@institutolucia.org`,
    `DTSTAMP:${carimbo}`,
    `DTSTART;VALUE=DATE:${sem(s.inicio)}`,
    `DTEND;VALUE=DATE:${sem(diaSeguinte)}`,
    dobrarIcs(`SUMMARY:${escaparIcs(s.titulo)}`),
    dobrarIcs(`DESCRIPTION:${escaparIcs(`${s.descricao}\n${s.url}`)}`),
    dobrarIcs(`URL:${s.url}`),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT9H",
    dobrarIcs(`DESCRIPTION:${escaparIcs(s.titulo)}`),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// ───────────── Reconhecimento de saberes (R1-48) ─────────────

export const MAX_AVALIADOR = 80;

/**
 * O texto do registro "Saberes reconhecidos" na caderneta: as trilhas que a pessoa provou saber e as práticas que a
 * pessoa avaliadora conferiu ao vivo, mais a observação (cortado no limite da caderneta).
 */
export function detalheDoReconhecimento(partes: { trilhas: readonly string[]; praticas: readonly string[]; observacao?: string; rotulos: { trilhas: string; praticas: string; observacao: string } }): string {
  const linhas: string[] = [];
  if (partes.trilhas.length) linhas.push(`${partes.rotulos.trilhas}: ${partes.trilhas.join("; ")}`);
  if (partes.praticas.length) linhas.push(`${partes.rotulos.praticas}: ${partes.praticas.join("; ")}`);
  const obs = partes.observacao?.trim();
  if (obs) linhas.push(`${partes.rotulos.observacao}: ${obs}`);
  return linhas.join("\n").slice(0, 2000);
}
