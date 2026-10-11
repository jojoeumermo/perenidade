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
    <div className="no-print border-l-2 border-gold bg-parchment-deep p-4 font-sans text-base">
      <p className="font-medium">{question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setChosen(i)}
            aria-pressed={chosen === i}
            className={`cursor-pointer border-2 bg-parchment px-3 py-1.5 text-left text-sm ${
              chosen === i ? (option.right ? "border-ok text-ok" : "border-gold") : "border-rule hover:border-gold"
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
