// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { type Compatibilidade, conferirCompatibilidade, EDITORES, enderecoDo } from "@/lib/estudio";
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

/** Os dois cartões (FilmCraft e EffectCraft), com abrir, conferir o aparelho e a ajuda. */
export function CartoesDoEstudio({ s }: { s: S }) {
  const cartoes = [
    { editor: EDITORES[1], textos: s.film },
    { editor: EDITORES[2], textos: s.effect },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cartoes.map(({ editor, textos }) => {
        const endereco = enderecoDo(editor.id);
        return (
          <article key={editor.id} className="border-2 border-ink bg-parchment-deep p-5 font-sans">
            <h3 className="font-serif text-2xl font-semibold">{textos.title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{textos.text}</p>
            <p className="mt-2 font-mono text-xs text-ink-soft">{editor.nome} {editor.versao} · {editor.licenca} · {fill(s.download, { mb: editor.mb })}</p>
            <p className="mt-3 flex flex-wrap items-center gap-3">
              {endereco ? (
                <a href={endereco} target="_blank" rel="noopener noreferrer" className="bg-oxblood px-4 py-2 font-semibold text-parchment hover:bg-ink">{s.open} {editor.nome} ↗</a>
              ) : (
                <span className="text-sm text-oxblood">{s.notYet}</span>
              )}
              <L href="/estudio-de-pratica/antes-de-comecar" className="text-sm underline hover:text-oxblood">{s.help} →</L>
              <a href={editor.repositorio} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-oxblood">{s.code} ↗</a>
            </p>
            <Compatibilidade s={s} />
          </article>
        );
      })}
    </div>
  );
}
