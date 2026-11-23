// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os ganchos do grupo "cartão do post" (prompt 4, itens 30, 31, 35 e 120): os textos (i18n/rede/cartao-do-post; pt é o texto
// final, os outros têm "_rascunho" até a revisão) e a paleta de reações da comunidade de um post. Desligado
// ("alumia-p4-cartao-do-post"), nada é pedido: a paleta é a fechada de sempre.
import { useEffect, useState } from "react";
import type pt from "../../../../i18n/rede/cartao-do-post/pt.json";
import { cartaoP4Ligado } from "../../../../lib/rede/p4/cartao/ligado";
import { clienteDoCartao, PREVIA_DO_CARTAO, type ReacoesDaComunidade } from "../../../../lib/rede/p4/cartao/cliente";
import { paletaDoPost } from "../../../../lib/rede/p4/cartao/regras";
import { prontoOu } from "../../../../lib/rede/textos-prontos";
import { REACOES } from "../../../../lib/rede/tipos-conversa";

export type TextosDoCartaoP4 = typeof pt;

/** O grupo está ligado nesta montagem (ou na prévia)? */
export const CARTAO_P4 = PREVIA_DO_CARTAO || cartaoP4Ligado();

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;
const portugues = async () => ((await import("../../../../i18n/rede/cartao-do-post/pt.json")) as { default: TextosDoCartaoP4 }).default;

export async function carregarTextosDoCartaoP4(lang: string): Promise<TextosDoCartaoP4> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../../i18n/rede/cartao-do-post/${l}.json`)) as { default: TextosDoCartaoP4 }).default, portugues);
  } catch {
    return portugues();
  }
}

/** Os textos no idioma da página; `null` enquanto chegam (ou com o grupo desligado). */
export function useTextosDoCartaoP4(lang: string, ligado = CARTAO_P4): TextosDoCartaoP4 | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDoCartaoP4 } | null>(null);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    void carregarTextosDoCartaoP4(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang, ligado]);
  return ligado && pronto?.lang === lang ? pronto.t : null;
}

// A lista de cada comunidade, pedida uma vez por aba (e de novo depois que a mediação muda).
const pedidas = new Map<string, Promise<ReacoesDaComunidade | null>>();
const ouvintes = new Set<() => void>();

/** Pede (ou reaproveita) a lista de reações de uma comunidade; nula se não deu (a tela fica com a fechada). */
export function pedirReacoesDaComunidade(slug: string): Promise<ReacoesDaComunidade | null> {
  let p = pedidas.get(slug);
  if (!p) {
    p = clienteDoCartao.reacoesDaComunidade(slug).catch(() => null);
    pedidas.set(slug, p);
  }
  return p;
}

/** A mediação mudou a lista: esquece a guardada e avisa quem mostra reações. */
export function esquecerReacoesDaComunidade(slug: string): void {
  pedidas.delete(slug);
  for (const o of ouvintes) o();
}

/**
 * A paleta de reações de um post da comunidade `slug`: a lista que a mediação escolheu, ou `null` (a fechada de sempre) sem
 * comunidade, com o grupo desligado ou enquanto a resposta não chega.
 */
export function usePaletaDaComunidade(slug: string | null | undefined): string[] | null {
  const [paleta, setPaleta] = useState<{ slug: string; lista: string[] } | null>(null);
  const [rodada, setRodada] = useState(0);
  useEffect(() => {
    const mudou = () => setRodada((n) => n + 1);
    ouvintes.add(mudou);
    return () => {
      ouvintes.delete(mudou);
    };
  }, []);
  useEffect(() => {
    if (!CARTAO_P4 || !slug) return;
    let vivo = true;
    void pedirReacoesDaComunidade(slug).then((r) => {
      if (vivo && r) setPaleta({ slug, lista: paletaDoPost(r.emojis, REACOES.map((x) => x.emoji)) });
    });
    return () => {
      vivo = false;
    };
  }, [slug, rodada]);
  return CARTAO_P4 && slug && paleta?.slug === slug ? paleta.lista : null;
}
