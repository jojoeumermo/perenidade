// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId } from "react";
import { LIMITE_DO_AJUSTE, SEM_AJUSTE, semAjuste, type AjustesDaMidia } from "@/lib/rede/stories/midia";

export interface TextosDosAjustes {
  titulo: string;
  brilho: string;
  contraste: string;
  saturacao: string;
  zerar: string;
}

/**
 * Os ajustes da foto e do vídeo do story (P5, A16): brilho, contraste e saturação, de −50 a +50. A prévia muda na hora e o
 * resultado vai "queimado" na mídia refeita no aparelho (lib/rede/stories/midia.ts), como o filtro. Funciona no teclado (as setas
 * do controle deslizante) e cada controle diz o valor.
 */
export function Ajustes({ t, ajustes, aoMudar }: { t: TextosDosAjustes; ajustes: AjustesDaMidia; aoMudar: (a: AjustesDaMidia) => void }) {
  const id = useId();
  const linha = (chave: keyof AjustesDaMidia, rotulo: string) => (
    <label key={chave} htmlFor={`${id}-${chave}`} className="al-ed-ajuste">
      <span className="al-ed-ajuste-nome">
        {rotulo}
        <output htmlFor={`${id}-${chave}`} className="al-ed-ajuste-valor">
          {ajustes[chave] > 0 ? `+${ajustes[chave]}` : ajustes[chave]}
        </output>
      </span>
      <input
        id={`${id}-${chave}`}
        type="range"
        min={-LIMITE_DO_AJUSTE}
        max={LIMITE_DO_AJUSTE}
        step={1}
        value={ajustes[chave]}
        onChange={(e) => aoMudar({ ...ajustes, [chave]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <fieldset className="al-ed-ajustes">
      <legend className="al-st-subtitulo">{t.titulo}</legend>
      {linha("brilho", t.brilho)}
      {linha("contraste", t.contraste)}
      {linha("saturacao", t.saturacao)}
      <button type="button" className="al-ed-ajuste-zerar" disabled={semAjuste(ajustes)} onClick={() => aoMudar(SEM_AJUSTE)}>
        {t.zerar}
      </button>
    </fieldset>
  );
}
