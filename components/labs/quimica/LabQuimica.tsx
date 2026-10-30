// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Bancada, BotaoClaro, Deslizante, Escolha, Leitura, Modulos, PrevejaRode } from "../kit";
import { ACIDOS, corCss, curvaDaTitulacao, DO_DIA_A_DIA, INDICADORES, phDaTitulacao, volumeDeEquivalencia } from "./quimica";

const num = (x: number, casas = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });

/** O erlenmeyer com o líquido na cor do indicador: o nível sobe com o volume. */
function Frasco({ cor, nivel, rotulo }: { cor: string; nivel: number; rotulo: string }) {
  const altura = 30 + Math.min(1, Math.max(0, nivel)) * 70;
  return (
    <svg viewBox="0 0 140 160" className="h-48 w-auto" role="img" aria-label={rotulo}>
      <defs>
        <clipPath id="dentro-do-frasco">
          <path d="M55 10h30v45l38 85a10 10 0 0 1-9 14H26a10 10 0 0 1-9-14l38-85z" />
        </clipPath>
      </defs>
      <rect x="0" y={154 - altura} width="140" height={altura} fill={cor} clipPath="url(#dentro-do-frasco)" />
      <path d="M55 10h30v45l38 85a10 10 0 0 1-9 14H26a10 10 0 0 1-9-14l38-85z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M50 10h40" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** A curva de pH desenhada à mão em SVG: eixo do volume, eixo do pH, o ponto de agora e o de equivalência. */
function Curva({ pontos, vMax, agora, veq }: { pontos: [number, number][]; vMax: number; agora: [number, number]; veq: number }) {
  const x = (v: number) => 34 + (v / vMax) * 256;
  const y = (ph: number) => 170 - (ph / 14) * 160;
  return (
    <svg viewBox="0 0 300 190" className="w-full border-2 border-ink bg-[#17130e]" role="img" aria-label={`Curva de titulação: pH ${num(agora[1])} com ${num(agora[0], 1)} mL de base`}>
      {[0, 7, 14].map((ph) => (
        <g key={ph}>
          <line x1={34} x2={290} y1={y(ph)} y2={y(ph)} stroke="#ffffff1f" />
          <text x={28} y={y(ph) + 3} fill="#cdbb91" fontSize="9" textAnchor="end" fontFamily="monospace">{ph}</text>
        </g>
      ))}
      {veq <= vMax && <line x1={x(veq)} x2={x(veq)} y1={10} y2={170} stroke="#d4a24c" strokeDasharray="3 3" />}
      <polyline fill="none" stroke="#e0837a" strokeWidth="2.2" points={pontos.map(([v, ph]) => `${x(v)},${y(ph)}`).join(" ")} />
      <circle cx={x(agora[0])} cy={y(agora[1])} r="4.5" fill="#fff" stroke="#c21f16" strokeWidth="2" />
      <text x={290} y={184} fill="#cdbb91" fontSize="9" textAnchor="end" fontFamily="monospace">mL de base →</text>
      <text x={8} y={12} fill="#cdbb91" fontSize="9" fontFamily="monospace">pH</text>
    </svg>
  );
}

function Titulacao() {
  const [acidoId, setAcidoId] = useState(ACIDOS[0].id);
  const [ca, setCa] = useState(0.1);
  const [va, setVa] = useState(25);
  const [cb, setCb] = useState(0.1);
  const [vb, setVb] = useState(0);
  const [indicadorId, setIndicadorId] = useState("fenolftaleina");
  const acido = ACIDOS.find((a) => a.id === acidoId) ?? ACIDOS[0];
  const indicador = INDICADORES.find((i) => i.id === indicadorId) ?? INDICADORES[0];
  const veq = volumeDeEquivalencia(ca, va, cb);
  const vMax = Math.max(10, Math.min(100, Math.ceil(veq * 2 / 5) * 5));
  const ph = phDaTitulacao(acido, ca, va, cb, vb);
  const pontos = curvaDaTitulacao(acido, ca, va, cb, vMax);
  return (
    <Bancada
      titulo="Titulação ácido-base"
      subtitulo="Pingue a base na bureta e veja o pH e a cor mudarem"
      acoes={
        <>
          <button type="button" onClick={() => setVb((v) => Math.min(vMax, +(v + 0.5).toFixed(2)))} className="cursor-pointer border-2 border-[#f4ecd8] bg-[#c21f16] px-3 py-1.5 text-sm font-extrabold text-white shadow-[3px_3px_0_#f4ecd8]">+ 0,5 mL</button>
          <button type="button" onClick={() => setVb((v) => Math.min(vMax, +(v + 0.05).toFixed(2)))} className="cursor-pointer border-2 border-[#f4ecd8]/60 px-3 py-1.5 text-sm font-bold">+ 1 gota</button>
          <button type="button" onClick={() => setVb(0)} className="cursor-pointer border-2 border-[#f4ecd8]/60 px-3 py-1.5 text-sm font-bold">↺ Recomeçar</button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-semibold">Ácido no frasco</span>
            <select value={acidoId} onChange={(e) => { setAcidoId(e.target.value); setVb(0); }} className="mt-1 block w-full border-2 border-ink bg-folha px-2 py-1.5">
              {ACIDOS.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
          <Deslizante rotulo="Concentração do ácido (mol/L)" valor={ca} min={0.01} max={1} passo={0.01} mudar={(v) => { setCa(v); setVb(0); }} formato={(v) => num(v)} />
          <Deslizante rotulo="Volume do ácido (mL)" valor={va} min={5} max={50} passo={1} mudar={(v) => { setVa(v); setVb(0); }} />
          <Deslizante rotulo="Concentração da base, NaOH (mol/L)" valor={cb} min={0.01} max={1} passo={0.01} mudar={(v) => { setCb(v); setVb(0); }} formato={(v) => num(v)} />
          <Deslizante rotulo="Base que já caiu da bureta (mL)" valor={vb} min={0} max={vMax} passo={0.05} mudar={setVb} formato={(v) => num(v)} />
          <Escolha rotulo="Indicador" valor={indicadorId} opcoes={INDICADORES.map((i) => [i.id, i.nome] as [string, string])} mudar={setIndicadorId} />
          <p className="text-xs text-ink-soft">{indicador.nome}: {indicador.viragem}.</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-5">
            <div className="text-ink">
              <Frasco cor={corCss(indicador.cor(ph))} nivel={(va + vb) / (va + vMax)} rotulo={`Frasco com ${num(va + vb, 1)} mL, cor do indicador em pH ${num(ph)}`} />
            </div>
            <div className="grid min-w-[13rem] flex-1 grid-cols-2 gap-2">
              <Leitura rotulo="pH agora" valor={num(ph)} destaque />
              <Leitura rotulo="Base na bureta" valor={`${num(vb)} mL`} />
              <Leitura rotulo="Ponto de equivalência" valor={Number.isFinite(veq) ? `${num(veq)} mL` : "—"} />
              <Leitura rotulo="Situação" valor={ph < 6.5 ? "ácida" : ph > 7.5 ? "básica" : "quase neutra"} />
            </div>
          </div>
          <Curva pontos={pontos} vMax={vMax} agora={[vb, ph]} veq={veq} />
          <p className="text-xs text-ink-soft">A linha tracejada marca o ponto de equivalência: ali a base neutralizou todo o ácido (mols de base = mols de ácido).</p>
        </div>
      </div>
      <div className="mt-6">
        <PrevejaRode
          pergunta="Com o vinagre (ácido fraco), o pH no ponto de equivalência é 7, menor que 7 ou maior que 7?"
          explicacao="Maior que 7 (perto de 8,7). No ponto de equivalência sobra o acetato, que puxa H+ da água e deixa a solução levemente básica. Com o HCl (forte), o cloreto não faz isso e o pH fica em 7. Por isso a fenolftaleína, que vira perto de 9, serve bem para o ácido fraco."
          limites="O modelo considera ácidos com um só H ionizável e a temperatura de 25 °C. Na bancada de verdade há erro de leitura da bureta, e a cor do indicador muda aos poucos."
          aprofundar="Troque o indicador para o alaranjado de metila e titule o vinagre: ele vira cedo demais e o resultado sai errado. É o erro do indicador."
        />
      </div>
    </Bancada>
  );
}

function Diluicao() {
  const [c1, setC1] = useState(1);
  const [v1, setV1] = useState(50);
  const [agua, setAgua] = useState(150);
  const v2 = v1 + agua;
  const c2 = (c1 * v1) / v2;
  const intensidade = Math.min(1, c2 / 1);
  return (
    <Bancada titulo="Diluição" subtitulo="C₁ · V₁ = C₂ · V₂: a quantidade de soluto não muda, só a água">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4">
          <Deslizante rotulo="Concentração inicial C₁ (mol/L)" valor={c1} min={0.1} max={2} passo={0.1} mudar={setC1} formato={(v) => num(v, 1)} />
          <Deslizante rotulo="Volume inicial V₁ (mL)" valor={v1} min={10} max={200} passo={5} mudar={setV1} />
          <Deslizante rotulo="Água acrescentada (mL)" valor={agua} min={0} max={800} passo={10} mudar={setAgua} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Leitura rotulo="Volume final V₂" valor={`${v2} mL`} />
            <Leitura rotulo="Concentração final C₂" valor={`${num(c2, 3)} mol/L`} destaque />
            <Leitura rotulo="Ficou mais fraca" valor={`${num(c1 / c2, 1)} vezes`} />
          </div>
          <p className="border-l-4 border-[#c21f16] bg-parchment p-3 text-sm">
            Conta: C₂ = C₁ × V₁ ÷ V₂ = {num(c1, 1)} × {v1} ÷ {v2} = <strong>{num(c2, 3)} mol/L</strong>. No dia a dia é o mesmo raciocínio de diluir água sanitária ou suco concentrado.
          </p>
        </div>
        <svg viewBox="0 0 120 200" className="mx-auto h-56 w-auto text-ink" role="img" aria-label={`Béquer com ${v2} mL`}>
          <rect x="22" y={190 - Math.min(170, (v2 / 1000) * 170)} width="76" height={Math.min(170, (v2 / 1000) * 170)} fill={`rgb(194 31 22 / ${0.15 + intensidade * 0.75})`} />
          <path d="M18 10v176a6 6 0 0 0 6 6h72a6 6 0 0 0 6-6V10" fill="none" stroke="currentColor" strokeWidth="3" />
          {[250, 500, 750].map((m) => (
            <g key={m}>
              <line x1="18" x2="30" y1={190 - (m / 1000) * 170} y2={190 - (m / 1000) * 170} stroke="currentColor" />
              <text x="34" y={193 - (m / 1000) * 170} fontSize="9" fill="currentColor" fontFamily="monospace">{m}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-6">
        <PrevejaRode
          pergunta="Se você dobrar o volume com água, a concentração cai pela metade, por um quarto ou não muda?"
          explicacao="Cai pela metade. O número de mols de soluto continua o mesmo; ele só se espalha num volume duas vezes maior."
          limites="Ao misturar alguns líquidos o volume final não é a soma exata (água e álcool, por exemplo). Para soluções diluídas em água, a soma é uma ótima aproximação."
          aprofundar="Quanto de água você precisa para transformar 50 mL de solução 1 mol/L em 0,1 mol/L? Faça a conta antes e confira nos controles."
        />
      </div>
    </Bancada>
  );
}

function EscalaDePh() {
  const [indicadorId, setIndicadorId] = useState("repolho");
  const [escolhida, setEscolhida] = useState(DO_DIA_A_DIA[1]);
  const indicador = INDICADORES.find((i) => i.id === indicadorId) ?? INDICADORES[3];
  return (
    <Bancada titulo="A escala de pH em casa" subtitulo="Do suco de limão à soda cáustica, e um indicador feito com repolho roxo">
      <Escolha rotulo="Indicador" valor={indicadorId} opcoes={INDICADORES.map((i) => [i.id, i.nome] as [string, string])} mudar={setIndicadorId} />
      <div className="mt-4 flex h-10 border-2 border-ink" role="img" aria-label={`Cores de ${indicador.nome} de pH 0 a 14`}>
        {Array.from({ length: 15 }, (_, ph) => (
          <span key={ph} className="flex flex-1 items-end justify-center pb-0.5 font-mono text-[0.6rem] text-[#1f1a14]" style={{ background: corCss(indicador.cor(ph)) }}>{ph}</span>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DO_DIA_A_DIA.map((s) => (
          <li key={s.nome}>
            <button type="button" onClick={() => setEscolhida(s)} aria-pressed={escolhida.nome === s.nome} className={`flex w-full cursor-pointer items-center gap-3 border-2 px-3 py-2 text-left text-sm ${escolhida.nome === s.nome ? "border-ink bg-ink text-parchment" : "border-ink bg-folha"}`}>
              <span aria-hidden className="h-7 w-7 shrink-0 border-2 border-[#1f1a14]" style={{ background: corCss(indicador.cor(s.ph)) }} />
              <span className="min-w-0 flex-1 font-semibold">{s.nome}</span>
              <span className="font-mono">{num(s.ph, 1)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-l-4 border-[#c21f16] bg-parchment p-3 text-sm">
        <strong>{escolhida.nome}</strong>, pH perto de {num(escolhida.ph, 1)}: {escolhida.nota}. Cada ponto da escala é dez vezes mais (ou menos) ácido que o vizinho: o limão (2) é cerca de cem mil vezes mais ácido que a água pura (7).
      </p>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold underline">Como fazer o indicador de repolho roxo em casa</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Pique umas folhas de repolho roxo e cubra com água quente (com ajuda de um adulto, se for criança).</li>
          <li>Espere dez minutos e coe: o caldo roxo é o indicador.</li>
          <li>Ponha um pouco em copos e pingue limão, vinagre, bicarbonato, sabão… e compare as cores com a faixa acima.</li>
          <li>Não use água sanitária, soda cáustica nem limpadores fortes sem luva e óculos, e nunca misture produtos de limpeza.</li>
        </ol>
      </details>
      <p className="mt-4"><BotaoClaro onClick={() => setEscolhida(DO_DIA_A_DIA[Math.floor(Math.random() * DO_DIA_A_DIA.length)])}>Sortear uma substância</BotaoClaro></p>
    </Bancada>
  );
}

type Id = "titulacao" | "diluicao" | "escala";
const MODULOS: { id: Id; nome: string; icone: string; resumo: string }[] = [
  { id: "titulacao", nome: "Titulação ácido-base", icone: "tubo", resumo: "pH, indicadores e o ponto de equivalência" },
  { id: "diluicao", nome: "Diluição", icone: "frasco", resumo: "C₁V₁ = C₂V₂ no béquer" },
  { id: "escala", nome: "A escala de pH em casa", icone: "reacao", resumo: "Do limão à soda, com repolho roxo" },
];

/**
 * O laboratório de química: a titulação com a curva de pH calculada de verdade (balanço de cargas, ácido forte ou
 * fraco), a diluição no béquer e a escala de pH das coisas de casa, com o indicador caseiro de repolho roxo. Nada de
 * reagente de verdade: na bancada da escola, avental, luva e óculos.
 */
export function LabQuimica() {
  const [atual, setAtual] = useState<Id>("titulacao");
  return (
    <div className="mt-8 font-sans">
      <p className="border-l-4 border-[#c21f16] bg-folha px-3 py-2 text-sm">Simulação para aprender. Na bancada de verdade: avental, luva e óculos de proteção, e nunca prove nem cheire reagentes diretamente.</p>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div>
          <Modulos itens={MODULOS} atual={atual} escolher={setAtual} />
        </div>
        <div className="min-w-0">
          {atual === "titulacao" && <Titulacao />}
          {atual === "diluicao" && <Diluicao />}
          {atual === "escala" && <EscalaDePh />}
        </div>
      </div>
    </div>
  );
}
