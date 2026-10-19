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
      {/* A linha de cima: o nome à esquerda e, à direita, conta, idioma e os atalhos. */}
      <div className="mx-auto flex max-w-7xl items-center gap-x-2 px-3 py-3 app:px-4 app:py-2 sm:gap-x-5 sm:px-4 sm:py-4 md:py-3">
        <AppBack />
        <Link href={localePath(lang, "/")} aria-label={site.name} className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="" width={44} height={44} className="h-9 w-9 shrink-0 sm:h-11 sm:w-11 xl:h-12 xl:w-12" />
          <span className="marca-nome whitespace-nowrap text-lg font-semibold leading-none tracking-tight sm:text-2xl xl:text-3xl">{site.name}</span>
        </Link>
        {/* Se faltar espaço, quem encolhe é o nome do "Olá, Fulano" (com reticências), nunca o nome do instituto nem os ícones. */}
        <div className="ml-auto flex min-w-0 items-center gap-1 app:gap-3 sm:gap-2 lg:gap-4">
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
      {/* O menu numa linha própria, como o índice embaixo do nome do jornal: cabe inteiro em qualquer largura e, se a
          letra estiver grande, quebra em duas linhas em vez de passar por cima da conta. No celular ele fica embaixo (BottomNav). */}
      <nav aria-label={t.nav.main} className="hidden border-t border-rule/70 md:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 py-1.5 font-sans text-sm leading-none text-ink-soft lg:gap-x-7 xl:gap-x-8">
          <NavLinks />
        </div>
      </nav>
    </header>
  );
}
