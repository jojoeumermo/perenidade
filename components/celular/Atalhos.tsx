// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { L, useI18n } from "../I18n";

type Chave = "radio" | "podcasts" | "journal" | "news" | "glossary" | "labs" | "questionBank" | "live" | "health";

/** As seções que se abrem todo dia, cada uma com a sua cor da paleta dos panos e o seu desenho em traço. */
export const ATALHOS: Record<Chave, { path: string; fundo: string; tinta: string; desenho: React.ReactNode }> = {
  radio: {
    path: "/radio",
    fundo: "#c21f16",
    tinta: "#fff",
    desenho: (
      <>
        <rect x="3" y="8" width="18" height="12" rx="1.5" />
        <path d="M7 8l9-4" />
        <circle cx="15.5" cy="14" r="2.5" />
        <path d="M6.5 12.5h4M6.5 15.5h4" />
      </>
    ),
  },
  podcasts: {
    path: "/podcasts",
    fundo: "#23408e",
    tinta: "#fff",
    desenho: (
      <>
        <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
        <rect x="3" y="14" width="4.5" height="6.5" rx="1.2" />
        <rect x="16.5" y="14" width="4.5" height="6.5" rx="1.2" />
      </>
    ),
  },
  journal: {
    path: "/jornal",
    // Tinta no papel e papel na noite: o ladrilho do jornal não some no tema escuro.
    fundo: "var(--ink)",
    tinta: "var(--parchment)",
    desenho: (
      <>
        <path d="M4 5h13v14H6a2 2 0 0 1-2-2z" />
        <path d="M17 9h3v8a2 2 0 0 1-2 2" />
        <path d="M7.5 9h6M7.5 12.5h6M7.5 16h3.5" />
      </>
    ),
  },
  news: {
    path: "/noticias",
    fundo: "#ea7a24",
    tinta: "#1f1a14",
    desenho: (
      <>
        <path d="M4 10v4h3l6 4V6L7 10z" />
        <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
      </>
    ),
  },
  glossary: {
    path: "/glossario",
    fundo: "#2e6b4f",
    tinta: "#fff",
    desenho: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
        <path d="M5 17a3 3 0 0 1 3-3h11" />
        <path d="M9 8h6" />
      </>
    ),
  },
  labs: {
    path: "/laboratorios",
    fundo: "#1f8a85",
    tinta: "#fff",
    desenho: (
      <>
        <path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
        <path d="M7.5 15h9" />
      </>
    ),
  },
  questionBank: {
    path: "/questoes",
    fundo: "#f0b323",
    tinta: "#1f1a14",
    desenho: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 12l3 3 5-6" />
      </>
    ),
  },
  live: {
    path: "/ao-vivo",
    fundo: "#e4577f",
    tinta: "#1f1a14",
    desenho: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="M16 10l5-3v10l-5-3" />
      </>
    ),
  },
  health: {
    path: "/saude",
    fundo: "#e4577f",
    tinta: "#1f1a14",
    desenho: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  },
};

/** Uma fileira de ladrilhos coloridos (quatro por linha), como a tela inicial de um aparelho. */
export function Ladrilhos({ chaves, rotulo, aoAbrir }: { chaves: Chave[]; rotulo: string; aoAbrir?: (path: string) => void }) {
  const { t } = useI18n();
  return (
    <nav aria-label={rotulo} className="grid grid-cols-4 gap-x-1.5 gap-y-4">
      {chaves.map((chave) => {
        const atalho = ATALHOS[chave];
        return (
          <L key={chave} href={atalho.path} className="ladrilho-de-app" onClick={() => aoAbrir?.(atalho.path)}>
            <span style={{ background: atalho.fundo, color: atalho.tinta }}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {atalho.desenho}
              </svg>
            </span>
            <span className="line-clamp-2">{t.nav[chave]}</span>
          </L>
        );
      })}
    </nav>
  );
}
