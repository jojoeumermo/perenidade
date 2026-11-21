// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/p4-compositor/pt.json";
import { prontoDe } from "../../../../lib/rede/textos-prontos";

/**
 * Os textos do compositor do prompt 4 (álbum, artigo com capítulos, versão curta, "com fonte", "Mande a sua", o filtro de imagens sem
 * descrição e o escrever na barrinha): i18n/rede/p4-compositor/{pt,en,es,fr,ru,zh}.json. O português é o final; os outros cinco
 * são rascunho. O navegador baixa só o idioma da pessoa, quando o Escrever, o cartão ou os Ajustes pedem.
 */
export type TextosDoP4 = typeof pt;

const CARREGADORES: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/p4-compositor/pt.json"),
  en: () => import("@/i18n/rede/p4-compositor/en.json"),
  es: () => import("@/i18n/rede/p4-compositor/es.json"),
  fr: () => import("@/i18n/rede/p4-compositor/fr.json"),
  ru: () => import("@/i18n/rede/p4-compositor/ru.json"),
  zh: () => import("@/i18n/rede/p4-compositor/zh.json"),
};

const guardados = new Map<string, Promise<TextosDoP4>>();

export function carregarTextosDoP4(lang: string): Promise<TextosDoP4> {
  const l = lang in CARREGADORES ? lang : "pt";
  let p = guardados.get(l);
  if (!p) {
    p = prontoDe(CARREGADORES[l], CARREGADORES.pt).then((d) => d as TextosDoP4);
    guardados.set(l, p);
  }
  return p;
}

/** Os textos do idioma (nulo enquanto carrega). */
export function useTextosDoP4(lang: string, ligado = true): TextosDoP4 | null {
  const [t, setT] = useState<TextosDoP4 | null>(null);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    void carregarTextosDoP4(lang).then((x) => vivo && setT(x));
    return () => {
      vivo = false;
    };
  }, [lang, ligado]);
  return t;
}

/**
 * A frase de um erro do banco que é do prompt 4 ("invalido:resumo", "resumo_revisar", "desligado"...), ou vazio quando o erro é de
 * outra parte (quem chama cai no texto de sempre).
 */
export function textoDoErroDoP4(t: TextosDoP4, codigo: string): string {
  const k = codigo.replace(":", "_");
  if (k === "invalido_grupo") return t.erros.semCifra;
  return (t.erros as Record<string, string>)[k] ?? "";
}
