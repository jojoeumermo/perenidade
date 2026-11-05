// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { type Carga, DISJUNTORES, formatar, OHM_DO_FIO_NO_CURTO, resolverCircuito, type Simulador } from "@/lib/simuladores-aula";

// O circuito simples da aula: uma fonte, até três aparelhos (série ou paralelo) e um disjuntor. Muda a tensão, a
// resistência de cada aparelho, as chaves, e a conta (V = R · I) aparece na hora, com o que o disjuntor faria.
// Tudo é conta no aparelho de quem estuda: nada é enviado nem guardado.

const botao = "cursor-pointer border-2 px-3 py-1.5 font-bold";

export function CircuitoSimples({ simulador }: { simulador: Simulador }) {
  const [modo, setModo] = useState(simulador.modo);
  const [volts, setVolts] = useState(simulador.tensao);
  const [disjuntor, setDisjuntor] = useState(simulador.disjuntor);
  const [curto, setCurto] = useState(false);
  const [cargas, setCargas] = useState<Carga[]>([
    { ohm: 24, ligada: true },
    { ohm: 48, ligada: true },
    { ohm: 12, ligada: false },
  ]);
  const r = resolverCircuito(modo, volts, cargas, disjuntor, curto);
  const mudar = (i: number, x: Partial<Carga>) => setCargas((a) => a.map((c, j) => (j === i ? { ...c, ...x } : c)));
  const opcoes = [...new Set<number>([...DISJUNTORES, disjuntor])].sort((a, b) => a - b);

  const aberta = r.aberto && !curto;
  const resumo = curto
    ? `Curto-circuito: só o fio limita a corrente (${formatar(OHM_DO_FIO_NO_CURTO)} Ω), então a fonte tentaria entregar ${formatar(r.correnteTotal, 0)} A.`
    : aberta
      ? "Circuito aberto: não há caminho fechado, então a corrente é zero."
      : `Resistência total ${formatar(r.ohmTotal)} Ω; corrente que sai da fonte ${formatar(r.correnteTotal)} A; potência ${formatar(r.potencia, 0)} W.`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {(["serie", "paralelo"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)} className={`${botao} ${modo === m ? "border-ink bg-ink text-parchment" : "border-ink/30 hover:border-ink"}`}>
            {m === "serie" ? "Em série" : "Em paralelo"}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-2">
          Fonte
          <input type="range" min={1} max={240} step={1} value={volts} onChange={(e) => setVolts(Number(e.target.value))} aria-label="Tensão da fonte em volts" />
          <strong className="w-14 font-mono">{volts} V</strong>
        </label>
        {[12, 127, 220].map((v) => (
          <button key={v} type="button" onClick={() => setVolts(v)} className={`${botao} border-ink/30 py-1 text-xs hover:border-ink`}>
            {v} V
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          Disjuntor
          <select value={disjuntor} onChange={(e) => setDisjuntor(Number(e.target.value))} className="border-2 border-ink/30 bg-parchment px-2 py-1">
            {opcoes.map((a) => (
              <option key={a} value={a}>
                {a} A
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={curto} onChange={(e) => setCurto(e.target.checked)} />
          ligar os dois polos com um fio (curto-circuito)
        </label>
      </div>

      <svg
        viewBox="0 0 640 230"
        className="mt-4 w-full border-2 border-ink bg-[#f9f3e3]"
        role="img"
        aria-label={`Circuito com fonte de ${volts} volts, ${modo === "serie" ? "aparelhos em série" : "aparelhos em paralelo"} e disjuntor de ${disjuntor} ampères: ${r.desarmou ? "o disjuntor desarma" : aberta ? "circuito aberto" : "o circuito funciona"}`}
      >
        <g stroke="#17130e" strokeWidth="3" fill="none">
          <line x1="40" y1="95" x2="40" y2="135" />
          <line x1="28" y1="105" x2="52" y2="105" strokeWidth="5" />
          <line x1="34" y1="122" x2="46" y2="122" strokeWidth="5" />
          <polyline points="40,95 40,40 120,40" />
          <polyline points="40,135 40,200 600,200" />
          <polyline points="600,200 600,40" />
          {curto && <line x1="560" y1="40" x2="560" y2="200" stroke="#c21f16" strokeWidth="4" />}
        </g>
        <text x="62" y="118" fontSize="13" fontFamily="ui-monospace, monospace">
          {volts} V
        </text>
        {/* O disjuntor: uma caixa com a alavanca para cima (ligado) ou inclinada (desarmado). */}
        <rect x="120" y="22" width="56" height="36" fill={r.desarmou ? "#f6d4cf" : "#e6e0cc"} stroke="#17130e" strokeWidth="2.5" />
        <line x1="148" y1="50" x2={r.desarmou ? 162 : 148} y2={r.desarmou ? 36 : 30} stroke={r.desarmou ? "#c21f16" : "#17130e"} strokeWidth="4" />
        <text x="148" y="76" textAnchor="middle" fontSize="12" fontFamily="ui-monospace, monospace">
          {disjuntor} A {r.desarmou ? "desarmou" : ""}
        </text>
        <line x1="176" y1="40" x2="200" y2="40" stroke="#17130e" strokeWidth="3" />
        {modo === "serie" ? (
          <>
            {cargas.map((c, i) => (
              <Aparelho key={i} x={200 + i * 120} y={40} n={i + 1} ligada={c.ligada} p={r.cada[i].p} />
            ))}
            <line x1="490" y1="40" x2="600" y2="40" stroke="#17130e" strokeWidth="3" />
          </>
        ) : (
          <>
            <line x1="200" y1="40" x2="600" y2="40" stroke="#17130e" strokeWidth="3" />
            {cargas.map((c, i) => {
              const x = 250 + i * 110;
              return (
                <g key={i}>
                  <line x1={x} y1="40" x2={x} y2="94" stroke="#17130e" strokeWidth="3" />
                  <line x1={x} y1="122" x2={x} y2="200" stroke="#17130e" strokeWidth="3" />
                  <Aparelho x={x} y={108} n={i + 1} ligada={c.ligada} p={r.cada[i].p} vertical />
                </g>
              );
            })}
          </>
        )}
      </svg>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {cargas.map((c, i) => (
          <div key={i} className="border-2 border-ink/20 bg-parchment-deep p-3">
            <p className="font-bold">Aparelho {i + 1}</p>
            <label className="mt-1 block">
              Resistência: <strong className="font-mono">{c.ohm} Ω</strong>
              <input type="range" min={1} max={200} value={c.ohm} onChange={(e) => mudar(i, { ohm: Number(e.target.value) })} className="w-full" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={c.ligada} onChange={(e) => mudar(i, { ligada: e.target.checked })} />
              ligado
            </label>
            <dl className="mt-2 grid grid-cols-3 gap-1 font-mono text-xs">
              <div>
                <dt className="text-ink-soft">corrente</dt>
                <dd>{formatar(r.cada[i].i)} A</dd>
              </div>
              <div>
                <dt className="text-ink-soft">tensão</dt>
                <dd>{formatar(r.cada[i].v)} V</dd>
              </div>
              <div>
                <dt className="text-ink-soft">potência</dt>
                <dd>{formatar(r.cada[i].p, 0)} W</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <p role="status" className={`mt-3 border-l-4 p-2 ${r.desarmou ? "border-oxblood bg-[#f6d4cf]" : "border-gold bg-parchment-deep"}`}>
        {resumo}
        {r.desarmou && (
          <strong className="mt-1 block">
            O disjuntor de {disjuntor} A desarma: {formatar(r.correnteTotal)} A passa do valor dele. É isso que protege o fio de esquentar demais. (Os valores de cada aparelho acima são os que haveria se o disjuntor não atuasse.)
          </strong>
        )}
        {!r.desarmou && !aberta && !curto && (
          <span className="block text-ink-soft">
            O disjuntor de {disjuntor} A aguenta: {formatar(r.correnteTotal)} A não passa do valor dele.
          </span>
        )}
      </p>
      <p className="mt-2 text-ink-soft">
        A conta de cada aparelho é V = R × I. {modo === "serie" ? "Em série a corrente é a mesma em todos e a tensão se divide." : "Em paralelo cada aparelho recebe a tensão inteira e as correntes se somam."} Modelo didático: o disjuntor real aguenta uma pequena sobrecarga por algum tempo antes de desarmar.
      </p>
    </div>
  );
}

function Aparelho({ x, y, n, ligada, p, vertical = false }: { x: number; y: number; n: number; ligada: boolean; p: number; vertical?: boolean }) {
  const forte = ligada && p > 0 ? Math.min(1, 0.25 + p / 2500) : 0;
  return (
    <g>
      {!vertical && <line x1={x - 50} y1={y} x2={x + 50} y2={y} stroke="#17130e" strokeWidth="3" />}
      <rect x={x - 22} y={y - 14} width="44" height="28" fill={ligada ? `rgba(232, 181, 32, ${0.15 + 0.7 * forte})` : "#e6e0cc"} stroke="#17130e" strokeWidth="2.5" strokeDasharray={ligada ? undefined : "4 3"} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="12" fontFamily="ui-monospace, monospace">
        R{n}
      </text>
      <text x={x} y={y + (vertical ? 34 : 34)} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace">
        {ligada ? "ligado" : "desligado"}
      </text>
    </g>
  );
}
