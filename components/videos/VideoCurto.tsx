// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { fill } from "@/i18n/config";
import { lerVideoCurto } from "@/lib/interativos";
import { ligado } from "@/lib/recursos";
import { INDICE_DE_VIDEOS as INDICE } from "@/lib/videos/indice";
import { useI18n } from "../I18n";

// O tocador (e o desenho das cenas) só baixa depois do clique em tocar. Antes, a aula leva só este cartaz.
const Tocador = dynamic(() => import("./Tocador").then((m) => m.Tocador), { ssr: false, loading: () => <p className="font-sans text-sm text-ink-soft">…</p> });

const duracao = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function VideoCurto({ id }: { id: string }) {
  const { t } = useI18n();
  const v = t.lesson.videoCurto;
  const [aberto, setAberto] = useState(false);
  const entrada = INDICE[id];
  if (!ligado("enem-video") || !entrada) return null;
  return (
    <section className="no-print no-leitor my-8" aria-label={fill(v.rotulo, { titulo: entrada.titulo })}>
      {aberto ? (
        <Tocador id={id} titulo={entrada.titulo} />
      ) : (
        <div className="cartao p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-prelo-texto">{v.selo}</p>
          <p className="mt-1 font-serif text-2xl font-semibold">{entrada.titulo}</p>
          <button type="button" className="botao mt-4 inline-flex min-h-11 items-center gap-3 px-5 font-sans font-semibold" onClick={() => setAberto(true)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
              <path d="M4 2 L16 9 L4 16 Z" fill="currentColor" />
            </svg>
            {fill(v.tocar, { tempo: duracao(entrada.segundos) })}
          </button>
          <p className="mt-3 font-sans text-xs text-ink-soft">{v.aviso}</p>
        </div>
      )}
    </section>
  );
}

/** O bloco ```videocurto das aulas. */
export function VideoCurtoDoBloco({ spec }: { spec: string }) {
  const id = lerVideoCurto(spec);
  return id ? <VideoCurto id={id} /> : null;
}
