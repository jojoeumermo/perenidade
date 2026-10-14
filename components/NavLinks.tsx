// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { localeNames, localePath, locales } from "@/i18n/config";
import { KEYS, useHydrated, useStored } from "@/lib/storage";
import { useI18n } from "./I18n";

export function NavLinks() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  // Na linha só o que se usa todo dia. Memorial, Dedicatória e o resto continuam em "Mais".
  const links: [string, string, string][] = [
    [t.nav.disciplines, "/trilhas", ""],
    [t.nav.library, "/acervo", ""],
    [t.nav.journal, "/jornal", ""],
    [t.nav.community, "/comunidade", ""],
    [t.nav.more, "/explorar", ""],
  ];
  const link = (label: React.ReactNode, path: string, name?: string, show = "") => {
    const href = localePath(lang, path);
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={path}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={name}
        className={`whitespace-nowrap py-2 hover:text-oxblood ${show} ${active ? "text-oxblood underline decoration-gold underline-offset-8" : ""}`}
      >
        {label}
      </Link>
    );
  };
  return (
    <>
      {links.map(([label, path, show]) => link(label, path, undefined, show))}
      {/* Contribuir é a porta de entrada de quem quer ajudar: um contorno discreto a separa do resto. */}
      {link(<span className="border border-oxblood px-2.5 py-1 text-oxblood">{t.nav.contribute}</span>, "/contribuir", undefined, "hidden lg:inline")}
      {/* O único destaque do menu: as letras de "Apoie" mudam de cor, uma depois da outra. */}
      {link(
        <span className="apoie font-semibold">
          {[...t.nav.support].map((letter, i) => (
            <span key={i} aria-hidden style={{ animationDelay: `${i * -0.35}s` }}>
              {letter}
            </span>
          ))}
        </span>,
        "/apoie",
        t.nav.support,
      )}
    </>
  );
}

const raizes = ["", "trilhas", "acervo", "comunidade", "explorar"];

/**
 * Só no aplicativo: voltar à tela anterior. Lá não existe a seta do navegador, e as abas de baixo só levam às
 * cinco telas principais; em qualquer outra, a seta aparece no canto de cima.
 */
export function AppBack() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  if (raizes.includes(pathname.split("/").slice(2).join("/"))) return null;
  return (
    <button
      type="button"
      aria-label={t.common.back}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(`/${lang}`))}
      className="-ml-2 hidden h-10 w-9 shrink-0 cursor-pointer items-center justify-center text-ink app:max-md:flex"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/** "Entrar" para quem não tem sessão, "Painel" para quem tem. Só aparece quando as contas estão ligadas. */
export function AccountLink() {
  const { lang, t } = useI18n();
  const hydrated = useHydrated();
  const session = useStored(KEYS.session);
  if (!hydrated) return null;
  return (
    <Link href={localePath(lang, session ? "/painel" : "/entrar")} className="whitespace-nowrap font-sans text-xs text-ink-soft hover:text-oxblood sm:text-sm">
      {session ? t.nav.panel : t.nav.signIn}
    </Link>
  );
}

/** Troca o idioma mantendo a pessoa na mesma página. */
export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  const rest = pathname.split("/").slice(2).join("/");
  return (
    <select
      aria-label={t.common.language}
      value={lang}
      onChange={(e) => router.push(`/${e.target.value}${rest ? `/${rest}` : ""}`)}
      className="max-w-[4.75rem] cursor-pointer border border-rule bg-parchment px-1 py-1 font-mono text-xs text-ink-soft hover:border-gold sm:max-w-none sm:px-1.5"
    >
      {locales.map((code) => (
        <option key={code} value={code} lang={code}>
          {localeNames[code]}
        </option>
      ))}
    </select>
  );
}

/** Atalho para a rádio, ao lado do botão de tema: um toque e a música começa. */
export function RadioLink() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const href = localePath(lang, "/radio");
  const active = pathname === href;
  return (
    <Link
      href={href}
      aria-label={t.nav.radio}
      title={t.nav.radio}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 w-7 shrink-0 items-center justify-center hover:text-oxblood sm:w-8 ${active ? "text-oxblood" : "text-ink-soft"}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="9" width="18" height="11" rx="1.5" />
        <path d="M7 9 17 4" />
        <circle cx="8.5" cy="14.5" r="2.5" />
        <path d="M14 13h4M14 16h4" />
      </svg>
    </Link>
  );
}

/** Atalho para o giro de notícias do país, ao lado da rádio. */
export function NewsLink() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const href = localePath(lang, "/noticias");
  const active = pathname === href;
  return (
    <Link
      href={href}
      aria-label={t.nav.news}
      title={t.nav.news}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 w-7 shrink-0 items-center justify-center hover:text-oxblood sm:w-8 ${active ? "text-oxblood" : "text-ink-soft"}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 5h13v14H6a2 2 0 0 1-2-2z" />
        <path d="M17 9h3v8a2 2 0 0 1-2 2" />
        <path d="M7.5 9h6M7.5 12.5h6M7.5 16h3.5" />
      </svg>
    </Link>
  );
}
