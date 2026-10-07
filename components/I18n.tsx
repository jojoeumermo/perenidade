"use client";

import NextLink from "next/link";
import { createContext, useContext, type ComponentProps } from "react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/pt";

const Context = createContext<{ lang: Locale; t: Dict } | null>(null);

export function I18nProvider({ lang, t, children }: { lang: Locale; t: Dict; children: React.ReactNode }) {
  return <Context.Provider value={{ lang, t }}>{children}</Context.Provider>;
}

/** Idioma e textos da página atual, para componentes do navegador. */
export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error("useI18n precisa estar dentro de I18nProvider");
  return value;
}

/** Link interno que acrescenta o prefixo do idioma atual: <L href="/trilhas">. */
export function L({ href, ...props }: Omit<ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  const { lang } = useI18n();
  return <NextLink href={localePath(lang, href)} {...props} />;
}
