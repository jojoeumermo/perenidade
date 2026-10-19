// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { JitsiSala } from "./JitsiSala";
import { useI18n } from "./I18n";

type S = Dict["studyGroup"];
interface Sala {
  id: string;
  inicio: number;
  foco: number;
  pausa: number;
}

/**
 * Sala de estudo em grupo: vídeo pelo mesmo Jitsi das aulas ao vivo e um cronômetro de foco que todo mundo da sala vê
 * igual sem servidor nenhum: o horário de começo vai no próprio link, e cada aparelho calcula a fase pelo relógio.
 */
export function EstudoEmGrupo({ s }: { s: S }) {
  const { lang } = useI18n();
  const [sala, setSala] = useState<Sala | null>(null);
  const [nome, setNome] = useState("");
  const [dentro, setDentro] = useState(false);
  const [agora, setAgora] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const [foco, setFoco] = useState(25);
  const [pausa, setPausa] = useState(5);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("sala") ?? "";
    const inicio = Number(p.get("inicio"));
    if (/^[a-z0-9]{12,40}$/.test(id) && Number.isFinite(inicio) && inicio > 0) {
      const lida = { id, inicio, foco: Math.min(90, Math.max(5, Number(p.get("foco")) || 25)), pausa: Math.min(30, Math.max(1, Number(p.get("pausa")) || 5)) };
      void Promise.resolve().then(() => setSala(lida));
    }
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(relogio);
  }, []);

  function criar() {
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const nova = { id, inicio: Date.now(), foco, pausa };
    window.history.replaceState(null, "", `?sala=${id}&inicio=${nova.inicio}&foco=${foco}&pausa=${pausa}`);
    setSala(nova);
  }

  if (!sala) {
    return (
      <div className="mt-8 max-w-xl space-y-4 font-sans text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            {s.focusMinutes}
            <input type="number" min={5} max={90} value={foco} onChange={(e) => setFoco(Number(e.target.value) || 25)} className="mt-1 block w-full border-2 border-ink bg-parchment px-3 py-2" />
          </label>
          <label className="block">
            {s.breakMinutes}
            <input type="number" min={1} max={30} value={pausa} onChange={(e) => setPausa(Number(e.target.value) || 5)} className="mt-1 block w-full border-2 border-ink bg-parchment px-3 py-2" />
          </label>
        </div>
        <button type="button" onClick={criar} className="cursor-pointer bg-ink px-6 py-3 font-semibold text-parchment hover:bg-oxblood">{s.create}</button>
        <p className="text-ink-soft">{s.note}</p>
      </div>
    );
  }

  const ciclo = (sala.foco + sala.pausa) * 60_000;
  const passado = Math.max(0, (agora || sala.inicio) - sala.inicio);
  const noCiclo = passado % ciclo;
  const emFoco = noCiclo < sala.foco * 60_000;
  const resta = Math.ceil(((emFoco ? sala.foco * 60_000 : ciclo) - noCiclo) / 1000);
  const relogio = `${String(Math.floor(resta / 60)).padStart(2, "0")}:${String(resta % 60).padStart(2, "0")}`;
  const link = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="mt-8 space-y-5 font-sans text-sm">
      <div className={`flex flex-wrap items-center justify-between gap-4 border-2 p-4 ${emFoco ? "border-oxblood" : "border-ok"}`}>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-gold">{emFoco ? s.phaseFocus : s.phaseBreak}</p>
          <p className="font-mono text-5xl" aria-live="off">{relogio}</p>
          <p className="text-ink-soft">{fill(s.cycle, { f: sala.foco, p: sala.pausa, n: Math.floor(passado / ciclo) + 1 })}</p>
        </div>
        <div className="space-y-2">
          <p>{s.roomLink}</p>
          <button type="button" className="cursor-pointer border-2 border-ink px-4 py-2 font-medium hover:border-oxblood hover:text-oxblood" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopiado(true)); }}>{copiado ? s.copied : s.copy}</button>
        </div>
      </div>
      {dentro ? (
        <JitsiSala sala={`instituto-lucia-estudo-${sala.id}`} nome={nome.trim() || s.someone} conduzo={false} lang={lang} assunto={s.title} aoSair={() => setDentro(false)} />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            {s.yourName}
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className="mt-1 block w-64 border-2 border-ink bg-parchment px-3 py-2" />
          </label>
          <button type="button" onClick={() => setDentro(true)} className="cursor-pointer bg-ink px-6 py-2.5 font-semibold text-parchment hover:bg-oxblood">{s.join}</button>
        </div>
      )}
      <p className="text-xs text-ink-soft">{s.privacy}</p>
    </div>
  );
}
