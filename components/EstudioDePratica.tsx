// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { type AreaDoEstudio, type Compatibilidade, conferirCompatibilidade, type EditorAvancado, editor, enderecoDo, ESTUDIOS } from "@/lib/estudio";
import { L } from "./I18n";

type S = Dict["practiceStudio"];


function Compatibilidade({ s }: { s: S }) {
  const [c, setC] = useState<Compatibilidade | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const veredito = !c ? null : !c.wasm ? "no" : !c.webgpu || (c.memoria !== null && c.memoria < 4) ? "slow" : "ok";
  return (
    <div className="mt-3 text-sm">
      <button type="button" disabled={conferindo} onClick={async () => { setConferindo(true); setC(await conferirCompatibilidade()); setConferindo(false); }} className="cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood disabled:opacity-50">
        {conferindo ? s.checking : s.check}
      </button>
      {c && veredito && (
        <div role="status" className={`mt-2 border-l-4 p-2 ${veredito === "ok" ? "border-ok" : veredito === "slow" ? "border-gold" : "border-oxblood"}`}>
          <p className="font-semibold">{s[veredito]}</p>
          <ul className="mt-1 text-xs text-ink-soft">
            <li>{s.wasm}: {c.wasm ? s.yes : s.noShort}</li>
            <li>{s.gpu}: {c.webgpu ? s.yes : s.noShort}</li>
            <li>{s.memory}: {c.memoria === null ? s.memoryUnknown : `${c.memoria} GB`}</li>
            <li>{s.browser}: {c.navegador}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/** Os textos do cartão de cada editor: os de vídeo têm chave própria desde o primeiro estúdio. */
function textosDo(s: S, id: EditorAvancado["id"]) {
  if (id === "filmcraft") return s.film;
  if (id === "effectcraft") return s.effect;
  return s.editors[id as keyof S["editors"]];
}

/**
 * Os cartões dos programas de uma disciplina, com abrir (dentro do site), conferir o aparelho e a ajuda. Programa só
 * de computador (LightCraft) leva ao download oficial.
 */
export function CartoesDoEstudio({ s, area = "edicao-de-video" }: { s: S; area?: AreaDoEstudio }) {
  const lista = ESTUDIOS[area].map((id) => editor(id)!).filter(Boolean);
  return (
    <div className={`grid gap-4 ${lista.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {lista.map((ed) => {
        const textos = textosDo(s, ed.id);
        const endereco = enderecoDo(ed.id);
        return (
          <article key={ed.id} className="flex flex-col border-2 border-ink bg-parchment-deep p-5 font-sans">
            <h3 className="font-serif text-2xl font-semibold">{textos.title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{textos.text}</p>
            <p className="mt-2 font-mono text-xs text-ink-soft">{ed.nome} {ed.versao} · {ed.licenca} · {fill(s.download, { mb: ed.mb })}</p>
            {ed.baixar ? (
              <>
                <p className="mt-2 text-sm">{s.desktopOnly}</p>
                <p className="mt-3 flex flex-wrap items-center gap-3">
                  <a href={ed.baixar} target="_blank" rel="noopener noreferrer" className="bg-oxblood px-4 py-2 font-semibold text-parchment hover:bg-ink">{s.downloadApp} ↗</a>
                  <a href={ed.repositorio} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-oxblood">{s.code} ↗</a>
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 flex flex-wrap items-center gap-3">
                  {endereco ? (
                    <L href={`/estudio-de-pratica/abrir/${ed.id}`} className="bg-oxblood px-4 py-2 font-semibold text-parchment hover:bg-ink">{s.open} {ed.nome}</L>
                  ) : (
                    <span className="text-sm text-oxblood">{s.notYet}</span>
                  )}
                  {area === "edicao-de-video" && <L href="/estudio-de-pratica/antes-de-comecar" className="text-sm underline hover:text-oxblood">{s.help} →</L>}
                  <a href={ed.repositorio} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-oxblood">{s.code} ↗</a>
                </p>
                <Compatibilidade s={s} />
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

/**
 * O programa aberto dentro do institutolucia.org: um quadro de outra origem (o estúdio), que não alcança a sessão nem
 * os dados do site. Tela cheia pelo navegador, sem sair da página.
 */
export function QuadroDoEditor({ s, id, nome }: { s: S; id: EditorAvancado["id"]; nome: string }) {
  const quadro = useRef<HTMLIFrameElement>(null);
  const endereco = enderecoDo(id);
  if (!endereco) return <p className="mt-6 text-oxblood">{s.notYet}</p>;
  return (
    <div className="mt-4">
      <p className="flex flex-wrap items-center justify-between gap-3 font-sans text-sm">
        <span className="text-ink-soft">{s.insideNote}</span>
        <button type="button" onClick={() => void quadro.current?.requestFullscreen?.()} className="cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">{s.fullscreen}</button>
      </p>
      <iframe
        ref={quadro}
        src={endereco}
        title={nome}
        allow="fullscreen; clipboard-read; clipboard-write"
        allowFullScreen
        referrerPolicy="no-referrer"
        className="mt-3 block h-[calc(100dvh-12rem)] min-h-[32rem] w-full border-2 border-ink bg-ink"
      />
    </div>
  );
}
