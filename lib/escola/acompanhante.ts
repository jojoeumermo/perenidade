// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O acompanhante do estudante (Etapa 4, E4-10): o histórico das conversas, que fica SÓ no aparelho, e a montagem do
// pedido ao assistente (a Edge Function "assistente"), já cortado nos limites que ela aceita. Nada daqui vai ao
// servidor sozinho: quem manda é a tela, quando a pessoa aperta o botão, depois de ver para onde vai.
//
// O histórico mora em "lucia:escola-privado:conversas": fora da cópia de segurança, apagado pelo "apagar meus dados"
// (prefixo privado da Escola, docs/ESCOLA.md). No modo seguro (lib/modo-seguro.ts) nada é gravado.
// Sem os atalhos "@/" de propósito: `npm run testar:acompanhante` roda este arquivo no Node.

import { estaLigado } from "../modo-seguro";

export const CHAVE_CONVERSAS = "lucia:escola-privado:conversas";
export const CHAVE_TRABALHO = "lucia:escola-privado:trabalho";

/** Os modos que o acompanhante usa (a Edge Function aceita também os do E4-16). */
export const MODOS_DO_ACOMPANHANTE = ["socratico", "pistas", "outro-jeito", "redacao", "documento", "conversa"] as const;
export type ModoDoAcompanhante = (typeof MODOS_DO_ACOMPANHANTE)[number];

/** Os modos dos agentes (E4-16): a Edge Function já os aceita; as telas ficam em /escola/agentes. */
export const MODOS_DOS_AGENTES = ["entrevista", "oratoria", "papelada", "turma", "educador"] as const;
export type ModoDeAgente = (typeof MODOS_DOS_AGENTES)[number];
/** Qualquer modo que uma conversa guardada pode ter. */
export type ModoDeConversa = ModoDoAcompanhante | ModoDeAgente;

/** Os mesmos limites de supabase/functions/assistente/assistente.ts (LIMITES_DO_ACOMPANHANTE); o teste confere. */
export const LIMITES = { itens: 8, item: 1500, historico: 6000, trecho: 1200, enunciado: 1500, alternativas: 6, alternativa: 300, trabalho: 80, vaga: 120, redacao: 2800, pergunta: 3000 };
/** O que o aparelho guarda: no máximo 20 conversas, de até 30 dias, com até 40 falas de até 20 mil caracteres. */
export const GUARDA = { conversas: 20, dias: 30, falas: 40, fala: 20_000, titulo: 120 };
const DIA = 24 * 60 * 60 * 1000;

export interface Fala {
  de: "pessoa" | "assistente";
  texto: string;
  /** Quando (milissegundos). */
  em: number;
  /** A resposta veio cortada pelo limite de tamanho. */
  cortada?: boolean;
}

export interface Conversa {
  id: string;
  modo: ModoDeConversa;
  titulo: string;
  /** A aula ("trilha/aula"), quando a conversa nasceu nela. */
  aula?: string;
  /** O idioma da prática, na conversa de idioma. */
  idiomaAlvo?: "en" | "es";
  criada: number;
  atualizada: number;
  falas: Fala[];
}

export interface Contexto {
  aula?: string;
  trecho?: string;
  enunciado?: string;
  alternativas?: string[];
  nivel?: 1 | 2 | 3;
  trabalho?: string;
  idiomaAlvo?: "en" | "es";
  vaga?: string;
}

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Sessao = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

const local = (): Armazenamento | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};
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

const ehModo = (v: unknown): v is ModoDeConversa => (MODOS_DO_ACOMPANHANTE as readonly unknown[]).includes(v) || (MODOS_DOS_AGENTES as readonly unknown[]).includes(v);

function validarFala(dado: unknown): Fala | null {
  if (!dado || typeof dado !== "object") return null;
  const f = dado as Record<string, unknown>;
  if ((f.de !== "pessoa" && f.de !== "assistente") || typeof f.texto !== "string" || typeof f.em !== "number" || !Number.isFinite(f.em)) return null;
  return { de: f.de, texto: f.texto.slice(0, GUARDA.fala), em: f.em, ...(f.cortada === true ? { cortada: true } : {}) };
}

/** Confere uma conversa lida do aparelho (o que não tem a forma certa é descartado). */
export function validarConversa(dado: unknown): Conversa | null {
  if (!dado || typeof dado !== "object" || Array.isArray(dado)) return null;
  const c = dado as Record<string, unknown>;
  if (typeof c.id !== "string" || !/^[a-z0-9-]{4,40}$/.test(c.id) || !ehModo(c.modo) || typeof c.titulo !== "string") return null;
  if (typeof c.criada !== "number" || typeof c.atualizada !== "number" || !Array.isArray(c.falas)) return null;
  const falas = c.falas.map(validarFala).filter((f): f is Fala => f !== null).slice(-GUARDA.falas);
  return {
    id: c.id,
    modo: c.modo,
    titulo: c.titulo.slice(0, GUARDA.titulo),
    ...(typeof c.aula === "string" && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(c.aula) ? { aula: c.aula } : {}),
    ...(c.idiomaAlvo === "en" || c.idiomaAlvo === "es" ? { idiomaAlvo: c.idiomaAlvo } : {}),
    criada: c.criada,
    atualizada: c.atualizada,
    falas,
  };
}

/** Só as válidas, de até 30 dias, as 20 mais recentes, da mais nova para a mais velha. */
function arrumar(lista: Conversa[], agora: number): Conversa[] {
  return lista
    .filter((c) => agora - c.atualizada <= GUARDA.dias * DIA)
    .sort((a, b) => b.atualizada - a.atualizada)
    .slice(0, GUARDA.conversas);
}

/** As conversas guardadas neste aparelho, da mais nova para a mais velha (as de mais de 30 dias não voltam). */
export function lerConversas(armazenamento: Armazenamento | null = local(), agora: number = Date.now()): Conversa[] {
  try {
    const texto = armazenamento?.getItem(CHAVE_CONVERSAS);
    const dado = texto ? (JSON.parse(texto) as unknown) : null;
    if (!Array.isArray(dado)) return [];
    return arrumar(dado.map(validarConversa).filter((c): c is Conversa => c !== null), agora);
  } catch {
    return [];
  }
}

/**
 * Grava (ou atualiza, pelo id) uma conversa. Ficam no máximo 20, de até 30 dias: a mais velha sai. No modo seguro não
 * grava nada e devolve false.
 */
export function gravarConversa(conversa: Conversa, o: { armazenamento?: Armazenamento | null; sessao?: Sessao; agora?: number } = {}): boolean {
  const armazenamento = o.armazenamento === undefined ? local() : o.armazenamento;
  const sessao = o.sessao === undefined ? sessaoDoNavegador() : o.sessao;
  if (!armazenamento || estaLigado(sessao)) return false;
  const agora = o.agora ?? Date.now();
  const valida = validarConversa(conversa);
  if (!valida) return false;
  const outras = lerConversas(armazenamento, agora).filter((c) => c.id !== valida.id);
  try {
    armazenamento.setItem(CHAVE_CONVERSAS, JSON.stringify(arrumar([valida, ...outras], agora)));
    avisar();
    return true;
  } catch {
    // armazenamento cheio ou bloqueado: a conversa vale até fechar a página
    return false;
  }
}

/** Apaga uma conversa (pelo id) ou, sem id, todas. */
export function apagarConversas(id?: string, armazenamento: Armazenamento | null = local(), agora: number = Date.now()): void {
  try {
    if (!armazenamento) return;
    if (id) {
      const resto = lerConversas(armazenamento, agora).filter((c) => c.id !== id);
      if (resto.length) armazenamento.setItem(CHAVE_CONVERSAS, JSON.stringify(resto));
      else armazenamento.removeItem(CHAVE_CONVERSAS);
    } else armazenamento.removeItem(CHAVE_CONVERSAS);
    avisar();
  } catch {
    // nada a apagar
  }
}

/** O trabalho que a pessoa disse ("Explique com exemplo do meu trabalho"), lembrado só no aparelho. */
export function lerTrabalho(armazenamento: Armazenamento | null = local()): string {
  try {
    return (armazenamento?.getItem(CHAVE_TRABALHO) ?? "").slice(0, LIMITES.trabalho);
  } catch {
    return "";
  }
}

export function gravarTrabalho(trabalho: string, o: { armazenamento?: Armazenamento | null; sessao?: Sessao } = {}): boolean {
  const armazenamento = o.armazenamento === undefined ? local() : o.armazenamento;
  const sessao = o.sessao === undefined ? sessaoDoNavegador() : o.sessao;
  if (!armazenamento || estaLigado(sessao)) return false;
  const limpo = trabalho.replace(/\s+/g, " ").trim().slice(0, LIMITES.trabalho);
  try {
    if (limpo) armazenamento.setItem(CHAVE_TRABALHO, limpo);
    else armazenamento.removeItem(CHAVE_TRABALHO);
    avisar();
    return true;
  } catch {
    return false;
  }
}

/** Um id curto e sorteado (sem nada da pessoa). */
export function novoId(): string {
  const bytes = new Uint8Array(8);
  try {
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `c-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** O título de uma conversa: o começo do primeiro texto, numa linha. */
export const tituloDe = (texto: string) => {
  const linha = texto.replace(/\s+/g, " ").trim();
  return linha.length > 80 ? `${linha.slice(0, 79)}…` : linha;
};

const cortar = (texto: string | undefined, limite: number) => (texto ?? "").trim().slice(0, limite);

/**
 * O pedido ao assistente, cortado nos limites da Edge Function: o histórico fica com as 8 falas mais recentes, cada
 * uma com até 1500 caracteres e 6000 no total (saem as mais antigas). O contexto só leva o que tem valor.
 */
export function montarPedido(o: {
  modo: ModoDeConversa;
  pergunta: string;
  idioma: string;
  falas?: readonly Pick<Fala, "de" | "texto">[];
  contexto?: Contexto;
  imagem?: { tipo: string; dados: string };
}) {
  const historico = (o.falas ?? [])
    .map((f) => ({ de: f.de, texto: f.texto.trim().slice(0, LIMITES.item) }))
    .filter((f) => f.texto)
    .slice(-LIMITES.itens);
  let total = historico.reduce((s, f) => s + f.texto.length, 0);
  while (total > LIMITES.historico && historico.length) total -= historico.shift()!.texto.length;
  const c = o.contexto ?? {};
  const contexto: Contexto = {};
  if (c.aula && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(c.aula)) contexto.aula = c.aula;
  if (cortar(c.trecho, LIMITES.trecho)) contexto.trecho = cortar(c.trecho, LIMITES.trecho);
  if (cortar(c.enunciado, LIMITES.enunciado)) contexto.enunciado = cortar(c.enunciado, LIMITES.enunciado);
  const alternativas = (c.alternativas ?? []).map((a) => cortar(a, LIMITES.alternativa)).filter(Boolean).slice(0, LIMITES.alternativas);
  if (alternativas.length) contexto.alternativas = alternativas;
  if (c.nivel === 1 || c.nivel === 2 || c.nivel === 3) contexto.nivel = c.nivel;
  if (cortar(c.trabalho, LIMITES.trabalho)) contexto.trabalho = cortar(c.trabalho, LIMITES.trabalho);
  if (c.idiomaAlvo === "en" || c.idiomaAlvo === "es") contexto.idiomaAlvo = c.idiomaAlvo;
  if (cortar(c.vaga, LIMITES.vaga)) contexto.vaga = cortar(c.vaga, LIMITES.vaga);
  return {
    modo: o.modo,
    pergunta: o.pergunta.trim().slice(0, o.modo === "redacao" ? LIMITES.redacao : LIMITES.pergunta),
    disciplina: "",
    idioma: o.idioma,
    aulas: [] as { titulo: string; caminho: string }[],
    ...(o.imagem ? { imagem: o.imagem } : {}),
    ...(historico.length ? { historico } : {}),
    ...(Object.keys(contexto).length ? { contexto } : {}),
  };
}

/** O que sai do aparelho num pedido, em caracteres, para a tela dizer antes de mandar. */
export function tamanhoDoPedido(pedido: ReturnType<typeof montarPedido>): number {
  const { imagem, ...resto } = pedido;
  return JSON.stringify(resto).length + (imagem ? imagem.dados.length : 0);
}

/**
 * Tira do comentário de redação qualquer linha que dê nota ou pontuação ("nota 800", "160 pontos", "120/200",
 * "nível 4"). A instrução do assistente já proíbe nota; isto é a segunda trava, no aparelho.
 */
export function tirarNotas(texto: string): { texto: string; tirou: boolean } {
  const nota = /\b(nota|pontua[çc][ãa]o|score)\b[^\n]{0,20}\d|\b\d{1,4}\s*(pontos|pts)\b|\b\d{1,4}\s*\/\s*(200|1000)\b|\bn[íi]vel\s*[0-5]\b/i;
  const linhas = texto.split("\n");
  const ficam = linhas.filter((l) => !nota.test(l));
  return { texto: ficam.join("\n").trim(), tirou: ficam.length !== linhas.length };
}

/** Uma tarja: retângulo em pixels da imagem. */
export interface Tarja {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Grava as tarjas NOS PIXELS (RGBA): cada pixel coberto vira preto opaco. Não é camada por cima: o que estava
 * embaixo deixa de existir na imagem que sai. Devolve quantos pixels mudaram.
 */
export function aplicarTarjas(dados: Uint8ClampedArray, largura: number, altura: number, tarjas: readonly Tarja[]): number {
  let mudou = 0;
  for (const t of tarjas) {
    const x0 = Math.max(0, Math.floor(Math.min(t.x, t.x + t.w)));
    const y0 = Math.max(0, Math.floor(Math.min(t.y, t.y + t.h)));
    const x1 = Math.min(largura, Math.ceil(Math.max(t.x, t.x + t.w)));
    const y1 = Math.min(altura, Math.ceil(Math.max(t.y, t.y + t.h)));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * largura + x) * 4;
        if (dados[i] !== 0 || dados[i + 1] !== 0 || dados[i + 2] !== 0 || dados[i + 3] !== 255) mudou++;
        dados[i] = 0;
        dados[i + 1] = 0;
        dados[i + 2] = 0;
        dados[i + 3] = 255;
      }
    }
  }
  return mudou;
}
