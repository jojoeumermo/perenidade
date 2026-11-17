// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { MidiaDoPost } from "@/lib/rede/tipos";
import { enderecoDaMidia } from "../publicar/api";
import type { ImagemDoTexto } from "./TextoFormatado";

/** O texto pede alguma imagem no meio ("![descrição](imagem:2)")? */
export const pedeImagem = (texto: string) => /\]\(imagem:[1-4]\)/.test(texto);

/**
 * As imagens anexadas ao post, com o endereço assinado do depósito da própria Alumia, só quando o texto pede alguma no meio (sem
 * pedido, nenhuma chamada a mais). Enquanto o endereço não chega, a imagem fica de fora (o texto diz "imagem N" no lugar).
 */
export function useImagensDoPost(texto: string, midia: readonly MidiaDoPost[] | undefined): ImagemDoTexto[] | undefined {
  const precisa = Boolean(midia?.length) && pedeImagem(texto);
  const chave = precisa ? (midia ?? []).map((m) => m.id).join(",") : "";
  const [imagens, setImagens] = useState<{ chave: string; lista: ImagemDoTexto[] } | null>(null);
  useEffect(() => {
    if (!chave || !midia) return;
    let vivo = true;
    Promise.all(
      midia.slice(0, 4).map((m) =>
        enderecoDaMidia(m.id).then(
          (src): ImagemDoTexto => ({ src, alt: m.alt, largura: m.largura, altura: m.altura }),
          () => null,
        ),
      ),
    ).then((lista) => {
      // Uma que falhou não pode puxar as outras de lugar: a "imagem:2" é sempre a segunda.
      if (vivo && lista.every(Boolean)) setImagens({ chave, lista: lista as ImagemDoTexto[] });
    });
    return () => {
      vivo = false;
    };
    // `midia` muda de identidade a cada desenho; a chave (os ids) diz quando mudou de verdade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return imagens?.chave === chave ? imagens.lista : undefined;
}
