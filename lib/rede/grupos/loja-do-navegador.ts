// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que os grupos MLS guardam no NAVEGADOR (os da rede, lib/rede/grupos/navegador.ts, e o chat da equipe, lib/chaveiro.ts):
//   - a loja do motor: o core-crypto guarda o estado MLS e a chave de assinatura de cada folha no OPFS ("core-crypto/<lugar>"),
//     cifrada por ele com uma chave de 32 bytes (DatabaseKey);
//   - os segredos de cada época (para reler o que já se podia ler), num IndexedDB próprio ("lucia-alumia-grupos"), CIFRADOS com
//     AES-GCM (WebCrypto, vetor sorteado a cada gravação, o nome da entrada amarrado como dado associado);
//   - a chave da loja do motor (sorteada) e as chaves que cifram as entradas: CryptoKey AES-GCM NÃO exportáveis, guardadas como
//     objeto pelo navegador (a chave não sai dele).
// Isso protege contra quem copia os arquivos do OPFS ou do IndexedDB sozinhos, não contra quem usa o próprio navegador desbloqueado:
// é a "proteção contra leitura casual" (docs/rede/CHAT-PRIVADO.md). Quando a frente dos cofres entregar a chave do motor aberta pela senha do
// chat (lib/rede/aparelhos/identidade.ts, `chaveDoMotor`), `abrirLojaDoMotor` passa a usá-la. O "Sair rápido" apaga tudo
// (lib/rede/grupos/apagar.ts). A loja do motor não abre em duas abas ao mesmo tempo (o core-crypto tranca o arquivo): a segunda
// aba recebe "motor_ocupado".
import type { CoreCrypto } from "@wireapp/core-crypto";
import { carregarMotor } from "../cifra/motor";
import type { Motor } from "./aparelho";
import { BANCO_DOS_GRUPOS, DIRETORIO_DO_MOTOR } from "./apagar";
import type { GuardaDoGrupo } from "./motor-de-grupo";

const GAVETA = "grupos";
const CHAVES = "chaves";
const encoder = new TextEncoder();

function abrirBancoDosGrupos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO_DOS_GRUPOS, 4);
    pedido.onupgradeneeded = () => {
      // As versões 1 e 2 guardavam a cifra antiga (feita à mão, depois a ts-mls); a 3, os segredos de época sem cifra: saem
      // inteiras na troca de 11/2026.
      for (const nome of [...pedido.result.objectStoreNames]) pedido.result.deleteObjectStore(nome);
      pedido.result.createObjectStore(GAVETA);
      pedido.result.createObjectStore(CHAVES);
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function naGaveta<T>(gaveta: string, modo: IDBTransactionMode, agir: (g: IDBObjectStore) => IDBRequest): Promise<T> {
  const banco = await abrirBancoDosGrupos();
  try {
    return await new Promise<T>((resolve, reject) => {
      const pedido = agir(banco.transaction(gaveta, modo).objectStore(gaveta));
      pedido.onsuccess = () => resolve(pedido.result as T);
      pedido.onerror = () => reject(pedido.error);
    });
  } finally {
    banco.close();
  }
}

/** Uma chave AES-GCM não exportável deste navegador, pelo nome (criada na primeira vez). */
async function chaveDoNavegador(nome: string): Promise<CryptoKey> {
  const guardada = await naGaveta<CryptoKey | undefined>(CHAVES, "readonly", (g) => g.get(`k:${nome}`));
  if (guardada) return guardada;
  const nova = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await naGaveta(CHAVES, "readwrite", (g) => g.put(nova, `k:${nome}`));
  return nova;
}

async function selarNoNavegador(chave: CryptoKey, nome: string, dados: Uint8Array): Promise<{ iv: Uint8Array; cifrado: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, cifrado: await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(nome) }, chave, dados as Uint8Array<ArrayBuffer>) };
}
async function abrirNoNavegador(chave: CryptoKey, nome: string, selado: { iv: Uint8Array; cifrado: ArrayBuffer }): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: selado.iv as Uint8Array<ArrayBuffer>, additionalData: encoder.encode(nome) }, chave, selado.cifrado));
  } catch {
    return null;
  }
}

/**
 * A guarda no navegador, com as entradas cifradas e o nome de cada uma começando por `prefixo` (uma conta ou um aparelho não lê a
 * entrada de outro). Sem IndexedDB (alguns modos privados), tudo vive só na memória da aba.
 */
export function guardaNoNavegador(prefixo: string): GuardaDoGrupo {
  const memoria = new Map<string, unknown>();
  const nome = (chave: string) => `${prefixo}${chave}`;
  return {
    async ler<T>(chave: string) {
      try {
        const selado = await naGaveta<{ iv: Uint8Array; cifrado: ArrayBuffer } | undefined>(GAVETA, "readonly", (g) => g.get(nome(chave)));
        if (!selado) return (memoria.get(chave) as T | undefined) ?? null;
        const aberto = await abrirNoNavegador(await chaveDoNavegador("guarda"), nome(chave), selado);
        return aberto ? (JSON.parse(new TextDecoder().decode(aberto)) as T) : null;
      } catch {
        return (memoria.get(chave) as T | undefined) ?? null;
      }
    },
    async guardar(chave, valor) {
      memoria.set(chave, valor);
      try {
        const selado = await selarNoNavegador(await chaveDoNavegador("guarda"), nome(chave), encoder.encode(JSON.stringify(valor)));
        await naGaveta(GAVETA, "readwrite", (g) => g.put(selado, nome(chave)));
      } catch {
        // fica só na memória
      }
    },
    async apagar(chave) {
      memoria.delete(chave);
      await naGaveta(GAVETA, "readwrite", (g) => g.delete(nome(chave))).catch(() => undefined);
    },
  };
}

/** A chave (32 bytes) da loja do motor em `lugar`: sorteada na primeira vez e guardada cifrada pela chave do navegador. */
async function chaveDaLoja(lugar: string): Promise<Uint8Array> {
  const embrulho = await chaveDoNavegador("loja");
  const guardada = await naGaveta<{ iv: Uint8Array; cifrado: ArrayBuffer } | undefined>(CHAVES, "readonly", (g) => g.get(`loja:${lugar}`));
  if (guardada) {
    const aberta = await abrirNoNavegador(embrulho, `loja:${lugar}`, guardada);
    if (aberta) return aberta;
  }
  const chave = crypto.getRandomValues(new Uint8Array(32));
  const selada = await selarNoNavegador(embrulho, `loja:${lugar}`, chave);
  await naGaveta(CHAVES, "readwrite", (g) => g.put(selada, `loja:${lugar}`));
  return chave;
}

/** Apaga a loja do motor em `lugar` (o diretório dela no OPFS). Nunca lança. */
async function apagarLoja(lugar: string): Promise<void> {
  try {
    const raiz = await navigator.storage.getDirectory();
    const dir = await raiz.getDirectoryHandle(DIRETORIO_DO_MOTOR);
    await dir.removeEntry(lugar, { recursive: true });
  } catch {
    // não havia
  }
}

/**
 * Abre a loja do motor em `lugar` (no OPFS). Sem OPFS ou sem IndexedDB, a loja vive só na memória da aba. Loja que não abre com a
 * chave guardada (a chave foi apagada pelo "Sair rápido" e o OPFS ficou): é apagada e começa de novo, como aparelho novo (os
 * colegas trocam a folha).
 */
export async function abrirLojaDoMotor(lugar: string): Promise<{ M: Motor; cc: CoreCrypto }> {
  const M = await carregarMotor();
  let chave: Uint8Array;
  try {
    chave = await chaveDaLoja(lugar);
  } catch {
    return { M, cc: M.CoreCrypto.new(M.Database.inMemory()) };
  }
  try {
    for (let vez = 0; vez < 2; vez++) {
      try {
        return { M, cc: M.CoreCrypto.new(await M.Database.open(lugar, new M.DatabaseKey(chave.slice()))) };
      } catch (e) {
        if (/locked/i.test(String((e as { inner?: { msg?: unknown } })?.inner?.msg ?? ""))) throw Object.assign(new Error("motor_ocupado"), { code: "motor_ocupado" });
        if (vez === 1) throw e;
        await apagarLoja(lugar);
      }
    }
    throw new Error("motor_falhou");
  } finally {
    chave.fill(0);
  }
}
