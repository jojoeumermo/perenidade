// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O SPQR do Signal (Sparse Post-Quantum Ratchet, o "triple ratchet", crate `spqr` v1.7.0, AGPL-3.0-only) dentro do aparelho, compilado
// para WebAssembly por nativo/spqr-wasm (sem wasm-bindgen: cinco funções C). Onda R3, item 1.1. Documento: docs/rede/CHAT-PRIVADO.md
// ("A camada pós-quântica"). Nada de cifra aqui: este arquivo só carrega o módulo (uma vez), CONFERE o sha256 dele contra o build de
// referência e passa bytes de um lado para o outro. O ML-KEM-768 de dentro é o `libcrux-ml-kem` (formalmente verificado).
//
// O sorteio do módulo vem do `crypto.getRandomValues` (o import `env.aleatorio`), nunca de Math.random. Entradas e saídas são zeradas
// na memória do módulo assim que copiadas (estado e chaves não ficam lá).
//
// Sem "@/" de propósito (os testes do Node importam este arquivo direto).

export const VERSAO_DO_SPQR = "1.7.0";
/** Quantas mensagens do SPQR vão em cada pacote (com 8, quem roubou o aparelho perde a conversa em ~9 idas e voltas). */
export const MENSAGENS_POR_PACOTE = 8;
/** Onde o site serve o módulo (copiado de nativo/spqr-wasm por scripts/preparar.mjs). */
export const CAMINHO_DO_SPQR = `/cifra/spqr-${VERSAO_DO_SPQR}.wasm`;
/**
 * O sha256 do build de REFERÊNCIA (nativo/spqr-wasm/montar.sh, no contêiner do Rust fixado pelo digest). Um módulo com outro resumo não
 * carrega: o site não troca a cifra do chat sem trocar este número (e o CI refaz o build e compara).
 */
export const RESUMO_DO_SPQR = "f09b59f4060ef17ffbd81668b3e1f992c82239ceea140410097bca444b1a04c9"; // gitleaks:allow (resumo SHA-256 público do build, não é chave)

export type Direcao = "A2B" | "B2A";

export interface MotorSpqr {
  /** O estado inicial: "A2B" para quem começa a sessão (e sorteou a auth_key), "B2A" para quem recebe. */
  inicial(direcao: Direcao, authKey: Uint8Array): Uint8Array;
  /** Uma mensagem do SPQR: o estado novo, a mensagem e a chave dela (32 bytes). Erro se o spqr recusar. */
  enviar(estado: Uint8Array): { estado: Uint8Array; msg: Uint8Array; chave: Uint8Array };
  /** Recebe uma mensagem: o estado novo e a chave. null se o spqr recusar (repetida, adulterada, versão abaixo da mínima, salto grande). */
  receber(estado: Uint8Array, msg: Uint8Array): { estado: Uint8Array; chave: Uint8Array } | null;
}

/** As funções que o módulo exporta (nativo/spqr-wasm/src/lib.rs). */
export interface ExportsDoSpqr {
  memory: WebAssembly.Memory;
  reservar(n: number): number;
  soltar(p: number, n: number): void;
  inicial(direcao: number, chave: number, n: number): number;
  enviar(e: number, ne: number, semente: number): number;
  receber(e: number, ne: number, m: number, nm: number): number;
  saida_ptr(): number;
  saida_len(): number;
  limpar(): void;
}

/** O import do módulo: o sorteio do sistema, em pedaços de até 64 KiB (o limite do getRandomValues). */
export function importsDoSpqr(memoria: () => WebAssembly.Memory): WebAssembly.Imports {
  return {
    env: {
      aleatorio: (p: number, n: number) => {
        for (let i = 0; i < n; i += 65536) globalThis.crypto.getRandomValues(new Uint8Array(memoria().buffer, p + i, Math.min(65536, n - i)));
      },
    },
  };
}

const campos = (b: Uint8Array): Uint8Array[] => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const r: Uint8Array[] = [];
  let i = 0;
  while (i + 4 <= b.length) {
    const n = v.getUint32(i, true);
    if (i + 4 + n > b.length) throw new Error("spqr_saida");
    r.push(b.slice(i + 4, i + 4 + n));
    i += 4 + n;
  }
  if (i !== b.length) throw new Error("spqr_saida");
  return r;
};

/** O motor sobre um módulo já instanciado (os testes instanciam o build de teste com isto). */
export function motorDeInstancia(w: ExportsDoSpqr): MotorSpqr {
  const entradas: [number, number][] = [];
  const por = (b: Uint8Array): [number, number] => {
    const n = Math.max(1, b.length);
    const p = w.reservar(n);
    new Uint8Array(w.memory.buffer, p, b.length).set(b);
    entradas.push([p, n]);
    return [p, b.length];
  };
  const soltarTudo = () => {
    for (const [p, n] of entradas.splice(0)) {
      new Uint8Array(w.memory.buffer, p, n).fill(0);
      w.soltar(p, n);
    }
  };
  /** A última saída do módulo, copiada (e zerada lá dentro). */
  const bruta = (): Uint8Array => {
    const b = new Uint8Array(w.memory.buffer, w.saida_ptr(), w.saida_len()).slice();
    w.limpar();
    return b;
  };
  const saida = (): Uint8Array[] => {
    const b = bruta();
    try {
      return campos(b);
    } finally {
      b.fill(0);
    }
  };
  return {
    inicial(direcao, authKey) {
      if (authKey.length !== 32) throw new Error("spqr_chave");
      try {
        const [p, n] = por(authKey);
        if (w.inicial(direcao === "A2B" ? 0 : 1, p, n) !== 0) throw new Error("spqr_inicial");
        return bruta();
      } finally {
        soltarTudo();
      }
    },
    enviar(estado) {
      const semente = new Uint8Array(32);
      globalThis.crypto.getRandomValues(semente);
      try {
        const [p, n] = por(estado);
        const [s] = por(semente);
        if (w.enviar(p, n, s) !== 0) throw new Error("spqr_enviar");
        const [novo, msg, chave] = saida();
        if (!novo || !msg || !chave || chave.length !== 32) throw new Error("spqr_enviar");
        return { estado: novo, msg, chave };
      } finally {
        semente.fill(0);
        soltarTudo();
      }
    },
    receber(estado, msg) {
      try {
        const [p, n] = por(estado);
        const [q, m] = por(msg);
        if (w.receber(p, n, q, m) !== 0) return null;
        const [novo, chave] = saida();
        return novo && chave && chave.length === 32 ? { estado: novo, chave } : null;
      } catch {
        return null;
      } finally {
        soltarTudo();
      }
    },
  };
}

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

/** Instancia os bytes do módulo, conferindo o sha256 contra o build de referência. */
export async function instanciarSpqr(bytes: Uint8Array, resumoEsperado: string = RESUMO_DO_SPQR): Promise<MotorSpqr> {
  const copia = Uint8Array.from(bytes);
  if (hex(await globalThis.crypto.subtle.digest("SHA-256", copia)) !== resumoEsperado) throw new Error("spqr_resumo");
  let memoria: WebAssembly.Memory | null = null;
  const { instance } = await WebAssembly.instantiate(copia, importsDoSpqr(() => memoria as WebAssembly.Memory));
  const w = instance.exports as unknown as ExportsDoSpqr;
  memoria = w.memory;
  return motorDeInstancia(w);
}

let carregado: Promise<MotorSpqr> | null = null;

/**
 * Carrega o SPQR (uma vez por página). No navegador e nos apps, do próprio site/pacote (`CAMINHO_DO_SPQR`); nos testes do Node, os
 * bytes do arquivo entram direto. Em todos os casos, o sha256 tem de ser o do build de referência.
 */
export function carregarSpqr(fonte: string | Uint8Array = CAMINHO_DO_SPQR): Promise<MotorSpqr> {
  if (typeof fonte !== "string") return instanciarSpqr(fonte);
  carregado ??= (async () => {
    const r = await fetch(fonte, { credentials: "omit", cache: "force-cache" });
    if (!r.ok) throw new Error("spqr_baixar");
    return instanciarSpqr(new Uint8Array(await r.arrayBuffer()));
  })().catch((erro: unknown) => {
    carregado = null;
    throw erro;
  });
  return carregado;
}
