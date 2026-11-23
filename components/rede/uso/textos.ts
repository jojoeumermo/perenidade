// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente "uso e funções" do R1 (falar com a moderação, a situação do cadastro, os códigos de recuperação na
// entrada, o "por que não aparece o número?", o aviso do chat, o kit de bolso do ato e a busca nos posts cifrados):
// i18n/rede/uso/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são rascunho marcado ("_rascunho") e,
// enquanto forem, a tela mostra o português (lib/rede/textos-prontos.ts). UM idioma por vez, por import dinâmico.
// Sem "@/" de propósito.
import { useEffect, useState } from "react";
import { carregarPronto } from "../../../lib/rede/textos-prontos";
import type pt from "../../../i18n/rede/uso/pt.json";

export type TextosDoUso = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/uso/pt.json"),
  en: () => import("../../../i18n/rede/uso/en.json"),
  es: () => import("../../../i18n/rede/uso/es.json"),
  fr: () => import("../../../i18n/rede/uso/fr.json"),
  ru: () => import("../../../i18n/rede/uso/ru.json"),
  zh: () => import("../../../i18n/rede/uso/zh.json"),
};

const JA: Record<string, Promise<TextosDoUso>> = {};

/** Os textos do idioma pedido (o português, enquanto o do idioma for rascunho); idioma desconhecido cai no português. */
export function carregarTextosDoUso(lang: string): Promise<TextosDoUso> {
  const chave = CARREGAR[lang] ? lang : "pt";
  JA[chave] ??= carregarPronto(CARREGAR, chave).then(
    (x) => x as TextosDoUso,
    (e: unknown) => {
      delete JA[chave];
      throw e;
    },
  );
  return JA[chave];
}

/** Os textos na tela (nulo até chegarem). */
export function useTextosDoUso(lang: string): TextosDoUso | null {
  const [t, setT] = useState<{ lang: string; t: TextosDoUso } | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDoUso(lang).then(
      (x) => vivo && setT({ lang, t: x }),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t && t.lang === lang ? t.t : null;
}

/** Troca {chave} pelo valor. */
export function encher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => (k in valores ? String(valores[k]) : `{${k}}`));
}
