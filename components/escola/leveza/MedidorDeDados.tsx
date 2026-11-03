// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { TextosDaLeveza } from "@/i18n/escola/leveza";
import { type EntradaDeDesempenho, formatarTamanho, preencherTexto as preencher, somarTransferencia } from "@/lib/escola/leveza";

type Medida = { bytes: number; incompleto: boolean } | "sem-info";

/** "Quanto esta página gastou": lê a Performance API do próprio navegador. Nada é gravado nem enviado. */
export function MedidorDeDados({ s, lang }: { s: TextosDaLeveza["medidor"]; lang: string }) {
  const [medida, setMedida] = useState<Medida | null>(null);

  function medir() {
    try {
      const entradas = [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")] as PerformanceResourceTiming[];
      const lista: EntradaDeDesempenho[] = entradas.map((e) => ({ name: e.name, transferSize: e.transferSize, entryType: e.entryType }));
      const soma = somarTransferencia(lista, window.location.origin);
      setMedida(soma.bytes > 0 ? soma : "sem-info");
    } catch {
      setMedida("sem-info");
    }
  }

  return (
    <div className="lev-medidor">
      <button type="button" className="lev-botao" onClick={medir}>
        {s.botao}
      </button>
      <p role="status" aria-live="polite" className="lev-nota">
        {medida === "sem-info" && s.semInfo}
        {medida && medida !== "sem-info" && (
          <>
            {preencher(s.resultado, { tamanho: formatarTamanho(medida.bytes, lang) })} {s.ressalva}
          </>
        )}
      </p>
    </div>
  );
}
