"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { localeNames, localePath, locales } from "@/i18n/config";
import { useI18n } from "./I18n";

export function NavLinks() {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const links = [
    [t.nav.tracks, "/trilhas"],
    [t.nav.library, "/acervo"],
    [t.nav.authors, "/autores"],
    [t.nav.memorial, "/memorial"],
    [t.nav.volunteers, "/voluntarios"],
    [t.nav.contribute, "/contribuir"],
    [t.nav.search, "/busca"],
  ];
  return (
    <>
      {links.map(([label, path]) => {
        const href = localePath(lang, path);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={path}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap hover:text-oxblood ${
              active ? "text-oxblood underline decoration-gold underline-offset-8" : ""
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
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
