// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { TextosPublicar } from "@/lib/rede/textos-publicar";

/**
 * Os textos do pacote publicar no idioma da pessoa. O navegador baixa SÓ o idioma que vai usar (import dinâmico de um arquivo
 * por idioma) e só quando o pacote aparece na tela (escrever, ou um post com enquete, imagem, áudio, prévia ou edição).
 */
const CARREGADORES: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/publicar/pt.json"),
  en: () => import("@/i18n/rede/publicar/en.json"),
  es: () => import("@/i18n/rede/publicar/es.json"),
  fr: () => import("@/i18n/rede/publicar/fr.json"),
  ru: () => import("@/i18n/rede/publicar/ru.json"),
  zh: () => import("@/i18n/rede/publicar/zh.json"),
};

const guardados = new Map<string, Promise<TextosPublicar>>();

export function carregarTextosPublicar(lang: string): Promise<TextosPublicar> {
  const l = lang in CARREGADORES ? lang : "pt";
  let p = guardados.get(l);
  if (!p) {
    p = CARREGADORES[l]().then((m) => m.default as TextosPublicar);
    guardados.set(l, p);
  }
  return p;
}

/** O idioma pelo endereço (/pt/alumia…), para quem não recebe `lang` por props. */
export function idiomaDoEndereco(): string {
  try {
    return window.location.pathname.split("/")[1] || "pt";
  } catch {
    return "pt";
  }
}

export function useTextosPublicar(lang?: string): TextosPublicar | null {
  const [t, setT] = useState<TextosPublicar | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosPublicar(lang ?? idiomaDoEndereco()).then(
      (x) => vivo && setT(x),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t;
}

/** O código de erro de uma chamada vira o texto do pacote; o que ele não conhece fica para os textos da fundação (nulo). */
export function textoDoErroPublicar(t: Pick<TextosPublicar, "erros">, codigo: string): string | null {
  const chave = codigo.replace(":", "_");
  return (t.erros as Record<string, string>)[chave] ?? null;
}
