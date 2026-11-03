// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaTurma } from "@/i18n/escola/turma";

const TOTAL = 10 * 60;
const AVISO = 8 * 60;

const relogio = (segundos: number) =>
  `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;

/**
 * O seminário da turma (R1-37): o último encontro do mês, com o roteiro de 10 minutos e um cronômetro que avisa aos 8.
 * Quem apresenta é combinado na própria sala; nada vai ao servidor. O cronômetro conta pelo relógio do aparelho
 * (Date.now), para não atrasar quando a aba fica em segundo plano.
 */
export function Seminario({
  dia,
  s,
}: {
  dia: string;
  s: TextosDaTurma["seminario"];
}) {
  const [passados, setPassados] = useState(0);
  const [rodando, setRodando] = useState(false);
  const base = useRef<{ inicio: number; antes: number } | null>(null);

  useEffect(() => {
    if (!rodando) return;
    base.current = { inicio: Date.now(), antes: passados };
    const relogioId = window.setInterval(() => {
      const b = base.current;
      if (!b) return;
      const agora = Math.min(
        TOTAL,
        b.antes + Math.floor((Date.now() - b.inicio) / 1000),
      );
      setPassados(agora);
      if (agora >= TOTAL) setRodando(false);
    }, 250);
    return () => window.clearInterval(relogioId);
    // Só recomeça a contagem ao ligar e desligar; "passados" entra como ponto de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando]);

  const restam = TOTAL - passados;
  const fase =
    passados >= TOTAL ? "fim" : passados >= AVISO ? "aviso" : "normal";

  return (
    <section
      className="turma-bloco"
      aria-labelledby="turma-seminario"
      data-seminario=""
    >
      <h2 id="turma-seminario" className="turma-bloco-titulo">
        {s.titulo}
      </h2>
      <p className="turma-bloco-texto">{s.texto}</p>
      <p className="turma-nota font-semibold">{fill(s.data, { data: dia })}</p>
      <h3 className="rotulo mt-5">{s.roteiroTitulo}</h3>
      <ol className="turma-roteiro">
        {s.roteiro.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <div
        className={`turma-cronometro turma-cronometro--${fase}`}
        data-cronometro={fase}
      >
        <p className="rotulo">{s.cronometro}</p>
        <p className="turma-cronometro-numero" aria-hidden>
          {relogio(restam)}
        </p>
        <div className="turma-botoes">
          <button
            type="button"
            className="botao botao-tinta"
            onClick={() => setRodando((r) => !r)}
            disabled={fase === "fim"}
          >
            {rodando ? s.pausar : passados > 0 ? s.continuar : s.comecar}
          </button>
          <button
            type="button"
            className="botao"
            onClick={() => {
              setRodando(false);
              setPassados(0);
            }}
          >
            {s.zerar}
          </button>
        </div>
        <p role="status" aria-live="polite" className="turma-cronometro-aviso">
          {fase === "fim" ? s.fim : fase === "aviso" ? s.aviso : ""}
        </p>
      </div>
    </section>
  );
}
