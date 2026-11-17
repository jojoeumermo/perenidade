// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do APARELHO dos posts restritos (docs/rede/POSTS-RESTRITOS.md). A cifra é a do MLS (lib/rede/grupo-mls.ts); este
// arquivo dá a guarda no navegador (um IndexedDB próprio, "lucia-alumia-grupos", que o "Sair rápido" apaga inteiro) e o
// apagar. A interface para as telas é a mesma de antes: criarChaveiroDeGrupo({ chamar, guarda }) → preparar, cifrar, abrir,
// esquecer. Sem "@/".
import type { GuardaDoGrupo } from "./grupo-mls";

export { criarChaveiroDeGrupo, type ChamarOBanco, type ChaveiroDeGrupo, type GuardaDoGrupo, epocaDoPost } from "./grupo-mls";

const BANCO_DOS_GRUPOS = "lucia-alumia-grupos";
const GAVETA = "grupos";

function abrirBancoDosGrupos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO_DOS_GRUPOS, 2);
    pedido.onupgradeneeded = () => {
      // A versão 1 guardava o par da cifra antiga (feita à mão): sai inteira.
      for (const nome of [...pedido.result.objectStoreNames]) pedido.result.deleteObjectStore(nome);
      pedido.result.createObjectStore(GAVETA);
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

/** A guarda no navegador. Sem IndexedDB (alguns modos privados), tudo vive só na memória da aba. */
export function guardaNoNavegador(): GuardaDoGrupo {
  const memoria = new Map<string, unknown>();
  const naGaveta = async <T,>(modo: IDBTransactionMode, agir: (g: IDBObjectStore) => IDBRequest): Promise<T> => {
    const banco = await abrirBancoDosGrupos();
    try {
      return await new Promise<T>((resolve, reject) => {
        const pedido = agir(banco.transaction(GAVETA, modo).objectStore(GAVETA));
        pedido.onsuccess = () => resolve(pedido.result as T);
        pedido.onerror = () => reject(pedido.error);
      });
    } finally {
      banco.close();
    }
  };
  return {
    async ler<T>(chave: string) {
      try {
        return ((await naGaveta<T | undefined>("readonly", (g) => g.get(chave))) ?? (memoria.get(chave) as T | undefined) ?? null) as T | null;
      } catch {
        return (memoria.get(chave) as T | undefined) ?? null;
      }
    },
    async guardar(chave, valor) {
      memoria.set(chave, valor);
      await naGaveta("readwrite", (g) => g.put(valor, chave)).catch(() => undefined);
    },
    async apagar(chave) {
      memoria.delete(chave);
      await naGaveta("readwrite", (g) => g.delete(chave)).catch(() => undefined);
    },
  };
}

/** O "Sair rápido": apaga do aparelho tudo dos grupos, de todas as contas (nunca lança, nem espera mais que `limiteMs`). */
export async function apagarParesDeGrupo(limiteMs = 300): Promise<void> {
  try {
    if (typeof indexedDB === "undefined") return;
    await new Promise<void>((pronto) => {
      const relogio = setTimeout(pronto, limiteMs);
      const fim = () => {
        clearTimeout(relogio);
        pronto();
      };
      try {
        const pedido = indexedDB.deleteDatabase(BANCO_DOS_GRUPOS);
        pedido.onsuccess = fim;
        pedido.onerror = fim;
      } catch {
        fim();
      }
    });
  } catch {
    // nunca lança: a pessoa precisa sair já
  }
}
