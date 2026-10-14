// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dict } from "@/i18n/types";

type S = Dict["tools"]["graphs"];
type MathJs = typeof import("mathjs");

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-mono";
const cores = ["var(--oxblood)", "var(--ink)", "var(--gold)"];
const LARGURA = 640;
const ALTURA = 400;
const PONTOS = 400;

/**
 * Gráficos de funções e álgebra com math.js, tudo no próprio navegador, sem serviço de fora.
 * A biblioteca só é baixada quando alguém abre esta ferramenta.
 */
export function Graphs({ s, lang }: { s: S; lang: string }) {
  const [math, setMath] = useState<MathJs | null>(null);
  const [funcoes, setFuncoes] = useState(["x^2 - 2x - 3", "2x + 1", ""]);
  const [faixa, setFaixa] = useState({ de: "-6", ate: "6" });
  const [derivar, setDerivar] = useState("x^3 - 3x");

  useEffect(() => {
    let cancelado = false;
    void import("mathjs").then((modulo) => {
      if (!cancelado) setMath(modulo);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const de = Number(faixa.de.replace(",", "."));
  const ate = Number(faixa.ate.replace(",", "."));
  const faixaOk = Number.isFinite(de) && Number.isFinite(ate) && ate > de && ate - de <= 10000;

  const curvas = useMemo(() => {
    if (!math || !faixaOk) return [];
    return funcoes.map((texto) => {
      if (!texto.trim()) return { texto, pontos: [] as [number, number][], erro: false };
      try {
        const compilada = math.compile(texto.replace(/,/g, "."));
        const pontos: [number, number][] = [];
        for (let i = 0; i <= PONTOS; i++) {
          const x = de + ((ate - de) * i) / PONTOS;
          const y = Number(compilada.evaluate({ x }));
          if (Number.isFinite(y)) pontos.push([x, y]);
        }
        return { texto, pontos, erro: pontos.length === 0 };
      } catch {
        return { texto, pontos: [] as [number, number][], erro: true };
      }
    });
  }, [math, funcoes, de, ate, faixaOk]);

  // A altura do gráfico acompanha as curvas, cortando os extremos que fogem para o infinito.
  const ys = curvas.flatMap((curva) => curva.pontos.map(([, y]) => y)).sort((a, b) => a - b);
  const corte = Math.floor(ys.length * 0.02);
  let baixo = ys.length ? ys[corte] : -1;
  let alto = ys.length ? ys[ys.length - 1 - corte] : 1;
  if (alto - baixo < 1e-9) {
    baixo -= 1;
    alto += 1;
  }
  const folga = (alto - baixo) * 0.08;
  baixo -= folga;
  alto += folga;
  const px = (x: number) => ((x - de) / (ate - de)) * LARGURA;
  const py = (y: number) => ALTURA - ((y - baixo) / (alto - baixo)) * ALTURA;
  const caminho = (pontos: [number, number][]) => {
    let d = "";
    let anterior: number | null = null;
    for (const [x, y] of pontos) {
      const fora = y < baixo - (alto - baixo) * 2 || y > alto + (alto - baixo) * 2;
      // Salto grande (assíntota): começa um traço novo em vez de ligar os dois lados.
      const salto = anterior !== null && Math.abs(y - anterior) > (alto - baixo) * 0.9;
      if (fora) {
        anterior = null;
        continue;
      }
      d += `${d === "" || anterior === null || salto ? "M" : "L"}${px(x).toFixed(1)},${py(y).toFixed(1)}`;
      anterior = y;
    }
    return d;
  };

  const algebra = useMemo(() => {
    if (!math || !derivar.trim()) return null;
    try {
      const expressao = derivar.replace(/,/g, ".");
      return { simplificada: math.simplify(expressao).toString(), derivada: math.simplify(math.derivative(expressao, "x")).toString() };
    } catch {
      return { erro: true };
    }
  }, [math, derivar]);

  const fmt = (valor: number) => new Intl.NumberFormat(lang, { maximumSignificantDigits: 4 }).format(valor);

  return (
    <div className="font-sans">
      {!math && <p className="text-ink-soft">{s.loading}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {funcoes.map((texto, i) => (
          <label key={i} className="block">
            <span style={{ color: cores[i] }} className="font-semibold">f{i + 1}(x) =</span>
            <input value={texto} onChange={(e) => setFuncoes(funcoes.map((item, j) => (j === i ? e.target.value : item)))} maxLength={120} spellCheck={false} className={field} />
            {curvas[i]?.erro && <span className="text-sm text-oxblood">{s.invalid}</span>}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="block w-32">
          {s.from}
          <input value={faixa.de} onChange={(e) => setFaixa({ ...faixa, de: e.target.value })} inputMode="decimal" className={field} />
        </label>
        <label className="block w-32">
          {s.to}
          <input value={faixa.ate} onChange={(e) => setFaixa({ ...faixa, ate: e.target.value })} inputMode="decimal" className={field} />
        </label>
      </div>
      {!faixaOk && <p className="mt-2 text-oxblood">{s.badRange}</p>}
      <figure className="mt-5">
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="h-auto w-full border border-rule bg-parchment" role="img" aria-label={funcoes.filter(Boolean).join("; ")}>
          {de < 0 && ate > 0 && <line x1={px(0)} x2={px(0)} y1={0} y2={ALTURA} stroke="var(--rule)" strokeWidth={1.5} />}
          {baixo < 0 && alto > 0 && <line x1={0} x2={LARGURA} y1={py(0)} y2={py(0)} stroke="var(--rule)" strokeWidth={1.5} />}
          {curvas.map((curva, i) => curva.pontos.length > 0 && <path key={i} d={caminho(curva.pontos)} fill="none" stroke={cores[i]} strokeWidth={2.5} />)}
        </svg>
        <figcaption className="mt-1 flex justify-between font-mono text-xs text-ink-soft">
          <span>x: {fmt(de)} … {fmt(ate)}</span>
          <span>y: {fmt(baixo)} … {fmt(alto)}</span>
        </figcaption>
      </figure>
      <section className="mt-8 border-t border-rule pt-6">
        <h2 className="font-serif text-2xl font-semibold">{s.algebra}</h2>
        <label className="mt-3 block">
          {s.expression}
          <input value={derivar} onChange={(e) => setDerivar(e.target.value)} maxLength={160} spellCheck={false} className={field} />
        </label>
        {algebra && ("erro" in algebra ? (
          <p className="mt-2 text-oxblood">{s.invalid}</p>
        ) : (
          <dl className="mt-3 grid gap-x-6 gap-y-1 font-mono sm:grid-cols-[12rem_1fr]">
            <dt className="text-ink-soft">{s.simplified}</dt>
            <dd>{algebra.simplificada}</dd>
            <dt className="text-ink-soft">{s.derivative}</dt>
            <dd>{algebra.derivada}</dd>
          </dl>
        ))}
        <p className="mt-4 text-sm text-ink-soft">{s.hint}</p>
      </section>
    </div>
  );
}
