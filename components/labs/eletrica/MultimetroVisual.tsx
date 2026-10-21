// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { type Borne, CHAVES, type Chave, ler, type Peca } from "./multimetro";

type Ponta = { peca: string; terminal: 0 | 1 } | null;
export interface Missao {
  texto: string;
  peca: string;
  chaves: Chave[];
}

/** Um bipe curto, gerado no próprio navegador (o som da continuidade). */
function bipe() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = 2400;
    ganho.gain.value = 0.08;
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => void ctx.close();
  } catch {
    // sem áudio: o visor já mostra a continuidade
  }
}

/**
 * O multímetro desenhado: visor, chave giratória (clique na posição) e os três bornes (a ponteira preta fica no COM; a
 * vermelha vai no VΩ ou no 10 A). Na bancada, cada peça tem dois terminais: escolha a ponteira e toque no terminal.
 */
export function MultimetroVisual({ pecas, missoes = [], titulo = "Bancada" }: { pecas: Peca[]; missoes?: Missao[]; titulo?: string }) {
  const [chave, setChave] = useState<Chave>("off");
  const [borne, setBorne] = useState<Borne>("vohm");
  const [vermelha, setVermelha] = useState<Ponta>(null);
  const [preta, setPreta] = useState<Ponta>(null);
  const [ativa, setAtiva] = useState<"vermelha" | "preta">("vermelha");
  const [fusivel, setFusivel] = useState(false);
  const [feitas, setFeitas] = useState<number[]>([]);
  const mesmaPeca = vermelha && preta && vermelha.peca === preta.peca && vermelha.terminal !== preta.terminal ? pecas.find((p) => p.id === vermelha.peca) ?? null : null;
  const mesmoPonto = Boolean(vermelha && preta && vermelha.peca === preta.peca && vermelha.terminal === preta.terminal);
  const separadas = Boolean(vermelha && preta && vermelha.peca !== preta.peca);
  const leitura = ler(chave, borne, mesmaPeca, Boolean(mesmaPeca && vermelha?.terminal === 1), fusivel);
  const ultimoBipe = useRef("");

  // O som da continuidade e o fusível que queima no curto: efeitos do que acabou de ser medido.
  useEffect(() => {
    const chaveDaMedida = `${chave}-${borne}-${vermelha?.peca}-${vermelha?.terminal}-${preta?.peca}-${preta?.terminal}`;
    if (leitura.bipe && ultimoBipe.current !== chaveDaMedida) bipe();
    ultimoBipe.current = chaveDaMedida;
    if (leitura.queimaFusivel && !fusivel) void Promise.resolve().then(() => setFusivel(true));
    if (mesmaPeca && leitura.tipo === "ok") {
      const i = missoes.findIndex((m, j) => !feitas.includes(j) && m.peca === mesmaPeca.id && m.chaves.includes(chave));
      if (i >= 0) void Promise.resolve().then(() => setFeitas((f) => [...f, i]));
    }
  }, [leitura.bipe, leitura.queimaFusivel, leitura.tipo, chave, borne, vermelha, preta, fusivel, mesmaPeca, missoes, feitas]);

  const encostar = (peca: string, terminal: 0 | 1) => {
    if (ativa === "vermelha") {
      setVermelha({ peca, terminal });
      if (!preta) setAtiva("preta");
    } else {
      setPreta({ peca, terminal });
      if (!vermelha) setAtiva("vermelha");
    }
  };
  const anguloDaChave = CHAVES.find((c) => c.id === chave)?.angulo ?? -90;
  const corDoAviso = leitura.tipo === "perigo" ? "border-[#c21f16] bg-[#c21f16]/10" : leitura.tipo === "aviso" ? "border-gold bg-parchment-deep" : "border-ok bg-parchment-deep";

  return (
    <div className="grid gap-6 font-sans text-sm lg:grid-cols-[19rem_minmax(0,1fr)]">
      {/* O multímetro */}
      <div className="mx-auto w-full max-w-[19rem]">
        <svg viewBox="0 0 300 470" className="w-full" role="group" aria-label="Multímetro digital">
          <rect x="6" y="6" width="288" height="458" rx="26" fill="#e8b520" stroke="#1b1b1b" strokeWidth="6" />
          <rect x="22" y="22" width="256" height="426" rx="16" fill="#2b2b2b" />
          {/* Visor */}
          <rect x="40" y="40" width="220" height="92" rx="6" fill="#b8c4a0" stroke="#1b1b1b" strokeWidth="3" />
          <text x="246" y="104" textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="44" fill="#1b1b1b">{leitura.visor}</text>
          <text x="246" y="124" textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="14" fill="#1b1b1b">{leitura.unidade}</text>
          {chave !== "off" && fusivel && <text x="52" y="60" fontFamily="ui-monospace, monospace" fontSize="11" fill="#9b1c1c">FUSE</text>}
          {/* Chave giratória */}
          <circle cx="150" cy="262" r="96" fill="#1f1f1f" stroke="#444" strokeWidth="2" />
          {CHAVES.map((c) => {
            const rad = ((c.angulo - 90) * Math.PI) / 180;
            const x = 150 + Math.cos(rad) * 78;
            const y = 262 + Math.sin(rad) * 78;
            const lx = 150 + Math.cos(rad) * 112;
            const ly = 262 + Math.sin(rad) * 112;
            return (
              <g key={c.id} onClick={() => setChave(c.id)} className="cursor-pointer" role="button" aria-label={`Chave em ${c.grupo} ${c.rotulo}`} aria-pressed={chave === c.id} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setChave(c.id)}>
                <circle cx={x} cy={y} r="11" fill={chave === c.id ? "#e8b520" : "#3a3a3a"} />
                <text x={lx} y={ly + 4} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="bold" fill={c.id === "a10" ? "#ff7b6b" : "#f4ecd8"}>{c.rotulo}</text>
              </g>
            );
          })}
          {/* Os símbolos de cada grupo, por fora */}
          <text x="58" y="166" fontSize="12" fill="#f4ecd8" fontFamily="ui-monospace, monospace">V⎓</text>
          <text x="150" y="152" textAnchor="middle" fontSize="12" fill="#f4ecd8" fontFamily="ui-monospace, monospace">V~</text>
          <text x="248" y="300" fontSize="12" fill="#f4ecd8" fontFamily="ui-monospace, monospace">Ω</text>
          <circle cx="150" cy="262" r="46" fill="#111" stroke="#555" strokeWidth="3" />
          <g style={{ transform: `rotate(${anguloDaChave}deg)`, transformOrigin: "150px 262px", transition: "transform .25s ease" }}>
            <rect x="145" y="214" width="10" height="44" rx="5" fill="#e8b520" />
          </g>
          {/* Bornes */}
          {([["a10", 70, "10A"], ["com", 150, "COM"], ["vohm", 230, "VΩ"]] as const).map(([id, x, nome]) => (
            <g key={id} onClick={() => id !== "com" && setBorne(id)} className={id === "com" ? "" : "cursor-pointer"} role={id === "com" ? undefined : "button"} aria-label={id === "com" ? "Borne COM (ponteira preta)" : `Pôr a ponteira vermelha no borne ${nome}`} tabIndex={id === "com" ? undefined : 0} onKeyDown={(e) => id !== "com" && (e.key === "Enter" || e.key === " ") && setBorne(id)}>
              <circle cx={x} cy="410" r="17" fill="#111" stroke={id === "a10" ? "#ff7b6b" : "#888"} strokeWidth="3" />
              {(id === "com" || borne === id) && <circle cx={x} cy="410" r="9" fill={id === "com" ? "#111" : "#c21f16"} stroke={id === "com" ? "#f4ecd8" : "#fff"} strokeWidth="2" />}
              <text x={x} y="446" textAnchor="middle" fontSize="12" fill={id === "a10" ? "#ff7b6b" : "#f4ecd8"} fontFamily="ui-monospace, monospace">{nome}</text>
            </g>
          ))}
        </svg>
        <p className="mt-1 text-center text-xs text-ink-soft">Toque na posição da chave e no borne da ponteira vermelha (a preta fica no COM).</p>
        {fusivel && <button type="button" onClick={() => setFusivel(false)} className="mt-2 w-full cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood">Trocar o fusível interno</button>}
      </div>

      {/* A bancada */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{titulo}: encostar a</span>
          <button type="button" aria-pressed={ativa === "vermelha"} onClick={() => setAtiva("vermelha")} className={`cursor-pointer border-2 px-3 py-1 font-bold ${ativa === "vermelha" ? "border-[#c21f16] bg-[#c21f16] text-white" : "border-[#c21f16] text-[#c21f16]"}`}>ponteira vermelha</button>
          <button type="button" aria-pressed={ativa === "preta"} onClick={() => setAtiva("preta")} className={`cursor-pointer border-2 px-3 py-1 font-bold ${ativa === "preta" ? "border-ink bg-ink text-parchment" : "border-ink"}`}>ponteira preta</button>
          {(vermelha || preta) && <button type="button" onClick={() => { setVermelha(null); setPreta(null); setAtiva("vermelha"); }} className="cursor-pointer underline hover:text-oxblood">tirar as ponteiras</button>}
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {pecas.map((p) => (
            <li key={p.id} className={`border-2 p-2 ${mesmaPeca?.id === p.id ? "border-ink bg-parchment-deep" : "border-ink/20"}`}>
              <p className="flex items-center gap-2 font-semibold"><span aria-hidden className="text-xl">{p.icone}</span>{p.nome}{(p.dc || p.ac) ? <span className="ml-auto text-[0.65rem] font-bold uppercase text-[#c21f16]">energizada</span> : null}</p>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {p.terminais.map((t, i) => {
                  const temVermelha = vermelha?.peca === p.id && vermelha.terminal === i;
                  const temPreta = preta?.peca === p.id && preta.terminal === i;
                  return (
                    <button key={t} type="button" onClick={() => encostar(p.id, i as 0 | 1)} aria-label={`Encostar a ponteira ${ativa} em: ${p.nome}, ${t}`} className="flex cursor-pointer items-center gap-1 border border-ink/30 bg-parchment px-1.5 py-1 text-left text-xs hover:border-ink">
                      <span aria-hidden className="flex gap-0.5">
                        <span className={`inline-block h-3 w-3 rounded-full border ${temVermelha ? "border-[#c21f16] bg-[#c21f16]" : "border-ink/30"}`} />
                        <span className={`inline-block h-3 w-3 rounded-full border ${temPreta ? "border-ink bg-ink" : "border-ink/30"}`} />
                      </span>
                      {t}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <div role="status" aria-live="polite" className={`mt-3 border-l-4 p-3 ${corDoAviso}`}>
          {chave === "off" ? "Gire a chave para ligar o multímetro." : separadas ? "As ponteiras estão em peças diferentes: assim não se mede nada. Encoste as duas na mesma peça, uma em cada terminal." : mesmoPonto ? "As duas ponteiras no mesmo ponto: o multímetro mede zero entre elas." : leitura.texto ?? "Encoste as duas ponteiras."}
        </div>
        {missoes.length > 0 && (
          <div className="mt-4 border-2 border-ink bg-parchment-deep p-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-oxblood">Missões ({feitas.length}/{missoes.length})</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {missoes.map((m, i) => <li key={m.texto} className={feitas.includes(i) ? "text-ok line-through" : ""}>{m.texto}</li>)}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
