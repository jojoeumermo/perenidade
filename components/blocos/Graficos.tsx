// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { lerCalculadora, lerDados, lerGrafico } from "@/lib/interativos";
import { useI18n } from "../I18n";

// Gráfico de função com controles, calculadora de variáveis e gráficos de dados. As contas usam o mathjs, que só
// entende matemática (não roda código), carregado apenas quando a aula tem um destes blocos.

type MathJs = typeof import("mathjs");
function useMath() {
  const [math, setMath] = useState<MathJs | null>(null);
  useEffect(() => {
    let vivo = true;
    void import("mathjs").then((m) => vivo && setMath(m));
    return () => {
      vivo = false;
    };
  }, []);
  return math;
}

const formatar = (lang: string, v: number, casas = 4) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang, { maximumFractionDigits: casas }).format(v);
const caixa = "no-print my-6 border-l-2 border-gold bg-parchment-deep p-4 font-sans text-sm";

export function GraficoDeFuncao({ spec }: { spec: string }) {
  const { lang, t } = useI18n();
  const g = useMemo(() => lerGrafico(spec), [spec]);
  const math = useMath();
  const [valores, setValores] = useState<Record<string, number>>(() => Object.fromEntries(g.parametros.map((p) => [p.nome, p.valor])));
  const W = 600;
  const H = 360;
  const curvas = useMemo(() => {
    if (!math) return [];
    return g.funcoes.map((f) => {
      try {
        const compilada = math.compile(f.expr);
        const pontos: [number, number][] = [];
        for (let i = 0; i <= 300; i++) {
          const x = g.x[0] + ((g.x[1] - g.x[0]) * i) / 300;
          const y = Number(compilada.evaluate({ ...valores, x }));
          pontos.push([x, Number.isFinite(y) ? y : NaN]);
        }
        return { nome: f.nome, expr: f.expr, pontos };
      } catch {
        return { nome: f.nome, expr: f.expr, pontos: [] as [number, number][] };
      }
    });
  }, [math, g, valores]);
  const ys = curvas.flatMap((c) => c.pontos.map((p) => p[1])).filter(Number.isFinite).sort((a, b) => a - b);
  const faixaY: [number, number] = g.y ?? (ys.length ? [Math.min(ys[Math.floor(ys.length * 0.02)], 0) - 1, Math.max(ys[Math.floor(ys.length * 0.98)], 0) + 1] : [-10, 10]);
  const px = (x: number) => ((x - g.x[0]) / (g.x[1] - g.x[0])) * W;
  const py = (y: number) => H - ((y - faixaY[0]) / (faixaY[1] - faixaY[0])) * H;
  const cores = ["var(--oxblood)", "var(--ink)", "var(--gold)", "#3d6fd6"];
  const caminho = (pontos: [number, number][]) => {
    let d = "";
    let aberto = false;
    for (const [x, y] of pontos) {
      if (!Number.isFinite(y) || y < faixaY[0] - (faixaY[1] - faixaY[0]) || y > faixaY[1] + (faixaY[1] - faixaY[0])) {
        aberto = false;
        continue;
      }
      d += `${aberto ? "L" : "M"}${px(x).toFixed(1)},${py(y).toFixed(1)}`;
      aberto = true;
    }
    return d;
  };
  const marcas = (de: number, ate: number) => {
    const passo = 10 ** Math.floor(Math.log10((ate - de) / 5));
    const k = (ate - de) / passo > 20 ? passo * 5 : (ate - de) / passo > 10 ? passo * 2 : passo;
    const lista: number[] = [];
    for (let v = Math.ceil(de / k) * k; v <= ate; v += k) lista.push(Math.round(v * 1e6) / 1e6);
    return lista;
  };
  if (!g.funcoes.length) return <pre className="text-sm">{spec}</pre>;
  return (
    <figure className={caixa}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-rule bg-parchment" role="img" aria-label={`${t.blocks.graph}: ${g.funcoes.map((f) => `${f.nome} = ${f.expr}`).join("; ")}`}>
        {marcas(g.x[0], g.x[1]).map((v) => <line key={`x${v}`} x1={px(v)} x2={px(v)} y1={0} y2={H} stroke="var(--rule)" strokeWidth={0.6} />)}
        {marcas(faixaY[0], faixaY[1]).map((v) => <line key={`y${v}`} x1={0} x2={W} y1={py(v)} y2={py(v)} stroke="var(--rule)" strokeWidth={0.6} />)}
        {faixaY[0] < 0 && faixaY[1] > 0 && <line x1={0} x2={W} y1={py(0)} y2={py(0)} stroke="var(--ink-soft)" strokeWidth={1.2} />}
        {g.x[0] < 0 && g.x[1] > 0 && <line x1={px(0)} x2={px(0)} y1={0} y2={H} stroke="var(--ink-soft)" strokeWidth={1.2} />}
        {marcas(g.x[0], g.x[1]).map((v) => <text key={`tx${v}`} x={px(v) + 2} y={Math.min(H - 4, Math.max(12, py(0) + 12))} fontSize={10} fill="var(--ink-soft)">{formatar(lang, v)}</text>)}
        {marcas(faixaY[0], faixaY[1]).map((v) => (v !== 0 ? <text key={`ty${v}`} x={Math.min(W - 30, Math.max(2, px(0) + 3))} y={py(v) - 2} fontSize={10} fill="var(--ink-soft)">{formatar(lang, v)}</text> : null))}
        {curvas.map((c, i) => <path key={c.nome + i} d={caminho(c.pontos)} fill="none" stroke={cores[i % cores.length]} strokeWidth={2.5} />)}
        {g.pontos.map((p, i) => (
          <g key={i}>
            <circle cx={px(p.x)} cy={py(p.y)} r={4.5} fill="var(--oxblood)" />
            {p.rotulo && <text x={px(p.x) + 7} y={py(p.y) - 7} fontSize={12} fill="var(--ink)">{p.rotulo}</text>}
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 font-mono text-xs">
        {curvas.map((c, i) => <span key={i} style={{ color: cores[i % cores.length] }}>{c.nome} = {c.expr}</span>)}
      </figcaption>
      {g.parametros.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {g.parametros.map((p) => (
            <label key={p.nome} className="block">
              <span className="flex justify-between font-mono"><span>{p.nome}</span><span>{formatar(lang, valores[p.nome] ?? p.valor)}</span></span>
              <input type="range" min={p.min} max={p.max} step={p.passo} value={valores[p.nome] ?? p.valor} onChange={(e) => setValores((v) => ({ ...v, [p.nome]: Number(e.target.value) }))} className="block w-full accent-[var(--oxblood)]" />
            </label>
          ))}
        </div>
      )}
    </figure>
  );
}

export function CalculadoraDeVariaveis({ spec }: { spec: string }) {
  const { lang, t } = useI18n();
  const c = useMemo(() => lerCalculadora(spec), [spec]);
  const math = useMath();
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries((c?.campos ?? []).map((x) => [x.nome, String(x.valor).replace(".", lang === "en" || lang === "zh" ? "." : ",")])));
  if (!c) return <pre className="text-sm">{spec}</pre>;
  let resultado: string = t.blocks.invalid;
  if (math) {
    try {
      const escopo = Object.fromEntries(c.campos.map((x) => [x.nome, Number((valores[x.nome] ?? "").replace(",", "."))]));
      const v = Number(math.evaluate(c.resultado.expr, escopo));
      if (Number.isFinite(v)) resultado = formatar(lang, v);
    } catch {
      // Fica a mensagem de que não deu para calcular.
    }
  }
  return (
    <div className={caixa}>
      <p className="font-mono text-xs text-ink-soft">{c.resultado.nome} = {c.resultado.expr}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {c.campos.map((x) => (
          <label key={x.nome} className="block">
            {x.rotulo}
            <input inputMode="decimal" value={valores[x.nome] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [x.nome]: e.target.value }))} className="mt-1 w-full border-2 border-ink bg-parchment px-2 py-1.5 font-mono" />
          </label>
        ))}
      </div>
      <p className="mt-3 text-base" role="status">
        {c.resultado.rotulo}: <strong className="font-mono">{resultado}</strong>
      </p>
    </div>
  );
}

export function GraficoDeDados({ spec }: { spec: string }) {
  const { lang, t } = useI18n();
  const d = useMemo(() => lerDados(spec), [spec]);
  if (!d.linhas.length) return <pre className="text-sm">{spec}</pre>;
  const W = 600;
  const H = 300;
  const series = d.cabecalho.length - 1 || 1;
  const cores = ["var(--oxblood)", "var(--ink)", "var(--gold)"];
  const max = Math.max(1, ...d.linhas.flatMap((l) => l.valores));
  const total = d.linhas.reduce((n, l) => n + (l.valores[0] ?? 0), 0) || 1;
  const pizzaCores = ["#8b1e1e", "#c9a227", "#2b2b2b", "#3d6fd6", "#3fa34d", "#8a4fbf", "#d36a2c", "#6b6b6b"];
  return (
    <figure className={caixa}>
      {d.titulo && <p className="mb-2 font-serif text-lg font-semibold">{d.titulo}</p>}
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="w-full border border-rule bg-parchment" role="img" aria-label={`${t.blocks.chart}${d.titulo ? `: ${d.titulo}` : ""}`}>
        {d.tipo === "pizza" ? (
          (() => {
            let angulo = -Math.PI / 2;
            return d.linhas.map((l, i) => {
              const fatia = ((l.valores[0] ?? 0) / total) * Math.PI * 2;
              const [x1, y1] = [200 + 130 * Math.cos(angulo), 170 + 130 * Math.sin(angulo)];
              angulo += fatia;
              const [x2, y2] = [200 + 130 * Math.cos(angulo), 170 + 130 * Math.sin(angulo)];
              return (
                <g key={i}>
                  <path d={`M200,170 L${x1},${y1} A130,130 0 ${fatia > Math.PI ? 1 : 0} 1 ${x2},${y2} Z`} fill={pizzaCores[i % pizzaCores.length]} stroke="var(--parchment)" strokeWidth={2} />
                  <rect x={380} y={40 + i * 24} width={14} height={14} fill={pizzaCores[i % pizzaCores.length]} />
                  <text x={400} y={52 + i * 24} fontSize={13} fill="var(--ink)">{`${l.rotulo} (${formatar(lang, ((l.valores[0] ?? 0) / total) * 100, 1)}%)`}</text>
                </g>
              );
            });
          })()
        ) : (
          <>
            <line x1={40} x2={W - 10} y1={H} y2={H} stroke="var(--ink)" />
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={40} x2={W - 10} y1={H - f * (H - 20)} y2={H - f * (H - 20)} stroke="var(--rule)" strokeWidth={0.6} />
                <text x={2} y={H - f * (H - 20) + 4} fontSize={10} fill="var(--ink-soft)">{formatar(lang, max * f, 1)}</text>
              </g>
            ))}
            {d.linhas.map((l, i) => {
              const largura = (W - 50) / d.linhas.length;
              const x0 = 45 + i * largura;
              return (
                <g key={i}>
                  {d.tipo === "barras" &&
                    l.valores.slice(0, series).map((v, s) => (
                      <rect key={s} x={x0 + (s * largura * 0.8) / series} y={H - (v / max) * (H - 20)} width={(largura * 0.8) / series - 2} height={(v / max) * (H - 20)} fill={cores[s % 3]} />
                    ))}
                  <text x={x0 + largura * 0.4} y={H + 16} fontSize={11} textAnchor="middle" fill="var(--ink)">{l.rotulo}</text>
                </g>
              );
            })}
            {d.tipo === "linhas" &&
              Array.from({ length: series }, (_, s) => {
                const largura = (W - 50) / d.linhas.length;
                const pts = d.linhas.map((l, i) => `${45 + i * largura + largura * 0.4},${H - ((l.valores[s] ?? 0) / max) * (H - 20)}`).join(" ");
                return <polyline key={s} points={pts} fill="none" stroke={cores[s % 3]} strokeWidth={2.5} />;
              })}
          </>
        )}
      </svg>
      {series > 1 && d.tipo !== "pizza" && (
        <figcaption className="mt-2 flex gap-4 text-xs">
          {d.cabecalho.slice(1).map((h, s) => <span key={s} style={{ color: cores[s % 3] }}>■ {h}</span>)}
        </figcaption>
      )}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer">{t.blocks.tableEquivalent}</summary>
        <table className="mt-1">
          <thead><tr>{d.cabecalho.map((h, i) => <th key={i} className="pr-3 text-left">{h}</th>)}</tr></thead>
          <tbody>{d.linhas.map((l, i) => <tr key={i}><td className="pr-3">{l.rotulo}</td>{l.valores.map((v, k) => <td key={k} className="pr-3 font-mono">{formatar(lang, v)}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
