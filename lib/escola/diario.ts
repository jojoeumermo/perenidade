// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O diário de formação e as fichas de registro da tarefa no mundo (PLANO-ESCOLA.md, F2): SÓ neste aparelho. Nada daqui
// vai ao servidor, nem na cópia de segurança: as chaves começam com "lucia:escola-privado:", o prefixo que a cópia pula e
// que o "apagar meus dados" apaga (lib/estudo.ts, PREFIXOS_SO_APAGAR). Com o modo seguro ligado (lib/modo-seguro.ts),
// nada é gravado. Cada parte pode ser apagada pela própria pessoa, na hora.
//
// A ficha de registro segue a sistematização do trabalho de base (Instituto Tricontinental, Caderno 1, jan/2022): o que
// fiz, onde, com quem, o que aprendi e o que levo ao núcleo. Sem dado pessoal de terceiros: o aparelho avisa quando o
// texto parece ter telefone, e-mail ou documento, e a tela pede para escrever "uma vizinha", não o nome.
// Sem os atalhos "@/" de propósito: scripts/testar-escola-cadernos.mjs roda este arquivo no Node.

import { estaLigado } from "../modo-seguro";
import { armazemPrivado } from "./cofre";

export const CHAVE_DIARIO = "lucia:escola-privado:diario";
export const CHAVE_FICHAS = "lucia:escola-privado:fichas";
/** Avisa as outras partes da página (e as outras abas, pelo evento storage) que o diário ou as fichas mudaram. */
export const MUDOU_O_DIARIO = "lucia:escola-diario-mudou";

export const LIMITES_DO_DIARIO = { entrada: 4000, entradas: 400, campo: 600 };

export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** O armazenamento das chaves privadas: o localStorage, ou o cofre cifrado da Escola quando ele existe (lib/escola/cofre.ts). */
const local = (): Armazenamento | null => armazemPrivado();

/** Gravar é permitido? Não no modo seguro (aba neutra) nem sem armazenamento. */
export const podeGravar = (armazenamento: Armazenamento | null = local(), seguro = estaLigado()) => Boolean(armazenamento) && !seguro;

function avisar() {
  try {
    globalThis.dispatchEvent?.(new Event(MUDOU_O_DIARIO));
  } catch {
    // fora do navegador
  }
}

function lerMapa<T>(armazenamento: Armazenamento | null, chave: string, validar: (v: unknown) => T | null): Record<string, T> {
  if (!armazenamento) return {};
  try {
    const bruto = JSON.parse(armazenamento.getItem(chave) ?? "{}") as unknown;
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
    const saida: Record<string, T> = {};
    for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
      const ok = validar(v);
      if (ok !== null && /^[a-z0-9/-]{1,200}$/.test(k)) saida[k] = ok;
    }
    return saida;
  } catch {
    return {};
  }
}

function gravarMapa<T>(armazenamento: Armazenamento | null, chave: string, mapa: Record<string, T>): boolean {
  if (!armazenamento || !podeGravar(armazenamento)) return false;
  try {
    if (Object.keys(mapa).length === 0) armazenamento.removeItem(chave);
    else armazenamento.setItem(chave, JSON.stringify(mapa));
    avisar();
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────── Diário (uma entrada por aula) ─────────────────────────────

export interface EntradaDoDiario {
  texto: string;
  /** Milissegundos. */
  em: number;
}

const entradaValida = (v: unknown): EntradaDoDiario | null =>
  v && typeof v === "object" && typeof (v as EntradaDoDiario).texto === "string" && typeof (v as EntradaDoDiario).em === "number"
    ? { texto: (v as EntradaDoDiario).texto.slice(0, LIMITES_DO_DIARIO.entrada), em: (v as EntradaDoDiario).em }
    : null;

export const lerDiario = (armazenamento: Armazenamento | null = local()) => lerMapa(armazenamento, CHAVE_DIARIO, entradaValida);

export const lerEntrada = (aula: string, armazenamento: Armazenamento | null = local()): string => lerDiario(armazenamento)[aula]?.texto ?? "";

/** Grava (ou apaga, com texto vazio) a entrada de uma aula. Guarda no máximo 400 aulas: as mais antigas saem. */
export function gravarEntrada(aula: string, texto: string, armazenamento: Armazenamento | null = local(), agora = Date.now()): boolean {
  const mapa = lerDiario(armazenamento);
  const limpo = texto.slice(0, LIMITES_DO_DIARIO.entrada);
  if (limpo.trim()) mapa[aula] = { texto: limpo, em: agora };
  else delete mapa[aula];
  const chaves = Object.keys(mapa).sort((a, b) => mapa[b].em - mapa[a].em);
  for (const k of chaves.slice(LIMITES_DO_DIARIO.entradas)) delete mapa[k];
  return gravarMapa(armazenamento, CHAVE_DIARIO, mapa);
}

/** Apaga o diário inteiro deste aparelho. */
export function apagarDiario(armazenamento: Armazenamento | null = local()): void {
  try {
    armazenamento?.removeItem(CHAVE_DIARIO);
    avisar();
  } catch {
    // sem armazenamento
  }
}

// ───────────────────────────── Ficha de registro da tarefa no mundo (uma por caderno) ─────────────────────────────

export const CAMPOS_DA_FICHA = ["oQue", "onde", "quem", "aprendi", "levar"] as const;
export type CampoDaFicha = (typeof CAMPOS_DA_FICHA)[number];

export interface FichaDeRegistro {
  campos: Partial<Record<CampoDaFicha, string>>;
  /** Milissegundos de quando a tarefa foi marcada como feita; nulo enquanto não foi. */
  feita: number | null;
  em: number;
}

const fichaValida = (v: unknown): FichaDeRegistro | null => {
  if (!v || typeof v !== "object") return null;
  const f = v as Partial<FichaDeRegistro>;
  const campos: FichaDeRegistro["campos"] = {};
  if (f.campos && typeof f.campos === "object") {
    for (const c of CAMPOS_DA_FICHA) {
      const valor = (f.campos as Record<string, unknown>)[c];
      if (typeof valor === "string" && valor.trim()) campos[c] = valor.slice(0, LIMITES_DO_DIARIO.campo);
    }
  }
  return { campos, feita: typeof f.feita === "number" ? f.feita : null, em: typeof f.em === "number" ? f.em : 0 };
};

export const lerFichas = (armazenamento: Armazenamento | null = local()) => lerMapa(armazenamento, CHAVE_FICHAS, fichaValida);

export const lerFicha = (caderno: string, armazenamento: Armazenamento | null = local()): FichaDeRegistro | null => lerFichas(armazenamento)[caderno] ?? null;

export function gravarFicha(caderno: string, ficha: Omit<FichaDeRegistro, "em">, armazenamento: Armazenamento | null = local(), agora = Date.now()): boolean {
  const mapa = lerFichas(armazenamento);
  const limpa = fichaValida({ ...ficha, em: agora })!;
  if (Object.keys(limpa.campos).length === 0 && limpa.feita === null) delete mapa[caderno];
  else mapa[caderno] = limpa;
  return gravarMapa(armazenamento, CHAVE_FICHAS, mapa);
}

export function apagarFicha(caderno: string, armazenamento: Armazenamento | null = local()): boolean {
  const mapa = lerFichas(armazenamento);
  delete mapa[caderno];
  return gravarMapa(armazenamento, CHAVE_FICHAS, mapa);
}

/**
 * O texto parece ter dado pessoal de alguém (telefone, e-mail, CPF, endereço com número)? A ficha é sistematização, não
 * cadastro: o aparelho avisa antes de guardar. Nome próprio não dá para reconhecer com segurança; a tela pede para não pôr.
 */
export function pareceDadoPessoal(texto: string): boolean {
  return (
    /[\w.+-]+@[\w-]+\.[\w.]+/.test(texto) ||
    /(\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/.test(texto) ||
    /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(texto) ||
    /\b(rua|r\.|avenida|av\.|travessa|alameda)\s+[^\d\n]{2,40},?\s*(n[ºo°.]?\s*)?\d+/i.test(texto)
  );
}
