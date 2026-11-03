// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

import { BASE_DOS_AUDIOS_DA_VIDA, chaveDoAudio, LOJA_DOS_AUDIOS } from "@/lib/escola/vida";

// Os áudios gravados pela própria pessoa ficam no IndexedDB "lucia-explicacoes" (a mesma base e a mesma versão 1 do
// ExpliqueComSuasPalavras), na loja "audios", com a chave "voz:<id>". Assim o "apagar meus dados" (que já apaga essa
// base inteira) cobre também estas gravações, sem tocar em lib/estudo.ts. Fora da cópia de segurança, por causa do
// tamanho. Nada aqui usa rede.

export const podeGravarAudio = () => typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolver) => {
    try {
      if (typeof indexedDB === "undefined") return resolver(null);
      const pedido = indexedDB.open(BASE_DOS_AUDIOS_DA_VIDA, 1);
      pedido.onupgradeneeded = () => {
        if (!pedido.result.objectStoreNames.contains(LOJA_DOS_AUDIOS)) pedido.result.createObjectStore(LOJA_DOS_AUDIOS);
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => resolver(null);
      pedido.onblocked = () => resolver(null);
    } catch {
      resolver(null);
    }
  });
}

async function naBase<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const base = await abrir();
  if (!base) return null;
  try {
    return await new Promise<T | null>((resolver) => {
      const pedido = fazer(base.transaction(LOJA_DOS_AUDIOS, modo).objectStore(LOJA_DOS_AUDIOS));
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => resolver(null);
    });
  } catch {
    return null;
  } finally {
    base.close();
  }
}

/** Guarda o áudio. Devolve false quando o aparelho não deixa (cheio, bloqueado, modo privado). */
export async function guardarAudio(id: string, audio: Blob): Promise<boolean> {
  const feito = await naBase("readwrite", (l) => l.put(audio, chaveDoAudio(id)));
  return feito !== null;
}

export async function lerAudio(id: string): Promise<Blob | null> {
  const achado = await naBase<unknown>("readonly", (l) => l.get(chaveDoAudio(id)));
  return achado instanceof Blob ? achado : null;
}

export async function apagarAudio(id: string): Promise<boolean> {
  const feito = await naBase("readwrite", (l) => l.delete(chaveDoAudio(id)));
  return feito !== null;
}
