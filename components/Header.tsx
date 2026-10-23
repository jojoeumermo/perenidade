// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { site } from "@/lib/site";
import { AccountLink, AppBack, LanguageSwitcher, NavLinks, NewsLink, PodcastLink, RadioLink } from "./NavLinks";
import { Strip } from "./Strip";
import { ThemeToggle } from "./ThemeToggle";
import { TopoFixo } from "./TopoFixo";

/** Os dois botões de quem quer ajudar: contribuir com aulas e apoiar o instituto. */
function Ajudar({ lang, t, menor = false }: { lang: Locale; t: Dict; menor?: boolean }) {
  const tamanho = menor ? "botao-menor" : "";
  return (
    <>
      <Link href={localePath(lang, "/contribuir")} className={`botao botao-papel ${tamanho} whitespace-nowrap`}>
        {t.nav.contribute}
      </Link>
      <Link href={localePath(lang, "/apoie")} className={`botao botao-prelo ${tamanho} whitespace-nowrap`}>
        {t.nav.supportLong}
      </Link>
    </>
  );
}

export function Header({ lang, t }: { lang: Locale; t: Dict }) {
  // A faixa preta de avisos fica fora do cabeçalho e rola junto com a página; o cabeçalho (marca, conta e menu) fica
  // preso no topo e encolhe depois que a página rola (TopoFixo). No celular o menu mora nas abas de baixo (BottomNav).
  return (
    <>
      <a
        href="#conteudo"
        className="no-print sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:font-sans focus:text-sm focus:text-parchment"
      >
        {t.common.skip}
      </a>
      <div className="no-print app:hidden">
        <Strip fallback={t.common.strip} />
      </div>
      <header className="cabecalho-site app-barra no-print no-focus sticky top-0 z-40 border-b-[3px] border-ink bg-parchment app:z-30 app:pt-[env(safe-area-inset-top,0px)]">
        <TopoFixo />
        <div className="linha-de-cima mx-auto flex max-w-[78rem] items-center gap-x-2 px-3 py-3 app:px-4 app:py-2 sm:gap-x-4 sm:px-6 md:pt-5 md:pb-3 lg:px-8">
          <AppBack />
          {/* A marca do instituto (o livro aberto com a estrela) não muda nunca. */}
          <Link href={localePath(lang, "/")} aria-label={site.name} className="flex min-w-0 shrink-0 items-center gap-2.5 text-ink hover:text-ink sm:gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca-96.png" alt="" width={52} height={52} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12 xl:h-[3.25rem] xl:w-[3.25rem]" />
            <span className="min-w-0">
              <span className="marca-nome block whitespace-nowrap text-xl font-semibold leading-none tracking-tight sm:text-[1.7rem] xl:text-[2rem]">{site.name}</span>
              <span className="marca-sub mt-1.5 hidden font-mono text-[0.62rem] uppercase tracking-[0.22em] text-ink-soft lg:block">{t.home.eyebrow}</span>
            </span>
          </Link>
          {/* Se faltar espaço, quem encolhe é o "Olá, Fulano" (com reticências), nunca a marca nem os ícones. */}
          <div className="ml-auto flex min-w-0 items-center gap-1 app:gap-3 sm:gap-2 lg:gap-3">
            <AccountLink />
            <span className="contents max-lg:hidden">
              <LanguageSwitcher />
            </span>
            <NewsLink />
            <PodcastLink />
            <RadioLink />
            <ThemeToggle />
            <span className="ml-3 hidden items-center gap-3 xl:flex">
              <Ajudar lang={lang} t={t} />
            </span>
          </div>
        </div>
        {/* O menu numa linha própria, na ordem de sempre, centrado como o índice embaixo do nome de um jornal.
            Se a letra estiver grande, quebra em duas linhas em vez de passar por cima da conta. */}
        <nav aria-label={t.nav.main} className="hidden md:block">
          <div className="menu-do-site mx-auto flex max-w-[78rem] flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 pt-1 font-sans text-[0.95rem] font-semibold leading-none text-ink lg:gap-x-8">
            <NavLinks />
            <span className="flex items-center gap-3 py-1.5 xl:hidden">
              <Ajudar lang={lang} t={t} menor />
            </span>
          </div>
        </nav>
      </header>
    </>
  );
}
