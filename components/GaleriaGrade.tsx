// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18n";

export interface Peca {
  slug: string;
  titulo: string;
  autor: string;
  ano: string;
  lugar: string;
  texto: string;
  imagem: string;
  largura: number;
  altura: number;
  fonte: string;
}

/** A galeria em grade de miniaturas; cada cartaz abre ampliado, com autoria, data e contexto. Fecha com Esc ou no botão. */
export function GaleriaGrade({ pecas, publicDomain }: { pecas: Peca[]; publicDomain: string }) {
  const { t } = useI18n();
  const [aberta, setAberta] = useState<Peca | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);
  return (
    <>
      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" lang="pt-BR">
        {pecas.map((peca) => (
          <li key={peca.slug} id={peca.slug} className="scroll-mt-6">
            <button type="button" onClick={() => setAberta(peca)} className="group block w-full cursor-pointer text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={peca.imagem} alt={`${peca.titulo}, ${peca.autor}, ${peca.ano}`} width={peca.largura} height={peca.altura} loading="lazy" decoding="async" className="aspect-[3/4] h-auto w-full border border-rule object-cover group-hover:border-oxblood" />
              <span className="mt-2 block font-serif text-base font-semibold leading-tight group-hover:text-oxblood">{peca.titulo}</span>
              <span className="block font-mono text-[0.65rem] text-ink-soft">{peca.ano} · {peca.autor}</span>
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={dialogo} onClose={() => setAberta(null)} aria-label={aberta?.titulo} className="m-auto max-h-[94vh] w-[min(96vw,64rem)] max-w-none overflow-y-auto border-2 border-ink bg-parchment p-0 text-ink backdrop:bg-black/80">
        {aberta && (
          <div className="grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" lang="pt-BR">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={aberta.imagem} alt={`${aberta.titulo}, ${aberta.autor}, ${aberta.ano}`} width={aberta.largura} height={aberta.altura} className="h-auto max-h-[94vh] w-full object-contain bg-ink" />
            <div className="relative p-6">
              <button type="button" onClick={() => setAberta(null)} aria-label={t.a11y.close} className="absolute top-3 right-3 flex h-11 w-11 cursor-pointer items-center justify-center border-2 border-ink bg-parchment font-sans text-xl font-bold hover:bg-ink hover:text-parchment">✕</button>
              <p className="jornal-editoria pr-12">{aberta.ano} · {aberta.lugar}</p>
              <h2 className="jornal-manchete mt-3 text-2xl">{aberta.titulo}</h2>
              <p className="mt-1 font-sans text-sm text-ink-soft">{aberta.autor}</p>
              <p className="mt-4 leading-relaxed">{aberta.texto}</p>
              <p className="mt-4 font-mono text-[0.7rem] text-ink-soft">
                {publicDomain} <a href={aberta.fonte} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">Wikimedia Commons</a>
              </p>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
