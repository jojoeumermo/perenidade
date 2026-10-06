import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="no-print border-b border-rule">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-ink focus:px-3 focus:py-2 focus:font-sans focus:text-sm focus:text-parchment"
      >
        Pular para o conteúdo
      </a>
      <div className="bg-ink px-4 py-1.5 text-center font-mono text-xs tracking-wide text-parchment">
        Arquivo vivo · 100% gratuito · conteúdo versionado e revertível
      </div>
      {/* No celular os links descem para a segunda linha e o botão de tema fica ao lado do nome. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5">
        <Link href="/" className="mr-auto flex items-baseline gap-3">
          <span aria-hidden className="text-3xl text-gold">◈</span>
          <span className="text-3xl font-semibold tracking-tight">Perenidade</span>
        </Link>
        <nav aria-label="Principal" className="order-3 flex w-full items-center gap-5 font-sans text-sm text-ink-soft sm:order-2 sm:w-auto">
          <NavLinks />
        </nav>
        <div className="order-2 flex sm:order-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
