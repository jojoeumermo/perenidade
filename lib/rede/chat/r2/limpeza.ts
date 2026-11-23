// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Zerar o chat do beta NESTE aparelho (onda R2). Na primeira abertura do site novo, antes de o chat novo guardar qualquer coisa,
// apaga TODAS as lojas do chat velho: o banco do chat a dois ("lucia-alumia-chat"), o histórico ("lucia-alumia-historico", que
// guardava as conversas do beta; o chat novo recomeça nele vazio), as lojas da biblioteca do Matrix ("lucia-alumia-olm-*" e
// "lucia-equipe-olm-*", com as chaves Olm/Megolm) e os grupos ("lucia-alumia-grupos"). O selo da equipe ("lucia-sigilo", a
// identidade de quem é da equipe) fica: é da frente da equipe. Depois marca, na loja nova, que já limpou, e mostra uma vez: "As
// conversas do beta foram apagadas em DD/MM/2026, como avisado."
//
// Nunca lança: falhar aqui não pode impedir a pessoa de usar o resto do site; na próxima abertura tenta de novo.
import { BANCO_R2, gravarMarca } from "./loja";

const MARCA = "limpeza-do-beta";
const LOJAS_DO_BETA = ["lucia-alumia-chat", "lucia-alumia-historico", "lucia-alumia-grupos"];
const PREFIXOS_DO_BETA = ["lucia-alumia-olm-", "lucia-equipe-olm-"];

function apagarBanco(nome: string): Promise<void> {
  return new Promise((ok) => {
    try {
      const pedido = indexedDB.deleteDatabase(nome);
      pedido.onsuccess = () => ok();
      pedido.onerror = () => ok();
      // Outra aba com o banco aberto: o pedido continua valendo e o banco some quando ela soltar.
      pedido.onblocked = () => ok();
    } catch {
      ok();
    }
  });
}

async function jaLimpou(): Promise<boolean> {
  return new Promise((ok) => {
    try {
      const pedido = indexedDB.open(BANCO_R2);
      pedido.onupgradeneeded = () => {
        // A loja nova ainda não existia: nada foi limpo. Não cria nada aqui (quem cria é lib/rede/chat/r2/loja.ts).
        pedido.transaction?.abort();
      };
      pedido.onsuccess = () => {
        const db = pedido.result;
        if (!db.objectStoreNames.contains("chaves")) {
          db.close();
          return ok(false);
        }
        const g = db.transaction("chaves", "readonly").objectStore("chaves").get(MARCA);
        g.onsuccess = () => {
          db.close();
          ok(g.result === true);
        };
        g.onerror = () => {
          db.close();
          ok(false);
        };
      };
      pedido.onerror = () => ok(false);
    } catch {
      ok(false);
    }
  });
}


/**
 * Apaga as lojas do chat do beta (uma vez por aparelho). Devolve true se apagou agora (a tela mostra o aviso de depois, uma vez).
 */
export async function limparChatAntigo(): Promise<boolean> {
  try {
    if (typeof indexedDB === "undefined" || (await jaLimpou())) return false;
    const nomes = new Set(LOJAS_DO_BETA);
    try {
      for (const b of (await indexedDB.databases?.()) ?? []) if (b.name && PREFIXOS_DO_BETA.some((p) => b.name?.startsWith(p))) nomes.add(b.name);
    } catch {
      // navegador sem a lista: ficam as conhecidas
    }
    await Promise.all([...nomes].map(apagarBanco));
    try {
      for (const k of Object.keys(localStorage)) if (/^(lucia-alumia-chat|alumia-dm-|lucia-dm-)/.test(k)) localStorage.removeItem(k);
    } catch {
      // sem localStorage
    }
    await gravarMarca(MARCA);
    return true;
  } catch {
    return false;
  }
}
