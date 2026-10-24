// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useI18n } from "./I18n";

// Pergunta rápida no meio do texto, para firmar a atenção. Não dá nota: quem erra é
// convidado a reler o trecho com uma pista, em vez de receber um "incorreto".
//
//   ```verificar
//   O que o trabalhador vende ao patrão?
//   - O produto pronto
//   + A sua força de trabalho
//   - As suas ferramentas
//   > Releia o trecho sobre a "mercadoria especial".
//   ```
export function InlineCheck({ spec }: { spec: string }) {
  const { t } = useI18n();
  const lines = spec.split("\n").map((line) => line.trim()).filter(Boolean);
  const question = lines.find((line) => !/^[-+>]/.test(line)) ?? "";
  const options = lines.filter((line) => /^[-+]\s/.test(line)).map((line) => ({ text: line.slice(2), right: line.startsWith("+") }));
  const hint = lines.find((line) => line.startsWith(">"))?.slice(1).trim() ?? "";
  const [chosen, setChosen] = useState<number | null>(null);
  const right = chosen !== null && options[chosen]?.right;

  return (
    <div className="no-print border-2 border-ink bg-parchment p-5 font-sans text-base shadow-[4px_4px_0_var(--sombra)]">
      <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-prelo-texto">{t.lesson.quickCheck}</p>
      <p className="mt-1.5 font-serif text-[1.25rem] leading-snug">{question}</p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((option, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setChosen(i)}
            aria-pressed={chosen === i}
            className={`cursor-pointer border-2 border-ink px-4 py-2.5 text-left font-serif text-[1.05rem] ${
              chosen === i ? (option.right ? "bg-[#2f5d34] text-white" : "bg-folha line-through decoration-[#c21f16] decoration-2") : "bg-folha hover:bg-parchment-deep"
            }`}
          >
            {option.text}
          </button>
        ))}
      </div>
      {chosen !== null && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          {right ? <strong className="text-ok">{t.lesson.correct}</strong> : `${t.lesson.reread} ${hint}`}
        </p>
      )}
    </div>
  );
}
