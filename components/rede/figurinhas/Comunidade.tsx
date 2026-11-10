// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { enderecos } from "@/lib/rede/tipos";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { ComunidadeParaMencao } from "@/lib/rede/tipos-stories";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["figurinha"]["comunidade"];

const IconeComunidade = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="9" cy="9" r="3.2" />
    <circle cx="17" cy="10" r="2.4" />
    <path d="M3.5 19c.6-3 3-4.6 5.5-4.6s4.9 1.6 5.5 4.6M14.5 15.2c.8-.5 1.6-.7 2.5-.7 2 0 3.6 1.3 4 3.8" />
  </svg>
);

/**
 * A menção de comunidade no visor: a ficha com o nome (o nome vem da comunidade, nunca do pedido). Com atalho, leva à comunidade;
 * sem (comunidade fechada para quem não é membro, ou que sumiu), é só o nome. Nenhum número de membros.
 */
export function ComunidadeVer({ slug, nome, lang, t }: { slug: string | null; nome: string; lang: string; t: T }) {
  const corpo = (
    <>
      <IconeComunidade />
      <span>{nome}</span>
    </>
  );
  return (
    <div className="al-fg-link-caixa">
      {slug ? (
        <Link href={enderecos.comunidade(lang, slug)} className="al-fg al-fg-comunidade al-fg-torto-esq" aria-label={preencherStory(t.abrir, { nome })}>
          {corpo}
        </Link>
      ) : (
        <span className="al-fg al-fg-comunidade al-fg-torto-esq">{corpo}</span>
      )}
    </div>
  );
}

/** A menção no "criar": escolher uma das minhas comunidades (lista que o banco devolve; sem contagem de ninguém). */
export function ComunidadeEditar({ t, lista, slug, aoEscolher }: { t: T; lista: ComunidadeParaMencao[] | null; slug: string | null; aoEscolher: (c: ComunidadeParaMencao) => void }) {
  return (
    <div className="al-fg al-fg-papel al-fg-torto-esq">
      <p className="al-fg-etiqueta" aria-hidden>
        {t.rotulo}
      </p>
      {lista === null ? (
        <p className="al-fg-nota" role="status">
          {t.carregando}
        </p>
      ) : lista.length === 0 ? (
        <p className="al-fg-nota">{t.nenhuma}</p>
      ) : (
        <label className="al-fg-comunidade-escolha">
          <span className="sr-only">{t.escolha}</span>
          <select className="al-fg-campo" value={slug ?? ""} onChange={(e) => {
            const c = lista.find((x) => x.slug === e.target.value);
            if (c) aoEscolher(c);
          }}>
            <option value="" disabled>
              {t.escolha}
            </option>
            {lista.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
