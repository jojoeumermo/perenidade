// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/publicar/compositor/pt.json";
import { prontoDe } from "../../../../lib/rede/textos-prontos";

/** Os textos do compositor (onda 12, 12A: fio, carrossel e colagem, fuso, figurinhas, cartão do link): i18n/rede/publicar/compositor/{pt,en,es,fr,ru,zh}.json. */
export type TextosDoCompositor = typeof pt;

// O navegador baixa SÓ o idioma da pessoa, e só quando o Escrever, o cartão ou os Ajustes pedem.
const CARREGADORES: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/publicar/compositor/pt.json"),
  en: () => import("@/i18n/rede/publicar/compositor/en.json"),
  es: () => import("@/i18n/rede/publicar/compositor/es.json"),
  fr: () => import("@/i18n/rede/publicar/compositor/fr.json"),
  ru: () => import("@/i18n/rede/publicar/compositor/ru.json"),
  zh: () => import("@/i18n/rede/publicar/compositor/zh.json"),
};

const guardados = new Map<string, Promise<TextosDoCompositor>>();
const prontos = new Map<string, TextosDoCompositor>();

export function carregarTextosDoCompositor(lang: string): Promise<TextosDoCompositor> {
  const l = lang in CARREGADORES ? lang : "pt";
  let p = guardados.get(l);
  if (!p) {
    p = prontoDe(CARREGADORES[l], CARREGADORES.pt).then((d) => {
      const t = d as TextosDoCompositor;
      prontos.set(l, t);
      return t;
    });
    guardados.set(l, p);
  }
  return p;
}

export function useTextosDoCompositor(lang: string): TextosDoCompositor | null {
  const l = lang in CARREGADORES ? lang : "pt";
  const [t, setT] = useState<TextosDoCompositor | null>(() => prontos.get(l) ?? null);
  useEffect(() => {
    if (prontos.get(l) === t && t) return;
    let vivo = true;
    carregarTextosDoCompositor(l).then(
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
export function textoDoErroDoCompositor(t: Pick<TextosDoCompositor, "erros">, codigo: string): string | null {
  return (t.erros as Record<string, string>)[codigo.replace(":", "_")] ?? null;
}
