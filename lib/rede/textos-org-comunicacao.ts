// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos da comunicação da organização (onda 12, frente 12E): i18n/rede/org/comunicacao/{pt,en,es,fr,ru,zh}.json (pt é o texto
// final; os outros têm "_rascunho": true até a revisão). UM idioma por vez, por import dinâmico.
import { useEffect, useState } from "react";
import type pt from "../../i18n/rede/org/comunicacao/pt.json";
import { prontoOu } from "./textos-prontos";

export type TextosDaComunicacao = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDaComunicacao(lang: string): Promise<TextosDaComunicacao> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../i18n/rede/org/comunicacao/${l}.json`)) as { default: TextosDaComunicacao }).default, async () => ((await import("../../i18n/rede/org/comunicacao/pt.json")) as { default: TextosDaComunicacao }).default);
  } catch {
    return ((await import("../../i18n/rede/org/comunicacao/pt.json")) as { default: TextosDaComunicacao }).default;
  }
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDaComunicacao(lang: string): TextosDaComunicacao | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDaComunicacao } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaComunicacao(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}

/** O código do erro do banco ("invalido:texto" → "invalido") virado em frase. */
export function fraseDaComunicacao(t: TextosDaComunicacao, e: unknown): string {
  const bruto = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : e instanceof Error ? e.message : "";
  const codigo = bruto.split(":")[0];
  if (codigo === "banco_desatualizado" || codigo === "sem_servico") return t.erros.semBanco;
  if (bruto.includes("permission denied")) return t.erros.entre_primeiro;
  return (t.erros as Record<string, string>)[codigo] ?? t.erros.falha;
}
