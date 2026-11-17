// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da decisão e dos números da comunidade: i18n/rede/decisao/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os
// outros cinco são rascunho marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico): o navegador só baixa o que usa,
// e só quando a aba abre.
"use client";

import { useEffect, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import { codigoDoErro } from "../../erros";
import type pt from "@/i18n/rede/decisao/pt.json";

export type TextosDaDecisao = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/decisao/pt.json"),
  en: () => import("@/i18n/rede/decisao/en.json"),
  es: () => import("@/i18n/rede/decisao/es.json"),
  fr: () => import("@/i18n/rede/decisao/fr.json"),
  ru: () => import("@/i18n/rede/decisao/ru.json"),
  zh: () => import("@/i18n/rede/decisao/zh.json"),
};

export async function carregarTextosDaDecisao(lang: string): Promise<TextosDaDecisao> {
  return (await (CARREGAR[lang] ?? CARREGAR.pt)()).default as TextosDaDecisao;
}

/** Os textos do idioma (nulo enquanto chegam). */
export function useTextosDaDecisao(lang: string): TextosDaDecisao | null {
  const [t, setT] = useState<{ lang: string; t: TextosDaDecisao } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaDecisao(lang).then((x) => vivo && setT({ lang, t: x }), () => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** O erro de uma chamada vira o texto do pacote ("invalido:prazo" → o texto do prazo). */
export function erroDaDecisao(td: TextosDaDecisao, erro: unknown): string {
  const codigo = codigoDoErro(erro);
  const [tipo, campo] = codigo.split(":");
  const erros = td.erros as Record<string, string>;
  if (tipo === "invalido" && campo && erros[campo]) return erros[campo];
  return erros[tipo] ?? erros.falha;
}

/** "Fecha em 2 d 4 h": o tempo que falta, com as palavras do pacote. */
export function tempoQueFalta(td: TextosDaDecisao, f: { dias: number; horas: number; minutos: number }): string {
  if (f.dias > 0) return preencher(td.tempo.dias, { d: f.dias, h: f.horas });
  if (f.horas > 0) return preencher(td.tempo.horas, { h: f.horas, m: f.minutos });
  return preencher(td.tempo.minutos, { m: Math.max(1, f.minutos) });
}

/** Data e hora curtas no idioma da tela ("22 nov., 18:00"). */
export function dataEHora(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

/** Só o dia ("17 nov."), para a semana dos números. */
export function diaCurto(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  } catch {
    return iso;
  }
}
