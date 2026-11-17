// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do texto formatado (frente 11A): i18n/rede/texto/{pt,en,es,fr,ru,zh}.json. Carrega só o idioma pedido, sob demanda, e
// guarda o que já veio (várias peças da mesma tela pedem juntas).
import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/texto/pt.json";

export type TextosDoTexto = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/texto/pt.json"),
  en: () => import("@/i18n/rede/texto/en.json"),
  es: () => import("@/i18n/rede/texto/es.json"),
  fr: () => import("@/i18n/rede/texto/fr.json"),
  ru: () => import("@/i18n/rede/texto/ru.json"),
  zh: () => import("@/i18n/rede/texto/zh.json"),
};

const JA: Record<string, Promise<TextosDoTexto>> = {};

export function carregarTextosDoTexto(lang: string): Promise<TextosDoTexto> {
  const chave = CARREGAR[lang] ? lang : "pt";
  JA[chave] ??= CARREGAR[chave]().then((m) => m.default as TextosDoTexto);
  return JA[chave];
}

export function useTextosDoTexto(lang: string): TextosDoTexto | null {
  const [t, setT] = useState<{ lang: string; t: TextosDoTexto } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDoTexto(lang)
      .then((x) => vivo && setT({ lang, t: x }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}
