// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, type Ref } from "react";

export interface Falta {
  dias: number;
  horas: number;
  minutos: number;
  /** Já começou (ou a data é inválida). */
  passou: boolean;
}

/** Quanto falta de `agora` até `ate` (em ms), em dias, horas e minutos inteiros. Puro, para os testes. */
export function quantoFalta(ate: number, agora: number): Falta {
  const ms = ate - agora;
  if (!Number.isFinite(ms) || ms <= 0) return { dias: 0, horas: 0, minutos: 0, passou: true };
  const minutosTotais = Math.floor(ms / 60_000);
  return { dias: Math.floor(minutosTotais / 1440), horas: Math.floor((minutosTotais % 1440) / 60), minutos: minutosTotais % 60, passou: false };
}

/**
 * Os grupos de plaquinhas: com 1 dia ou mais, "2d" e "04h" (as pranchas); com menos de 1 dia, "04h" e "37m". Cada caractere é uma
 * plaquinha.
 */
export function gruposDosFlaps(f: Falta): string[] {
  if (f.passou) return [];
  if (f.dias > 0) return [`${Math.min(f.dias, 99)}d`, `${String(f.horas).padStart(2, "0")}h`];
  return [`${String(f.horas).padStart(2, "0")}h`, `${String(f.minutos).padStart(2, "0")}m`];
}

export interface PropsDosFlaps {
  /** Quando o ato começa (ISO ou Date). */
  ate: string | Date;
  /** Frase para o leitor de tela, no idioma da tela: recebe o que falta (ex.: "faltam 2 dias e 4 horas"). */
  rotulo: (f: Falta) => string;
  /** O que mostrar quando já começou (ex.: "agora"). */
  agoraTexto: string;
  ref?: Ref<HTMLSpanElement>;
  className?: string;
}

/**
 * A contagem regressiva em plaquinhas (pranchas: a faixa "PRÓXIMO ATO … [2][d] [0][4][h]"). Mostra quanto falta para o ato e se
 * atualiza a cada minuto, sozinha. Antes de o navegador montar a tela não mostra número nenhum (o servidor não sabe a hora da
 * pessoa e o número errado pularia na tela). O leitor de tela ouve a frase inteira, não as plaquinhas.
 */
export function Flaps({ ate, rotulo, agoraTexto, ref, className = "" }: PropsDosFlaps) {
  const alvo = (ate instanceof Date ? ate : new Date(ate)).getTime();
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    const tique = () => setAgora(Date.now());
    const primeiro = window.setTimeout(tique, 0);
    const relogio = window.setInterval(tique, 60_000);
    return () => {
      window.clearTimeout(primeiro);
      window.clearInterval(relogio);
    };
  }, []);
  const falta = agora === null ? null : quantoFalta(alvo, agora);
  const grupos = falta ? gruposDosFlaps(falta) : ["–", "––"];
  const frase = falta ? (falta.passou ? agoraTexto : rotulo(falta)) : "";
  return (
    <span ref={ref} className={`al-flaps ${className}`.trim()} role="timer" aria-live="off" aria-label={frase || undefined}>
      {falta?.passou ? (
        <span className="al-flap al-flap-texto al-cond" aria-hidden>{agoraTexto}</span>
      ) : (
        grupos.map((g, i) => (
          <span key={i} className="al-flaps-grupo" aria-hidden>
            {[...g].map((c, j) => (
              <span key={j} className="al-flap al-cond">{c}</span>
            ))}
          </span>
        ))
      )}
    </span>
  );
}
