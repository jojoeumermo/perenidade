// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef } from "react";
import { diaDaSemana, diaMes, hora } from "@/lib/rede/atos/tempo";

/** "ter 19/11 · 6h" (prancha celular-escrever-ato), no idioma da página, a partir do valor de um datetime-local. */
export function resumoDoQuando(valor: string, lang: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) return "";
  const d = new Date(valor);
  if (!Number.isFinite(d.getTime())) return "";
  return `${diaDaSemana(d, lang, "curto")} ${diaMes(d, lang)} · ${hora(d, lang)}`;
}

/**
 * Dia e hora como as pranchas escrevem ("ter 19/11 · 6h"), no lugar do "mm/dd/yyyy --:-- --" que o Chrome mostra no campo nativo
 * numa página em português (ele segue o idioma do navegador, não o da página). O campo de verdade continua lá, transparente por
 * cima do resumo: o toque e o Enter abrem o seletor do aparelho, o teclado e o leitor de tela usam o campo nativo (com o rótulo de
 * quem chama), e o resumo é só o que se vê. Vazio, mostra o convite ("Escolher dia e hora").
 */
export function CampoDeQuando({
  id,
  valor,
  aoMudar,
  lang,
  vazio,
  min,
  max,
  className = "",
  ...aria
}: {
  id?: string;
  /** O valor do datetime-local ("2026-11-19T06:00"), no fuso do aparelho. */
  valor: string;
  aoMudar: (valor: string) => void;
  lang: string;
  vazio: string;
  min?: string;
  max?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
  onBlur?: () => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const resumo = resumoDoQuando(valor, lang);
  const abrir = () => {
    try {
      campo.current?.showPicker?.();
    } catch {
      // sem seletor (navegador antigo ou sem gesto da pessoa): o campo nativo continua editável pelo teclado
    }
  };
  return (
    <span className={`al-quando ${resumo ? "" : "al-quando-vazio"} ${className}`}>
      <svg aria-hidden viewBox="0 0 24 24" className="al-quando-icone" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4" />
      </svg>
      <span aria-hidden className="al-quando-texto">
        {resumo || vazio}
      </span>
      <input
        ref={campo}
        id={id}
        type="datetime-local"
        lang={lang}
        className="al-quando-campo"
        value={valor}
        min={min}
        max={max}
        onChange={(e) => aoMudar(e.target.value)}
        onClick={abrir}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrir();
          }
        }}
        {...aria}
      />
    </span>
  );
}
