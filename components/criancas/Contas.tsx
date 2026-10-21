// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Mascote, NotaParaOAdulto } from "./comum";

/** Sorteio com semente: a mesma sequência a cada vez que se escolhe a mesma tabuada (bom para o adulto acompanhar). */
function sorteador(semente: number) {
  let s = semente % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Tabuada() {
  const [tabua, setTabua] = useState(2);
  const [rodada, setRodada] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [dica, setDica] = useState(false);
  const r = sorteador(tabua * 1000 + rodada + 1);
  const outro = 1 + Math.floor(r() * 10);
  const certa = tabua * outro;
  const opcoes = [...new Set([certa, certa + tabua, Math.max(0, certa - tabua), certa + 1 + Math.floor(r() * 3)])].sort((a, b) => a - b);
  const acertou = escolha === certa;
  const proxima = () => { setRodada(rodada + 1); setEscolha(null); setDica(false); };
  return (
    <div className="rounded-3xl border-4 border-ink bg-white p-6">
      <p className="text-xl font-bold">Escolha a tabuada:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((t) => (
          <button key={t} type="button" onClick={() => { setTabua(t); setRodada(0); setEscolha(null); setDica(false); }} className={`min-h-12 min-w-12 cursor-pointer rounded-xl border-4 border-ink text-xl font-bold ${t === tabua ? "bg-ink text-white" : "bg-white"}`}>{t}</button>
        ))}
      </div>
      <p className="mt-8 text-center text-6xl font-bold">{tabua} × {outro} = ?</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {opcoes.map((o) => (
          <button key={o} type="button" disabled={acertou} onClick={() => { setEscolha(o); if (o !== certa) setDica(true); }} className={`min-h-16 min-w-24 cursor-pointer rounded-2xl border-4 border-ink text-4xl font-bold ${escolha === o ? (o === certa ? "bg-[#9FD8A0]" : "bg-[#FFE0C2]") : "bg-white hover:bg-[#FFF4D6]"}`}>{o}</button>
        ))}
      </div>
      {dica && !acertou && (
        <div className="mt-6 rounded-2xl bg-[#FFF4D6] p-4 text-xl">
          <p>Quase! Uma ajuda: {tabua} × {outro} é somar o {tabua}, {outro} vezes.</p>
          <p className="mt-2 text-2xl" aria-label={`${outro} grupos de ${tabua}`}>{Array.from({ length: outro }, () => tabua).join(" + ")}</p>
        </div>
      )}
      {acertou && (
        <div className="mt-6 text-center">
          <Mascote humor="festa" tamanho={80} />
          <p className="text-3xl font-bold">Isso! {tabua} × {outro} = {certa}</p>
          <button type="button" onClick={proxima} className="mt-3 min-h-14 cursor-pointer rounded-full border-4 border-ink bg-ink px-8 text-2xl font-bold text-white">Outra conta →</button>
        </div>
      )}
    </div>
  );
}

/** Uma pizza de n fatias com k pintadas, em SVG. */
function Pizza({ n, k }: { n: number; k: number }) {
  const fatia = (i: number) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    return `M100 100 L${100 + 90 * Math.cos(a0)} ${100 + 90 * Math.sin(a0)} A90 90 0 ${grande} 1 ${100 + 90 * Math.cos(a1)} ${100 + 90 * Math.sin(a1)} Z`;
  };
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-56 w-56" role="img" aria-label={`Uma pizza dividida em ${n} pedaços iguais, com ${k} pintados`}>
      {Array.from({ length: n }, (_, i) => <path key={i} d={fatia(i)} fill={i < k ? "#F08A3E" : "#FFF4D6"} stroke="#221C17" strokeWidth="4" />)}
    </svg>
  );
}

function Fracoes() {
  const [rodada, setRodada] = useState(0);
  const [escolha, setEscolha] = useState<string | null>(null);
  const r = sorteador(rodada * 31 + 5);
  const n = [2, 3, 4, 5, 6, 8][Math.floor(r() * 6)];
  const k = 1 + Math.floor(r() * (n - 1));
  const certa = `${k}/${n}`;
  const opcoes = [...new Set([certa, `${n - k}/${n}`, `${k}/${n + 1}`, `${n}/${k}`])].filter((o) => o !== `${n}/${k}` || k !== n);
  const ordenadas = [...opcoes].sort();
  return (
    <div className="rounded-3xl border-4 border-ink bg-white p-6">
      <p className="text-center text-2xl font-bold">Que parte da pizza está pintada?</p>
      <Pizza n={n} k={k} />
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {ordenadas.map((o) => (
          <button key={o} type="button" disabled={escolha === certa} onClick={() => setEscolha(o)} className={`min-h-16 min-w-24 cursor-pointer rounded-2xl border-4 border-ink text-4xl font-bold ${escolha === o ? (o === certa ? "bg-[#9FD8A0]" : "bg-[#FFE0C2]") : "bg-white"}`}>{o}</button>
        ))}
      </div>
      {escolha && escolha !== certa && <p className="mt-4 text-center text-xl">Conte os pedaços pintados (em cima da barrinha) e todos os pedaços da pizza (embaixo). Tente de novo! 💛</p>}
      {escolha === certa && (
        <div className="mt-4 text-center">
          <p className="text-3xl font-bold">Isso! {k} de {n} pedaços: {certa}</p>
          <button type="button" onClick={() => { setRodada(rodada + 1); setEscolha(null); }} className="mt-3 min-h-14 cursor-pointer rounded-full border-4 border-ink bg-ink px-8 text-2xl font-bold text-white">Outra pizza →</button>
        </div>
      )}
    </div>
  );
}

export function Contas() {
  const [aba, setAba] = useState<"tabuada" | "fracoes">("tabuada");
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3">
        {([["tabuada", "✖️ Tabuada"], ["fracoes", "🍕 Frações"]] as const).map(([id, nome]) => (
          <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)} className={`min-h-12 cursor-pointer rounded-full border-4 border-ink px-6 text-xl font-bold ${aba === id ? "bg-ink text-white" : "bg-white"}`}>{nome}</button>
        ))}
      </div>
      {aba === "tabuada" ? <Tabuada /> : <Fracoes />}
      <NotaParaOAdulto idade="8 a 12 anos" objetivo="Praticar a tabuada e entender frações com desenhos, sem pressa." aprende="Multiplicação como soma repetida e a ideia de fração como parte de um todo." nota="Não há tempo, placar nem ranking: errar mostra uma dica e deixa tentar de novo. A sequência de contas é a mesma a cada vez que se escolhe a mesma tabuada, para você acompanhar." />
    </div>
  );
}
