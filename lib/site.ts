// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

export const site = {
  name: "Instituto Lúcia",
  // Endereço público do site. Em outro domínio (cópia, espelho), defina NEXT_PUBLIC_SITE_URL.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === "production" ? "https://institutolucia.org" : "http://localhost:3000")).replace(/\/$/, ""),
  /** Campanha de financiamento coletivo que ajuda a pagar servidor e domínio. */
  support: "https://benfeitoria.com/projeto/instituto-lucia-28cx",
  /** Perfil do instituto no Instagram: aparece no rodapé e na página "Mais". */
  instagram: "https://www.instagram.com/institutoluciaorg/",
  instagramUser: "institutoluciaorg",
  /** Endereço de contato do instituto: é para lá que vão os pedidos sobre o boletim do jornal. */
  newsletter: "institutolucia@tutamail.com",
  /**
   * O histórico público de mudanças. Vazio: a página não existe e nada aparece na página inicial.
   * Com uma data (AAAA-MM-DD), a página volta ao ar e mostra só o que mudou daquele dia em diante.
   */
  historyFrom: "2026-10-11" as string,
  /**
   * Robôs de IA no robots.txt:
   * - "bloquear-treino" (padrão): os buscadores com IA que citam e linkam a fonte (ChatGPT Search, Perplexity…) entram;
   *   os que só coletam texto para treinar modelos ficam de fora.
   * - "permitir-todos": nenhum bloqueio além das áreas privadas.
   * - "bloquear-todos": nenhum robô de IA, nem os de busca.
   */
  robosDeIA: "bloquear-treino" as "bloquear-treino" | "permitir-todos" | "bloquear-todos",
} as const;
