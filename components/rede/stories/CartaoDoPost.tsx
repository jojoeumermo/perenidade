// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O cartão do post ou do ato que foi "Posto no story": no visor ele leva ao post (ou à página do ato); no "criar" é a prévia de
// como vai ficar. O banco manda só o que quem vê pode ver (interno.rede5_story_post): do ato, o nome, a data, a CIDADE e a
// situação, nunca o ponto exato nem quem vai (LGPD art. 6º, III, necessidade). Post que sumiu vira "indisponível" sem porquê.
import Link from "@/components/Link";
import { enderecos } from "@/lib/rede/tipos";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { CartaoDoPost as Cartao } from "@/lib/rede/tipos-stories";
import { quandoDoAto } from "../figurinhas/Novas";
import { Avatar16 } from "../ui/Avatar16";
import { preencherStory } from "./usar";

type T = TextosDosStories["b1"]["post"];

const IconeAto = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

export function CartaoDoPostNoStory({ cartao, t, lang, previa = false }: { cartao: Cartao; t: T; lang: string; previa?: boolean }) {
  if (cartao.tipo === "indisponivel") {
    return (
      <div className="al-st-cartao al-st-cartao-sumiu" role="note">
        {t.indisponivel}
      </div>
    );
  }
  const corpo =
    cartao.tipo === "ato" ? (
      <>
        <span className="al-st-cartao-tipo">
          <IconeAto />
          {cartao.autora ? preencherStory(t.atoDe, { nome: cartao.autora.nome }) : t.verAto}
        </span>
        <strong className="al-st-cartao-titulo al-cond">{cartao.titulo}</strong>
        <span className="al-st-cartao-quando">
          {quandoDoAto(cartao.inicio, lang)}
          {cartao.cidade ? ` · ${cartao.cidade}` : ""}
        </span>
        {cartao.situacao !== "confirmado" ? (
          <span className="al-st-cartao-situacao" data-situacao={cartao.situacao}>
            {t.situacao[cartao.situacao]}
          </span>
        ) : null}
      </>
    ) : (
      <>
        <span className="al-st-cartao-tipo">
          {cartao.autora ? <Avatar16 handle={cartao.autora.handle} cor={cartao.autora.cor ?? undefined} tamanho={22} /> : null}
          {cartao.autora ? preencherStory(t.de, { nome: cartao.autora.nome }) : t.verPost}
        </span>
        <span className="al-st-cartao-texto">{cartao.texto}</span>
      </>
    );
  if (previa) {
    return (
      <div className="al-st-cartao" data-tipo={cartao.tipo}>
        {corpo}
      </div>
    );
  }
  const href = cartao.tipo === "ato" ? `/${lang}/alumia/ato/${cartao.id}` : enderecos.post(lang, cartao.id);
  return (
    <Link href={href} className="al-st-cartao" data-tipo={cartao.tipo}>
      {corpo}
      <span className="al-st-cartao-ir">
        {cartao.tipo === "ato" ? t.verAto : t.verPost}
        <span aria-hidden> →</span>
      </span>
    </Link>
  );
}
