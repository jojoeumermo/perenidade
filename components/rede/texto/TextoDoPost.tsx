// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { temFormatacao } from "@/lib/rede/texto/formatado";
import type { MidiaDoPost } from "@/lib/rede/tipos";
import { TextoComTags } from "../descoberta/TextoComTags";
import { TextoComMencoes } from "../conversa/TextoComMencoes";
import { TextoFormatado, type ImagemDoTexto } from "./TextoFormatado";
import { useImagensDoPost } from "./usarImagensDoPost";

/**
 * O texto de um post no cartão, pronto para trocar o "<p><TextoComTags … Resto={TextoComMencoes} /></p>" de hoje (quem junta troca
 * em CartaoDaAlumia2.tsx e CartaoDePost.tsx). Sem marca de formatação, sai EXATAMENTE o parágrafo de antes (mesma classe, mesmas
 * peças). Com marca, sai o texto formatado num <div> (título, lista, bloco de código e fórmula não cabem dentro de um <p>), com as
 * imagens anexadas no meio quando o texto pede ("![descrição](imagem:2)"): as dadas em `imagens` ou, com `midia` (a do post), as
 * do próprio post, buscadas só quando o texto pede alguma.
 */
export function TextoDoPost({
  texto,
  lang,
  className = "",
  imagens,
  midia,
  citavel,
}: {
  texto: string;
  lang: string;
  className?: string;
  imagens?: readonly ImagemDoTexto[];
  midia?: readonly MidiaDoPost[];
  citavel?: string;
}) {
  const doPost = useImagensDoPost(imagens ? "" : texto, midia);
  if (!temFormatacao(texto)) {
    return (
      <p className={className} data-citavel={citavel}>
        <TextoComTags texto={texto} lang={lang} Resto={TextoComMencoes} />
      </p>
    );
  }
  return (
    <div data-citavel={citavel}>
      <TextoFormatado texto={texto} lang={lang} imagens={imagens ?? doPost} className={className.replace(/\bwhitespace-pre-line\b/, "")} />
    </div>
  );
}
