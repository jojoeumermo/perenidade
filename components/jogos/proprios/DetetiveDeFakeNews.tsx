// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { MENSAGEM_DE_TREINO, conferirSinais } from "@/lib/jogos-proprios/regras";
import { Btn, Moldura } from "./kit";

/** Detetive de fake news: marcar, numa mensagem inventada, os trechos que são sinal de alerta. O jogo ensina o método, não um boato específico. */
export default function DetetiveDeFakeNews() {
  const [marcados, setMarcados] = useState<string[]>([]);
  const [visto, setVisto] = useState(false);
  const r = conferirSinais(marcados);
  const alertas = MENSAGEM_DE_TREINO.sinais.filter((s) => s.alerta).length;

  return (
    <Moldura titulo="Detetive de fake news" ajuda="Leia a mensagem. Marque os trechos que devem acender o alerta antes de você repassar. Cuidado: nem todo trecho é suspeito.">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{MENSAGEM_DE_TREINO.titulo}</p>
      <ul className="mt-2 space-y-2">
        {MENSAGEM_DE_TREINO.sinais.map((s) => {
          const on = marcados.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => { setVisto(false); setMarcados((m) => (on ? m.filter((x) => x !== s.id) : [...m, s.id])); }}
                className={`min-h-11 w-full cursor-pointer border-2 border-ink px-3 py-2 text-left text-sm ${on ? "bg-[#f0b323]" : "bg-parchment"}`}
              >
                {on ? "[alerta] " : ""}{s.trecho}
              </button>
              {visto && (on || s.alerta) && (
                <p className="mt-1 text-xs">{s.alerta ? (on ? "Boa. " : "Passou batido. ") : "Falso alarme. "}{s.porque}</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn tipo="tinta" onClick={() => setVisto(true)}>Conferir</Btn>
        <Btn onClick={() => { setMarcados([]); setVisto(false); }}>Limpar</Btn>
        {visto && <p className="text-sm" aria-live="polite">{r.acertos.length} de {alertas} alertas achados; {r.erros.length} falso(s) alarme(s).</p>}
      </div>
      {visto && (
        <p className="mt-3 border-l-4 border-[#c21f16] pl-3 text-sm">Método de bolso: desconfie da pressa, peça o nome e o link da fonte, procure a mesma notícia em veículo conhecido e, no caso de saúde, em fonte oficial. Para exemplos reais, veja as checagens do Instituto.</p>
      )}
    </Moldura>
  );
}
