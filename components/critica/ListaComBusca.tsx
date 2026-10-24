// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type ReactNode } from "react";
import { fill } from "@/i18n/config";
import { normalize } from "@/lib/text";
import { CopiarLink } from "../CopiarLink";
import { useI18n } from "../I18n";

export interface ItemDaBusca {
  id: string;
  nome: string;
  /** Texto em que a busca procura (nome, resumo, lugar…). */
  chaves: string;
  /** Um dado curto ao lado do nome no índice (ex.: o veredito). */
  meta?: string;
  /** O item inteiro, já montado no servidor. */
  node: ReactNode;
}

const letraDe = (nome: string) => {
  const l = normalize(nome).replace(/[^a-z0-9]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(l) ? l : "#";
};

/** O campo de busca no desenho do caderno: borda de tinta de 2 px e a sombra vermelha quando está em uso. */
export const campoDeBusca =
  "mt-2 block min-h-12 w-full border-2 border-ink bg-folha px-4 py-3 font-sans text-base text-ink outline-none placeholder:text-ink-soft focus:shadow-[4px_4px_0_var(--prelo)]";

/**
 * Lista longa com busca dentro da página, letras A–Z (opcional), índice clicável e "copiar link" em cada item. É a
 * mesma lista das checagens, dos cartões de debate e do memorial; `tom="luto"` é a versão em papel preto do memorial.
 * `grade` põe os itens em colunas (os retratos do memorial).
 */
export function ListaComBusca({ items, az = false, rotulo, tom = "papel", grade = false, indice = true }: { items: ItemDaBusca[]; az?: boolean; rotulo: string; tom?: "papel" | "luto"; grade?: boolean; indice?: boolean }) {
  const { t } = useI18n();
  const [digitado, setDigitado] = useState("");
  const [letra, setLetra] = useState("");
  const termo = normalize(digitado.trim());
  const letras = [...new Set(items.map((i) => letraDe(i.nome)))].sort();
  const vistos = items.filter((i) => (!termo || normalize(i.chaves).includes(termo)) && (!letra || letraDe(i.nome) === letra));
  const luto = tom === "luto";
  const botao = (ativo: boolean) =>
    `flex h-11 min-w-11 cursor-pointer items-center justify-center border-2 px-2 font-mono text-sm ${
      luto
        ? ativo
          ? "border-[#f4ecd8] bg-[#f4ecd8] text-[#1f1a14]"
          : "border-[#5a4e3c] text-[#e9dcbc] hover:border-[#f4ecd8]"
        : ativo
          ? "border-ink bg-ink text-parchment"
          : "border-ink bg-folha text-ink hover:shadow-[3px_3px_0_var(--prelo)]"
    }`;
  return (
    <>
      <div className="no-print font-sans">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <label className={`block w-full max-w-md text-sm font-semibold ${luto ? "text-[#e9dcbc]" : ""}`}>
            {t.lists.find}
            <input
              type="search"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              maxLength={80}
              className={luto ? "mt-2 block min-h-12 w-full border-2 border-[#b3a584] bg-[#2a241b] px-4 py-3 font-sans text-base text-[#f4ecd8] outline-none focus:border-[#f4ecd8]" : campoDeBusca}
            />
          </label>
          <p className={`font-mono text-xs uppercase tracking-[0.16em] ${luto ? "text-[#b3a584]" : "text-ink-soft"}`} role="status">
            {fill(t.lists.count, { n: vistos.length })}
          </p>
        </div>
        {az && letras.length > 3 && (
          <p className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="A–Z">
            <button type="button" onClick={() => setLetra("")} aria-pressed={letra === ""} className={botao(letra === "")}>
              A–Z
            </button>
            {letras.map((l) => (
              <button key={l} type="button" onClick={() => setLetra(l === letra ? "" : l)} aria-pressed={letra === l} className={botao(letra === l)}>
                {l}
              </button>
            ))}
          </p>
        )}
        {indice && vistos.length > 1 && (
          <nav aria-label={rotulo} className={`mt-6 border-y-2 py-4 ${luto ? "border-[#5a4e3c]" : "border-ink"}`}>
            <ol className="flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
              {vistos.map((i, n) => (
                <li key={i.id} className="flex items-baseline gap-1.5">
                  <span aria-hidden className={`font-mono text-[0.68rem] ${luto ? "text-[#e0837a]" : "text-prelo-texto"}`}>
                    {String(n + 1).padStart(2, "0")}
                  </span>
                  <a href={`#${i.id}`} className={luto ? "text-[#f4ecd8] underline decoration-[#5a4e3c] underline-offset-4 hover:text-white hover:decoration-[#e0837a]" : "text-ink underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-[#c21f16]"}>
                    {i.nome}
                    {i.meta && <span className={luto ? "text-[#b3a584]" : "text-ink-soft"}> · {i.meta}</span>}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
      <div className={grade ? "mt-10 grid gap-8 md:grid-cols-2" : "mt-10 flex flex-col gap-10"}>
        {vistos.map((i) => (
          <div key={i.id} id={i.id} className="relative scroll-mt-40">
            <CopiarLink id={i.id} className={`no-print absolute top-3 right-4 z-[1] inline-flex min-h-11 items-center ${luto ? "text-[#b3a584]! hover:text-white!" : ""}`} />
            {i.node}
          </div>
        ))}
      </div>
      {vistos.length === 0 && <p className={`mt-6 text-lg ${luto ? "text-[#e9dcbc]" : "text-ink-soft"}`}>{t.lists.none}</p>}
    </>
  );
}
