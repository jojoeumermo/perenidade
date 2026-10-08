// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { localeNames, localePath, locales } from "@/i18n/config";
import { hasBackend } from "@/lib/backend";
import { KEYS, useHydrated, useStored } from "@/lib/storage";
import { useI18n } from "./I18n";

export function NavLinks() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const links = [
    [t.nav.disciplines, "/trilhas"],
    [t.nav.library, "/acervo"],
    [t.nav.journal, "/jornal"],
    [t.nav.community, "/comunidade"],
    [t.nav.memorial, "/memorial"],
    [t.nav.dedication, "/dedicatoria"],
    [t.nav.contribute, "/contribuir"],
    [t.nav.more, "/explorar"],
  ];
  const link = (label: React.ReactNode, path: string, name?: string) => {
    const href = localePath(lang, path);
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={path}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={name}
        className={`whitespace-nowrap hover:text-oxblood ${active ? "text-oxblood underline decoration-gold underline-offset-8" : ""}`}
      >
        {label}
      </Link>
    );
  };
  return (
    <>
      {links.map(([label, path]) => link(label, path))}
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

/** "Entrar" para quem não tem sessão, "Painel" para quem tem. Só aparece quando as contas estão ligadas. */
export function AccountLink() {
  const { lang, t } = useI18n();
  const hydrated = useHydrated();
  const session = useStored(KEYS.session);
  if (!hasBackend || !hydrated) return null;
  return (
    <Link href={localePath(lang, session ? "/painel" : "/entrar")} className="whitespace-nowrap font-sans text-sm text-ink-soft hover:text-oxblood">
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
      className="cursor-pointer border border-rule bg-parchment px-1.5 py-1 font-mono text-xs text-ink-soft hover:border-gold"
    >
      {locales.map((code) => (
        <option key={code} value={code} lang={code}>
          {localeNames[code]}
        </option>
      ))}
    </select>
  );
}
