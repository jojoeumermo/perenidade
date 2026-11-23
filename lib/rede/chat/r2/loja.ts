// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A loja do chat a dois da onda R2 NESTE aparelho: um banco IndexedDB próprio ("lucia-alumia-r2") com o estado do aparelho de cada
// conta (chaves da conta e do aparelho, lista de conversas, caixas, contadores) SELADO com AES-256-GCM do WebCrypto, por uma chave
// NÃO exportável guardada no mesmo banco (o navegador guarda o objeto CryptoKey sem deixar ler os bytes). IV de 12 bytes sorteado a
// cada gravação (crypto.getRandomValues); o dado associado é "alumia/r2/cofre/aparelho/v1:<conta>" (um estado não abre como de outra
// conta). A loja do motor (sessões Proteus) fica no OPFS, cifrada pelo próprio motor com a `DatabaseKey`, que mora aqui dentro.
//
// Limite dito na tela: sem senha do chat, isto protege contra leitura casual do disco, não contra quem roda código nesta página ou
// tem o aparelho destravado. O "Sair rápido" e o pânico apagam o banco inteiro e o OPFS do motor (lib/rede/chat/gaveta.ts).
export const BANCO_R2 = "lucia-alumia-r2";
/** A pasta do motor no OPFS (o @wireapp/core-crypto grava em "core-crypto/<nome>"). */
export const PASTA_DO_MOTOR = "core-crypto";
export const nomeDaLojaDoMotor = (conta: string) => `alumia-r2-${conta}`;
const VERSAO = 1;
const CHAVES = "chaves";
const ESTADOS = "estados";
const ROTULO = "alumia/r2/cofre/aparelho/v1";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const pedido = indexedDB.open(BANCO_R2, VERSAO);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(CHAVES)) db.createObjectStore(CHAVES);
      if (!db.objectStoreNames.contains(ESTADOS)) db.createObjectStore(ESTADOS);
    };
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => falha(pedido.error);
    pedido.onblocked = () => falha(new Error("loja_ocupada"));
  });
}

async function naLoja<T>(gaveta: string, modo: IDBTransactionMode, fazer: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, falha) => {
      const tx = db.transaction(gaveta, modo);
      const pedido = fazer(tx.objectStore(gaveta));
      tx.oncomplete = () => ok((pedido ? pedido.result : undefined) as T);
      tx.onerror = () => falha(tx.error);
      tx.onabort = () => falha(tx.error ?? new Error("loja_abortada"));
    });
  } finally {
    db.close();
  }
}

/** A chave que sela os estados: criada uma vez, não exportável. */
async function chaveDaLoja(): Promise<CryptoKey> {
  const ja = await naLoja<CryptoKey | undefined>(CHAVES, "readonly", (s) => s.get("selo"));
  if (ja) return ja;
  const nova = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await naLoja(CHAVES, "readwrite", (s) => s.add(nova, "selo")).catch(() => undefined);
  // Outra aba pode ter criado ao mesmo tempo: vale a que ficou gravada.
  return (await naLoja<CryptoKey | undefined>(CHAVES, "readonly", (s) => s.get("selo"))) ?? nova;
}

/** Uma marca simples na loja (ex.: "o beta já foi limpo neste aparelho"). */
export async function gravarMarca(nome: string): Promise<void> {
  await naLoja(CHAVES, "readwrite", (s) => s.put(true, nome));
}

const aad = (conta: string) => new TextEncoder().encode(`${ROTULO}:${conta}`);

/** Grava (selado) o que este aparelho guarda da conta. */
export async function gravarNaLoja<T>(conta: string, valor: T): Promise<void> {
  const chave = await chaveDaLoja();
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const claro = new TextEncoder().encode(JSON.stringify(valor));
  try {
    const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(conta) }, chave, claro);
    await naLoja(ESTADOS, "readwrite", (s) => s.put({ iv, cifrado }, conta));
  } finally {
    claro.fill(0);
  }
}

/** Lê o que este aparelho guarda da conta; null se não há (ou se não abre: outra conta, mexido). */
export async function lerDaLoja<T>(conta: string): Promise<T | null> {
  const guardado = await naLoja<{ iv: Uint8Array<ArrayBuffer>; cifrado: ArrayBuffer } | undefined>(ESTADOS, "readonly", (s) => s.get(conta));
  if (!guardado) return null;
  try {
    const aberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: guardado.iv, additionalData: aad(conta) }, await chaveDaLoja(), guardado.cifrado);
    return JSON.parse(new TextDecoder().decode(aberto)) as T;
  } catch {
    return null;
  }
}

/** Apaga o estado de uma conta e a loja do motor dela. */
export async function apagarDaLoja(conta: string): Promise<void> {
  await naLoja(ESTADOS, "readwrite", (s) => s.delete(conta)).catch(() => undefined);
  await apagarLojasDoMotor([nomeDaLojaDoMotor(conta)]);
  // A base IndexedDB de mesmo nome que o WebAssembly do motor abre (a migração da loja antiga).
  try {
    indexedDB.deleteDatabase(nomeDaLojaDoMotor(conta));
  } catch {
    // sem IndexedDB: nada a apagar
  }
}

/** Apaga lojas do motor no OPFS (todas as da R2, sem nome). Nunca lança. */
export async function apagarLojasDoMotor(nomes?: string[]): Promise<void> {
  try {
    const raiz = await navigator.storage.getDirectory();
    const pasta = await raiz.getDirectoryHandle(PASTA_DO_MOTOR).catch(() => null);
    if (!pasta) return;
    const alvo = nomes ?? [];
    if (!nomes) for await (const [nome] of (pasta as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) if (nome.startsWith("alumia-r2-")) alvo.push(nome);
    for (const nome of alvo) await pasta.removeEntry(nome, { recursive: true }).catch(() => undefined);
  } catch {
    // sem OPFS: nada a apagar
  }
}
