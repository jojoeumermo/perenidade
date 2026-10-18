// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { site } from "@/lib/site";
import { AccountLink, AppBack, LanguageSwitcher, NavLinks, NewsLink, PodcastLink, RadioLink } from "./NavLinks";
import { Strip } from "./Strip";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ lang, t }: { lang: Locale; t: Dict }) {
  // No celular a barra é a faixa bordô do instituto; só o idioma sai dela (está em "Mais"). Notícias e rádio
  // ficam sempre à mão, também no aplicativo, onde a barra é curta, fica presa no topo e perde a faixa de avisos.
  return (
    <header className="app-barra barra-celular no-print no-focus border-b border-rule app:sticky app:top-0 app:z-30 app:bg-parchment app:pt-[env(safe-area-inset-top,0px)]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-ink focus:px-3 focus:py-2 focus:font-sans focus:text-sm focus:text-parchment"
      >
        {t.common.skip}
      </a>
      <div className="app:hidden">
        <Strip fallback={t.common.strip} />
      </div>
      {/* Três colunas: o nome à esquerda, o menu no centro da página (alinhado com a faixa de cima) e, à direita, conta, idioma e tema. */}
      <div className="mx-auto flex max-w-7xl items-center gap-x-2 px-3 py-3 app:px-4 app:py-2 sm:gap-x-5 md:gap-x-3 sm:px-4 sm:py-4 lg:grid lg:gap-x-6 lg:grid-cols-[auto_1fr_auto]">
        <AppBack />
        <Link href={localePath(lang, "/")} aria-label={site.name} className="flex shrink-0 items-center gap-2 sm:gap-3 lg:justify-self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="" width={44} height={44} className="h-9 w-9 shrink-0 sm:h-11 sm:w-11 xl:h-12 xl:w-12" />
          <span className="marca-nome whitespace-nowrap text-lg font-semibold leading-none tracking-tight sm:text-2xl md:text-xl lg:text-2xl xl:text-3xl">{site.name}</span>
        </Link>
        {/* No celular o menu fica embaixo (BottomNav); aqui ele aparece a partir de telas médias, sempre em uma linha. */}
        <nav aria-label={t.nav.main} className="mr-auto hidden translate-y-[3px] items-center justify-center gap-x-2.5 font-sans text-sm leading-none text-ink-soft md:flex lg:mr-0 lg:justify-self-center lg:gap-x-2.5 lg:text-[0.8125rem] xl:gap-x-3.5 2xl:gap-x-5 2xl:text-sm">
          <NavLinks />
        </nav>
        {/* Se faltar espaço, quem encolhe é o nome do "Olá, Fulano" (com reticências), nunca o nome do instituto nem os ícones. */}
        <div className="ml-auto flex min-w-0 items-center gap-1 app:gap-3 sm:gap-2 md:ml-0 lg:gap-4 lg:justify-self-end">
          <AccountLink />
          <span className="contents max-lg:hidden">
            <LanguageSwitcher />
          </span>
          <NewsLink />
          <PodcastLink />
          <RadioLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
