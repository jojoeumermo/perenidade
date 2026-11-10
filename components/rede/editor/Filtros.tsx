// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./editor.css";
import { FILTROS_DO_STORY, filtroEmCss, type FiltroDoStory } from "@/lib/rede/stories/midia";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { focarNoGrupo, indiceDaSeta } from "../stories/usar";

/**
 * Os filtros (lista fechada): uma fileira de amostras da própria foto ou de um quadro do vídeo, cada uma já com o filtro. Grupo de
 * opções de verdade (setas trocam, o leitor de tela diz qual está marcado). Também desliza com o dedo na prévia (no Criar).
 */
export function Filtros({ t, filtro, amostra, aoEscolher }: { t: TextosDosStories["criar"]["midia"]; filtro: FiltroDoStory; amostra: string | null; aoEscolher: (f: FiltroDoStory) => void }) {
  return (
    <div className="al-ed-filtros" role="radiogroup" aria-label={t.filtros}>
      {FILTROS_DO_STORY.map((f, k) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={filtro === f}
          tabIndex={filtro === f ? 0 : -1}
          className="al-ed-filtro"
          onClick={() => aoEscolher(f)}
          onKeyDown={(e) => {
            const n = indiceDaSeta(e.key, k, FILTROS_DO_STORY.length, "horizontal");
            if (n === null) return;
            e.preventDefault();
            aoEscolher(FILTROS_DO_STORY[n]);
            focarNoGrupo(e.currentTarget, "[role=radio]", n);
          }}
        >
          <span className="al-ed-filtro-amostra" aria-hidden style={{ filter: filtroEmCss(f), backgroundImage: amostra ? `url("${amostra}")` : undefined }} />
          <span className="al-ed-filtro-nome">{t.filtro[f]}</span>
        </button>
      ))}
    </div>
  );
}
