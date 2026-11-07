// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AMBIENTES, type Ambiente, audioEspacial, temAudioEspacial } from "@/lib/audio-imersivo";
import { useI18n } from "../I18n";

/** A escolha do modo espacial (ligado e ambiente), a mesma no tocador e na página do podcast. */
export function useAudioEspacial() {
  return useSyncExternalStore(audioEspacial.assinar, audioEspacial.atual, audioEspacial.servidor);
}

const ORDEM = Object.keys(AMBIENTES) as Ambiente[];

/** Fones de ouvido com ondas: o ícone do modo. */
function Icone({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
      <path d="M9.5 9.5a3.5 3.5 0 0 1 5 0M7.8 7.4a6 6 0 0 1 8.4 0" />
    </svg>
  );
}

/** Ligar, desligar e escolher o ambiente. "disponivel" falso: o áudio atual vem de fora e não pode ser processado. */
function Opcoes({ disponivel, escuro }: { disponivel: boolean; escuro: boolean }) {
  const { t } = useI18n();
  const s = t.radio.espacial;
  const { ligado, ambiente } = useAudioEspacial();
  const nome = useId();
  const suporte = temAudioEspacial();
  const fraco = escuro ? "text-[#d9ccac]" : "text-ink-soft";
  return (
    <div className="space-y-3 font-sans text-sm">
      <button
        type="button"
        aria-pressed={ligado}
        disabled={!suporte}
        onClick={() => audioEspacial.definir({ ligado: !ligado })}
        className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 border-2 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${escuro ? "border-[#f4ecd8]" : "border-ink"} ${ligado ? (escuro ? "bg-[#f4ecd8] text-[#1f1a14]" : "bg-ink text-parchment") : ""}`}
      >
        <span className="flex items-center gap-2">
          <Icone />
          {ligado ? s.desligar : s.ligar}
        </span>
        <span aria-hidden className="font-mono text-xs uppercase">{ligado ? "on" : "off"}</span>
      </button>
      <fieldset disabled={!suporte} className="space-y-1.5">
        <legend className={`font-mono text-[0.68rem] uppercase tracking-[0.14em] ${fraco}`}>{s.ambiente}</legend>
        <div className="flex flex-wrap gap-2">
          {ORDEM.map((a) => (
            <label key={a} className={`flex min-h-11 cursor-pointer items-center gap-2 border px-3 ${escuro ? "border-[#f4ecd8]/50" : "border-ink/40"} has-[:checked]:border-current has-[:checked]:font-semibold`}>
              <input type="radio" name={nome} value={a} checked={ambiente === a} onChange={() => audioEspacial.definir({ ambiente: a, ligado: true })} className="accent-[#c21f16]" />
              {s[a]}
            </label>
          ))}
        </div>
      </fieldset>
      <p className={`text-xs leading-snug ${fraco}`}>
        <strong>{s.fones}</strong> {s.explicacao}
      </p>
      {!suporte && <p className="text-xs text-[#e0837a]">{s.semSuporte}</p>}
      {suporte && !disponivel && ligado && <p role="status" className="text-xs text-[#e0837a]">{s.indisponivel}</p>}
    </div>
  );
}

/**
 * O botão do tocador: fones com o estado (ligado fica dourado). Abre um painel pequeno com as opções; fecha com Esc, com
 * outro clique no botão ou ao clicar fora.
 */
export function BotaoEspacial({ disponivel, className = "" }: { disponivel: boolean; className?: string }) {
  const { t } = useI18n();
  const s = t.radio.espacial;
  const { ligado } = useAudioEspacial();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const painel = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const ativo = ligado && disponivel;
  return (
    <div ref={caixa} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={painel}
        aria-label={`${s.nome}: ${ativo ? s.ligadoAgora : s.desligadoAgora}`}
        title={s.nome}
        data-audio-espacial={ativo ? "ligado" : "desligado"}
        className={`flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1 px-2 hover:text-gold ${ativo ? "text-gold" : ""}`}
      >
        <Icone />
        <span className="hidden font-mono text-[0.65rem] uppercase lg:inline">{s.curto}</span>
      </button>
      {aberto && (
        <div id={painel} role="group" aria-label={s.nome} className="absolute right-0 bottom-full z-40 mb-2 w-[min(20rem,calc(100vw-2rem))] border-2 border-gold bg-ink p-4 text-parchment shadow-[4px_4px_0_#000]">
          <p className="mb-3 font-sans text-sm font-bold">{s.nome}</p>
          <Opcoes disponivel={disponivel} escuro />
          <p className="mt-3 font-sans text-xs text-[#d9ccac]">{s.continua}</p>
        </div>
      )}
    </div>
  );
}

/** O cartão da página do podcast: explica o modo e deixa ligar antes mesmo de dar o play. */
export function CartaoEspacial() {
  const { t } = useI18n();
  const s = t.radio.espacial;
  return (
    <section aria-labelledby="audio-espacial" className="cartao mt-12 grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <p className="rotulo">{s.curto}</p>
        <h2 id="audio-espacial" className="mt-1 font-serif text-3xl font-semibold">{s.nome}</h2>
        <p className="mt-2 max-w-2xl text-lg text-ink-soft">{s.lead}</p>
        <p className="mt-3 max-w-2xl font-sans text-sm text-ink-soft">{s.continua}</p>
      </div>
      <Opcoes disponivel escuro={false} />
    </section>
  );
}
