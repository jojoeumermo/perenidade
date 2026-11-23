// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do banco de questões (frente 11A): i18n/rede/questoes/{pt,en,es,fr,ru,zh}.json, só o idioma pedido, sob demanda.
import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/questoes/pt.json";
import type { TextosDaRede } from "@/lib/rede/textos";
import { codigoDoErro, textoDoErro } from "../../erros";
import { prontoDe } from "../../../../lib/rede/textos-prontos";

export type TextosDasQuestoes = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/questoes/pt.json"),
  en: () => import("@/i18n/rede/questoes/en.json"),
  es: () => import("@/i18n/rede/questoes/es.json"),
  fr: () => import("@/i18n/rede/questoes/fr.json"),
  ru: () => import("@/i18n/rede/questoes/ru.json"),
  zh: () => import("@/i18n/rede/questoes/zh.json"),
};

const JA: Record<string, Promise<TextosDasQuestoes>> = {};

export function carregarTextosDasQuestoes(lang: string): Promise<TextosDasQuestoes> {
  const chave = CARREGAR[lang] ? lang : "pt";
  JA[chave] ??= prontoDe(CARREGAR[chave], CARREGAR.pt).then((d) => d as TextosDasQuestoes);
  return JA[chave];
}

export function useTextosDasQuestoes(lang: string): TextosDasQuestoes | null {
  const [t, setT] = useState<{ lang: string; t: TextosDasQuestoes } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDasQuestoes(lang)
      .then((x) => vivo && setT({ lang, t: x }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** O erro do banco em texto: primeiro o das questões (código inteiro, depois o tipo), senão o texto geral da Alumia. */
export function erroDasQuestoes(t: TextosDasQuestoes, s: Pick<TextosDaRede, "erros">, e: unknown): string {
  const codigo = codigoDoErro(e);
  const erros = t.erros as Record<string, string>;
  if (erros[codigo]) return erros[codigo];
  const [tipo, campo] = codigo.split(":");
  const problemas = t.escrever.problemas as Record<string, string>;
  if (tipo === "invalido" && campo && problemas[campo]) return problemas[campo];
  if (erros[tipo]) return erros[tipo];
  return textoDoErro(s, e);
}
