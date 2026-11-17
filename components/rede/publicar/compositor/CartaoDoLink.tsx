// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { PreviaDoPost } from "@/lib/rede/tipos-publicar";
import { LinkDoLeitor } from "../../protecao/LinkDoLeitor";
import type { TextosDoCompositor } from "./textos";
import "./compositor.css";

/**
 * A imagem do cartão só pode vir do proxy do nosso servidor (/api/rede/previa/imagem, que busca, limpa e assina): o navegador de quem
 * lê nunca toca no site de fora. Na prévia sem banco, também o desenho de exemplo (data:image/svg+xml, feito no próprio código).
 */
export function imagemDoCartaoPermitida(imagem: string | undefined, previa = false): string | null {
  if (!imagem) return null;
  if (imagem.startsWith("/api/rede/previa/imagem?")) return imagem;
  if (previa && imagem.startsWith("data:image/svg+xml")) return imagem;
  return null;
}

/**
 * O cartão do link (onda 12, 12A: acabamento do L2-28), com o que o servidor já busca hoje (título, resumo e imagem pelo proxy):
 *   · com imagem larga (≥ 1,5:1), a imagem em cima, inteira na largura; sem imagem, ou quadrada, a imagem pequena do lado;
 *   · a imagem que falha some (não fica moldura vazia), e o cartão segue com o texto;
 *   · o domínio numa linha própria, com o selo de cadeado para https; título em até 2 linhas e o resumo em até 3;
 *   · o link passa pela conferência de quem lê (LinkDoLeitor: o link perigoso vira texto, sem clique).
 * `compacto`: dentro do Escrever (a prévia do que vai sair), sem o link de verdade.
 */
export function CartaoDoLink({ previa, lang, t, exemplo = false, compacto = false }: { previa: PreviaDoPost; lang: string; t: TextosDoCompositor | null; exemplo?: boolean; compacto?: boolean }) {
  const imagem = imagemDoCartaoPermitida(previa.imagem, exemplo);
  const [falhou, setFalhou] = useState(false);
  const [larga, setLarga] = useState(true);
  const comImagem = Boolean(imagem) && !falhou;
  const seguro = /^https:/i.test(previa.url);
  const conteudo = (
    <>
      {comImagem && (
        <span className={larga ? "cp-link-imagem cp-link-imagem-larga" : "cp-link-imagem cp-link-imagem-lado"}>
          {/* Endereço do nosso proxy (ou o desenho de exemplo): o next/image não otimiza esse endereço. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagem as string}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFalhou(true)}
            onLoad={(e) => {
              const i = e.currentTarget;
              if (i.naturalWidth && i.naturalHeight) setLarga(i.naturalWidth / i.naturalHeight >= 1.5);
            }}
          />
        </span>
      )}
      <span className="cp-link-texto">
        <span className="cp-link-dominio">
          {seguro && (
            <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 shrink-0">
              <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          )}
          <span className="truncate">{previa.dominio}</span>
        </span>
        {previa.titulo && <span className="cp-link-titulo">{previa.titulo}</span>}
        {previa.descricao && <span className="cp-link-descricao">{previa.descricao}</span>}
        {compacto && t && <span className="cp-link-nota">{t.link.doServidor}</span>}
      </span>
    </>
  );
  const classe = `cp-link ${comImagem && !larga ? "cp-link-lado" : ""} ${compacto ? "cp-link-compacto" : ""}`;
  if (compacto || exemplo) return <span className={`${classe} mt-2`}>{conteudo}</span>;
  return (
    <LinkDoLeitor href={previa.url} lang={lang} className={`${classe} mt-2`}>
      {conteudo}
    </LinkDoLeitor>
  );
}
