// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.

export const site = {
  name: "Instituto Lúcia",
  // Defina NEXT_PUBLIC_SITE_URL no deploy para sitemap e metadados apontarem para o domínio certo.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Campanha de financiamento coletivo que ajuda a pagar servidor e domínio. */
  support: "https://benfeitoria.com/projeto/instituto-lucia-28cx",
} as const;
