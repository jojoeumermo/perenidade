// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { site } from "@/lib/site";
import { InstagramIcon } from "./Footer";
import { AccountLink, AppBack, HeaderSearch, LanguageSwitcher, NavLinks, NewsLink, PodcastLink, RadioLink } from "./NavLinks";
import { Strip } from "./Strip";
import { ThemeToggle } from "./ThemeToggle";
import { TopoFixo } from "./TopoFixo";

/**
 * O perfil do instituto no Instagram, sempre à vista: muita gente chega pelos cartazes impressos. É um botão só com o
 * desenho da câmera, nas cores do próprio Instagram, para ser reconhecido de longe sem precisar do @ escrito.
 * "menor" é a versão da segunda linha, quando a tela não é tão larga.
 */
function Instagram({ t, menor = false }: { t: Dict; menor?: boolean }) {
  const rotulo = `${t.footer.instagram} @${site.instagramUser}`;
  return (
    <a href={site.instagram} target="_blank" rel="noopener noreferrer me" aria-label={rotulo} title={rotulo} className={`botao botao-instagram-cor ${menor ? "botao-menor" : ""}`}>
      <InstagramIcon className={menor ? "h-[1.1rem] w-[1.1rem]" : "h-[1.35rem] w-[1.35rem]"} />
    </a>
  );
}

/** Os botões de quem quer ajudar: seguir no Instagram e apoiar o instituto. "Contribuir" mora no "Mais". */
function Ajudar({ lang, t, menor = false }: { lang: Locale; t: Dict; menor?: boolean }) {
  return (
    <>
      <Instagram t={t} menor={menor} />
      <Link href={localePath(lang, "/apoie")} className={`botao botao-prelo ${menor ? "botao-menor" : ""} whitespace-nowrap`}>
        {t.nav.support}
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
        <div className="linha-de-cima mx-auto flex max-w-[78rem] 2xl:max-w-[92rem] items-center gap-x-2 px-3 py-3 app:px-4 app:py-2 sm:gap-x-4 sm:px-6 md:pt-5 md:pb-3 lg:px-8">
          <AppBack />
          {/* A marca do instituto (o livro aberto com a estrela) não muda nunca. */}
          <Link href={localePath(lang, "/")} aria-label={site.name} className="flex min-w-0 shrink-0 items-center gap-2.5 text-ink hover:text-ink sm:gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca-96.png" alt="" width={52} height={52} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12 xl:h-[3.25rem] xl:w-[3.25rem]" />
            <span className="min-w-0">
              <span className="marca-nome block whitespace-nowrap text-xl font-semibold leading-none tracking-tight sm:text-[1.7rem] xl:text-[2rem]">{site.name}</span>
              <span aria-hidden className="marca-sub mt-1.5 hidden font-mono text-[0.62rem] uppercase tracking-[0.22em] text-ink-soft lg:block">{t.home.eyebrow}</span>
            </span>
          </Link>
          {/* Se faltar espaço, quem encolhe é o "Olá, Fulano" (com reticências), nunca a marca nem os ícones. */}
          <div className="ml-auto flex min-w-0 items-center gap-1 app:gap-3 sm:gap-2 lg:gap-3">
            {/* No computador, na ordem do desenho: a busca, a rádio, o tema e o idioma; depois a conta, o Instagram e o apoio. */}
            {/* Num invólucro: no toque, toda ligação do cabeçalho é forçada a aparecer (globals.css, pointer: coarse). */}
            <span className="hidden lg:contents">
              <HeaderSearch />
            </span>
            <span className="contents md:hidden">
              <AccountLink />
            </span>
            {/* O jornal já está no menu do computador; no aplicativo a barra de cima não cabe tudo numa linha. */}
            <span className="contents md:hidden app:max-md:hidden">
              <NewsLink />
            </span>
            <PodcastLink />
            <RadioLink />
            <ThemeToggle />
            <span className="contents max-lg:hidden">
              <LanguageSwitcher globo />
            </span>
            <span aria-hidden className="mx-1 hidden h-7 w-px bg-rule md:block" />
            <span className="contents max-md:hidden">
              <AccountLink />
            </span>
            {/* No aplicativo o Instagram mora na gaveta "Mais": a barra de cima fica só com o que é do aplicativo. */}
            <span className="ml-1 app:hidden md:hidden">
              <Instagram t={t} menor />
            </span>
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
