// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Por que não aparece o número?" (R1): um "?" de um toque ao lado de toda contagem que a Alumia esconde (abaixo de 3) ou
// atrasa (o marco de 15 minutos). Abre uma explicação curta logo abaixo, sem sair da tela e sem pedir nada ao servidor. Só spans:
// cabe dentro de um parágrafo. O alvo de toque tem 44 px, mesmo com o círculo pequeno.
import { useParams } from "next/navigation";
import { useId, useState } from "react";
import { useTextosDoUso } from "./textos";
import "./uso.css";

/** Por que o número falta: "piso" (abaixo de 3), "marco" (15 minutos), "ambos"; `soma` acrescenta a regra da subtração. */
export type MotivoSemNumero = "piso" | "marco" | "ambos";

export function PorQueSemNumero({ lang, motivo = "piso", soma = false, comRotulo = false, className = "" }: {
  lang?: string;
  motivo?: MotivoSemNumero;
  soma?: boolean;
  /** Mostra a pergunta escrita ao lado do "?" (onde não há um número escondido logo antes, como no alto de uma página de números). */
  comRotulo?: boolean;
  className?: string;
}) {
  // Sem `lang` (peças que não recebem o idioma), vale o do endereço (/[lang]/alumia/...).
  const params = useParams<{ lang?: string }>();
  const t = useTextosDoUso(lang ?? (typeof params?.lang === "string" ? params.lang : "pt"));
  const [aberto, setAberto] = useState(false);
  const id = useId();
  if (!t) return null;
  return (
    <span className={`al-porque ${className}`.trim()}>
      <button type="button" className="al-porque-botao" aria-expanded={aberto} aria-controls={id} title={t.porque.rotulo} onClick={() => setAberto((a) => !a)}>
        <span aria-hidden className="al-porque-circulo">?</span>
        <span className={comRotulo ? "al-porque-rotulo" : "sr-only"}>{t.porque.rotulo}</span>
      </button>
      {aberto ? (
        <span id={id} role="note" className="al-porque-balao">
          <span style={{ display: "block" }}>{t.porque[motivo]}</span>
          {soma ? <span style={{ display: "block", marginTop: "0.375rem" }}>{t.porque.soma}</span> : null}
          <button type="button" className="al-porque-fechar" onClick={() => setAberto(false)}>
            {t.porque.fechar}
          </button>
        </span>
      ) : null}
    </span>
  );
}
