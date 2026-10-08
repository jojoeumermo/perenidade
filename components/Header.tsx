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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5">
        <Link href={localePath(lang, "/")} className="flex items-baseline gap-3">
          <span aria-hidden className="text-3xl text-gold">◈</span>
          <span className="text-3xl font-semibold tracking-tight">{site.name}</span>
        </Link>
        <nav aria-label={t.nav.main} className="mr-auto flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-sm text-ink-soft">
          <NavLinks />
        </nav>
        <div className="flex items-center gap-4">
          <AccountLink />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
