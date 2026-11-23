// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A "casca" do chat (onda R3, item 1.2): o que muda entre o site, o app de Android e o app de computador, atrás de UMA interface.
// O protocolo do chat (lib/rede/chat/**) é o mesmo nos três; só o que é do aparelho passa por aqui: o cofre de hardware
// (Keystore/StrongBox no Android, o chaveiro do sistema no computador), o fetch nativo (sem `Origin`), a notificação sem conteúdo,
// o apagar tudo, a trava ao ir para o fundo, a conferência das atualizações no livro público e a rede social aberta FORA da casca.
//
// Quem escolhe a casca é a página que inicia o app (casca/app/**): no Android ela monta a de lib/rede/casca/android.ts com os
// plugins nativos e chama `definirCasca`. Ninguém mais escreve aqui. Sem `definirCasca`, vale a do site, que não promete o que não
// tem: no navegador NÃO há cofre de hardware (o `embrulhar` devolve os mesmos bytes; o que protege a loja do chat no site continua
// sendo a chave do navegador não exportável, como na R2), nem atualização para conferir.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r3-android-casca.mjs). Sem import do Capacitor: o site não o leva.

export type Plataforma = "site" | "android" | "computador";

/** O que cada app oferece ao chat. Bytes entram e saem como Uint8Array; o transporte até o nativo é da implementação. */
export interface Casca {
  plataforma: Plataforma;
  /** Embrulha com a chave do cofre do aparelho (não exportável). `finalidade` entra como dado associado: o embrulho de uma não abre como outra. */
  embrulhar(finalidade: string, dados: Uint8Array): Promise<Uint8Array>;
  /** Desembrulha; nulo se o embrulho foi mexido, é de outra finalidade ou de outro aparelho (ou a chave do cofre sumiu). */
  desembrulhar(finalidade: string, embrulhado: Uint8Array): Promise<Uint8Array | null>;
  /** O fetch nativo (sem `Origin`, cabeçalhos fixos). Ausente no site. */
  fetchNativo?: typeof fetch;
  /** "Nova mensagem", sem remetente nem trecho, e escondida na tela bloqueada. */
  notificar(): Promise<void>;
  /** Apaga TUDO deste app neste aparelho (dados, lojas, chaves do cofre). No Android o processo morre logo depois. */
  apagarTudo(): Promise<void>;
  /** Chama `f` quando o app vai para o fundo (trava automática). Devolve a função que desliga. */
  aoIrParaOFundo(f: () => void): () => void;
  /** O binário instalado está no livro público (Rekor)? */
  conferirAtualizacao(versao: string): Promise<"no_log" | "fora_do_log" | "sem_rede">;
  /** Abre a rede social FORA da casca do chat (no Android, numa tela sem ponte nenhuma com o nativo, em outro processo). */
  abrirRede(caminho: string): Promise<void>;
}

/**
 * As páginas do CHAT do site (com ou sem o idioma na frente): a conversa, os aparelhos e o painel (o chat da equipe). Nos apps o chat
 * mora na casca, com o cofre e a trava; abri-las pela rede social (fora da casca, sem trava e com a loja fora do cofre) não pode
 * (auditoria interna da R3). O mesmo teste está no nativo (AlumiaApp.caminhoValido, Android).
 */
const PAGINA_DO_CHAT = /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?(?:alumia\/(?:conversas|aparelhos)|painel)(?:[/?#]|$)/i;

/** O caminho da rede social só pode ser um caminho deste site: começa com uma barra e não vira endereço de outro lugar; nunca o chat. */
export function caminhoDaRede(caminho: string): string | null {
  if (typeof caminho !== "string" || caminho.length > 512) return null;
  if (!/^\/(?![/\\])[A-Za-z0-9\-._~%/?=&#]*$/.test(caminho)) return null;
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(caminho.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  // Conferido já decodificado (um "%63onversas" não passa) e sem "." nem "..", que o navegador resolveria para outra página.
  if (/(^|\/)\.{1,2}(\/|$)|\/\/|\\/.test(decodificado) || PAGINA_DO_CHAT.test(decodificado)) return null;
  return caminho;
}

/** A casca do site: sem cofre de hardware, sem atualização para conferir, a rede social na mesma aba. */
export const cascaDoSite: Casca = {
  plataforma: "site",
  embrulhar: async (_finalidade, dados) => dados.slice(),
  desembrulhar: async (_finalidade, embrulhado) => embrulhado.slice(),
  notificar: async () => undefined,
  apagarTudo: async () => undefined,
  aoIrParaOFundo(f) {
    if (typeof document === "undefined") return () => undefined;
    const ouvir = () => {
      if (document.visibilityState === "hidden") f();
    };
    document.addEventListener("visibilitychange", ouvir);
    return () => document.removeEventListener("visibilitychange", ouvir);
  },
  conferirAtualizacao: async () => {
    throw Object.assign(new Error("so_no_app"), { code: "so_no_app" });
  },
  abrirRede: async (caminho) => {
    const certo = caminhoDaRede(caminho);
    if (certo && typeof location !== "undefined") location.assign(certo);
  },
};

let atual: Casca = cascaDoSite;

/** Troca a casca (só a página que inicia o app, e os testes). */
export function definirCasca(c: Casca): void {
  atual = c;
}

/** A casca em uso ("site" quando não há app). */
export function casca(): Casca {
  return atual;
}
