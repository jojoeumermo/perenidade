// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do voto secreto em limiar (guardiãs, chave da votação, abrir a urna): i18n/rede/voto/{pt,en,es,fr,ru,zh}.json. O
// português é o texto final; os outros cinco são rascunho marcado ("_rascunho"). Cada idioma é um pedaço separado (import
// dinâmico): o navegador só baixa o que usa.
"use client";

import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/voto/pt.json";
import { carregarPronto } from "@/lib/rede/textos-prontos";
import { codigoDoErro } from "../erros";

export type TextosDoVoto = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/voto/pt.json"),
  en: () => import("@/i18n/rede/voto/en.json"),
  es: () => import("@/i18n/rede/voto/es.json"),
  fr: () => import("@/i18n/rede/voto/fr.json"),
  ru: () => import("@/i18n/rede/voto/ru.json"),
  zh: () => import("@/i18n/rede/voto/zh.json"),
};

/** Os textos do idioma (nulo enquanto chegam). */
export function useTextosDoVoto(lang: string): TextosDoVoto | null {
  const [t, setT] = useState<{ lang: string; t: TextosDoVoto } | null>(null);
  useEffect(() => {
    let vivo = true;
    (carregarPronto(CARREGAR, lang) as Promise<TextosDoVoto>).then((x) => vivo && setT({ lang, t: x }), () => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** O erro de uma ação do voto vira o texto do idioma (o código da urna ou do banco; o resto, "não deu certo"). */
export function erroDoVoto(t: TextosDoVoto, e: unknown): string {
  const bruto = codigoDoErro(e);
  const codigo = bruto.startsWith("invalido") ? "invalido" : bruto;
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? erros.falha;
}
