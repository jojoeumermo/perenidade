// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do acervo (frente 10D): i18n/rede/acervo/{pt,en,es,fr,ru,zh}.json. Carrega só o idioma pedido, sob demanda, e guarda o
// que já veio (as várias peças da mesma tela pedem juntas).
import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/acervo/pt.json";
import { codigoDoErro } from "../../erros";

export type TextosDoAcervo = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/acervo/pt.json"),
  en: () => import("@/i18n/rede/acervo/en.json"),
  es: () => import("@/i18n/rede/acervo/es.json"),
  fr: () => import("@/i18n/rede/acervo/fr.json"),
  ru: () => import("@/i18n/rede/acervo/ru.json"),
  zh: () => import("@/i18n/rede/acervo/zh.json"),
};

const JA: Record<string, Promise<TextosDoAcervo>> = {};

export function carregarTextosDoAcervo(lang: string): Promise<TextosDoAcervo> {
  const chave = CARREGAR[lang] ? lang : "pt";
  JA[chave] ??= CARREGAR[chave]().then((m) => m.default as TextosDoAcervo);
  return JA[chave];
}

export function useTextosDoAcervo(lang: string): TextosDoAcervo | null {
  const [t, setT] = useState<{ lang: string; t: TextosDoAcervo } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDoAcervo(lang)
      .then((x) => vivo && setT({ lang, t: x }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** O erro do banco em texto do acervo; o que o acervo não conhece cai no texto geral de falha. */
export function erroDoAcervo(t: TextosDoAcervo, e: unknown): string {
  const c = codigoDoErro(e);
  return (t.erros as Record<string, string>)[c] ?? t.erros.falha;
}
