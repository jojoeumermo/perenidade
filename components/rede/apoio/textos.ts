// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do apoio: i18n/rede/apoio/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros têm "_rascunho": true até a
// revisão). UM idioma por vez, por import dinâmico.
import { useEffect, useState } from "react";
import type pt from "../../../i18n/rede/apoio/pt.json";
import { prontoOu } from "../../../lib/rede/textos-prontos";

export type TextosDoApoio = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDoApoio(lang: string): Promise<TextosDoApoio> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../i18n/rede/apoio/${l}.json`)) as { default: TextosDoApoio }).default, async () => ((await import("../../../i18n/rede/apoio/pt.json")) as { default: TextosDoApoio }).default);
  } catch {
    return ((await import("../../../i18n/rede/apoio/pt.json")) as { default: TextosDoApoio }).default;
  }
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDoApoio(lang: string): TextosDoApoio | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDoApoio } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDoApoio(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}

/** O código do erro do banco ("invalido:meta" → "invalido") virado em frase. */
export function fraseDoApoio(t: TextosDoApoio, e: unknown): string {
  const bruto = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : e instanceof Error ? e.message : "";
  const codigo = bruto.split(":")[0];
  if (codigo === "banco_desatualizado" || codigo === "sem_servico") return t.erros.semBanco;
  if (bruto.includes("permission denied")) return t.erros.entre_primeiro;
  return (t.erros as Record<string, string>)[codigo] ?? t.erros.falha;
}

export const preencherApoio = (modelo: string, valores: Record<string, string | number>) => modelo.replace(/\{(\w+)\}/g, (m, k: string) => (k in valores ? String(valores[k]) : m));
