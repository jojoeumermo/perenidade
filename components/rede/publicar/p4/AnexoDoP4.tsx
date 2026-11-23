// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/Link";
import { ligado, type Recurso } from "@/lib/recursos";
import { preencher } from "@/lib/rede/preencher";
import { totalDoConvite } from "@/lib/rede/publicar/p4-compositor";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../../encaixes";
import { LinkDoLeitor } from "../../protecao/LinkDoLeitor";
import { useExtrasDoPost } from "./lote";
import { useTextosDoP4 } from "./textos";
import "./p4.css";

// A leitura em páginas só baixa quando alguém toca em "Ler em páginas".
const LeituraEmPaginas = dynamic(() => import("./LeituraEmPaginas"), { ssr: false });

/**
 * O que o compositor do prompt 4 pendura embaixo do texto do cartão (encaixe anexosDoCartao; o cartão não muda):
 *   - a versão curta que a autora escreveu (item 117);
 *   - no texto longo com 2 capítulos ou mais, "N capítulos" e "Ler em páginas" (item 26: índice, capa e uma página por capítulo);
 *   - no post-convite, "Mande a sua", o total de pessoas diferentes que responderam só a partir de 3 (abaixo, nenhum número), e
 *     o caminho para responder (item 29). Ninguém vê quem respondeu: o banco só devolve o número;
 *   - o selo "Com fonte" e a fonte (item 118). Com "assinar junto" (alumia-coautoria) ligado, o link da fonte já aparece no anexo
 *     dele: aqui fica só o selo, para não repetir.
 * Post cifrado não recebe nada (o banco não devolve). Desligado, não pede nada ao banco.
 */
export default function AnexoDoP4({ post, lang }: ContextoDoEncaixe & { post: Post }) {
  const e = useExtrasDoPost(post.id, !post.corpo_grupo);
  const t = useTextosDoP4(lang, e !== null);
  const [lendo, setLendo] = useState(false);
  if (!e || !t) return null;
  const total = totalDoConvite(e.total);
  const coautoria = ligado("alumia-coautoria" as Recurso);
  const fonteVale = e.fonte?.vale ?? null;
  const fonteLink = e.fonte?.link ?? null;
  return (
    // Os toques aqui dentro não abrem o post (o cartão inteiro é clicável).
    <div className="p4c-anexo" data-p4c="anexo" onClick={(x) => x.stopPropagation()}>
      {e.resumo && (
        <p className="p4c-curta">
          <strong>{t.cartao.versaoCurta}</strong>
          {e.resumo}
        </p>
      )}
      {e.capitulos && e.capitulos >= 2 && (
        <div className="p4c-linha">
          <span className="p4c-selo">{preencher(t.cartao.capitulos, { n: e.capitulos })}</span>
          <button type="button" className="p4c-botao" onClick={() => setLendo(true)} aria-haspopup="dialog">
            {t.cartao.lerEmPaginas}
          </button>
        </div>
      )}
      {e.convite && (
        <div className="p4c-convite">
          <span className="p4c-convite-nome al-cond">{t.cartao.convite}</span>
          <span>{total !== null ? preencher(t.cartao.conviteTotal, { n: total }) : t.cartao.conviteSemTotal}</span>
          <Link href={`/${lang}/alumia/p/${post.id}`} className="p4c-botao justify-self-start" aria-label={t.cartao.mandar}>
            {t.cartao.responder}
          </Link>
        </div>
      )}
      {(fonteLink || fonteVale) && (
        <p className="p4c-linha">
          <span className="p4c-selo p4c-selo-fonte" title={t.cartao.ajudaDoSelo}>
            {t.cartao.comFonte}
          </span>
          {!coautoria && fonteVale && (
            <Link href={`/${lang}/vale-o-escrito/caso/${fonteVale}`} className="p4c-fonte-link">
              {t.cartao.fonteVale}
            </Link>
          )}
          {!coautoria && fonteLink && (
            // O link passa pela mesma conferência dos links de quem lê (o marcado como perigoso sai sem clique).
            <LinkDoLeitor href={fonteLink} lang={lang} className="p4c-fonte-link">
              {(() => {
                try {
                  return new URL(fonteLink).hostname;
                } catch {
                  return fonteLink;
                }
              })()}
            </LinkDoLeitor>
          )}
        </p>
      )}
      {lendo && typeof document !== "undefined" && createPortal(<LeituraEmPaginas post={post} capa={e.capa ?? null} t={t} lang={lang} aoFechar={() => setLendo(false)} />, document.body)}
    </div>
  );
}
