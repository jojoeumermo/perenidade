// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/publicar/alumia2/pt.json";

/** Os textos da cara nova da Alumia (F1): i18n/rede/publicar/alumia2/{pt,en,es,fr,ru,zh}.json. */
export type TextosAlumia2 = typeof pt;

// O navegador baixa SÓ o idioma da pessoa, e só com a flag "alumia-2" ligada (quem chama é a casca nova).
const CARREGADORES: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/publicar/alumia2/pt.json"),
  en: () => import("@/i18n/rede/publicar/alumia2/en.json"),
  es: () => import("@/i18n/rede/publicar/alumia2/es.json"),
  fr: () => import("@/i18n/rede/publicar/alumia2/fr.json"),
  ru: () => import("@/i18n/rede/publicar/alumia2/ru.json"),
  zh: () => import("@/i18n/rede/publicar/alumia2/zh.json"),
};

const guardados = new Map<string, Promise<TextosAlumia2>>();
/** Os já chegados: a tela seguinte (cada rota monta a Rede de novo) começa com eles, sem um quadro de esqueleto no meio. */
const prontos = new Map<string, TextosAlumia2>();

export function carregarTextosAlumia2(lang: string): Promise<TextosAlumia2> {
  const l = lang in CARREGADORES ? lang : "pt";
  let p = guardados.get(l);
  if (!p) {
    p = CARREGADORES[l]().then((m) => {
      const t = m.default as TextosAlumia2;
      prontos.set(l, t);
      return t;
    });
    guardados.set(l, p);
  }
  return p;
}

export function useTextosAlumia2(lang: string, ativo = true): TextosAlumia2 | null {
  const l = lang in CARREGADORES ? lang : "pt";
  const [t, setT] = useState<TextosAlumia2 | null>(() => prontos.get(l) ?? null);
  useEffect(() => {
    if (!ativo || prontos.get(l) === t) return;
    let vivo = true;
    carregarTextosAlumia2(l).then(
      (x) => vivo && setT(x),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [l, ativo, t]);
  return ativo ? t : null;
}
