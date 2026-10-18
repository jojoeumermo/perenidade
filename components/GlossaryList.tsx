// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type ReactNode } from "react";
import type { Dict } from "@/i18n/types";
import { fill } from "@/i18n/config";
import { L, useI18n } from "./I18n";

export interface GlossaryItem {
  slug: string;
  term: string;
  summary: string;
  areas: string[];
  lessons: { href: string; title: string }[];
  original: boolean;
  /** O texto longo do verbete, já montado no servidor. */
  body: ReactNode;
}

/** A lista do glossário, com busca por palavra e filtro pela disciplina em que o termo é usado. */
export function GlossaryList({ items, s }: { items: GlossaryItem[]; s: Dict["glossary"] }) {
  const { t } = useI18n();
  const [area, setArea] = useState("");
  const [typed, setTyped] = useState("");
  const [letra, setLetra] = useState("");
  const [limite, setLimite] = useState(80);
  const name = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const areas = [...new Set(items.flatMap((item) => item.areas))].sort((a, b) => name(a).localeCompare(name(b)));
  const wanted = typed.trim().toLowerCase();
  const letraDe = (termo: string) => {
    const l = termo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
    return /[A-Z]/.test(l) ? l : "#";
  };
  const shown = items.filter((item) => (!area || item.areas.includes(area)) && (!letra || letraDe(item.term) === letra) && (!wanted || item.term.toLowerCase().includes(wanted) || item.summary.toLowerCase().includes(wanted)));
  const letras = [...new Set(items.map((item) => letraDe(item.term)))].sort();
  // Carrega em partes: no celular, quatrocentos verbetes de uma vez pesam.
  const visiveis = shown.slice(0, limite);
  const botaoLetra = (ativo: boolean) => `cursor-pointer border px-2 py-1 font-mono text-xs ${ativo ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`;
  const original = (item: GlossaryItem) => (item.original ? { lang: "pt-BR" } : {});

  return (
    <>
      <div className="no-print mt-8 grid gap-3 font-sans text-sm sm:grid-cols-2">
        <label className="block">
          {s.filter}
          <select value={area} onChange={(e) => setArea(e.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2">
            <option value="">{s.all}</option>
            {areas.map((slug) => (
              <option key={slug} value={slug}>
                {name(slug)} ({items.filter((item) => item.areas.includes(slug)).length})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          {s.find}
          <input type="search" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={60} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
        </label>
      </div>
      <p className="no-print mt-3 flex flex-wrap gap-1 font-sans" role="group" aria-label="A–Z">
        <button type="button" onClick={() => setLetra("")} aria-pressed={letra === ""} className={botaoLetra(letra === "")}>∗</button>
        {letras.map((l) => (
          <button key={l} type="button" onClick={() => { setLetra(l === letra ? "" : l); setLimite(80); }} aria-pressed={letra === l} className={botaoLetra(letra === l)}>{l}</button>
        ))}
      </p>
      <p className="mt-3 font-mono text-xs text-ink-soft" role="status">{fill(s.count, { n: shown.length })}</p>
      <nav aria-label={s.title} className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
        {visiveis.map((item) => (
          <a key={item.slug} href={`#${item.slug}`} className="underline hover:text-oxblood" {...original(item)}>{item.term}</a>
        ))}
      </nav>
      <dl className="mt-10 space-y-8">
        {visiveis.map((item) => (
          <div key={item.slug} id={item.slug} className="scroll-mt-6 border-l-2 border-gold pl-5" {...original(item)}>
            <dt className="text-3xl font-semibold">{item.term}</dt>
            <dd className="mt-2">
              <p className="text-xl italic text-ink-soft">{item.summary}</p>
              {item.body && <div className="mt-3">{item.body}</div>}
              {item.lessons.length > 0 && (
                <p className="mt-3 font-sans text-sm text-ink-soft">
                  {s.usedIn}{" "}
                  {item.lessons.map((lesson, i) => (
                    <span key={lesson.href}>
                      {i > 0 && " · "}
                      <L href={lesson.href} className="underline hover:text-oxblood">{lesson.title}</L>
                    </span>
                  ))}
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {shown.length === 0 && <p className="mt-6 text-lg text-ink-soft">{s.none}</p>}
      {shown.length > visiveis.length && (
        <p className="no-print mt-8 text-center">
          <button type="button" onClick={() => setLimite((n) => n + 80)} className="cursor-pointer border-2 border-ink px-6 py-2.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood">{t.lists.more} ({shown.length - visiveis.length})</button>
        </p>
      )}
    </>
  );
}
