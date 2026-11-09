// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os agentes de trabalho, turma e equipe da Escola (Etapa 4, E4-16): o catálogo dos 7 agentes, os limites de cada
// tela, a conta da entrevista (5 perguntas), a medida da fala no aparelho, o histórico dos ensaios (só números), a
// conferência de dado pessoal antes do envio, o resumo da aula para o debate e a passagem do rascunho do educador
// para a revisão. Nada daqui vai ao servidor sozinho: quem manda é a tela, quando a pessoa aperta o botão.
// Sem os atalhos "@/" e sem "node:fs" de propósito: `npm run testar:agentes` roda este arquivo no Node.

import { estaLigado } from "../modo-seguro";
import type { ModoDeAgente } from "./acompanhante";
import { termosDe } from "./respostas-locais";
import { normalize } from "../text";
import { armazemPrivado } from "./cofre";

export type ChaveDeAgente = "entrevista" | "oratoria" | "papelada" | "turma" | "educador" | "revisao" | "traducao";
export type ParaQuem = "estudante" | "turma" | "equipe";

export interface Agente {
  chave: ChaveDeAgente;
  caminho: string;
  /** O modo do assistente (só nos 5 agentes que usam o servidor). */
  modo?: ModoDeAgente;
  paraQuem: ParaQuem;
  usaServidor: boolean;
}

/** Os 7 agentes, na ordem do hub. Revisão e tradução ficam inteiras no aparelho. */
export const AGENTES: readonly Agente[] = [
  { chave: "entrevista", caminho: "/escola/agentes/entrevista", modo: "entrevista", paraQuem: "estudante", usaServidor: true },
  { chave: "oratoria", caminho: "/escola/agentes/oratoria", modo: "oratoria", paraQuem: "estudante", usaServidor: true },
  { chave: "papelada", caminho: "/escola/agentes/papelada", modo: "papelada", paraQuem: "estudante", usaServidor: true },
  { chave: "turma", caminho: "/escola/agentes/turma", modo: "turma", paraQuem: "turma", usaServidor: true },
  { chave: "educador", caminho: "/escola/agentes/educador", modo: "educador", paraQuem: "equipe", usaServidor: true },
  { chave: "revisao", caminho: "/escola/agentes/revisao", paraQuem: "equipe", usaServidor: false },
  { chave: "traducao", caminho: "/escola/agentes/traducao", paraQuem: "equipe", usaServidor: false },
];

export const CHAVES_DOS_AGENTES = AGENTES.map((a) => a.chave);

/** O agente de uma chave, ou undefined se a chave não existe. */
export const agenteDe = (chave: string): Agente | undefined => AGENTES.find((a) => a.chave === chave);

/** Cada tela dentro dos limites da Edge Function (LIMITES_DO_ACOMPANHANTE e LIMITES do assistente.ts). */
export const LIMITES_DOS_AGENTES = {
  vaga: 120,
  falaMin: 50,
  falaMax: 2800,
  respostaMax: 1500,
  papeladaMin: 10,
  papeladaMax: 3000,
  resumoMax: 1200,
  tituloMin: 3,
  tituloMax: 120,
  temaMin: 10,
  temaMax: 600,
  perguntasDaEntrevista: 5,
  ensaios: 10,
  ensaioDias: 30,
  /** Uma fala de ensaio dura até 5 minutos. */
  ensaioSegundos: 300,
  /** Só calculamos palavras por minuto com 10 segundos ou mais (antes disso o número não quer dizer nada). */
  segundosParaRitmo: 10,
} as const;

// ───────────────────────── Entrevista ─────────────────────────

export interface EtapaDaEntrevista {
  /** Respostas dadas (a primeira mensagem, "Pode começar", não conta). */
  respondidas: number;
  total: number;
  terminou: boolean;
}

type FalaSimples = { de: "pessoa" | "assistente"; texto?: string };

/**
 * Onde a entrevista está. A primeira fala da pessoa só abre a entrevista ("Pode começar a entrevista."); as seguintes
 * são as respostas. Terminou: 5 respostas dadas e a última fala é do assistente (o resumo).
 */
export function etapaDaEntrevista(falas: readonly FalaSimples[]): EtapaDaEntrevista {
  const total = LIMITES_DOS_AGENTES.perguntasDaEntrevista;
  const dasPessoas = falas.filter((f) => f.de === "pessoa").length;
  const respondidas = Math.min(total, Math.max(0, dasPessoas - 1));
  return { respondidas, total, terminou: respondidas >= total && falas.at(-1)?.de === "assistente" };
}

/**
 * O contexto da próxima mensagem. O histórico que o assistente aceita tem no máximo 8 falas e a 5ª resposta perderia a
 * conta; a marca no contexto resolve sem mexer no backend. Na abertura (nenhuma fala), pede a pergunta 1.
 */
export function contextoDaEntrevista(vaga: string, falas: readonly FalaSimples[]): { vaga: string; trecho: string } {
  const { respondidas, total } = etapaDaEntrevista(falas);
  const aberta = falas.length > 0;
  const n = Math.min(total, respondidas + 1);
  return {
    vaga: vaga.trim().slice(0, LIMITES_DOS_AGENTES.vaga),
    trecho: aberta ? `Esta é a resposta ${n} de ${total}; a pergunta ${n} já foi feita.` : `Comece a entrevista: faça a pergunta 1 de ${total}.`,
  };
}

// ───────────────────────── Oratória: a medida da fala, no aparelho ─────────────────────────

export interface MedidaDaFala {
  palavras: number;
  /** Palavras por minuto; null com menos de 10 segundos. */
  ppm: number | null;
  segundos: number;
  /** "m:ss". */
  duracao: string;
}

export const formatarDuracao = (segundos: number): string => {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Palavras do texto: em chinês, cada caractere conta; nos outros idiomas, os pedaços separados por espaço. */
export function contarPalavras(texto: string, lang = "pt"): number {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (!limpo) return 0;
  if (lang === "zh") return [...limpo.replace(/[\s\p{P}\p{S}]/gu, "")].length;
  return limpo.split(" ").filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}

/** As até 3 palavras de conteúdo que mais se repetem (4 vezes ou mais). Só em português; nos outros, lista vazia. */
export function palavrasQueSeRepetem(texto: string, lang = "pt"): { palavra: string; vezes: number }[] {
  if (lang !== "pt") return [];
  const conteudo = new Set(termosDe(texto));
  const contagem = new Map<string, number>();
  for (const p of normalize(texto).split(/[^a-z0-9]+/)) if (conteudo.has(p)) contagem.set(p, (contagem.get(p) ?? 0) + 1);
  return [...contagem]
    .filter(([, n]) => n >= 4)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([palavra, vezes]) => ({ palavra, vezes }));
}

/** A medida local do ensaio. Sem faixa de "ritmo bom": isso seria número sem fonte. */
export function analisarFala(texto: string, segundos: number, lang = "pt"): MedidaDaFala & { repetidas: { palavra: string; vezes: number }[] } {
  const palavras = contarPalavras(texto, lang);
  const s = Number.isFinite(segundos) && segundos > 0 ? segundos : 0;
  return {
    palavras,
    ppm: s >= LIMITES_DOS_AGENTES.segundosParaRitmo ? Math.round(palavras / (s / 60)) : null,
    segundos: Math.round(s),
    duracao: formatarDuracao(s),
    repetidas: palavrasQueSeRepetem(texto, lang),
  };
}

// ───────────────────────── Ensaios: só números, só no aparelho ─────────────────────────

export const CHAVE_ENSAIOS = "lucia:escola-privado:ensaios";
const DIA = 24 * 60 * 60 * 1000;

export interface Ensaio {
  id: string;
  /** Quando (milissegundos). */
  em: number;
  segundos: number;
  palavras: number;
  ppm: number | null;
}

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Sessao = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

/** O armazenamento das chaves privadas: o localStorage, ou o cofre cifrado da Escola quando ele existe (lib/escola/cofre.ts). */
const local = (): Armazenamento | null => armazemPrivado();
const sessaoDoNavegador = (): Sessao => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};
function avisar() {
  try {
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // fora do navegador
  }
}

const numero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Confere um ensaio lido do aparelho; só os números passam (qualquer outro campo é descartado). */
export function validarEnsaio(dado: unknown): Ensaio | null {
  if (!dado || typeof dado !== "object" || Array.isArray(dado)) return null;
  const e = dado as Record<string, unknown>;
  if (typeof e.id !== "string" || !/^[a-z0-9-]{4,40}$/.test(e.id) || !numero(e.em) || !numero(e.segundos) || !numero(e.palavras)) return null;
  if (e.ppm !== null && !numero(e.ppm)) return null;
  return { id: e.id, em: e.em, segundos: Math.round(e.segundos), palavras: Math.round(e.palavras), ppm: e.ppm === null ? null : Math.round(e.ppm as number) };
}

const arrumar = (lista: Ensaio[], agora: number) =>
  lista
    .filter((e) => agora - e.em <= LIMITES_DOS_AGENTES.ensaioDias * DIA)
    .sort((a, b) => b.em - a.em)
    .slice(0, LIMITES_DOS_AGENTES.ensaios);

/** Os ensaios guardados neste aparelho, do mais novo para o mais velho (até 10, de até 30 dias). */
export function lerEnsaios(armazenamento: Armazenamento | null = local(), agora: number = Date.now()): Ensaio[] {
  try {
    const texto = armazenamento?.getItem(CHAVE_ENSAIOS);
    const dado = texto ? (JSON.parse(texto) as unknown) : null;
    if (!Array.isArray(dado)) return [];
    return arrumar(dado.map(validarEnsaio).filter((e): e is Ensaio => e !== null), agora);
  } catch {
    return [];
  }
}

/** Grava um ensaio (só números). No modo seguro não grava nada e devolve false. */
export function gravarEnsaio(ensaio: Ensaio, o: { armazenamento?: Armazenamento | null; sessao?: Sessao; agora?: number } = {}): boolean {
  const armazenamento = o.armazenamento === undefined ? local() : o.armazenamento;
  const sessao = o.sessao === undefined ? sessaoDoNavegador() : o.sessao;
  if (!armazenamento || estaLigado(sessao)) return false;
  const agora = o.agora ?? Date.now();
  const valido = validarEnsaio(ensaio);
  if (!valido) return false;
  const outros = lerEnsaios(armazenamento, agora).filter((e) => e.id !== valido.id);
  try {
    armazenamento.setItem(CHAVE_ENSAIOS, JSON.stringify(arrumar([valido, ...outros], agora)));
    avisar();
    return true;
  } catch {
    return false;
  }
}

/** Apaga todos os ensaios deste aparelho. */
export function apagarEnsaios(armazenamento: Armazenamento | null = local()): void {
  try {
    if (!armazenamento) return;
    armazenamento.removeItem(CHAVE_ENSAIOS);
    avisar();
  } catch {
    // nada a apagar
  }
}

// ───────────────────────── Dado pessoal no campo (princípio da necessidade) ─────────────────────────

export type TipoDeDado = "cpf" | "cartao" | "email" | "telefone";

function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(digitos[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(digitos[9]) && dv(10) === Number(digitos[10]);
}

function luhn(digitos: string): boolean {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return soma % 10 === 0;
}

/**
 * Os tipos de dado pessoal que aparecem no texto: CPF (com pontos, ou 11 dígitos que passam na conta do CPF), cartão
 * (13 a 19 dígitos que passam no cálculo de Luhn), e-mail e telefone brasileiro. Texto vazio não acusa nada.
 */
export function achaDadoPessoal(texto: string): TipoDeDado[] {
  const achados = new Set<TipoDeDado>();
  let resto = texto;
  for (const m of texto.matchAll(/(?<![\d.-])(?:\d[ -]?){12,18}\d(?![\d])/g)) {
    const digitos = m[0].replace(/\D/g, "");
    if (digitos.length >= 13 && digitos.length <= 19 && luhn(digitos)) {
      achados.add("cartao");
      resto = resto.replace(m[0], " ");
    }
  }
  for (const m of resto.matchAll(/(?<![\d.])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\d])/g)) {
    achados.add("cpf");
    resto = resto.replace(m[0], " ");
  }
  for (const m of resto.matchAll(/(?<![\d.])\d{11}(?![\d])/g)) {
    if (cpfValido(m[0])) {
      achados.add("cpf");
      resto = resto.replace(m[0], " ");
    }
  }
  if (/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+/u.test(resto)) achados.add("email");
  if (/(?<![\d])(?:\+?55[\s.-]?)?(?:\(\s?[1-9]\d\s?\)|[1-9]\d)[\s.-]?9?\d{4}[\s.-]?\d{4}(?![\d])/.test(resto)) achados.add("telefone");
  return [...achados];
}

/** O aviso para o campo: CPF e cartão bloqueiam o envio; e-mail e telefone só avisam. Nada, devolve null. */
export function conferirCampo(texto: string): { aviso: TipoDeDado; bloqueia: boolean } | null {
  const achados = achaDadoPessoal(texto);
  for (const tipo of ["cpf", "cartao"] as const) if (achados.includes(tipo)) return { aviso: tipo, bloqueia: true };
  for (const tipo of ["email", "telefone"] as const) if (achados.includes(tipo)) return { aviso: tipo, bloqueia: false };
  return null;
}

// ───────────────────────── Debate da turma ─────────────────────────

/**
 * O resumo de uma aula para o debate: o começo do texto do índice, copiado como está (só espaços juntados), cortado em
 * frase inteira até 1.200 caracteres. A pessoa confere e edita antes de mandar.
 */
export function resumoDaAula(entrada: { text?: string }, limite: number = LIMITES_DOS_AGENTES.resumoMax): string {
  const texto = (entrada.text ?? "").replace(/\s+/g, " ").trim();
  if (texto.length <= limite) return texto;
  const frases = texto.match(/[^.!?。]+[.!?。]+(?:\s|$)/g) ?? [];
  let saida = "";
  for (const frase of frases) {
    if ((saida + frase).trim().length > limite) break;
    saida += frase;
  }
  if (saida.trim()) return saida.trim();
  const corte = texto.lastIndexOf(" ", limite);
  return texto.slice(0, corte > 0 ? corte : limite).trim();
}

// ───────────────────────── Do rascunho do educador para a revisão ─────────────────────────

export const CHAVE_RASCUNHO = "lucia:escola-privado:rascunho-para-revisao";

/** Deixa o rascunho na aba para a Revisão ler (uma vez). Falhou ou modo seguro: false. */
export function levarRascunho(texto: string, sessao: Sessao = sessaoDoNavegador()): boolean {
  try {
    if (!sessao) return false;
    sessao.setItem(CHAVE_RASCUNHO, texto.slice(0, 20_000));
    avisar();
    return true;
  } catch {
    return false;
  }
}

/** Lê o rascunho deixado e já apaga: só vale uma vez. */
export function pegarRascunho(sessao: Sessao = sessaoDoNavegador()): string {
  try {
    if (!sessao) return "";
    const texto = sessao.getItem(CHAVE_RASCUNHO) ?? "";
    sessao.removeItem(CHAVE_RASCUNHO);
    return texto;
  } catch {
    return "";
  }
}
