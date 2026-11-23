// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A chamada de voz e de vídeo da conversa a dois (Prompt 4, itens 139 e 140, atrás de "alumia-p4-chamadas"). Documento:
// docs/rede/VOZ.md, seção "Chamada da conversa a dois".
//
// O TOQUE é um tipo novo de conteúdo DENTRO do cifrado do chat (o controle "chamada" de lib/rede/chat/r2/servico.ts), pela mesma
// cifra, o mesmo envelope de tamanho fixo e o mesmo ritmo do texto: o servidor não sabe que houve chamada. Ele leva uma chave
// sorteada no aparelho de quem liga (32 bytes de crypto.getRandomValues), que só os aparelhos das duas pessoas recebem. Dessa chave
// saem (HKDF) a chave da combinação da sala (AES-256-GCM, a mesma de lib/rede/voz/sala.ts) e o nome do canal de combinação. A sala
// é a de voz que já existe (conexão direta, sempre por retransmissão, até 2 pessoas aqui).
//
// Por que a chamada a dois não tem o problema que o docs/rede/VOZ.md admite na sala do grupo (um membro se passar por outro na
// combinação): só as duas pessoas têm a chave da chamada. Quem poderia "se passar" pela outra é a própria outra, e trocar a impressão
// da conexão dela por ela mesma não dá a ninguém o meio da conversa. Quem é de fora não tem a chave. Na chamada de GRUPO, o problema
// continua (a chave seria de todos): por isso ela não existe até a combinação ir como mensagem de aplicação do MLS, assinada (isso
// mexe no protocolo da voz: pendência).
//
// Sorteio só por crypto.getRandomValues (nunca Math.random). Sem "@/" de propósito (roda no Node nos testes).

/** Os rótulos das duas chaves tiradas da chave do toque (na lista única: lib/rede/cifra/rotulos.ts). */
export const ROTULOS = { combinacao: "alumia/p4/chamada/combinacao/v1", canal: "alumia/p4/chamada/canal/v1" } as const;

/** Por quanto tempo um toque vale (o chat busca a caixa a cada minuto com a tela aberta, e o depósito espera até 30 s). */
export const TOQUE_VALE_MS = 2 * 60_000;
/** O teto de pessoas da chamada a dois (os aparelhos das duas pessoas: o primeiro que atende fica). */
export const PESSOAS_NA_CHAMADA = 2;

/**
 * Como a chamada acabou. "atendida": um aparelho da outra pessoa atendeu (quem liga avisa, e os OUTROS aparelhos dela param de tocar;
 * o que atendeu segue na chamada).
 */
export type FimDaChamada = "cancelou" | "recusou" | "desligou" | "atendida";
export const FINS: readonly FimDaChamada[] = ["cancelou", "recusou", "desligou", "atendida"];

/** O corpo do toque, em JSON, dentro do cifrado. `fim`: a chamada acabou (nenhuma chave vai junto). */
export interface CorpoDoToque {
  v: 1;
  /** O id da chamada (16 bytes, base64url). */
  id: string;
  /** A chave da chamada (32 bytes, base64url). Vazia no `fim`. */
  k: string;
  video: boolean;
  /** Quando quem liga mandou (ms). */
  quando: number;
  fim?: FimDaChamada;
}

const paraB64Url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const B64URL = /^[A-Za-z0-9_-]+$/;
const temBytes = (s: unknown, n: number) => typeof s === "string" && B64URL.test(s) && s.length === Math.ceil((n * 4) / 3);

/** Um toque novo: id e chave sorteados neste aparelho. */
export function novoToque(video: boolean, agora = Date.now()): CorpoDoToque {
  const id = crypto.getRandomValues(new Uint8Array(16));
  const k = crypto.getRandomValues(new Uint8Array(32));
  return { v: 1, id: paraB64Url(id), k: paraB64Url(k), video: !!video, quando: agora };
}

/** O fim de uma chamada: o mesmo id, sem chave. */
export function fimDoToque(toque: Pick<CorpoDoToque, "id" | "video">, fim: FimDaChamada, agora = Date.now()): CorpoDoToque {
  return { v: 1, id: toque.id, k: "", video: toque.video, quando: agora, fim };
}

/** Lê um corpo de toque (JSON). null em qualquer dúvida: fora do formato, chave do tamanho errado, campo a mais. */
export function lerCorpoDoToque(json: string): CorpoDoToque | null {
  if (typeof json !== "string" || json.length > 400) return null;
  try {
    const c = JSON.parse(json) as Record<string, unknown>;
    if (!c || typeof c !== "object" || c.v !== 1 || !temBytes(c.id, 16) || typeof c.video !== "boolean" || typeof c.quando !== "number" || !Number.isFinite(c.quando)) return null;
    const chaves = Object.keys(c);
    if (chaves.some((x) => !["v", "id", "k", "video", "quando", "fim"].includes(x))) return null;
    if (c.fim !== undefined) {
      if (!FINS.includes(c.fim as FimDaChamada) || c.k !== "") return null;
      return { v: 1, id: c.id as string, k: "", video: c.video, quando: c.quando, fim: c.fim as FimDaChamada };
    }
    if (!temBytes(c.k, 32)) return null;
    return { v: 1, id: c.id as string, k: c.k as string, video: c.video, quando: c.quando };
  } catch {
    return null;
  }
}

/** O toque ainda vale? (Um toque velho, repetido ou atrasado demais, não toca.) */
export const toqueVale = (c: CorpoDoToque, agora = Date.now()) => !c.fim && agora - c.quando <= TOQUE_VALE_MS && c.quando - agora <= 30_000;

async function derivar(k: string, rotulo: string, bits: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", deB64Url(k) as BufferSource, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode(rotulo) }, base, bits));
}

/** A chave da combinação da chamada (AES-256-GCM, não extraível), tirada da chave do toque. */
export async function chaveDaCombinacao(toque: CorpoDoToque): Promise<CryptoKey> {
  if (!temBytes(toque.k, 32)) throw new Error("chamada_sem_chave");
  const bruta = await derivar(toque.k, `${ROTULOS.combinacao}|${toque.id}`, 256);
  return crypto.subtle.importKey("raw", bruta as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** O nome do canal de combinação (Realtime): sai da chave, então quem vê o canal não acha a chamada nem a conversa. */
export async function canalDaChamada(toque: CorpoDoToque): Promise<string> {
  if (!temBytes(toque.k, 32)) throw new Error("chamada_sem_chave");
  const b = await derivar(toque.k, `${ROTULOS.canal}|${toque.id}`, 128);
  return `voz-${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
