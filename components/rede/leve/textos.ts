// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente 13D (leve e no seu tempo): i18n/rede/leve/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros
// cinco são rascunho marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico). Sem "@/" de propósito.
import { useEffect, useState } from "react";
import type pt from "../../../i18n/rede/leve/pt.json";
import { carregarPronto } from "../../../lib/rede/textos-prontos";

export type TextosDoLeve = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/leve/pt.json"),
  en: () => import("../../../i18n/rede/leve/en.json"),
  es: () => import("../../../i18n/rede/leve/es.json"),
  fr: () => import("../../../i18n/rede/leve/fr.json"),
  ru: () => import("../../../i18n/rede/leve/ru.json"),
  zh: () => import("../../../i18n/rede/leve/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoLeve(lang: string): Promise<TextosDoLeve> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDoLeve;
}

/** Os textos na tela (nulo até chegarem). */
export function useTextosDoLeve(lang: string): TextosDoLeve | null {
  const [t, setT] = useState<{ lang: string; t: TextosDoLeve } | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDoLeve(lang).then((x) => vivo && setT({ lang, t: x }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t && t.lang === lang ? t.t : null;
}
