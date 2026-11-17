// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosEstrutura, textoDeErroEstrutura, type TextosDaEstrutura } from "@/lib/rede/estrutura/textos";
import type { ComunidadeCurta } from "@/lib/rede/estrutura/tipos";
import type { TextosDaRede } from "@/lib/rede/textos";
import { corDaComunidadeNova } from "@/lib/rede/tipos-comunidades";
import { codigoDoErro, textoDoErro } from "../../erros";

const cache = new Map<string, TextosDaEstrutura>();

/** Os textos da estrutura no idioma da página; vêm sob demanda (null enquanto chegam). Com "ativo" falso, não baixa nada. */
export function useTextosEstrutura(lang: string, ativo = true): TextosDaEstrutura | null {
  const [chegou, setChegou] = useState<{ lang: string; texto: TextosDaEstrutura } | null>(null);
  useEffect(() => {
    if (!ativo || cache.has(lang)) return;
    let vivo = true;
    carregarTextosEstrutura(lang)
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

/** O erro vira texto: primeiro os códigos desta frente, depois os da Rede. */
export function mensagemDeErro(s: Pick<TextosDaRede, "erros">, te: Pick<TextosDaEstrutura, "erros"> | null, erro: unknown): string {
  const proprio = te ? textoDeErroEstrutura(te, codigoDoErro(erro)) : null;
  return proprio ?? textoDoErro(s, erro);
}

/** A classe da cor da comunidade (o token --al-com-N, nunca a cor crua). */
export function classeDaCor(c: Pick<ComunidadeCurta, "slug" | "cor">): string {
  return `e10-cor-${corDaComunidadeNova(c.slug, c.cor)}`;
}

/** "Itaquera · São Paulo – SP": o lugar escrito, do menor para o maior. */
export function lugarEscrito(l: { bairro?: string | null; municipio?: string | null; uf?: string | null } | null | undefined): string {
  if (!l || !l.municipio) return "";
  return [l.bairro, l.uf ? `${l.municipio} – ${l.uf}` : l.municipio].filter(Boolean).join(" · ");
}
