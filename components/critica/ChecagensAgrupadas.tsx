// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { normalize } from "@/lib/text";
import { CopiarLink } from "../CopiarLink";
import { useI18n } from "../I18n";
import { campoDeBusca } from "./ListaComBusca";

export interface ChecagemNaLista {
  id: string;
  tema?: string;
  veredito: string;
  /** Texto em que a busca procura (alegação, resposta, selo, texto). */
  chaves: string;
  /** O cartão inteiro, já montado no servidor (a checagem completa vem fechada dentro dele). */
  node: ReactNode;
}

/**
 * As checagens agrupadas por tema, cada uma mostrando a alegação, o selo e a resposta curta; o texto inteiro e as fontes
 * abrem no próprio cartão. Busca, filtro de tema e de selo; quem chega com #checagem no endereço já a encontra aberta.
 */
export function ChecagensAgrupadas({ itens, s, temas, vereditos }: { itens: ChecagemNaLista[]; s: Dict["factCheck"]; temas: readonly string[]; vereditos: readonly string[] }) {
  const { t } = useI18n();
  const [digitado, setDigitado] = useState("");
  const [tema, setTema] = useState("");
  const [veredito, setVeredito] = useState("");
  const chaves = useMemo(() => new Map(itens.map((i) => [i.id, normalize(i.chaves)])), [itens]);
  const termo = normalize(digitado.trim());
  const vistos = itens.filter((i) => (!termo || chaves.get(i.id)?.includes(termo)) && (!tema || i.tema === tema) && (!veredito || i.veredito === veredito));
  const nomes = s.themes as Record<string, string>;
  const grupos = [...temas.map((id) => ({ id, nome: nomes[id] ?? id, itens: vistos.filter((i) => i.tema === id) })), { id: "", nome: s.checksTitle, itens: vistos.filter((i) => !i.tema || !temas.includes(i.tema)) }].filter((g) => g.itens.length > 0);
  const usados = vereditos.filter((v) => itens.some((i) => i.veredito === v));

  useEffect(() => {
    const abrir = (limpar: boolean) => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      // Um filtro ligado pode estar escondendo a checagem do link: limpa os filtros antes de abrir.
      if (limpar && !document.getElementById(id) && itens.some((i) => i.id === id)) {
        flushSync(() => {
          setDigitado("");
          setTema("");
          setVeredito("");
        });
      }
      const alvo = document.getElementById(id);
      const detalhe = alvo?.querySelector("details");
      if (alvo && detalhe) {
        detalhe.open = true;
        alvo.scrollIntoView({ block: "start" });
      }
    };
    abrir(false);
    const aoMudar = () => abrir(true);
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, [itens]);

  return (
    <>
      <div className="no-print grid gap-5 font-sans">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <label className="block w-full max-w-md text-sm font-semibold">
            {t.lists.find}
            <input type="search" value={digitado} onChange={(e) => setDigitado(e.target.value)} maxLength={80} className={campoDeBusca} />
          </label>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft" role="status">
            {fill(t.lists.count, { n: vistos.length })}
          </p>
        </div>
        <div role="group" aria-label={s.allThemes} className="flex flex-wrap items-end gap-1.5 border-b-2 border-ink">
          <button type="button" aria-pressed={tema === ""} onClick={() => setTema("")} className="aba-pasta">{s.allThemes}</button>
          {temas
            .filter((id) => itens.some((i) => i.tema === id))
            .map((id) => (
              <button key={id} type="button" aria-pressed={tema === id} onClick={() => setTema(id === tema ? "" : id)} className="aba-pasta">
                {nomes[id] ?? id}
              </button>
            ))}
        </div>
        {usados.length > 1 && (
          <div role="group" aria-label={s.allVerdicts} className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={veredito === ""} onClick={() => setVeredito("")} className="chip-filtro">{s.allVerdicts}</button>
            {usados.map((v) => (
              <button key={v} type="button" aria-pressed={veredito === v} onClick={() => setVeredito(v === veredito ? "" : v)} className="chip-filtro" lang="pt-BR">
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {grupos.map((g) => (
        <section key={g.id || "outras"} aria-labelledby={`checagens-${g.id || "outras"}`} className="mt-12">
          <h3 id={`checagens-${g.id || "outras"}`} className="flex items-baseline gap-3 border-b-[3px] border-double border-ink pb-2 font-serif text-[1.7rem] font-semibold leading-tight">
            {g.nome}
            <span className="font-mono text-xs font-normal text-ink-soft">{g.itens.length}</span>
          </h3>
          <div className="mt-6 flex flex-col gap-8">
            {g.itens.map((i) => (
              <div key={i.id} id={i.id} className="relative scroll-mt-40">
                <CopiarLink id={i.id} className="no-print absolute top-3 right-4 z-[1] inline-flex min-h-11 items-center" />
                {i.node}
              </div>
            ))}
          </div>
        </section>
      ))}
      {vistos.length === 0 && <p className="mt-6 text-lg text-ink-soft">{t.lists.none}</p>}
    </>
  );
}
