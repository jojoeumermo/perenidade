// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { falar, Mascote, NotaParaOAdulto, temVoz } from "./comum";

/** Cada letra com uma palavra e o desenho (emoji do próprio aparelho). */
const LETRAS: [string, string, string][] = [
  ["A", "abelha", "🐝"], ["B", "bola", "⚽"], ["C", "casa", "🏠"], ["D", "dado", "🎲"], ["E", "estrela", "⭐"], ["F", "foca", "🦭"],
  ["G", "gato", "🐱"], ["H", "hipopótamo", "🦛"], ["I", "ilha", "🏝️"], ["J", "jacaré", "🐊"], ["K", "kiwi", "🥝"], ["L", "lua", "🌙"],
  ["M", "macaco", "🐒"], ["N", "navio", "🚢"], ["O", "ovo", "🥚"], ["P", "pato", "🦆"], ["Q", "queijo", "🧀"], ["R", "rato", "🐭"],
  ["S", "sapo", "🐸"], ["T", "tomate", "🍅"], ["U", "uva", "🍇"], ["V", "vaca", "🐄"], ["W", "wi-fi", "📶"], ["X", "xícara", "☕"],
  ["Y", "yakisoba", "🍜"], ["Z", "zebra", "🦓"],
];

/** Palavras de duas e três sílabas para montar. */
const PALAVRAS: { silabas: string[]; desenho: string }[] = [
  { silabas: ["BO", "LA"], desenho: "⚽" }, { silabas: ["CA", "SA"], desenho: "🏠" }, { silabas: ["GA", "TO"], desenho: "🐱" },
  { silabas: ["PA", "TO"], desenho: "🦆" }, { silabas: ["SA", "PO"], desenho: "🐸" }, { silabas: ["DA", "DO"], desenho: "🎲" },
  { silabas: ["LU", "A"], desenho: "🌙" }, { silabas: ["U", "VA"], desenho: "🍇" }, { silabas: ["VA", "CA"], desenho: "🐄" },
  { silabas: ["MA", "CA", "CO"], desenho: "🐒" }, { silabas: ["JA", "CA", "RÉ"], desenho: "🐊" }, { silabas: ["BA", "NA", "NA"], desenho: "🍌" },
  { silabas: ["SA", "PA", "TO"], desenho: "👟" }, { silabas: ["CA", "VA", "LO"], desenho: "🐴" }, { silabas: ["PE", "TE", "CA"], desenho: "🪁" },
];
const EXTRAS = ["MO", "BI", "TA", "RE", "FU", "NE", "LI", "PO"];

function embaralhar<T>(lista: T[], semente: number): T[] {
  const r = [...lista];
  let s = semente;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function Letras() {
  const [aba, setAba] = useState<"letras" | "silabas">("letras");
  const [letra, setLetra] = useState<(typeof LETRAS)[number] | null>(null);
  const [n, setN] = useState(0);
  const [montada, setMontada] = useState<string[]>([]);
  const [semVoz, setSemVoz] = useState(false);
  const alvo = PALAVRAS[n % PALAVRAS.length];
  const pecas = embaralhar([...alvo.silabas, ...EXTRAS.filter((x) => !alvo.silabas.includes(x)).slice(n % 4, (n % 4) + 3)], n + 7);
  const certa = montada.join("") === alvo.silabas.join("");
  const dizer = (t: string) => { if (!falar(t)) setSemVoz(true); };

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-3">
        {([["letras", "Letras"], ["silabas", "Montar palavras"]] as const).map(([id, nome]) => (
          <button key={id} role="tab" aria-selected={aba === id} type="button" onClick={() => setAba(id)} className={`min-h-12 cursor-pointer rounded-full border-4 px-6 text-xl font-bold ${aba === id ? "border-ink bg-ink text-white" : "border-ink bg-white"}`}>{nome}</button>
        ))}
      </div>
      {semVoz && temVoz() && <p className="mt-4 rounded-2xl bg-white p-4 text-lg">O som está desligado. Peça a um adulto para ligar no botão lá em cima.</p>}
      {semVoz && !temVoz() && <p className="mt-4 rounded-2xl bg-white p-4 text-lg">Este aparelho não fala. Peça ajuda a um adulto para ler junto com você!</p>}

      {aba === "letras" ? (
        <>
          <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-7">
            {LETRAS.map((l) => (
              <button key={l[0]} type="button" onClick={() => { setLetra(l); dizer(`${l[0]}. ${l[0]} de ${l[1]}.`); }} className={`min-h-16 cursor-pointer rounded-2xl border-4 border-ink text-4xl font-bold ${letra?.[0] === l[0] ? "bg-[#F6C945]" : "bg-white hover:bg-[#FFF4D6]"}`}>
                {l[0]}
              </button>
            ))}
          </div>
          {letra && (
            <div className="mt-6 flex items-center gap-6 rounded-3xl border-4 border-ink bg-white p-6">
              <span className="text-8xl" aria-hidden>{letra[2]}</span>
              <p className="text-4xl font-bold"><span className="text-[#7A1F1F]">{letra[0]}</span> de {letra[1].toUpperCase()}</p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 rounded-3xl border-4 border-ink bg-white p-6">
          <p className="text-center text-8xl" aria-hidden>{alvo.desenho}</p>
          <p className="mt-2 text-center text-xl">Toque nas sílabas na ordem certa para formar o nome do desenho.</p>
          <div className="mt-4 flex min-h-20 flex-wrap items-center justify-center gap-2 rounded-2xl border-4 border-dashed border-ink/40 p-3" aria-live="polite">
            {montada.map((s, i) => <span key={i} className="rounded-xl bg-[#F6C945] px-4 py-2 text-4xl font-bold">{s}</span>)}
            {montada.length === 0 && <span className="text-xl text-ink-soft">…</span>}
          </div>
          {certa ? (
            <div className="mt-4 text-center">
              <Mascote humor="festa" tamanho={90} />
              <p className="text-3xl font-bold">Isso! {alvo.silabas.join("")}!</p>
              <button type="button" onClick={() => { setN(n + 1); setMontada([]); }} className="mt-3 min-h-14 cursor-pointer rounded-full border-4 border-ink bg-ink px-8 text-2xl font-bold text-white">Próxima palavra →</button>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {pecas.map((s, i) => (
                  <button key={`${s}-${i}`} type="button" onClick={() => { dizer(s.toLowerCase()); if (montada.length < alvo.silabas.length) setMontada([...montada, s]); }} className="min-h-16 min-w-20 cursor-pointer rounded-2xl border-4 border-ink bg-white text-4xl font-bold hover:bg-[#FFF4D6]">{s}</button>
                ))}
              </div>
              {montada.length === alvo.silabas.length && !certa && <p className="mt-4 text-center text-2xl">Quase! Vamos tentar de novo? 💛</p>}
              <p className="mt-4 flex justify-center gap-3">
                <button type="button" onClick={() => setMontada(montada.slice(0, -1))} className="min-h-12 cursor-pointer rounded-full border-4 border-ink bg-white px-5 text-lg font-bold">⌫ Apagar</button>
                <button type="button" onClick={() => dizer(alvo.silabas.join("").toLowerCase())} className="min-h-12 cursor-pointer rounded-full border-4 border-ink bg-white px-5 text-lg font-bold">🔊 Ouvir a palavra</button>
              </p>
            </>
          )}
        </div>
      )}
      <NotaParaOAdulto idade="4 a 7 anos" objetivo="Reconhecer letras e juntar sílabas simples para formar palavras." aprende="O nome e o som de cada letra, a ideia de sílaba e a leitura de palavras de duas e três sílabas." nota="Leia junto, aponte as letras em casa e na rua. Errar faz parte: o jogo só ajuda a tentar de novo, sem pontos nem tempo." />
    </div>
  );
}
