// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.

export const site = {
  name: "Instituto Lúcia",
  // Endereço público do site. Em outro domínio (cópia, espelho), defina NEXT_PUBLIC_SITE_URL.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === "production" ? "https://institutolucia.org" : "http://localhost:3000")).replace(/\/$/, ""),
  /** Campanha de financiamento coletivo que ajuda a pagar servidor e domínio. */
  support: "https://benfeitoria.com/projeto/instituto-lucia-28cx",
} as const;
