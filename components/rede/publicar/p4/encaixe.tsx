// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { ligado } from "@/lib/recursos";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe, Encaixe } from "../../encaixes";

// Carregados só quando um cartão ou os Ajustes aparecem.
const AnexoDoP4 = dynamic(() => import("./AnexoDoP4"), { ssr: false });
const FiltroSemDescricao = dynamic(() => import("./FiltroSemDescricao"), { ssr: false });

const TITULO_DO_FILTRO: Record<string, string> = {
  pt: "Imagens sem descrição",
  en: "Images without a description",
  es: "Imágenes sin descripción",
  fr: "Images sans description",
  ru: "Изображения без описания",
  zh: "没有描述的图片",
};

/**
 * Encaixe do compositor do prompt 4 ("alumia-p4-compositor", só pelo nome e desligado). Desligado, fica vazio e nada muda na tela.
 * O que muda no Escrever (versão curta, capa, "Mande a sua", fonte, álbum de 20) fica no próprio Escrever. Pendura:
 *   - no cartão, embaixo do texto: a versão curta, "N capítulos" e a leitura em páginas, o convite com o total (só a partir de 3)
 *     e o selo "Com fonte" (o cartão do post não muda; D10);
 *   - nos Ajustes: o filtro "esconder imagens sem descrição", só no aparelho.
 */
export const encaixe: Encaixe = !ligado("alumia-p4-compositor")
  ? {}
  : {
      anexosDoCartao: [AnexoDoP4 as React.ComponentType<ContextoDoEncaixe & { post: Post }>],
      secoesDeAjustes: [{ chave: "p4-sem-descricao", titulo: ({ lang }) => TITULO_DO_FILTRO[lang] ?? TITULO_DO_FILTRO.pt, Componente: FiltroSemDescricao as React.ComponentType<ContextoDoEncaixe> }],
    };
