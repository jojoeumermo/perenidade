// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { normalize } from "@/lib/text";
import { CopiarLink } from "./CopiarLink";
import { L } from "./I18n";

export interface FalaciaItem {
  slug: string;
  name: string;
  original?: string;
  summary: string;
  family: string;
  what: string;
  everyday: string;
  publicDebate: string;
  reply: string;
  related: { slug: string; name: string }[];
  /** Cartões de debate que usam esta falácia. */
  debates: { slug: string; claim: string }[];
  untranslated: boolean;
  /** Fontes e texto longo, já montados no servidor. */
  extra: ReactNode;
}

/**
 * O guia das falácias como um baralho: uma carta por falácia, na cor da família (razões que não vêm ao caso, provas
 * fracas, premissas escondidas, desvios, confusões de sentido), com o nome e o truque em uma frase. Tocar vira a carta:
 * a ficha inteira (o que é, no dia a dia, no debate público, como responder, parecidas, fontes) abre na largura da
 * mesa, uma por vez. As famílias viram abas; a busca procura no nome, no nome em latim e no resumo.
 */
export function FalaciasList({ items, s }: { items: FalaciaItem[]; s: Dict["fallacies"] }) {
  const [family, setFamily] = useState("");
  const [typed, setTyped] = useState("");
  const families = s.families as Record<string, string>;
  const wanted = normalize(typed.trim());
  const shown = items.filter((item) => (!family || item.family === family) && (!wanted || normalize(`${item.name} ${item.original ?? ""} ${item.summary}`).includes(wanted)));
  const original = (item: FalaciaItem) => (item.untranslated ? { lang: "pt-BR" } : {});

  // O link com #falacia (de outra página, ou das "parecidas") abre a carta, limpando os filtros se ela estiver escondida.
  useEffect(() => {
    const abrir = (limpar: boolean) => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      if (limpar && !document.getElementById(id) && items.some((item) => item.slug === id)) {
        flushSync(() => {
          setFamily("");
          setTyped("");
        });
      }
      const alvo = document.getElementById(id);
      if (alvo instanceof HTMLDetailsElement) {
        alvo.open = true;
        alvo.scrollIntoView({ block: "start" });
      }
    };
    abrir(false);
    const aoMudar = () => abrir(true);
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, [items]);

  return (
    <>
      <div className="no-print mt-10 grid gap-4 font-sans text-sm">
        <div role="group" aria-label={s.filter} className="flex flex-wrap items-end gap-1.5 border-b-2 border-ink">
          <button type="button" aria-pressed={family === ""} onClick={() => setFamily("")} className="aba-pasta">
            {s.all} <span className="conta-aba">{items.length}</span>
          </button>
          {Object.entries(families).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={family === id} onClick={() => setFamily(id === family ? "" : id)} className={`aba-pasta carta-aba-${id}`}>
              {label} <span className="conta-aba">{items.filter((item) => item.family === id).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <label className="block w-full max-w-md font-semibold">
            {s.find}
            <input type="search" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={60} className="mt-1 w-full border-2 border-ink bg-folha px-3 py-2 font-normal" />
          </label>
          <p className="font-mono text-xs text-ink-soft" role="status">
            {fill(s.count, { n: shown.length })}
          </p>
        </div>
      </div>

      <ul aria-label={s.title} className="baralho mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => (
          <li key={item.slug} className="baralho-item min-w-0">
            <details
              id={item.slug}
              name="falacias"
              className={`carta carta-${item.family} scroll-mt-24`}
              onToggle={(e) => {
                const carta = e.currentTarget;
                if (!carta.open || location.hash === `#${item.slug}`) return;
                const leve = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                carta.scrollIntoView({ block: "nearest", behavior: leve ? "auto" : "smooth" });
              }}
              {...original(item)}
            >
              <summary className="carta-frente">
                <span className="carta-familia">{families[item.family] ?? item.family}</span>
                <span className="carta-corpo">
                  <h2 className="font-serif text-[1.55rem] font-semibold leading-[1.1] text-balance">{item.name}</h2>
                  {item.original && <span className="mt-1 block font-serif text-base italic text-ink-soft">{item.original}</span>}
                  <span className="mt-3 block text-[1.05rem] leading-snug">{item.summary}</span>
                </span>
              </summary>
              <div className="carta-ficha">
                <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                  {(
                    [
                      [s.what, item.what],
                      [s.everyday, item.everyday],
                      [s.publicDebate, item.publicDebate],
                      [s.reply, item.reply],
                    ] as const
                  ).map(([label, text], i) => (
                    <div key={label} className={i === 3 ? "carta-resposta" : undefined}>
                      <dt className="font-mono text-xs uppercase tracking-widest text-gold">{label}</dt>
                      <dd className="mt-1 text-lg leading-relaxed">{text}</dd>
                    </div>
                  ))}
                </dl>
                {item.related.length > 0 && (
                  <p className="mt-6 font-sans text-sm">
                    <span className="text-ink-soft">{s.related}: </span>
                    {item.related.map((other, i) => (
                      <span key={other.slug}>
                        {i > 0 && " · "}
                        <a href={`#${other.slug}`} className="underline hover:text-oxblood">
                          {other.name}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
                {item.debates.length > 0 && (
                  <p className="mt-2 font-sans text-sm">
                    <span className="text-ink-soft">{s.inDebates}: </span>
                    {item.debates.map((card, i) => (
                      <span key={card.slug}>
                        {i > 0 && " · "}
                        <L href={`/debates#${card.slug}`} className="underline hover:text-oxblood">
                          “{card.claim}”
                        </L>
                      </span>
                    ))}
                  </p>
                )}
                {item.extra}
                <p className="no-print mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <CopiarLink id={item.slug} />
                  <button
                    type="button"
                    onClick={(e) => {
                      const carta = e.currentTarget.closest("details");
                      if (!carta) return;
                      carta.open = false;
                      carta.querySelector("summary")?.focus();
                    }}
                    className="cursor-pointer font-sans text-xs text-ink-soft underline hover:text-oxblood"
                  >
                    {s.close}
                  </button>
                </p>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="mt-6 text-lg text-ink-soft">{s.none}</p>}
    </>
  );
}
