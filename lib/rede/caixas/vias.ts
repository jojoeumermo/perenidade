// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Por onde passam os pedidos ANÔNIMOS das caixas (onda R3, item 2.1): a "via". O cliente das caixas não sabe qual é: só pede o
// `fetch` à via atual (lib/rede/caixas/transporte.ts). Documento: docs/rede/CHAT-PRIVADO.md ("Por onde as mensagens passam").
//   - "direta": o HTTPS de sempre (no site, o fetch do navegador; nos apps, o HTTP nativo, sem Origin). O servidor vê o endereço de IP;
//   - "tor": quando a página veio pelo endereço .onion (tudo já passa pelo Tor), ou, nos apps, quando a pessoa liga o Tor (Orbot/Arti) e
//     a casca registra o fetch pelo proxy (`ligarTor`). O servidor não vê o IP; quem olha a rede inteira ainda pode ligar horários;
//   - "mixnet": a Nym (lib/rede/mixnet/nym.ts), com atraso por nó e cobertura: nem o servidor nem quem olha a rede inteira liga o
//     depósito a quem depositou e a busca a quem buscou (simulação: scripts/testar-r3-mixnet.mjs). DESLIGADA nesta versão.
// Com a mixnet ligada, ela é o padrão; o "modo rápido" (só Tor) é escolha da pessoa, sabendo o que perde (o texto está na tela).
// Só os pedidos anônimos das caixas passam pela via; os com a sessão da conta (emitir passes, publicar no diretório) seguem diretos:
// eles já dizem quem é.
//
// Sem "@/" de propósito.
import { fetchPelaMixnet, mixnetLigada } from "../mixnet/nym";

export type Via = "direta" | "tor" | "mixnet";

export interface ViaDeTransporte {
  via: Via;
  fetch: typeof fetch;
  /** O começo dos endereços nesta via ("" = o de sempre; o .onion quando o Tor dos apps fala com o endereço .onion). */
  base?: string;
  pronta(): Promise<boolean>;
}

const CHAVE_DO_MODO = "alumia-via-r3";
export type Modo = "padrao" | "rapido";

let fetchDireto: typeof fetch = (...a) => globalThis.fetch(...a);
let tor: { fetch: typeof fetch; base: string } | null = null;

/**
 * O desvio de endereço que vale em TODA via (a junção da R3): com o chat separado (lib/rede/caixas/servidor-do-chat.ts,
 * ligarServidorDoChat), as rotas das caixas vão ao servidor do chat também pela mixnet e pelo Tor, e não só pela via direta. Ele
 * recebe o fetch da via e devolve o fetch desviado (nunca o fetch direto global: sem laço).
 */
let desvio: ((daVia: typeof fetch) => typeof fetch) | null = null;
export function usarDesvio(d: ((daVia: typeof fetch) => typeof fetch) | null): void {
  desvio = d;
}

/** O fetch da via direta (lib/rede/caixas/transporte.ts passa o dele: o do navegador ou o nativo dos apps). */
export function usarFetchDireto(f: typeof fetch): void {
  fetchDireto = f;
}

/** Nos apps: a pessoa ligou o Tor (Orbot/Arti) e a casca tem um fetch pelo proxy, falando com o endereço .onion. */
export function ligarTor(f: typeof fetch, base: string): void {
  tor = { fetch: f, base };
}
export function desligarTor(): void {
  tor = null;
}

/** A página veio pelo endereço .onion (Tor Browser): tudo já passa pelo Tor. */
const paginaPeloTor = (): boolean => {
  try {
    return typeof location !== "undefined" && location.hostname.endsWith(".onion");
  } catch {
    return false;
  }
};
const torPronto = () => !!tor || paginaPeloTor();

/** O modo escolhido neste aparelho ("padrao": a mixnet quando ligada; "rapido": só Tor). */
export function modoDaVia(): Modo {
  try {
    return globalThis.localStorage?.getItem(CHAVE_DO_MODO) === "rapido" ? "rapido" : "padrao";
  } catch {
    return "padrao";
  }
}
export function escolherModo(m: Modo): void {
  try {
    if (m === "rapido") globalThis.localStorage?.setItem(CHAVE_DO_MODO, "rapido");
    else globalThis.localStorage?.removeItem(CHAVE_DO_MODO);
  } catch {
    /* sem armazenamento: fica o padrão */
  }
}

function montar(via: Via): ViaDeTransporte {
  const v = montarSemDesvio(via);
  if (!desvio) return v;
  return { ...v, fetch: desvio(v.fetch) };
}

function montarSemDesvio(via: Via): ViaDeTransporte {
  if (via === "mixnet") {
    const f = fetchPelaMixnet();
    return { via, fetch: (...a) => (f ?? fetchDireto)(...a), pronta: async () => mixnetLigada() };
  }
  if (via === "tor") {
    const t = tor;
    return { via, fetch: (...a) => (t ? t.fetch : fetchDireto)(...a), base: t?.base, pronta: async () => torPronto() };
  }
  return { via, fetch: (...a) => fetchDireto(...a), pronta: async () => true };
}

/** A via que vale agora: a mixnet (se ligada e o modo não é o rápido), senão o Tor (se há), senão a direta. */
export function viaAtual(): ViaDeTransporte {
  if (mixnetLigada() && modoDaVia() === "padrao") return montar("mixnet");
  if (torPronto()) return montar("tor");
  return montar("direta");
}

/**
 * Pede uma via. Devolve a que vai valer e, se não for a pedida, o porquê: "mixnet_desligada" (a mixnet não está ligada nesta versão)
 * ou "tor_indisponivel" (sem .onion e sem o Tor do app). Pedir a mixnet volta ao modo padrão; pedir o Tor é o modo rápido.
 */
export async function escolherVia(preferida: Via): Promise<{ via: Via; motivo?: "mixnet_desligada" | "tor_indisponivel" }> {
  if (preferida === "mixnet") {
    escolherModo("padrao");
    if (mixnetLigada()) return { via: "mixnet" };
    return { via: viaAtual().via, motivo: "mixnet_desligada" };
  }
  if (preferida === "tor") {
    escolherModo("rapido");
    if (torPronto()) return { via: "tor" };
    return { via: "direta", motivo: "tor_indisponivel" };
  }
  escolherModo("rapido");
  return { via: torPronto() ? "tor" : "direta" };
}
