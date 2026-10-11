// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { site } from "@/lib/site";
import { AccountLink, LanguageSwitcher, NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ lang, t }: { lang: Locale; t: Dict }) {
  return (
    <header className="no-print no-focus border-b border-rule">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-ink focus:px-3 focus:py-2 focus:font-sans focus:text-sm focus:text-parchment"
      >
        {t.common.skip}
      </a>
      <div className="bg-ink px-4 py-1.5 text-center font-mono text-xs tracking-wide text-parchment">{t.common.strip}</div>
      {/* Tudo em uma linha: nome, seções do site e, à direita, conta, idioma e tema. Em telas estreitas, quebra. */}
      <div className="mx-auto flex max-w-7xl items-center gap-x-5 px-4 py-4">
        <Link href={localePath(lang, "/")} className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/emblema-96.png" alt="" width={44} height={44} className="h-11 w-11" />
          <span className="text-2xl font-semibold leading-none tracking-tight sm:text-3xl">{site.name}</span>
        </Link>
        {/* No celular o menu fica embaixo (BottomNav); aqui ele aparece a partir de telas médias, sempre em uma linha. */}
        <nav aria-label={t.nav.main} className="mr-auto hidden items-center gap-x-4 font-sans text-sm leading-none text-ink-soft md:flex">
          <NavLinks />
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
          <AccountLink />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
