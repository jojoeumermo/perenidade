// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { abrirPainel, useCoautoriaDoCartao, type PainelDaCoautoria } from "./use-cartao";

function Icone({ nome }: { nome: PainelDaCoautoria }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {nome === "assinar" && (
        <>
          <path d="M4 18c2.5-3 4-3 5.5 0s3 3 5.5 0" />
          <path d="M14 6l4 4M12.5 7.5l4 4L10 18H6v-4z" />
        </>
      )}
      {nome === "fonte" && (
        <>
          <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
        </>
      )}
      {nome === "marcar" && (
        <>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
          <circle cx="12" cy="11" r="2.5" />
          <path d="M8 18.5c.8-2 2.2-3 4-3s3.2 1 4 3" />
        </>
      )}
    </svg>
  );
}

/**
 * No menu "mais" do cartão (encaixe acoesDoCartao), só para a autora: "Assinar junto", "Pôr a fonte" e, em post com foto que
 * aceita marcação (nunca ato, resposta ou comunidade de luta), "Marcar na foto". Cada um abre o painel embaixo do texto do post
 * (AnexoDaCoautoria). Quem lê pede a fonte pelo "Fonte?" do próprio cartão, fora do menu.
 */
export default function AcoesDaCoautoria({ lang, post, situacao }: ContextoDoEncaixe & { post: Post }) {
  const { c, t } = useCoautoriaDoCartao(post.id, lang);
  if (!t || !situacao.logado || c.convites === null) return null;
  const abrir = (e: React.MouseEvent<HTMLButtonElement>, painel: PainelDaCoautoria) => {
    e.stopPropagation();
    const menu = e.currentTarget.closest("details");
    if (menu) menu.open = false;
    abrirPainel(post.id, painel);
  };
  const classe = "al2-acao justify-start";
  return (
    <>
      {post.resposta_a === null && (
        <button type="button" className={classe} onClick={(e) => abrir(e, "assinar")}>
          <Icone nome="assinar" />
          {t.assinar.menu}
        </button>
      )}
      <button type="button" className={classe} onClick={(e) => abrir(e, "fonte")}>
        <Icone nome="fonte" />
        {c.fonte ? t.fonte.menuTrocar : t.fonte.menu}
      </button>
      {c.marcar_pode && (
        <button type="button" className={classe} onClick={(e) => abrir(e, "marcar")}>
          <Icone nome="marcar" />
          {t.marcar.menu}
        </button>
      )}
    </>
  );
}
