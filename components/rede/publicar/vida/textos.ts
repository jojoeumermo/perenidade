// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/publicar/vida/pt.json";

/** Os textos do público e da vida do post (onda 9, 9D): i18n/rede/publicar/vida/{pt,en,es,fr,ru,zh}.json. */
export type TextosDaVida = typeof pt;

// O navegador baixa SÓ o idioma da pessoa, e só quando o Escrever, o cartão ou os Ajustes pedem.
const CARREGADORES: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/publicar/vida/pt.json"),
  en: () => import("@/i18n/rede/publicar/vida/en.json"),
  es: () => import("@/i18n/rede/publicar/vida/es.json"),
  fr: () => import("@/i18n/rede/publicar/vida/fr.json"),
  ru: () => import("@/i18n/rede/publicar/vida/ru.json"),
  zh: () => import("@/i18n/rede/publicar/vida/zh.json"),
};

const guardados = new Map<string, Promise<TextosDaVida>>();
const prontos = new Map<string, TextosDaVida>();

export function carregarTextosDaVida(lang: string): Promise<TextosDaVida> {
  const l = lang in CARREGADORES ? lang : "pt";
  let p = guardados.get(l);
  if (!p) {
    p = CARREGADORES[l]().then((m) => {
      const t = m.default as TextosDaVida;
      prontos.set(l, t);
      return t;
    });
    guardados.set(l, p);
  }
  return p;
}

export function useTextosDaVida(lang: string): TextosDaVida | null {
  const l = lang in CARREGADORES ? lang : "pt";
  const [t, setT] = useState<TextosDaVida | null>(() => prontos.get(l) ?? null);
  useEffect(() => {
    if (prontos.get(l) === t && t) return;
    let vivo = true;
    carregarTextosDaVida(l).then(
      (x) => vivo && setT(x),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [l, t]);
  return t;
}

/** O código de erro de uma chamada desta frente vira o texto dela; o que ela não conhece fica para os outros textos (nulo). */
export function textoDoErroDaVida(t: Pick<TextosDaVida, "erros" | "cifra">, codigo: string): string | null {
  const chave = codigo.replace(":", "_");
  return (t.erros as Record<string, string>)[chave] ?? (t.cifra as Record<string, string>)[chave] ?? null;
}
