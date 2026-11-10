// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras da B1 da casca da Alumia (Escrever, cartão, pausa, aba inicial, rascunho cifrado). Sem "@/" de propósito: roda
// no Node nos testes (scripts/testar-alumia-b1-casca-telas.mjs). O que fica no aparelho fica no localStorage desta origem e
// nunca vai ao servidor: as preferências de leitura (avisos que abrem sozinhos, minutos da pausa, aba inicial) dizem muito de
// quem lê (LGPD art. 6º, III: o servidor não precisa saber).

// ───── Aviso de conteúdo (CW) ─────

/** As sugestões prontas do aviso de conteúdo (as chaves; o texto vem do idioma). */
export const SUGESTOES_DE_AVISO = ["violencia", "luto", "imagem", "autolesao"] as const;
export type SugestaoDeAviso = (typeof SUGESTOES_DE_AVISO)[number];
/** O banco guarda até 80 caracteres (rede_publicar: left(btrim(aviso), 80)). */
export const LIMITE_DO_AVISO = 80;

/** O aviso como chave de comparação: sem acento, sem caixa, sem espaço sobrando ("Luto " = "luto"). */
export function chaveDoAviso(aviso: string): string {
  return aviso
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITE_DO_AVISO);
}

/** Uma área de guardar com a cara do localStorage (o teste passa uma de mentira). */
export interface Guarda {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
function guardaDoNavegador(): Guarda | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
function lerJson<T>(chave: string, padrao: T, g: Guarda | null = guardaDoNavegador()): T {
  try {
    const bruto = g?.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(chave: string, valor: unknown, g: Guarda | null = guardaDoNavegador()) {
  try {
    if (valor === null || valor === undefined) g?.removeItem(chave);
    else g?.setItem(chave, JSON.stringify(valor));
  } catch {
    // janela privada, armazenamento cheio: a preferência só não fica
  }
}

const CHAVE_AVISOS_ABERTOS = "alumia:avisos-abertos:v1";
/** Os avisos que esta pessoa escolheu abrir sozinhos neste aparelho (no máximo 30). */
export function avisosQueAbrem(g?: Guarda | null): string[] {
  const lista = lerJson<unknown>(CHAVE_AVISOS_ABERTOS, [], g);
  return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string").slice(0, 30) : [];
}
/** Este aviso abre sozinho aqui? */
export function avisoAbreSozinho(aviso: string, g?: Guarda | null): boolean {
  const c = chaveDoAviso(aviso);
  return Boolean(c) && avisosQueAbrem(g).includes(c);
}
/** Liga ou desliga "sempre abrir avisos de X" (devolve a lista nova). */
export function marcarAvisoQueAbre(aviso: string, abrir: boolean, g?: Guarda | null): string[] {
  const c = chaveDoAviso(aviso);
  const atual = avisosQueAbrem(g).filter((x) => x !== c);
  const nova = abrir && c ? [c, ...atual].slice(0, 30) : atual;
  gravar(CHAVE_AVISOS_ABERTOS, nova.length ? nova : null, g);
  return nova;
}

// ───── Lembrete de pausa ─────

/** As escolhas de minutos (0 = desligado). O padrão é 30. */
export const MINUTOS_DA_PAUSA = [15, 30, 45, 60, 0] as const;
export const PAUSA_PADRAO = 30;
const CHAVE_PAUSA = "alumia:pausa:v1";

export function minutosDaPausa(g?: Guarda | null): number {
  const n = lerJson<unknown>(CHAVE_PAUSA, PAUSA_PADRAO, g);
  return typeof n === "number" && (MINUTOS_DA_PAUSA as readonly number[]).includes(n) ? n : PAUSA_PADRAO;
}
export function guardarMinutosDaPausa(n: number, g?: Guarda | null) {
  gravar(CHAVE_PAUSA, (MINUTOS_DA_PAUSA as readonly number[]).includes(n) ? n : PAUSA_PADRAO, g);
}

/**
 * O relógio da pausa, sem placar: conta só o tempo em que a pessoa está rolando de verdade (a página à vista e um gesto de rolar
 * nos últimos 90 s), e nada sai do aparelho. `tique(agora, ativo)` devolve true quando chegou a hora do lembrete.
 */
export function criarRelogioDaPausa(minutos: number, ociosoMs = 90_000) {
  let acumulado = 0;
  let ultimo: number | null = null;
  let ultimoGesto = -Infinity;
  return {
    gesto(agora: number) {
      ultimoGesto = agora;
    },
    tique(agora: number, visivel: boolean): boolean {
      const ativo = visivel && agora - ultimoGesto <= ociosoMs;
      if (ativo && ultimo !== null) acumulado += Math.min(agora - ultimo, 5_000);
      ultimo = agora;
      return minutos > 0 && acumulado >= minutos * 60_000;
    },
    zerar() {
      acumulado = 0;
    },
    get ms() {
      return acumulado;
    },
  };
}

// ───── Aba inicial ─────

export const ABAS_INICIAIS = ["seguindo", "comunidades", "tudo"] as const;
export type AbaInicial = (typeof ABAS_INICIAIS)[number];
const CHAVE_ABA = "alumia:aba-inicial:v1";
export function abaPreferida(g?: Guarda | null): AbaInicial | null {
  const a = lerJson<unknown>(CHAVE_ABA, null, g);
  return typeof a === "string" && (ABAS_INICIAIS as readonly string[]).includes(a) ? (a as AbaInicial) : null;
}
export function guardarAbaPreferida(a: AbaInicial | null, g?: Guarda | null) {
  gravar(CHAVE_ABA, a && (ABAS_INICIAIS as readonly string[]).includes(a) ? a : null, g);
}

// ───── Rascunho na conta, cifrado no aparelho ─────

const CHAVE_NA_CONTA = "alumia:rascunhos-na-conta:v1";
const CHAVE_DA_CIFRA = "alumia:rascunhos-chave:v1";

/** A pessoa ligou "guardar rascunhos na conta"? Desligado por padrão (opt-in). */
export function guardarNaConta(g?: Guarda | null): boolean {
  return lerJson<unknown>(CHAVE_NA_CONTA, false, g) === true;
}
export function marcarGuardarNaConta(sim: boolean, g?: Guarda | null) {
  gravar(CHAVE_NA_CONTA, sim ? true : null, g);
}

const paraBase64 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
const deBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** O código da chave para levar a outro aparelho: 44 letras em 11 grupos de 4 (é a chave inteira; quem tiver, lê). */
export function codigoDaChave(chaveBase64: string): string {
  return chaveBase64.replace(/=+$/, "").match(/.{1,4}/g)?.join("-") ?? "";
}
/** O contrário: aceita com ou sem os tracinhos e espaços. Nulo se não for uma chave de 32 bytes. */
export function chaveDoCodigo(codigo: string): string | null {
  const limpo = codigo.replace(/[\s-]+/g, "");
  if (!/^[A-Za-z0-9+/]{43}$/.test(limpo)) return null;
  const b64 = `${limpo}=`;
  try {
    return deBase64(b64).length === 32 ? b64 : null;
  } catch {
    return null;
  }
}

/** A chave deste aparelho (cria uma na primeira vez). Fica só aqui; o servidor nunca recebe. */
export function chaveDoAparelho(g: Guarda | null = guardaDoNavegador()): string {
  const atual = lerJson<unknown>(CHAVE_DA_CIFRA, null, g);
  if (typeof atual === "string" && chaveDoCodigo(atual) === atual) return atual;
  const nova = paraBase64(crypto.getRandomValues(new Uint8Array(32)));
  gravar(CHAVE_DA_CIFRA, nova, g);
  return nova;
}
export function trocarChaveDoAparelho(chaveBase64: string, g?: Guarda | null) {
  gravar(CHAVE_DA_CIFRA, chaveBase64, g);
}

export interface RascunhoCifrado {
  v: 1;
  iv: string;
  cifra: string;
}

async function chaveAes(chaveBase64: string) {
  return crypto.subtle.importKey("raw", deBase64(chaveBase64), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Cifra o rascunho (AES-GCM 256, iv novo a cada vez). O servidor guarda só isto. */
export async function cifrarRascunho(conteudo: unknown, chaveBase64: string): Promise<RascunhoCifrado> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = new TextEncoder().encode(JSON.stringify(conteudo));
  const cifra = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chaveAes(chaveBase64), dados));
  return { v: 1, iv: paraBase64(iv), cifra: paraBase64(cifra) };
}

/** Decifra; nulo se a chave não é a deste rascunho (cifrado em outro aparelho) ou se a cifra foi mexida. */
export async function decifrarRascunho<T>(r: { iv?: unknown; cifra?: unknown }, chaveBase64: string): Promise<T | null> {
  if (typeof r.iv !== "string" || typeof r.cifra !== "string") return null;
  try {
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(r.iv) }, await chaveAes(chaveBase64), deBase64(r.cifra));
    return JSON.parse(new TextDecoder().decode(claro)) as T;
  } catch {
    return null;
  }
}

// ───── Agendar ─────

/** Quantas vezes "toda semana" pode repetir (o banco aceita de 2 a 12). */
export const VEZES_DA_REPETICAO = [2, 4, 8, 12] as const;
