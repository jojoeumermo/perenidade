// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { ligado } from "@/lib/recursos";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

// Os assuntos em alta só descem ao navegador com o interruptor "alumia-linha-aberta" ligado.
const EmAltaNaColuna = dynamic(() => import("../linha/EmAlta").then((m) => m.EmAltaNaColuna), { ssr: false });
// Ajustes → Vida dos posts (onda 9, 9D): só desce quando a pessoa abre os Ajustes.
const AjustesDaVida = dynamic(() => import("./vida/AjustesDaVida").then((m) => m.AjustesDaVida), { ssr: false });
// Ajustes → Interesses na linha (onda 11, 11F): o questionário, só neste aparelho. Muda a ordem Em roda, então só aparece com ela.
const AjustesDosInteresses = dynamic(() => import("../interesses/AjustesDosInteresses").then((m) => m.AjustesDosInteresses), { ssr: false });

/** "Assuntos em alta" na coluna da direita (computador): critério escrito na caixa, lista igual para todo mundo, sem número. */
function AssuntosEmAlta(ctx: ContextoDoEncaixe) {
  return ligado("alumia-linha-aberta") ? <EmAltaNaColuna {...ctx} /> : null;
}

/** O título da seção nos seis idiomas (o mesmo de i18n/rede/publicar/vida/*.json, ajustes.titulo). */
const VIDA_DOS_POSTS: Record<string, string> = {
  pt: "Vida dos posts",
  en: "Life of posts",
  es: "Vida de las publicaciones",
  fr: "Vie des publications",
  ru: "Жизнь постов",
  zh: "帖子的生命",
};

/** O título da seção nos seis idiomas (o mesmo de i18n/rede/interesses/*.json, ajustes.titulo). */
const INTERESSES_NA_LINHA: Record<string, string> = {
  pt: "Interesses na linha",
  en: "Interests in the feed",
  es: "Intereses en el muro",
  fr: "Centres d’intérêt dans le fil",
  ru: "Интересы в ленте",
  zh: "动态中的兴趣",
};

/**
 * Encaixe da F1 (casca, linha, cartão e escrever): o que esta frente pendura nas telas comuns (menu, cartão, compositor, abas, coluna da direita,
 * ajustes, Sair rápido). Tudo o que entrar aqui fica atrás da flag "alumia-2" (lib/recursos.ts) e segue as regras de privacidade
 * do PLANO-ALUMIA §6. Hoje: os assuntos em alta da linha com regra aberta (atrás do interruptor "alumia-linha-aberta") e, da onda 9,
 * a seção Vida dos posts nos Ajustes (apagar depois de X semanas, as escolhas do aparelho e os arquivados).
 */
export const encaixe: Encaixe = {
  colunaDireita: [AssuntosEmAlta],
  secoesDeAjustes: [
    { chave: "vida-dos-posts", titulo: ({ lang }) => VIDA_DOS_POSTS[lang] ?? VIDA_DOS_POSTS.pt, Componente: AjustesDaVida as React.ComponentType<ContextoDoEncaixe> },
    ...(ligado("alumia-linha-aberta")
      ? [{ chave: "interesses", titulo: ({ lang }: ContextoDoEncaixe) => INTERESSES_NA_LINHA[lang] ?? INTERESSES_NA_LINHA.pt, Componente: AjustesDosInteresses as React.ComponentType<ContextoDoEncaixe> }]
      : []),
  ],
};
