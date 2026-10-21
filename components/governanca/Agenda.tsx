// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";

export interface Encontro {
  id: string;
  titulo: string;
  tipo: "cineclube" | "leitura" | "outro";
  /** AAAA-MM-DDTHH:MM, horário de Brasília. */
  inicio: string;
  duracao_min: number;
  organizacao: string;
  sala: string;
  descricao: string;
  obra?: { titulo: string; licenca: string; link: string };
}

const TIPOS = { cineclube: "Cineclube", leitura: "Clube de leitura", outro: "Encontro" } as const;
// Brasília não tem horário de verão desde 2019: UTC−3 o ano todo.
const emUtc = (inicio: string, somaMin = 0) => new Date(new Date(`${inicio}:00-03:00`).getTime() + somaMin * 60000);
const carimbo = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapaIcs = (t: string) => t.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

/** O arquivo de calendário (.ics) do encontro, montado no próprio aparelho: nada vai para servidor nenhum. */
function baixarIcs(e: Encontro) {
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Instituto Lucia//Agenda//PT", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${e.id}@institutolucia.org`, `DTSTAMP:${carimbo(new Date())}`, `DTSTART:${carimbo(emUtc(e.inicio))}`, `DTEND:${carimbo(emUtc(e.inicio, e.duracao_min))}`,
    `SUMMARY:${escapaIcs(`${TIPOS[e.tipo]}: ${e.titulo}`)}`, `DESCRIPTION:${escapaIcs(`${e.descricao}\n\nSala: ${e.sala}`)}`, `URL:${e.sala}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// A data de hoje só existe no navegador: no servidor, todos os encontros entram como "próximos".
const assinar = () => () => undefined;
const agora = () => new Date().toISOString().slice(0, 16);

function Cartao({ e, passou }: { e: Encontro; passou?: boolean }) {
  return (
    <li className={`border-[3px] border-ink p-5 ${passou ? "opacity-60" : "bg-parchment-deep"}`}>
      <p className="font-mono text-xs uppercase tracking-widest text-oxblood">{TIPOS[e.tipo]} · {new Date(`${e.inicio}:00-03:00`).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" })} (Brasília)</p>
      <h2 className="mt-1 text-2xl font-semibold">{e.titulo}</h2>
      <p className="mt-2">{e.descricao}</p>
      {e.obra && <p className="mt-2 font-sans text-sm">Obra: <a href={e.obra.link} target="_blank" rel="noopener noreferrer nofollow" className="underline">{e.obra.titulo}</a> · {e.obra.licenca}</p>}
      <p className="mt-1 font-sans text-sm text-ink-soft">Organização: {e.organizacao}</p>
      {!passou && (
        <p className="mt-3 flex flex-wrap gap-3 font-sans">
          <a href={e.sala} target="_blank" rel="noopener noreferrer nofollow" className="border-2 border-ink bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood">Entrar na sala →</a>
          <button type="button" onClick={() => baixarIcs(e)} className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood">Pôr no meu calendário (.ics)</button>
          <span className="self-center text-xs text-ink-soft">A sala é de um site de terceiros.</span>
        </p>
      )}
    </li>
  );
}

export function Agenda({ eventos }: { eventos: Encontro[] }) {
  const hoje = useSyncExternalStore(assinar, agora, () => "");
  const ordem = [...eventos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const proximos = ordem.filter((e) => !hoje || emUtc(e.inicio, e.duracao_min).toISOString().slice(0, 16) >= hoje);
  const passados = hoje ? ordem.filter((e) => !proximos.includes(e)).reverse().slice(0, 6) : [];
  if (eventos.length === 0) return <p className="mt-8 border-2 border-dashed border-rule p-8 text-center font-sans text-ink-soft">Nenhum encontro marcado ainda. Volte em breve.</p>;
  return (
    <div className="mt-8">
      <ul className="space-y-5">{proximos.map((e) => <Cartao key={e.id} e={e} />)}</ul>
      {proximos.length === 0 && <p className="font-sans text-ink-soft">Nenhum encontro marcado daqui para a frente.</p>}
      {passados.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-semibold">Já aconteceram</h2>
          <ul className="mt-3 space-y-3">{passados.map((e) => <Cartao key={e.id} e={e} passou />)}</ul>
        </>
      )}
    </div>
  );
}
