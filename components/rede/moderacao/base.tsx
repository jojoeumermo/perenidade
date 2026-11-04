// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosMod, textoDeErroMod, type TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { TextosDaRede } from "@/lib/rede/textos";
import { textoDoErro, codigoDoErro } from "../erros";

/** Classes comuns das telas de moderação (o mesmo desenho do resto da Rede). */
export const estilo = {
  botao: "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-sans text-sm font-bold hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-50",
  botaoForte: "min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-sans text-sm font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50",
  campo: "min-h-11 w-full rounded-lg border border-rule bg-folha px-3 py-2 font-sans",
  caixa: "rounded-lg border border-rule bg-folha p-3 font-sans",
  aba: "min-h-11 flex-1 cursor-pointer px-1 font-sans text-sm font-bold sm:text-base",
} as const;

const cache = new Map<string, TextosDaModeracao>();

/** Os textos do pacote de moderação no idioma da página; vêm sob demanda (null enquanto chegam). Com "ativo" falso, não baixa nada. */
export function useTextosMod(lang: string, ativo = true): TextosDaModeracao | null {
  const [chegou, setChegou] = useState<{ lang: string; texto: TextosDaModeracao } | null>(null);
  useEffect(() => {
    if (!ativo || cache.has(lang)) return;
    let vivo = true;
    carregarTextosMod(lang)
      .then((texto) => {
        cache.set(lang, texto);
        if (vivo) setChegou({ lang, texto });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang, ativo]);
  return cache.get(lang) ?? (chegou?.lang === lang ? chegou.texto : null);
}

/** O erro vira texto: primeiro os códigos do pacote, depois os da Rede. */
export function mensagemDeErro(s: Pick<TextosDaRede, "erros">, sm: Pick<TextosDaModeracao, "erros"> | null, erro: unknown): string {
  const proprio = sm ? textoDeErroMod(sm, codigoDoErro(erro)) : null;
  return proprio ?? textoDoErro(s, erro);
}

/** "há 3 dias" simples: só a data local, sem hora, para os avisos de prazo. */
export function dataCurta(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Segundos em texto do modo lento ("1 minuto"), com as palavras do pacote. */
export function tempoLento(sm: TextosDaModeracao, segundos: number): string {
  const tabela = sm.moderar.lento as Record<string, string>;
  return tabela[String(segundos)] ?? `${segundos} s`;
}
