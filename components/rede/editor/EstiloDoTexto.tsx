// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./editor.css";
import { FAMILIA_DA_FONTE } from "@/lib/rede/stories/visual";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { FONTES_DO_STORY, type Alinhamento, type EstiloDoStory, type FonteDoStory } from "@/lib/rede/tipos-stories";
import { focarNoGrupo, indiceDaSeta, preencherStory } from "../stories/usar";

const PROXIMO: Record<Alinhamento, Alinhamento> = { esq: "centro", centro: "dir", dir: "esq" };

const IconeAlinhar = ({ lado }: { lado: Alinhamento }) => {
  const linhas = lado === "esq" ? ["M4 6h16", "M4 10h10", "M4 14h16", "M4 18h10"] : lado === "centro" ? ["M4 6h16", "M7 10h10", "M4 14h16", "M7 18h10"] : ["M4 6h16", "M10 10h10", "M4 14h16", "M10 18h10"];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
      {linhas.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
};

/**
 * A barra do texto (como a do Instagram): as 4 fontes em fichas que já mostram a letra, o alinhamento (um botão que gira entre
 * esquerda, centro e direita) e o "A" com caixa (fundo sólido atrás do texto, legível sobre foto e vídeo). Só valores da lista.
 */
export function EstiloDoTexto({ t, estilo, aoMudar }: { t: TextosDosStories["criar"]["estilo"]; estilo: EstiloDoStory; aoMudar: (e: EstiloDoStory) => void }) {
  const fonte: FonteDoStory = estilo.fonte ?? "condensada";
  const alinhar: Alinhamento = estilo.alinhar ?? "esq";
  const caixa = estilo.caixa === "caixa";
  return (
    <div className="al-ed-estilo" role="group" aria-label={t.rotulo}>
      <button
        type="button"
        className="al-ed-estilo-botao"
        aria-label={preencherStory(t.alinhar, { lado: t.alinhamento[alinhar] })}
        onClick={() => aoMudar({ ...estilo, alinhar: PROXIMO[alinhar] })}
      >
        <IconeAlinhar lado={alinhar} />
      </button>
      <button type="button" className="al-ed-estilo-botao al-ed-estilo-caixa" aria-pressed={caixa} aria-label={t.caixa} onClick={() => aoMudar({ ...estilo, caixa: caixa ? "nenhuma" : "caixa" })}>
        <span aria-hidden>A</span>
      </button>
      <div className="al-ed-fontes" role="radiogroup" aria-label={t.rotulo}>
        {FONTES_DO_STORY.map((f, k) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={fonte === f}
            tabIndex={fonte === f ? 0 : -1}
            className="al-ed-fonte"
            data-fonte={f}
            style={{ fontFamily: FAMILIA_DA_FONTE[f] }}
            onClick={() => aoMudar({ ...estilo, fonte: f })}
            onKeyDown={(e) => {
              const n = indiceDaSeta(e.key, k, FONTES_DO_STORY.length, "horizontal");
              if (n === null) return;
              e.preventDefault();
              aoMudar({ ...estilo, fonte: FONTES_DO_STORY[n] });
              focarNoGrupo(e.currentTarget, "[role=radio]", n);
            }}
          >
            {t.fonte[f]}
          </button>
        ))}
      </div>
    </div>
  );
}
