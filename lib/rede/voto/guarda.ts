// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A privada da chave de voto da guardiã (X-Wing, 32 bytes), só neste aparelho (lib/rede/voto/limiar.ts). Fica no IndexedDB
// "lucia-alumia-voto", embrulhada (AES-256-GCM da Web Crypto, vetor sorteado a cada gravação) por uma chave NÃO exportável criada
// aqui: nem o próprio site lê a chave do embrulho, só a usa. É proteção contra leitura casual do armazenamento (uma cópia do
// disco junto com o navegador aberto ainda abre), dita na tela. O "Sair rápido" e o pânico apagam a base inteira (prefixo "lucia-").
// Perder esta chave (aparelho perdido, base apagada) tira a guardiã da abertura das votações em que ela já é guardiã; com K de N,
// as outras abrem. Ela cria uma chave nova para as próximas.

const BASE = "lucia-alumia-voto";
const LOJA = "chaves";

export interface ParDeGuardia {
  publica: Uint8Array;
  privada: Uint8Array;
}

function abrirBase(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    if (typeof indexedDB === "undefined") {
      falha(new Error("sem_armazenamento"));
      return;
    }
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => falha(pedido.error ?? new Error("sem_armazenamento"));
  });
}

async function comLoja<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await abrirBase();
  try {
    return await new Promise<T>((ok, falha) => {
      const t = base.transaction(LOJA, modo);
      const pedido = fazer(t.objectStore(LOJA));
      t.oncomplete = () => ok(pedido.result);
      t.onerror = () => falha(t.error ?? new Error("sem_armazenamento"));
      t.onabort = () => falha(t.error ?? new Error("sem_armazenamento"));
    });
  } finally {
    base.close();
  }
}

/** A chave do embrulho (AES-GCM, não exportável), criada na primeira vez. */
async function chaveDoEmbrulho(): Promise<CryptoKey> {
  const guardada = await comLoja<CryptoKey | undefined>("readonly", (l) => l.get("embrulho") as IDBRequest<CryptoKey | undefined>);
  if (guardada) return guardada;
  const nova = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await comLoja("readwrite", (l) => l.put(nova, "embrulho"));
  return nova;
}

const rotulo = (usuario: string) => new TextEncoder().encode(`alumia/r2/voto/guarda/v1\n${usuario}`);
const buf = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;

/** Guarda a chave de voto desta conta neste aparelho (substitui a de antes). */
export async function guardarChaveDeGuardia(usuario: string, par: ParDeGuardia): Promise<void> {
  const k = await chaveDoEmbrulho();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const embrulhada = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: buf(rotulo(usuario)) }, k, buf(par.privada)));
  await comLoja("readwrite", (l) => l.put({ publica: par.publica, iv, embrulhada }, `guardia:${usuario}`));
}

/** A chave de voto desta conta guardada neste aparelho, ou nulo. A privada vem aberta: quem usa a zera depois (`fill(0)`). */
export async function lerChaveDeGuardia(usuario: string): Promise<ParDeGuardia | null> {
  try {
    const g = await comLoja<{ publica: Uint8Array; iv: Uint8Array; embrulhada: Uint8Array } | undefined>("readonly", (l) => l.get(`guardia:${usuario}`) as IDBRequest<{ publica: Uint8Array; iv: Uint8Array; embrulhada: Uint8Array } | undefined>);
    if (!g) return null;
    const k = await chaveDoEmbrulho();
    const privada = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(g.iv), additionalData: buf(rotulo(usuario)) }, k, buf(g.embrulhada)));
    return { publica: new Uint8Array(g.publica), privada };
  } catch {
    return null;
  }
}

/** Esquece a chave de voto desta conta neste aparelho. */
export async function esquecerChaveDeGuardia(usuario: string): Promise<void> {
  await comLoja("readwrite", (l) => l.delete(`guardia:${usuario}`));
}
