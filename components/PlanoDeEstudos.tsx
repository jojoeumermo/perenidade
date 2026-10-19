// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { lerErros } from "@/lib/estudo";
import { useCompleted } from "@/lib/progress";
import { useHydrated } from "@/lib/storage";
import { L, useI18n } from "./I18n";

interface Aula {
  id: string;
  path: string;
  title: string;
}

/**
 * "O que estudar agora?" e o plano de estudos da trilha. Tudo calculado no aparelho, com o que ele já guarda: as aulas
 * concluídas e o caderno de erros (inclusive o da prova da trilha, que serve de nivelamento). O plano vira um arquivo
 * .ics para a agenda da pessoa; nada é enviado.
 */
export function PlanoDeEstudos({ aulas, trilha, temProva, s }: { aulas: Aula[]; trilha: string; temProva: boolean; s: Dict["tracks"] }) {
  const hidratado = useHydrated();
  return hidratado ? <Plano aulas={aulas} trilha={trilha} temProva={temProva} s={s} /> : null;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const diaIso = (d: Date) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
const escaparIcs = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

function Plano({ aulas, trilha, temProva, s }: { aulas: Aula[]; trilha: string; temProva: boolean; s: Dict["tracks"] }) {
  const { lang } = useI18n();
  const feitas = useCompleted();
  const [dias, setDias] = useState<number[]>([1, 3, 5]);
  const [hora, setHora] = useState("19:00");
  const [porDia, setPorDia] = useState(1);
  const [inicio, setInicio] = useState(() => diaIso(new Date()));
  const faltam = aulas.filter((a) => !feitas.has(a.id));
  const proxima = faltam[0];

  // Aulas desta trilha com questões erradas (nas aulas, no simulado ou na prova da trilha), as mais erradas primeiro.
  const prefixo = aulas[0]?.path.split("/").slice(0, 3).join("/") ?? "";
  const erradas = new Map<string, number>();
  for (const erro of lerErros()) if (erro.href && prefixo && erro.href.startsWith(`${prefixo}/`)) erradas.set(erro.href, (erradas.get(erro.href) ?? 0) + 1);
  const rever = [...erradas.entries()]
    .map(([href, n]) => ({ aula: aulas.find((a) => a.path === href), n }))
    .filter((x): x is { aula: Aula; n: number } => Boolean(x.aula))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  // Distribui as aulas que faltam pelos dias escolhidos, a partir da data de início.
  const agenda: { dia: Date; aula: Aula }[] = [];
  if (dias.length) {
    const cursor = new Date(`${inicio}T12:00:00`);
    let i = 0;
    for (let guarda = 0; i < faltam.length && guarda < 3660; guarda++) {
      if (dias.includes(cursor.getDay())) for (let k = 0; k < porDia && i < faltam.length; k++) agenda.push({ dia: new Date(cursor), aula: faltam[i++] });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const formato = new Intl.DateTimeFormat(htmlLang[lang], { weekday: "short", day: "2-digit", month: "2-digit" });
  const formatoLongo = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "long", year: "numeric" });

  function baixar() {
    const [h, m] = hora.split(":").map(Number);
    const agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Instituto Lucia//Plano de estudos//PT", "CALSCALE:GREGORIAN"];
    const porDiaContado = new Map<string, number>();
    agenda.forEach(({ dia, aula }, i) => {
      const chave = diaIso(dia);
      const ordem = porDiaContado.get(chave) ?? 0;
      porDiaContado.set(chave, ordem + 1);
      const comeco = new Date(dia);
      comeco.setHours(h, m + ordem * 30, 0, 0);
      const fim = new Date(comeco.getTime() + 30 * 60 * 1000);
      const local = (d: Date) => `${d.getFullYear()}${doisDigitos(d.getMonth() + 1)}${doisDigitos(d.getDate())}T${doisDigitos(d.getHours())}${doisDigitos(d.getMinutes())}00`;
      linhas.push(
        "BEGIN:VEVENT",
        `UID:plano-${chave}-${i}-${aula.id.replace(/[^a-z0-9-]/gi, "")}@institutolucia.org`,
        `DTSTAMP:${agora}`,
        `DTSTART:${local(comeco)}`,
        `DTEND:${local(fim)}`,
        `SUMMARY:${escaparIcs(`${aula.title} (${trilha})`)}`,
        `URL:${location.origin}/${lang}${aula.path}`,
        `DESCRIPTION:${escaparIcs(`${location.origin}/${lang}${aula.path}`)}`,
        "END:VEVENT",
      );
    });
    linhas.push("END:VCALENDAR");
    const url = URL.createObjectURL(new Blob([linhas.join("\r\n")], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "plano-de-estudos.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mt-8 grid gap-6 font-sans text-sm md:grid-cols-2">
      <section className="border border-rule bg-parchment-deep p-5">
        <h2 className="text-xl font-semibold">{s.nowTitle}</h2>
        <ul className="mt-3 space-y-2">
          {rever.map(({ aula, n }) => (
            <li key={aula.id}>
              <L href={aula.path} className="underline hover:text-oxblood">{fill(s.nowReview, { title: aula.title, n })}</L>
            </li>
          ))}
          {proxima ? (
            <li>
              <L href={proxima.path} className="font-semibold underline hover:text-oxblood">{fill(s.nowNext, { title: proxima.title })}</L>
            </li>
          ) : (
            <li>{s.nowDone}</li>
          )}
        </ul>
        {temProva && rever.length === 0 && <p className="mt-3 text-ink-soft">{s.nowPlacement}</p>}
      </section>
      <section className="border border-rule bg-parchment-deep p-5">
        <h2 className="text-xl font-semibold">{s.planTitle}</h2>
        <p className="mt-1 text-ink-soft">{s.planLead}</p>
        {faltam.length === 0 ? (
          <p className="mt-3">{s.planEmpty}</p>
        ) : (
          <>
            <fieldset className="mt-3">
              <legend>{s.planDays}</legend>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(s.weekdays as string[]).map((nome, d) => (
                  <label key={d} className={`cursor-pointer border-2 px-2.5 py-1 ${dias.includes(d) ? "border-ink bg-ink text-parchment" : "border-rule"}`}>
                    <input type="checkbox" className="sr-only" checked={dias.includes(d)} onChange={() => setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort()))} />
                    {nome}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
              <label className="block">
                {s.planTime}
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value || "19:00")} className="mt-1 w-full border-2 border-ink bg-parchment px-2 py-1.5" />
              </label>
              <label className="block">
                {s.planPerDay}
                <select value={porDia} onChange={(e) => setPorDia(Number(e.target.value))} className="mt-1 w-full border-2 border-ink bg-parchment px-2 py-1.5">
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                {s.planStart}
                <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value || diaIso(new Date()))} className="mt-1 w-full border-2 border-ink bg-parchment px-2 py-1.5" />
              </label>
            </div>
            {agenda.length > 0 ? (
              <>
                <p className="mt-3 font-semibold">{fill(s.planEnds, { date: formatoLongo.format(agenda[agenda.length - 1].dia) })}</p>
                <ol className="mt-2 max-h-48 space-y-0.5 overflow-y-auto font-mono text-xs">
                  {agenda.map(({ dia, aula }, i) => (
                    <li key={`${aula.id}-${i}`}>
                      {formato.format(dia)} · <span className="font-sans">{aula.title}</span>
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={baixar} className="mt-3 cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood">{s.planDownload}</button>
              </>
            ) : (
              <p className="mt-3 text-oxblood">{s.planNone}</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
