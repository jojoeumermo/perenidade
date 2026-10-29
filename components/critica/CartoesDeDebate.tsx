// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { normalize } from "@/lib/text";
import { CopiarLink } from "../CopiarLink";
import { useI18n } from "../I18n";
import { campoDeBusca } from "./campoDeBusca";

export interface CartaoNaLista {
  id: string;
  tema?: string;
  /** Texto em que a busca procura (frase, resposta, aprofundamento). */
  chaves: string;
  /** O cartão inteiro, já montado no servidor. */
  node: ReactNode;
}

/**
 * Os cartões de debate em grade, agrupados por tema: a frase feita e a resposta curta ficam à vista (é o que se copia e
 * manda na conversa), o aprofundamento e as fontes abrem dentro do cartão. Busca e abas de tema; o link com #cartão
 * leva ao cartão certo mesmo com um filtro ligado.
 */
export function CartoesDeDebate({ itens, s, temas }: { itens: CartaoNaLista[]; s: Dict["debates"]; temas: readonly string[] }) {
  const { t } = useI18n();
  const [digitado, setDigitado] = useState("");
  const [tema, setTema] = useState("");
  const chaves = useMemo(() => new Map(itens.map((i) => [i.id, normalize(i.chaves)])), [itens]);
  const termo = normalize(digitado.trim());
  const vistos = itens.filter((i) => (!termo || chaves.get(i.id)?.includes(termo)) && (!tema || i.tema === tema));
  const nomes = s.themes as Record<string, string>;
  const grupos = [...temas.map((id) => ({ id, nome: nomes[id] ?? id, itens: vistos.filter((i) => i.tema === id) })), { id: "", nome: s.title, itens: vistos.filter((i) => !i.tema || !temas.includes(i.tema)) }].filter((g) => g.itens.length > 0);

  useEffect(() => {
    const ir = (limpar: boolean) => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      if (limpar && !document.getElementById(id) && itens.some((i) => i.id === id)) {
        flushSync(() => {
          setDigitado("");
          setTema("");
        });
      }
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    ir(false);
    const aoMudar = () => ir(true);
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, [itens]);

  return (
    <>
      <div className="no-print mt-10 grid gap-4 font-sans">
        <div role="group" aria-label={s.allThemes} className="flex flex-wrap items-end gap-1.5 border-b-2 border-ink">
          <button type="button" aria-pressed={tema === ""} onClick={() => setTema("")} className="aba-pasta">
            {s.allThemes} <span className="conta-aba">{itens.length}</span>
          </button>
          {temas
            .filter((id) => itens.some((i) => i.tema === id))
            .map((id) => (
              <button key={id} type="button" aria-pressed={tema === id} onClick={() => setTema(id === tema ? "" : id)} className="aba-pasta">
                {nomes[id] ?? id} <span className="conta-aba">{itens.filter((i) => i.tema === id).length}</span>
              </button>
            ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <label className="block w-full max-w-md text-sm font-semibold">
            {t.lists.find}
            <input type="search" value={digitado} onChange={(e) => setDigitado(e.target.value)} maxLength={80} className={campoDeBusca} />
          </label>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft" role="status">
            {fill(t.lists.count, { n: vistos.length })}
          </p>
        </div>
      </div>

      {grupos.map((g) => (
        <section key={g.id || "outros"} aria-labelledby={`debates-${g.id || "outros"}`} className="mt-12">
          <h2 id={`debates-${g.id || "outros"}`} className="flex items-baseline gap-3 border-b-[3px] border-double border-ink pb-2 font-serif text-[1.7rem] font-semibold leading-tight">
            {g.nome}
            <span className="font-mono text-xs font-normal text-ink-soft">{g.itens.length}</span>
          </h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {g.itens.map((i) => (
              <li key={i.id} id={i.id} className="relative min-w-0 scroll-mt-28">
                <CopiarLink id={i.id} className="no-print absolute top-3 right-4 z-[1] inline-flex min-h-11 items-center" />
                {i.node}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {vistos.length === 0 && <p className="mt-6 text-lg text-ink-soft">{t.lists.none}</p>}
    </>
  );
}
