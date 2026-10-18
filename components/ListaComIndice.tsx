// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type ReactNode } from "react";
import { fill } from "@/i18n/config";
import { normalize } from "@/lib/text";
import { CopiarLink } from "./CopiarLink";
import { useI18n } from "./I18n";

export interface ItemDaLista {
  id: string;
  nome: string;
  /** Texto em que a busca procura (nome, resumo, lugar…). */
  chaves: string;
  /** Um dado curto ao lado do nome no índice (ex.: "3 obras"). */
  meta?: string;
  /** O item inteiro, já montado no servidor. */
  node: ReactNode;
}

const letraDe = (nome: string) => {
  const l = normalize(nome).replace(/[^a-z0-9]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(l) ? l : "#";
};

/**
 * Uma lista longa com busca dentro da página, índice A–Z (opcional), índice clicável no topo e "copiar link"
 * em cada item. Serve para autores, memorial, checagens e cartões de debate.
 */
export function ListaComIndice({ items, az = false, rotulo }: { items: ItemDaLista[]; az?: boolean; rotulo: string }) {
  const { t } = useI18n();
  const [digitado, setDigitado] = useState("");
  const [letra, setLetra] = useState("");
  const termo = normalize(digitado.trim());
  const letras = [...new Set(items.map((i) => letraDe(i.nome)))].sort();
  const vistos = items.filter((i) => (!termo || normalize(i.chaves).includes(termo)) && (!letra || letraDe(i.nome) === letra));
  const botao = (ativo: boolean) => `cursor-pointer border px-2 py-1 font-mono text-xs ${ativo ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`;
  return (
    <>
      <div className="no-print mt-8 font-sans text-sm">
        <label className="block max-w-md">
          {t.lists.find}
          <input type="search" value={digitado} onChange={(e) => setDigitado(e.target.value)} maxLength={80} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
        </label>
        {az && letras.length > 3 && (
          <p className="mt-3 flex flex-wrap gap-1" role="group" aria-label="A–Z">
            <button type="button" onClick={() => setLetra("")} aria-pressed={letra === ""} className={botao(letra === "")}>∗</button>
            {letras.map((l) => (
              <button key={l} type="button" onClick={() => setLetra(l === letra ? "" : l)} aria-pressed={letra === l} className={botao(letra === l)}>{l}</button>
            ))}
          </p>
        )}
        <p className="mt-3 font-mono text-xs text-ink-soft" role="status">{fill(t.lists.count, { n: vistos.length })}</p>
        <nav aria-label={rotulo} className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {vistos.map((i) => (
            <a key={i.id} href={`#${i.id}`} className="underline hover:text-oxblood">
              {i.nome}
              {i.meta && <span className="text-ink-soft"> · {i.meta}</span>}
            </a>
          ))}
        </nav>
      </div>
      <div className="mt-10 space-y-6">
        {vistos.map((i) => (
          <div key={i.id} id={i.id} className="relative scroll-mt-6">
            <CopiarLink id={i.id} className="no-print absolute top-2 right-3 z-[1]" />
            {i.node}
          </div>
        ))}
      </div>
      {vistos.length === 0 && <p className="mt-6 text-lg text-ink-soft">{t.lists.none}</p>}
    </>
  );
}
