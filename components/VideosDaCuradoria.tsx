// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import { normalize } from "@/lib/text";
import { useI18n } from "./I18n";
import { campoDeBusca } from "./critica/campoDeBusca";

export interface CanalDeVideo {
  slug: string;
  title: string;
  channel: string;
  url: string;
  /** O nome da disciplina, já traduzido. */
  area: string;
  grupo: string;
  language: string;
  description: string;
}

/**
 * Os canais e vídeos da curadoria numa grade só, com abas pelos grupos de disciplinas do site e busca no nome, no canal,
 * na disciplina e na descrição. A disciplina vai como etiqueta no cartão (antes era uma seção para cada uma, quase todas
 * com um ou dois canais). Os vídeos abrem no site de quem produziu.
 */
export function VideosDaCuradoria({ canais, grupos, todos }: { canais: CanalDeVideo[]; grupos: { id: string; nome: string }[]; todos: string }) {
  const { t } = useI18n();
  const [grupo, setGrupo] = useState("");
  const [digitado, setDigitado] = useState("");
  const termo = normalize(digitado.trim());
  const vistos = canais.filter((c) => (!grupo || c.grupo === grupo) && (!termo || normalize(`${c.title} ${c.channel} ${c.area} ${c.description}`).includes(termo)));
  const usados = grupos.filter((g) => canais.some((c) => c.grupo === g.id));
  return (
    <>
      <div className="no-print mt-8 grid gap-4 font-sans">
        <div role="group" aria-label={t.nav.disciplines} className="flex flex-wrap items-end gap-1.5 border-b-2 border-ink">
          <button type="button" aria-pressed={grupo === ""} onClick={() => setGrupo("")} className="aba-pasta">
            {todos} <span className="conta-aba">{canais.length}</span>
          </button>
          {usados.map((g) => (
            <button key={g.id} type="button" aria-pressed={grupo === g.id} onClick={() => setGrupo(g.id === grupo ? "" : g.id)} className="aba-pasta">
              {g.nome} <span className="conta-aba">{canais.filter((c) => c.grupo === g.id).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <label className="block w-full max-w-md text-sm font-semibold">
            {t.lists.find}
            <input type="search" value={digitado} onChange={(e) => setDigitado(e.target.value)} maxLength={60} className={campoDeBusca} />
          </label>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft" role="status">
            {fill(t.lists.count, { n: vistos.length })}
          </p>
        </div>
      </div>
      <ul className="mt-8 grid gap-5 font-sans text-sm sm:grid-cols-2 lg:grid-cols-3">
        {vistos.map((c) => (
          <li key={c.slug} className="cartao flex flex-col p-5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] uppercase tracking-[0.1em]">
              <span className="bg-ink px-1.5 py-0.5 text-parchment">{c.area}</span>
              <span className="text-ink-soft">{c.language}</span>
            </p>
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-start gap-2 font-serif text-xl font-semibold leading-snug hover:text-oxblood">
              <span aria-hidden className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center bg-[#c21f16] text-[0.6rem] text-white">▶</span>
              <span>
                {c.title} <span aria-hidden>↗</span>
              </span>
            </a>
            {c.channel !== c.title && <p className="mt-1 text-xs text-ink-soft">{c.channel}</p>}
            <p className="mt-2 leading-relaxed text-ink-soft" lang="pt-BR">
              {c.description}
            </p>
          </li>
        ))}
      </ul>
      {vistos.length === 0 && <p className="mt-6 text-lg text-ink-soft">{t.lists.none}</p>}
    </>
  );
}
