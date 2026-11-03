// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaAula } from "@/i18n/escola/aula";
import { setPrefs, usePrefs } from "@/lib/prefs";

/** Os cinco tamanhos da letra da aula, em % da letra do site. */
export const PASSOS_DA_LETRA = [100, 115, 130, 150, 175] as const;

/** O passo mais perto do tamanho guardado (quem escolheu 140 em outro lugar cai no 130). */
export function passoDe(escala: number): number {
  let melhor = 0;
  PASSOS_DA_LETRA.forEach((p, i) => {
    if (Math.abs(p - escala) < Math.abs(PASSOS_DA_LETRA[melhor] - escala)) melhor = i;
  });
  return melhor;
}

/**
 * Letra de verdade (Etapa 4, R1-19): A−, A e A+ com alvos de 48 px, em cinco passos (100, 115, 130, 150 e 175%).
 * Grava o mesmo tamanho do painel de acessibilidade (prefs.scale, lib/prefs.ts), aplica na hora e anuncia o novo
 * tamanho para quem usa leitor de tela. `escuro`: na faixa preta da aula; `folha`: na folha da aula do celular.
 */
export function TamanhoDaLetra({ s, variante = "escuro" }: { s: TextosDaAula["letra"]; variante?: "escuro" | "folha" | "faixa" }) {
  const prefs = usePrefs();
  const [anuncio, setAnuncio] = useState("");
  const passo = passoDe(prefs.scale);
  const ir = (i: number) => {
    const novo = PASSOS_DA_LETRA[Math.max(0, Math.min(PASSOS_DA_LETRA.length - 1, i))];
    setPrefs({ scale: novo });
    setAnuncio(fill(s.agora, { n: novo }));
  };
  return (
    <span role="group" aria-label={s.rotulo} className={`tamanho-da-letra tamanho-${variante}`}>
      <button type="button" aria-label={s.menor} title={s.menor} disabled={passo === 0} onClick={() => ir(passo - 1)}>
        A−
      </button>
      <button type="button" aria-label={s.normal} title={s.normal} aria-pressed={prefs.scale === 100} onClick={() => ir(0)}>
        A
      </button>
      <button type="button" aria-label={s.maior} title={s.maior} disabled={passo === PASSOS_DA_LETRA.length - 1} onClick={() => ir(passo + 1)}>
        A+
      </button>
      <span className="sr-only" aria-live="polite">
        {anuncio}
      </span>
    </span>
  );
}
