// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do B1 das organizações: i18n/rede/org-b1/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros têm "_rascunho": true
// até a revisão). UM idioma por vez, por import dinâmico.
import { useEffect, useState } from "react";
import type pt from "../../i18n/rede/org-b1/pt.json";

export type TextosDaOrgB1 = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDaOrgB1(lang: string): Promise<TextosDaOrgB1> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return ((await import(`../../i18n/rede/org-b1/${l}.json`)) as { default: TextosDaOrgB1 }).default;
  } catch {
    return ((await import("../../i18n/rede/org-b1/pt.json")) as { default: TextosDaOrgB1 }).default;
  }
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDaOrgB1(lang: string): TextosDaOrgB1 | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDaOrgB1 } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaOrgB1(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}

/** O código do erro do banco ("invalido:fim" → "invalido") virado em frase. */
export function fraseDoErro(t: TextosDaOrgB1, e: unknown): string {
  const bruto = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : e instanceof Error ? e.message : "";
  const codigo = bruto.split(":")[0];
  if (codigo === "banco_desatualizado" || codigo === "sem_servico") return t.erros.semBanco;
  if (bruto.includes("permission denied")) return t.erros.entre_primeiro;
  return (t.erros as Record<string, string>)[codigo] ?? t.erros.falha;
}
