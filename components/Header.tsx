// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { site } from "@/lib/site";
import { AccountLink, AppBack, LanguageSwitcher, NavLinks, NewsLink, PodcastLink, RadioLink } from "./NavLinks";
import { Strip } from "./Strip";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ lang, t }: { lang: Locale; t: Dict }) {
  // No celular a barra é a faixa bordô do instituto; o idioma e as notícias saem dela (estão em "Mais").
  // No aplicativo ela é curta e fica presa no topo, e a faixa de avisos também sai.
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
      <div className="mx-auto flex max-w-7xl items-center gap-x-2 px-3 py-3 app:px-4 app:py-2 sm:gap-x-5 sm:px-4 sm:py-4 lg:grid lg:gap-x-6 lg:grid-cols-[auto_1fr_auto]">
        <AppBack />
        <Link href={localePath(lang, "/")} className="flex min-w-0 items-center gap-2 sm:shrink-0 sm:gap-3 lg:justify-self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="" width={44} height={44} className="h-9 w-9 shrink-0 sm:h-11 sm:w-11 lg:h-12 lg:w-12" />
          <span className="whitespace-nowrap text-lg font-semibold leading-none tracking-tight sm:text-2xl lg:text-3xl">{site.name}</span>
        </Link>
        {/* No celular o menu fica embaixo (BottomNav); aqui ele aparece a partir de telas médias, sempre em uma linha. */}
        <nav aria-label={t.nav.main} className="mr-auto hidden translate-y-[3px] items-center justify-center gap-x-3 font-sans text-sm leading-none text-ink-soft md:flex lg:mr-0 lg:justify-self-center lg:gap-x-4 xl:gap-x-5">
          <NavLinks />
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 app:gap-3 sm:gap-2 md:ml-0 lg:gap-4 lg:justify-self-end">
          <AccountLink />
          <span className="contents max-lg:hidden">
            <LanguageSwitcher />
            <NewsLink />
          </span>
          <PodcastLink />
          <RadioLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
