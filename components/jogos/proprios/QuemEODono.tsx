// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { CARTAS_DE_FLUXO, DESTINOS, conferirFluxo, type Destino } from "@/lib/jogos-proprios/regras";
import { Btn, Moldura } from "./kit";

/**
 * Quem é o dono?: para onde vai cada parte dos R$ 100 de um par de sapatos. Arrasta-se a carta até o destino, ou, pelo
 * teclado e no celular, escolhe-se a carta (Enter) e depois o destino. As duas formas fazem a mesma coisa.
 */
export default function QuemEODono() {
  const [lugar, setLugar] = useState<Record<string, Destino | undefined>>({});
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [conferido, setConferido] = useState(false);
  const [aviso, setAviso] = useState("");
  const resultado = conferirFluxo(lugar);

  function colocar(id: string, d: Destino) {
    setLugar((l) => ({ ...l, [id]: d }));
    setEscolhida(null);
    setConferido(false);
    const c = CARTAS_DE_FLUXO.find((x) => x.id === id);
    setAviso(`${c?.texto} colocada em ${DESTINOS.find((x) => x.id === d)?.nome}.`);
  }
  const soltas = CARTAS_DE_FLUXO.filter((c) => !lugar[c.id]);

  return (
    <Moldura
      titulo="Quem é o dono?"
      ajuda="Um par de sapatos foi vendido por R$ 100 (exemplo inventado). Para onde vai cada parte desse dinheiro? Arraste a carta ou escolha a carta e depois o destino."
      fontes={[{ titulo: "Lei nº 5.764/1971, art. 3º (cooperativa)", url: "https://www.planalto.gov.br/ccivil_03/leis/l5764.htm" }]}
    >
      <p role="status" className="sr-only">{aviso}</p>
      <div className="flex flex-wrap gap-2" aria-label="Cartas ainda sem destino">
        {soltas.length === 0 && <p className="text-sm text-ink-soft">Todas as cartas foram colocadas.</p>}
        {soltas.map((c) => (
          <button
            key={c.id}
            type="button"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
            onClick={() => setEscolhida(escolhida === c.id ? null : c.id)}
            aria-pressed={escolhida === c.id}
            className={`min-h-11 cursor-grab border-2 border-ink px-3 py-1.5 text-left text-sm ${escolhida === c.id ? "bg-ink text-parchment" : "bg-parchment"}`}
          >
            {c.texto}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {DESTINOS.map((d) => {
          const dentro = CARTAS_DE_FLUXO.filter((c) => lugar[c.id] === d.id);
          return (
            <div
              key={d.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/plain");
                if (CARTAS_DE_FLUXO.some((c) => c.id === id)) colocar(id, d.id);
              }}
              className="min-h-24 border-2 border-dashed border-ink p-2"
            >
              <p className="text-sm font-bold">{d.nome}</p>
              <Btn desligado={!escolhida} onClick={() => escolhida && colocar(escolhida, d.id)}>Colocar aqui a carta escolhida</Btn>
              <ul className="mt-2 space-y-1 text-sm">
                {dentro.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 border border-ink/40 bg-parchment px-2 py-1">
                    <span>
                      {c.texto}
                      {conferido && <em className="block text-xs text-ink-soft">{c.destino === d.id ? "Certo. " : "Repense. "}{c.destino === d.id ? c.explicacao : ""}</em>}
                    </span>
                    <button type="button" className="min-h-8 shrink-0 text-xs underline" onClick={() => { setLugar((l) => ({ ...l, [c.id]: undefined })); setConferido(false); }}>tirar</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn tipo="tinta" desligado={soltas.length > 0} onClick={() => setConferido(true)}>Conferir</Btn>
        <Btn onClick={() => { setLugar({}); setConferido(false); setEscolhida(null); }}>Recomeçar</Btn>
        {conferido && <p className="text-sm" aria-live="polite">{resultado.certas} de {resultado.total} no lugar certo.</p>}
      </div>
      {conferido && resultado.certas === resultado.total && (
        <p className="mt-3 border-l-4 border-[#c21f16] pl-3 text-sm">
          Repare: quem costura recebe só o salário; o que sobra depois de pagar todos vai para o dono. Numa cooperativa, a lei define uma sociedade de pessoas que se unem para uma atividade econômica de benefício comum, sem objetivo de lucro (Lei nº 5.764/1971, art. 3º): quem trabalha também decide para onde vai a sobra.
        </p>
      )}
    </Moldura>
  );
}
