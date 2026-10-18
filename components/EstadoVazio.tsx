// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { L, useI18n } from "./I18n";

interface Textos {
  what: string;
  state: string;
  act: string;
  related: string;
}

/**
 * O estado vazio de uma página que ainda não tem conteúdo: diz o que vai aparecer, em que pé está, como a pessoa
 * participa agora e para onde ir enquanto isso. Some sozinho quando o conteúdo chega.
 */
export function EstadoVazio({ textos, acaoHref, aoAgir, relacionadoHref }: { textos: Textos; acaoHref?: string; aoAgir?: () => void; relacionadoHref: string }) {
  const { t } = useI18n();
  const botao = "inline-block bg-ink px-5 py-2.5 font-sans text-sm font-semibold text-parchment hover:bg-oxblood";
  return (
    <section className="mt-8 border-2 border-ink bg-parchment-deep p-6 sm:p-8">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gold">{t.lists.whatHere}</p>
      <p className="mt-2 max-w-2xl font-serif text-xl leading-snug">{textos.what}</p>
      <p className="mt-3 font-sans text-sm text-ink-soft">{textos.state}</p>
      <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 font-sans text-sm">
        {aoAgir ? (
          <button type="button" onClick={aoAgir} className={`${botao} cursor-pointer`}>{textos.act}</button>
        ) : (
          <L href={acaoHref ?? "/voluntarios"} className={botao}>{textos.act}</L>
        )}
        <L href={relacionadoHref} className="underline hover:text-oxblood">{textos.related} →</L>
      </p>
    </section>
  );
}
