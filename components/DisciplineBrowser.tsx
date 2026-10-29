// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useState } from "react";
import { fill, localePath, plural } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { stageAreas, stages, type AreaSlug, type Stage } from "@/lib/areas";
import { corDaCapa } from "@/lib/capas";
import { useLastLesson } from "@/lib/progress";
import { KEYS, setItem, useHydrated, useStored } from "@/lib/storage";
import { normalize } from "@/lib/text";
import { useI18n } from "./I18n";

export interface DisciplineCard {
  slug: string;
  name: string;
  description: string;
  essential: boolean;
  /** Aulas prontas e planejadas em cada etapa. */
  counts: Record<Stage, [number, number]>;
  /** Os títulos das trilhas da disciplina: a busca também acha "fotossíntese" em Biologia. */
  palavras?: string;
}

export interface DisciplineGroup {
  id: string;
  title: string;
  areas: DisciplineCard[];
}

type Filter = "todas" | "essencial" | "revolucao" | Stage;

/** Os grupos do filtro "Revolução e militância": a teoria revolucionária e as lutas do povo. */
const REVOLUCAO = ["teoria", "lutas"];

/** Na página inicial, quantas disciplinas cada grupo mostra antes de "ver todas": duas linhas na tela larga. */
const PRIMEIRAS = 6;

/**
 * As disciplinas, com um filtro para quem não quer ver tudo de uma vez: só o essencial, ou só o que
 * tem trilha no ensino fundamental, no médio ou no superior. A escolha fica guardada neste navegador.
 * Em cada grupo vêm primeiro as disciplinas com mais aulas prontas. Na página inicial ("labels") só as
 * primeiras aparecem de cara: quem chega encontra conteúdo, não uma parede de cartões.
 */
export function DisciplineBrowser({ groups, s, stageNames, labels = false }: { labels?: boolean; groups: DisciplineGroup[]; s: Dict["tracks"]; stageNames: Dict["stages"] }) {
  const { lang, t } = useI18n();
  const hydrated = useHydrated();
  const stored = useStored(KEYS.filter);
  const [abertos, setAbertos] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const termos = normalize(busca).split(/\s+/).filter(Boolean);
  const filter: Filter = hydrated && (stored === "essencial" || stored === "revolucao" || (stages as readonly string[]).includes(stored)) ? (stored as Filter) : "todas";
  const options: [Filter, string][] = [["todas", s.filterAll], ["essencial", s.filterEssential], ["revolucao", s.filterRevolution], ...stages.map((stage): [Filter, string] => [stage, stageNames[stage]])];
  // O caderno da última aula estudada leva o caquinho de azulejo na etiqueta (só um por estante).
  const ultima = useLastLesson()?.area;

  const total = (card: DisciplineCard): [number, number] =>
    filter === "todas" || filter === "essencial" || filter === "revolucao" ? stages.reduce<[number, number]>((sum, stage) => [sum[0] + card.counts[stage][0], sum[1] + card.counts[stage][1]], [0, 0]) : card.counts[filter];
  const casa = (card: DisciplineCard) => !termos.length || termos.every((termo) => normalize(`${card.name} ${card.description} ${card.palavras ?? ""}`).includes(termo));
  const shown = (card: DisciplineCard) => casa(card) && (filter === "todas" || filter === "revolucao" ? true : filter === "essencial" ? card.essential : stageAreas[filter].includes(card.slug as AreaSlug));
  // As mais completas primeiro (mais aulas prontas); no empate, vale a ordem de sempre.
  const visible = groups
    .filter((group) => filter !== "revolucao" || REVOLUCAO.includes(group.id))
    .map((group) => ({
      ...group,
      areas: group.areas
        .filter(shown)
        .map((card, i) => ({ card, i }))
        .sort((a, b) => total(b.card)[0] - total(a.card)[0] || a.i - b.i)
        .map(({ card }) => card),
    }))
    .filter((group) => group.areas.length > 0);

  const Title = labels ? "h3" : "h2";
  // As capas dos cadernos: cores do cartaz e dos panos, a mesma para a mesma disciplina em qualquer página.
  const capa = corDaCapa;

  return (
    <div>
      {/* Busca: pelo nome, pela descrição e pelos títulos das trilhas. Com busca, os grupos abrem inteiros. */}
      {!labels && (
        <div role="search" className="no-print mt-8 flex max-w-2xl border-2 border-ink bg-folha shadow-[5px_5px_0_var(--sombra)]">
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label={s.searchLabel} placeholder={s.searchPlaceholder} className="min-w-0 flex-1 bg-transparent px-4 py-3.5 font-sans text-base outline-none placeholder:text-ink-soft" />
          {busca && <button type="button" onClick={() => setBusca("")} className="cursor-pointer px-4 font-sans text-sm underline">{s.searchClear}</button>}
        </div>
      )}
      {/* O filtro em abas de pasta de arquivo, assentadas no fio de tinta. */}
      <div role="group" aria-label={s.filter} className="no-print mt-8 flex flex-wrap items-end gap-1.5 border-b-2 border-ink">
        {options.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setItem(KEYS.filter, value === "todas" ? null : value)} aria-pressed={filter === value} className="aba-pasta">
            {label}
          </button>
        ))}
      </div>
      {filter === "essencial" && <p className="mt-3 font-sans text-sm text-ink-soft">{s.filterEssentialHint}</p>}
      {filter === "revolucao" && <p className="mt-3 font-sans text-sm text-ink-soft">{s.filterRevolutionHint}</p>}
      {visible.length > 1 && !labels && (
        <nav aria-label={s.jump} className="no-print mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-sm">
          <span className="text-ink-soft">{s.jump}:</span>
          {visible.map((group) => (
            <a key={group.id} href={`#grupo-${group.id}`} className="py-1 underline decoration-rule underline-offset-4 hover:text-prelo-texto hover:decoration-[#c21f16]">
              {group.title}
            </a>
          ))}
        </nav>
      )}
      {visible.length === 0 && <p className="mt-10 text-lg text-ink-soft">{s.filterNone}</p>}
      {visible.map((group) => {
        // Esconder uma só não vale o botão: com até uma a mais que o limite, o grupo aparece inteiro.
        const recolhe = labels && !termos.length && group.areas.length > PRIMEIRAS + 1;
        const aberto = !recolhe || abertos.includes(group.id);
        const cards = aberto ? group.areas : group.areas.slice(0, PRIMEIRAS);
        const militante = group.id === "teoria" || group.id === "lutas";
        return (
          <section key={group.id} id={`grupo-${group.id}`} className="scroll-mt-24">
            <Title className={`tarja mt-12 ${militante ? "tarja-v" : ""}`}>
              <span className="tarja-nome">{militante ? "★ " : ""}{group.title}</span>
              <span className="tarja-conta">{group.areas.length}</span>
            </Title>
            <div className="mt-6 grid grid-cols-2 gap-5 sm:gap-7 lg:grid-cols-4">
              {cards.map((card, i) => {
                const [ready, planned] = total(card);
                const anchor = filter === "todas" || filter === "essencial" || filter === "revolucao" ? "" : `#${filter}`;
                const cor = capa(card.slug);
                const etapa = card.essential ? s.essentialTag : stages.filter((stage) => card.counts[stage][1] > 0).map((stage) => s.stageShort[stage]).join(" · ");
                return (
                  <Link
                    key={card.slug}
                    href={`${localePath(lang, `/estantes/${card.slug}`)}${anchor}`}
                    className={`caderno min-h-56 sm:min-h-64 ${i % 2 ? "caderno-v" : ""}`}
                    style={{ background: cor, ...(cor === "#c21f16" ? { boxShadow: "6px 6px 0 var(--sombra)" } : {}) }}
                  >
                    <span className="flex items-start justify-between gap-2 pt-4 pr-4 pl-8 font-mono text-[0.62rem] uppercase tracking-[0.16em] sm:pt-5 sm:pr-5 sm:pl-9 sm:text-[0.68rem]">
                      <span className="line-clamp-2">{etapa}</span>
                    </span>
                    <span className="etiqueta relative mx-3 mt-4 ml-8 block px-3 py-2.5 sm:mr-5 sm:ml-9 sm:px-3.5 sm:py-3">
                      {ultima === card.slug && <span aria-hidden className="caquinho-de-azulejo" />}
                      <span className="block text-[1.2rem] font-semibold leading-[1.05] sm:text-[1.5rem]">{card.name}</span>
                      <span className="mt-1 block line-clamp-3 text-[0.85rem] leading-snug text-[#5a4e3c] sm:text-[0.95rem]">{card.description}</span>
                    </span>
                    <span className="mt-auto flex items-end justify-between gap-2 pt-4 pr-4 pb-4 pl-8 font-mono text-[0.68rem] uppercase tracking-[0.1em] sm:pr-5 sm:pb-5 sm:pl-9 sm:text-xs">
                      <span aria-label={fill(s.ready, { a: ready, b: planned })}>{plural(lang, ready, t.common.lessons)} →</span>
                    </span>
                  </Link>
                );
              })}
            </div>
            {recolhe && (
              <button
                type="button"
                aria-expanded={aberto}
                onClick={() => setAbertos((lista) => (aberto ? lista.filter((id) => id !== group.id) : [...lista, group.id]))}
                className="botao botao-papel botao-menor no-print mt-6"
              >
                {aberto ? s.showLess : fill(s.showAll, { n: group.areas.length })}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
