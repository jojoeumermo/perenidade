// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Modo seguro (Etapa 4, R1-94): para quem estuda num aparelho dividido ou vigiado. Ligado, aparece um botão "Sair"
// fixo e a tecla Esc apertada 3 vezes em 1 segundo também sai. A saída apaga deste aparelho o que o site guardou
// (estudo, preferências, páginas guardadas para ler sem internet) e troca a página por uma página neutra de fora.
// A marca fica no sessionStorage: some sozinha quando a aba fecha. Fica SEMPRE disponível, com ou sem a Escola ligada.
//
// O que não dá para fazer daqui, e a página /modo-seguro diz com todas as letras: apagar o histórico do navegador
// (só a janela anônima evita), nem o que a rede ou um programa espião no aparelho já viu.
// As funções de conta são puras e o teste (`npm run testar:busca-viva`) roda no Node; sairRapido() só no navegador.

export const CHAVE_SEGURO = "lucia-seguro";
/** Uma página comum, de fora, sem nada da pessoa no endereço. */
export const DESTINO_NEUTRO = "https://www.google.com/search?q=previs%C3%A3o+do+tempo";
/** Os caches das vozes naturais: arquivos de modelo de voz, iguais para todo mundo, que não revelam nada. */
const DE_VOZ = /^lucia-voz/;
/** As bases conhecidas, para os navegadores que não sabem listar as bases (indexedDB.databases). */
export const BASES_CONHECIDAS = ["lucia-busca", "lucia-sigilo", "lucia-explicacoes", "lucia-alumia-chat"];

type Sessao = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const sessao = (): Sessao | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

/** O modo seguro está ligado nesta aba? (o histórico local, o passaporte e as conversas consultam isto antes de gravar) */
export function estaLigado(armazenamento: Sessao | null = sessao()): boolean {
  try {
    return armazenamento?.getItem(CHAVE_SEGURO) === "1";
  } catch {
    return false;
  }
}

const avisar = () => {
  try {
    globalThis.dispatchEvent?.(new Event("lucia:modo-seguro"));
  } catch {
    // fora do navegador
  }
};

export function ligarModoSeguro(armazenamento: Sessao | null = sessao()) {
  try {
    armazenamento?.setItem(CHAVE_SEGURO, "1");
  } catch {
    // sem sessionStorage: o modo não liga (o botão da página avisa)
  }
  avisar();
}

export function desligarModoSeguro(armazenamento: Sessao | null = sessao()) {
  try {
    armazenamento?.removeItem(CHAVE_SEGURO);
  } catch {
    // nada a desligar
  }
  avisar();
}

/** As chaves que a saída apaga: toda chave que começa com "lucia" (as do site). As de outros sites nem existem aqui. */
export function chavesParaApagar(armazenamento: Pick<Storage, "length" | "key">): string[] {
  const chaves: string[] = [];
  for (let i = 0; i < armazenamento.length; i++) {
    const chave = armazenamento.key(i);
    if (chave && chave.startsWith("lucia")) chaves.push(chave);
  }
  return chaves;
}

/** As bases do IndexedDB que saem: as "lucia-*" que não são de voz. */
export function basesParaApagar(nomes: readonly string[]): string[] {
  return [...new Set(nomes)].filter((nome) => nome.startsWith("lucia-") && !DE_VOZ.test(nome));
}

/** Os caches que saem: os do site (páginas guardadas para ler sem internet e arquivos), menos os modelos de voz. */
export function cachesParaApagar(nomes: readonly string[]): string[] {
  return nomes.filter((nome) => nome.startsWith("lucia-") && !DE_VOZ.test(nome));
}

/** Apaga as chaves "lucia*" de um armazenamento. Devolve quantas saíram. */
export function apagarChaves(armazenamento: Pick<Storage, "length" | "key" | "removeItem">): number {
  const chaves = chavesParaApagar(armazenamento);
  for (const chave of chaves) {
    try {
      armazenamento.removeItem(chave);
    } catch {
      // segue com as outras
    }
  }
  return chaves.length;
}

async function apagarBases() {
  const idb = globalThis.indexedDB;
  if (!idb) return;
  let nomes = [...BASES_CONHECIDAS];
  try {
    const lista = await idb.databases?.();
    if (lista) nomes = [...nomes, ...lista.map((b) => b.name ?? "")];
  } catch {
    // navegador sem a lista: ficam as conhecidas
  }
  await Promise.all(
    basesParaApagar(nomes).map(
      (nome) =>
        new Promise<void>((resolve) => {
          try {
            const pedido = idb.deleteDatabase(nome);
            pedido.onsuccess = pedido.onerror = pedido.onblocked = () => resolve();
          } catch {
            resolve();
          }
        }),
    ),
  );
}

/**
 * Encerra a sessão da conta no servidor, não só no aparelho: quem copiou o token de renovação antes (ou quem pegar o
 * aparelho e restaurar uma cópia do armazenamento) não consegue mais usá-lo. Lê o token de acesso guardado e chama a
 * saída do Supabase só para esta sessão, com keepalive, para o pedido sair mesmo com a troca de página logo depois.
 * Precisa rodar ANTES de apagar as chaves (é delas que sai o token). Nunca lança. O "Sair rápido" da Alumia usa a mesma
 * função (lib/rede/saida.ts). Devolve se o pedido foi feito.
 */
export function revogarSessao(armazenamento?: Pick<Storage, "getItem"> | null): boolean {
  try {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
    const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const guardada = (armazenamento ?? globalThis.localStorage)?.getItem("lucia:sessao");
    const token = guardada ? (JSON.parse(guardada) as { access_token?: unknown }).access_token : null;
    if (!url || !chave || typeof token !== "string") return false;
    void fetch(`${url}/auth/v1/logout?scope=local`, { method: "POST", keepalive: true, headers: { apikey: chave, Authorization: `Bearer ${token}` } }).catch(() => {});
    return true;
  } catch {
    // sem sessão guardada ou sem rede: a sessão local sai do mesmo jeito
    return false;
  }
}

/** Quanto a saída espera pela limpeza do chat antes de seguir para as bases. */
export const TETO_DO_CHAT_MS = 350;

/** A limpeza do chat privado da Alumia (importada só na hora da saída: o resto do site não carrega nada do chat). Nunca lança. */
export async function limparOChat(carregar: () => Promise<{ apagarTudoDoChat: (limiteMs?: number) => Promise<void> }> = () => import("./rede/chat/gaveta")): Promise<void> {
  try {
    await (await carregar()).apagarTudoDoChat(300);
  } catch {
    // sem o módulo (ou sem IndexedDB): as bases são apagadas logo depois do mesmo jeito
  }
}

async function apagarCaches() {
  try {
    const armazem = globalThis.caches;
    if (!armazem) return;
    const nomes = await armazem.keys();
    await Promise.all(cachesParaApagar(nomes).map((nome) => armazem.delete(nome)));
  } catch {
    // sem Cache Storage
  }
}

/**
 * A saída rápida: esconde a página na hora, apaga o que o site guardou neste aparelho e troca a página por uma de fora,
 * sem mandar de onde veio (nem a origem). A troca usa location.replace: o "Voltar" não volta para esta página.
 * Espera no máximo 700 ms pelas bases e pelos caches; o que ficar pela metade o navegador termina sozinho.
 */
export async function sairRapido(destino = DESTINO_NEUTRO) {
  if (typeof document === "undefined") return;
  try {
    document.documentElement.style.visibility = "hidden";
    document.title = "";
  } catch {
    // segue
  }
  revogarSessao();
  try {
    if (globalThis.localStorage) apagarChaves(localStorage);
  } catch {
    // bloqueado
  }
  try {
    if (globalThis.sessionStorage) apagarChaves(sessionStorage);
  } catch {
    // bloqueado
  }
  // O chat privado da Alumia antes das bases: liga a trava do chat nesta aba e avisa as outras, que apagam a memória delas
  // (chaves de conversa, mensagens abertas) na hora, e não só quando notarem que o banco sumiu (lib/rede/chat/gaveta.ts).
  // A limpeza do chat tem teto próprio (350 ms, contando baixar o módulo): passou disso, as bases são apagadas do mesmo jeito.
  // Tudo dentro do teto de 700 ms da saída: o que ficar pela metade o navegador termina sozinho.
  const bases = Promise.race([limparOChat(), new Promise((resolve) => setTimeout(resolve, TETO_DO_CHAT_MS))]).then(apagarBases);
  await Promise.race([Promise.all([bases, apagarCaches()]), new Promise((resolve) => setTimeout(resolve, 700))]);
  try {
    document.querySelectorAll('meta[name="referrer"]').forEach((m) => m.remove());
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);
  } catch {
    // segue
  }
  location.replace(destino);
}

/** Esc três vezes em até 1 segundo? Recebe os instantes das últimas teclas e devolve a lista atualizada e a resposta. */
export function tresEsc(instantes: readonly number[], agora: number): { instantes: number[]; sair: boolean } {
  const recentes = [...instantes, agora].filter((t) => agora - t <= 1000).slice(-3);
  return { instantes: recentes, sair: recentes.length >= 3 };
}
