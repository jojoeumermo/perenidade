// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A privada da chave de segurança (X-Wing, selo.ts), só neste aparelho. Fica no IndexedDB "lucia-alumia-seguranca", embrulhada
// (AES-256-GCM da Web Crypto, vetor sorteado a cada gravação) por uma chave NÃO exportável criada aqui: nem o próprio site lê a chave
// do embrulho, só a usa. É proteção contra leitura casual do armazenamento (uma cópia do disco com o navegador aberto ainda abre), e
// a tela diz isso. O "Sair rápido" e o pânico apagam a base inteira (prefixo "lucia-"). Perder esta chave (aparelho perdido, base
// apagada) é perder o que já chegou cifrado para ela: a pessoa cria outra para o que vier depois.

const BASE = "lucia-alumia-seguranca";
const LOJA = "chaves";

export interface ParGuardado {
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

async function chaveDoEmbrulho(): Promise<CryptoKey> {
  const guardada = await comLoja<CryptoKey | undefined>("readonly", (l) => l.get("embrulho") as IDBRequest<CryptoKey | undefined>);
  if (guardada) return guardada;
  const nova = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await comLoja("readwrite", (l) => l.put(nova, "embrulho"));
  return nova;
}

const rotulo = (usuario: string) => new TextEncoder().encode(`alumia/p4/seguranca/guarda/v1\n${usuario}`);
const buf = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;
type Gravado = { publica: Uint8Array; iv: Uint8Array; embrulhada: Uint8Array };

/** Guarda a chave de segurança desta conta neste aparelho (substitui a de antes). */
export async function guardarChaveDeSeguranca(usuario: string, par: ParGuardado): Promise<void> {
  const k = await chaveDoEmbrulho();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const embrulhada = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: buf(rotulo(usuario)) }, k, buf(par.privada)));
  await comLoja("readwrite", (l) => l.put({ publica: par.publica, iv, embrulhada } satisfies Gravado, `seguranca:${usuario}`));
}

/** A chave guardada neste aparelho, ou nulo. A privada vem aberta: quem usa a zera depois (`fill(0)`). */
export async function lerChaveDeSeguranca(usuario: string): Promise<ParGuardado | null> {
  try {
    const g = await comLoja<Gravado | undefined>("readonly", (l) => l.get(`seguranca:${usuario}`) as IDBRequest<Gravado | undefined>);
    if (!g) return null;
    const k = await chaveDoEmbrulho();
    const privada = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(g.iv), additionalData: buf(rotulo(usuario)) }, k, buf(g.embrulhada)));
    return { publica: new Uint8Array(g.publica), privada };
  } catch {
    return null;
  }
}

export async function esquecerChaveDeSeguranca(usuario: string): Promise<void> {
  await comLoja("readwrite", (l) => l.delete(`seguranca:${usuario}`));
}
