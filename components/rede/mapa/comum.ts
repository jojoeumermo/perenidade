// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { BackendError } from "@/lib/backend";

/** Um gancho de textos com cache por idioma: o arquivo do idioma chega uma vez por aba. */
export function criarUsoDeTextos<T>(carregar: (lang: string) => Promise<T>): (lang: string) => T | null {
  const cache = new Map<string, T>();
  return function useTextos(lang: string): T | null {
    const [chegou, setChegou] = useState<{ lang: string; texto: T } | null>(null);
    useEffect(() => {
      if (cache.has(lang)) return;
      let vivo = true;
      carregar(lang)
        .then((texto) => {
          cache.set(lang, texto);
          if (vivo) setChegou({ lang, texto });
        })
        .catch(() => undefined);
      return () => {
        vivo = false;
      };
    }, [lang]);
    return cache.get(lang) ?? (chegou?.lang === lang ? chegou.texto : null);
  };
}

/** A frase de um erro do banco: o código antes dos dois pontos ("invalido:titulo" → "invalido"); desconhecido cai em "outro". */
export function fraseDoErro(erros: Record<string, string>, e: unknown): string {
  const codigo = e instanceof BackendError ? e.code.split(":")[0] : "";
  return erros[codigo] ?? erros.outro;
}

/** Dia e hora curtos no idioma da tela. */
export function diaCurto(lang: string, iso: string): string {
  return new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}
export function horaCurta(lang: string, iso: string): string {
  return new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
