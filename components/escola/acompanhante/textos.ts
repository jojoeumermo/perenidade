// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";

// Para os pedaços do acompanhante que entram em páginas de outros pacotes (o "Não entendi" na faixa da aula e o
// "Quero uma pista" no exercício): sem props novas nessas páginas, o componente baixa só o dicionário do idioma da
// página, num pedaço à parte, depois da hidratação (no servidor e na primeira pintura não aparece nada).

const CARREGAR: Record<string, () => Promise<{ default: TextosDoAcompanhante }>> = {
  pt: () => import("@/i18n/escola/acompanhante/pt.json"),
  en: () => import("@/i18n/escola/acompanhante/en.json"),
  es: () => import("@/i18n/escola/acompanhante/es.json"),
  fr: () => import("@/i18n/escola/acompanhante/fr.json"),
  ru: () => import("@/i18n/escola/acompanhante/ru.json"),
  zh: () => import("@/i18n/escola/acompanhante/zh.json"),
};
const guardados = new Map<string, Promise<TextosDoAcompanhante>>();

export function carregarTextos(lang: string): Promise<TextosDoAcompanhante> {
  const idioma = lang in CARREGAR ? lang : "pt";
  let p = guardados.get(idioma);
  if (!p) {
    p = CARREGAR[idioma]().then((m) => m.default);
    guardados.set(idioma, p);
  }
  return p;
}

/** Os textos do idioma, ou null enquanto não chegam (e quando `ativo` é falso, nem baixa). */
export function useTextosDoAcompanhante(lang: string, ativo = true): TextosDoAcompanhante | null {
  const [textos, setTextos] = useState<{ lang: string; s: TextosDoAcompanhante } | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    carregarTextos(lang)
      .then((s) => {
        if (vivo) setTextos({ lang, s });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [lang, ativo]);
  return textos && textos.lang === lang ? textos.s : null;
}
