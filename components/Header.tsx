import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/pt";
import { site } from "@/lib/site";
import { LanguageSwitcher, NavLinks } from "./NavLinks";
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
      {/* Em telas estreitas os links descem para a linha de baixo; idioma e tema ficam ao lado do nome. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5">
        <Link href={localePath(lang, "/")} className="mr-auto flex items-baseline gap-3">
          <span aria-hidden className="text-3xl text-gold">◈</span>
          <span className="text-3xl font-semibold tracking-tight">{site.name}</span>
        </Link>
        <nav
          aria-label={t.nav.main}
          className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-2 font-sans text-sm text-ink-soft lg:order-2 lg:w-auto"
        >
          <NavLinks />
        </nav>
        <div className="order-2 flex items-center gap-3 lg:order-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
