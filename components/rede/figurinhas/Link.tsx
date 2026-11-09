// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId } from "react";
import { dominioDoLink, linkSeguro } from "@/lib/rede/stories/visual";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { LIMITES_DO_STORY } from "@/lib/rede/tipos-stories";
import { IconeLinkFora } from "../stories/icones";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["figurinha"]["link"];

/**
 * O link no visor: só https (conferido de novo aqui), abre fora numa aba nova sem contar de onde veio (noreferrer) e sem prévia
 * buscada no aparelho: quem vê escolhe se abre.
 */
export function LinkVer({ url, rotulo, t }: { url: string; rotulo: string; t: T }) {
  const seguro = linkSeguro(url);
  if (!seguro) return null;
  const dominio = dominioDoLink(seguro);
  return (
    <div className="al-fg-link-caixa">
      <a
        className="al-fg al-fg-link al-fg-torto-dir"
        href={seguro}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        referrerPolicy="no-referrer"
        aria-label={`${rotulo ? `${rotulo}. ` : ""}${preencherStory(t.abrir, { dominio })}`}
      >
        <IconeLinkFora />
        <span>
          {rotulo || dominio}
          {rotulo ? <small> · {dominio}</small> : null}
        </span>
      </a>
    </div>
  );
}

/** O link no "criar": endereço e texto; o aviso aparece se não for https. */
export function LinkEditar({ url, rotulo, t, invalido, aoMudar }: { url: string; rotulo: string; t: T; invalido: string | null; aoMudar: (url: string, rotulo: string) => void }) {
  const id = useId();
  return (
    <div className="al-fg al-fg-papel al-fg-torto-dir">
      <p className="al-fg-etiqueta" aria-hidden>{t.rotulo}</p>
      <label htmlFor={id} className="sr-only">{t.endereco}</label>
      <input
        id={id}
        className="al-fg-campo"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder={t.endereco}
        value={url}
        maxLength={300}
        aria-invalid={!!invalido}
        aria-describedby={invalido ? `${id}-e` : undefined}
        onChange={(e) => aoMudar(e.target.value, rotulo)}
      />
      <label htmlFor={`${id}-t`} className="sr-only">{t.texto}</label>
      <input
        id={`${id}-t`}
        className="al-fg-campo"
        style={{ marginTop: 8 }}
        placeholder={t.texto}
        value={rotulo}
        maxLength={LIMITES_DO_STORY.rotuloDoLink}
        onChange={(e) => aoMudar(url, e.target.value)}
      />
      {invalido ? <p id={`${id}-e`} className="al-fg-nota" style={{ color: "#a5180e", fontWeight: 700 }}>{invalido}</p> : null}
    </div>
  );
}
