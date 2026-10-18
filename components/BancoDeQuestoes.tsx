// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import { normalize } from "@/lib/text";
import { L, useI18n } from "./I18n";

export interface QuestaoDoBanco {
  id: string;
  area: string;
  trilha: string;
  aula: string;
  href: string;
  pergunta: string;
  opcoes: string[];
  resposta: number;
  explicacao?: string;
}

/** O banco de questões: todas as questões das aulas, com busca, filtro por disciplina, resposta sob clique e sorteio. */
export function BancoDeQuestoes({ questoes }: { questoes: QuestaoDoBanco[] }) {
  const { t } = useI18n();
  const [area, setArea] = useState("");
  const [termo, setTermo] = useState("");
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  const [sorteio, setSorteio] = useState<string[] | null>(null);
  const nome = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const areas = useMemo(() => [...new Set(questoes.map((q) => q.area))].sort((a, b) => nome(a).localeCompare(nome(b))), [questoes]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = normalize(termo.trim());
  const vistas = questoes.filter((q) => (!area || q.area === area) && (!n || normalize(`${q.pergunta} ${q.opcoes.join(" ")} ${q.aula}`).includes(n)) && (!sorteio || sorteio.includes(q.id)));
  return (
    <div className="mt-8 font-sans text-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">{t.lists.find}<input type="search" value={termo} onChange={(e) => { setTermo(e.target.value); setSorteio(null); }} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" /></label>
        <label className="block">{t.nav.disciplines}<select value={area} onChange={(e) => { setArea(e.target.value); setSorteio(null); }} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2"><option value="">{t.lists.anySubject}</option>{areas.map((a) => <option key={a} value={a}>{nome(a)} ({questoes.filter((q) => q.area === a).length})</option>)}</select></label>
        <button type="button" className="self-end cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood" onClick={() => { const base = questoes.filter((q) => !area || q.area === area); setSorteio([...base].sort(() => Math.random() - 0.5).slice(0, 10).map((q) => q.id)); setTermo(""); }}>{t.lists.bankRandom}</button>
      </div>
      <p className="mt-3 font-mono text-xs text-ink-soft" role="status">{fill(t.lists.bankCount, { n: vistas.length })}</p>
      <ol className="mt-4 space-y-4">
        {vistas.slice(0, 200).map((q, i) => (
          <li key={q.id} className="border border-rule bg-parchment-deep p-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">{nome(q.area)} · {q.trilha}</p>
            <p className="mt-1 font-serif text-lg">{i + 1}. {q.pergunta}</p>
            <ol className="mt-2 space-y-1" type="a">
              {q.opcoes.map((o, j) => <li key={j} className={`border px-3 py-1.5 ${abertas[q.id] && j === q.resposta ? "border-ok bg-ok/10 font-semibold" : "border-rule"}`}>{String.fromCharCode(97 + j)}) {o}</li>)}
            </ol>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setAbertas({ ...abertas, [q.id]: !abertas[q.id] })}>{abertas[q.id] ? t.lists.bankHide : t.lists.bankReveal}</button>
              <L href={q.href} className="text-ink-soft underline hover:text-oxblood">{t.lists.bankLesson}: {q.aula}</L>
            </p>
            {abertas[q.id] && q.explicacao && <p className="mt-2 border-l-4 border-gold pl-3">{q.explicacao}</p>}
          </li>
        ))}
      </ol>
      {vistas.length > 200 && <p className="mt-3 text-ink-soft">{fill(t.lists.bankCount, { n: vistas.length })} — use a busca ou o filtro para ver as outras.</p>}
    </div>
  );
}
