// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import MiniSearch from "minisearch";

// Busca nas conversas, só neste aparelho. O servidor não consegue procurar no que não lê: o índice é feito aqui, com
// as mensagens que este aparelho já abriu, e fica num banco do navegador (IndexedDB) separado do das chaves.
// O texto aberto fica guardado no aparelho; quem tem o aparelho destravado já lê as conversas de qualquer jeito, e a
// trava com a digital (lib/trava.ts) cobre a tela. Entradas com mais de trinta dias somem, como as mensagens.

export interface Indexada {
  id: string;
  conversa: string;
  conversa_nome: string;
  autor: string;
  texto: string;
  criado_em: string;
}

const BANCO = "lucia-busca";
const LOJA = "mensagens";
const PRAZO = 30 * 24 * 3600 * 1000;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => {
      const loja = pedido.result.createObjectStore(LOJA, { keyPath: "id" });
      loja.createIndex("criado_em", "criado_em");
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

const pedir = <T,>(pedido: IDBRequest<T>) => new Promise<T>((resolve, reject) => { pedido.onsuccess = () => resolve(pedido.result); pedido.onerror = () => reject(pedido.error); });

let indice: MiniSearch<Indexada> | null = null;
const conhecidas = new Set<string>();

function novoIndice() {
  return new MiniSearch<Indexada>({ fields: ["texto", "autor", "conversa_nome"], storeFields: ["id", "conversa", "conversa_nome", "autor", "texto", "criado_em"], processTerm: (termo) => termo.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase() });
}

/** Carrega o índice do aparelho (uma vez), já tirando o que passou de trinta dias. */
export async function carregarIndice(): Promise<MiniSearch<Indexada>> {
  if (indice) return indice;
  const atual = novoIndice();
  try {
    const banco = await abrir();
    const tudo = await pedir(banco.transaction(LOJA, "readwrite").objectStore(LOJA).getAll());
    const limite = Date.now() - PRAZO;
    const velhas = tudo.filter((item: Indexada) => new Date(item.criado_em).getTime() < limite);
    if (velhas.length) {
      const loja = banco.transaction(LOJA, "readwrite").objectStore(LOJA);
      for (const item of velhas) loja.delete(item.id);
    }
    for (const item of tudo as Indexada[]) {
      if (new Date(item.criado_em).getTime() >= limite) { atual.add(item); conhecidas.add(item.id); }
    }
    banco.close();
  } catch {
    // Sem IndexedDB (navegação privada, por exemplo): a busca vale só para o que abrir nesta sessão.
  }
  indice = atual;
  return atual;
}

/** Guarda mensagens abertas neste aparelho. Ignora o que já está lá. */
export async function indexar(itens: Indexada[]) {
  const atual = await carregarIndice();
  const novas = itens.filter((item) => !conhecidas.has(item.id) && item.texto.trim());
  if (novas.length === 0) return;
  for (const item of novas) { atual.add(item); conhecidas.add(item.id); }
  try {
    const banco = await abrir();
    const loja = banco.transaction(LOJA, "readwrite").objectStore(LOJA);
    for (const item of novas) loja.put(item);
    banco.close();
  } catch {
    // fica só em memória
  }
}

/** Tira do índice o que foi apagado. */
export async function desindexar(ids: string[]) {
  const atual = await carregarIndice();
  for (const id of ids) {
    if (!conhecidas.has(id)) continue;
    try { atual.discard(id); } catch { /* já não estava */ }
    conhecidas.delete(id);
  }
  try {
    const banco = await abrir();
    const loja = banco.transaction(LOJA, "readwrite").objectStore(LOJA);
    for (const id of ids) loja.delete(id);
    banco.close();
  } catch { /* sem banco */ }
}

export async function buscar(termo: string, limite = 30): Promise<Indexada[]> {
  const atual = await carregarIndice();
  if (termo.trim().length < 2) return [];
  return atual.search(termo, { prefix: true, fuzzy: 0.15, combineWith: "AND" }).slice(0, limite).map((hit) => hit as unknown as Indexada);
}

/** Apaga o índice inteiro deste aparelho (ao sair da conta ou recomeçar). */
export async function limparIndice() {
  indice = novoIndice();
  conhecidas.clear();
  try { await new Promise<void>((resolve) => { const pedido = indexedDB.deleteDatabase(BANCO); pedido.onsuccess = () => resolve(); pedido.onerror = () => resolve(); pedido.onblocked = () => resolve(); }); } catch { /* nada */ }
}
