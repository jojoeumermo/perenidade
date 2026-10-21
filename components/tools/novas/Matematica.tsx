// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { medidasDoSolido, prestacao, regraDeTres, type Solido, variacoes } from "@/lib/ferramentas/rodada";
import { Bancada, BotaoClaro, Deslizante, Escolha, Leitura } from "../../labs/kit";
import { ComoUsar } from "./comum";

const num = (x: number, c = 2) => (Number.isFinite(x) ? x.toLocaleString("pt-BR", { maximumFractionDigits: c }) : "—");
const real = (x: number) => (Number.isFinite(x) ? x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");

type P3 = [number, number, number];
/** Os vértices e arestas de cada sólido (as superfícies curvas viram polígonos de 24 lados). */
function malha(s: Solido, a: number, b: number, c: number): { v: P3[]; e: [number, number][] } {
  const n = 24;
  const v: P3[] = [];
  const e: [number, number][] = [];
  const caixa = (x: number, y: number, z: number) => {
    for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) v.push([(i * x) / 2, (j * y) / 2, (k * z) / 2]);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const d = [0, 1, 2].filter((t) => v[i][t] !== v[j][t]).length; if (d === 1) e.push([i, j]); }
  };
  if (s === "cubo") caixa(a, a, a);
  else if (s === "paralelepipedo") caixa(a, c, b);
  else if (s === "cilindro" || s === "cone") {
    for (let i = 0; i < n; i++) { const t = (i / n) * 2 * Math.PI; v.push([a * Math.cos(t), -b / 2, a * Math.sin(t)]); }
    for (let i = 0; i < n; i++) e.push([i, (i + 1) % n]);
    if (s === "cilindro") {
      for (let i = 0; i < n; i++) { const t = (i / n) * 2 * Math.PI; v.push([a * Math.cos(t), b / 2, a * Math.sin(t)]); }
      for (let i = 0; i < n; i++) { e.push([n + i, n + ((i + 1) % n)]); if (i % 3 === 0) e.push([i, n + i]); }
    } else {
      v.push([0, b / 2, 0]);
      for (let i = 0; i < n; i += 3) e.push([i, n]);
    }
  } else if (s === "esfera") {
    const m = 12;
    for (let la = 1; la < m; la++) for (let lo = 0; lo < n; lo++) { const f = (la / m) * Math.PI, t = (lo / n) * 2 * Math.PI; v.push([a * Math.sin(f) * Math.cos(t), a * Math.cos(f), a * Math.sin(f) * Math.sin(t)]); }
    for (let la = 0; la < m - 1; la++) for (let lo = 0; lo < n; lo++) { const i = la * n + lo; e.push([i, la * n + ((lo + 1) % n)]); if (la < m - 2 && lo % 2 === 0) e.push([i, i + n]); }
  } else {
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) v.push([(x * a) / 2, -b / 2, (z * a) / 2]);
    v.push([0, b / 2, 0]);
    for (let i = 0; i < 4; i++) { e.push([i, (i + 1) % 4]); e.push([i, 4]); }
  }
  return { v, e };
}

/** A planificação: o sólido "aberto" no plano (a esfera não tem). */
function Planificacao({ s, a, b, c }: { s: Solido; a: number; b: number; c: number }) {
  const cor = { fill: "#ffd27a55", stroke: "#8a5a00", strokeWidth: 0.04 };
  let conteudo: React.ReactNode = null;
  let caixa = [0, 0, 1, 1];
  if (s === "cubo" || s === "paralelepipedo") {
    const [x, y, z] = s === "cubo" ? [a, a, a] : [a, c, b];
    // Cruz: a tampa, as quatro laterais em fila e o fundo.
    const rects = [[z, 0, x, z], [0, z, z, y], [z, z, x, y], [z + x, z, z, y], [2 * z + x, z, x, y], [z, z + y, x, z]];
    conteudo = rects.map(([rx, ry, w, h], i) => <rect key={i} x={rx} y={ry} width={w} height={h} {...cor} />);
    caixa = [0, 0, 2 * z + 2 * x, 2 * z + y];
  } else if (s === "cilindro") {
    const w = 2 * Math.PI * a;
    conteudo = <><rect x={0} y={2 * a} width={w} height={b} {...cor} /><circle cx={w / 2} cy={a} r={a} {...cor} /><circle cx={w / 2} cy={3 * a + b} r={a} {...cor} /></>;
    caixa = [0, 0, w, 4 * a + b];
  } else if (s === "cone") {
    const g = Math.hypot(a, b);
    const ang = (2 * Math.PI * a) / g;
    const x2 = g * Math.sin(ang), y2 = g - g * Math.cos(ang);
    conteudo = <><path d={`M ${g} 0 L ${g} ${g} L ${g + x2} ${g - (g - y2)} A ${g} ${g} 0 ${ang > Math.PI ? 1 : 0} 0 ${g} 0 Z`} {...cor} /><circle cx={g} cy={g + a + 0.05} r={a} {...cor} /></>;
    caixa = [0, -0.1, 2 * g, 2 * g + 2 * a];
  } else if (s === "piramide") {
    const ap = Math.hypot(a / 2, b);
    const o = ap;
    conteudo = <><rect x={o} y={o} width={a} height={a} {...cor} /><path d={`M ${o} ${o} L ${o + a} ${o} L ${o + a / 2} ${o - ap} Z M ${o + a} ${o} L ${o + a} ${o + a} L ${o + a + ap} ${o + a / 2} Z M ${o} ${o + a} L ${o + a} ${o + a} L ${o + a / 2} ${o + a + ap} Z M ${o} ${o} L ${o} ${o + a} L ${o - ap} ${o + a / 2} Z`} {...cor} /></>;
    caixa = [0, 0, a + 2 * ap, a + 2 * ap];
  }
  if (!conteudo) return <p className="text-sm text-ink-soft">A esfera não pode ser aberta no plano sem esticar ou rasgar: é por isso que todo mapa-múndi deforma alguma coisa.</p>;
  const m = Math.max(caixa[2], caixa[3]) * 0.05;
  return <svg viewBox={`${caixa[0] - m} ${caixa[1] - m} ${caixa[2] + 2 * m} ${caixa[3] + 2 * m}`} className="h-56 w-full rounded bg-white" role="img" aria-label="Planificação do sólido">{conteudo}</svg>;
}

/** Sólidos geométricos: girar, ver a planificação e as fórmulas de área e volume. */
export function Solidos() {
  const [s, setS] = useState<Solido>("cilindro");
  const [a, setA] = useState(2);
  const [b, setB] = useState(4);
  const [c, setC] = useState(3);
  const [ang, setAng] = useState({ y: 0.6, x: 0.45 });
  const [girar, setGirar] = useState(true);
  const arrasto = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!girar) return;
    const id = window.setInterval(() => setAng((p) => ({ ...p, y: p.y + 0.03 })), 40);
    return () => window.clearInterval(id);
  }, [girar]);
  const { v, e } = malha(s, a, b, c);
  const proj = v.map(([x, y, z]) => {
    const x1 = x * Math.cos(ang.y) - z * Math.sin(ang.y);
    const z1 = x * Math.sin(ang.y) + z * Math.cos(ang.y);
    const y1 = y * Math.cos(ang.x) - z1 * Math.sin(ang.x);
    const z2 = y * Math.sin(ang.x) + z1 * Math.cos(ang.x);
    const k = 6 / (12 + z2);
    return [x1 * k * 22, -y1 * k * 22];
  });
  const m = medidasDoSolido(s, a, b, c);
  const rotulos: Record<Solido, [string, string?, string?]> = { cubo: ["aresta a"], paralelepipedo: ["comprimento a", "altura b", "largura c"], cilindro: ["raio r", "altura h"], cone: ["raio r", "altura h"], esfera: ["raio r"], piramide: ["lado da base a", "altura h"] };
  const [ra, rb, rc] = rotulos[s];
  return (
    <div>
      <Bancada titulo="Sólidos geométricos" subtitulo="Gire, abra no plano e calcule">
        <Escolha rotulo="Sólido" valor={s} opcoes={[["cubo", "Cubo"], ["paralelepipedo", "Paralelepípedo"], ["cilindro", "Cilindro"], ["cone", "Cone"], ["piramide", "Pirâmide quadrada"], ["esfera", "Esfera"]]} mudar={setS} />
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <svg viewBox="-120 -110 240 220" className="w-full touch-none rounded bg-[#17130e]" role="img" aria-label={`${s} girando; arraste para girar`}
              onPointerDown={(ev) => { (ev.currentTarget as SVGSVGElement).setPointerCapture(ev.pointerId); arrasto.current = { x: ev.clientX, y: ev.clientY }; setGirar(false); }}
              onPointerMove={(ev) => { const d = arrasto.current; if (!d) return; setAng((p) => ({ y: p.y + (ev.clientX - d.x) * 0.01, x: Math.max(-1.4, Math.min(1.4, p.x + (ev.clientY - d.y) * 0.01)) })); arrasto.current = { x: ev.clientX, y: ev.clientY }; }}
              onPointerUp={() => { arrasto.current = null; }}>
              {e.map(([i, j], k) => <line key={k} x1={proj[i][0]} y1={proj[i][1]} x2={proj[j][0]} y2={proj[j][1]} stroke="#ffd27a" strokeWidth="1.4" strokeLinecap="round" />)}
            </svg>
            <p className="mt-1 flex items-center gap-2 text-xs text-ink-soft">Arraste para girar. <button type="button" className="cursor-pointer underline" onClick={() => setGirar(!girar)}>{girar ? "parar" : "girar sozinho"}</button></p>
          </div>
          <div>
            <Planificacao s={s} a={a} b={b} c={c} />
            <p className="mt-1 text-xs text-ink-soft">Planificação: as faces abertas no plano (a área total é a soma delas).</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Deslizante rotulo={ra} valor={a} min={1} max={6} passo={0.5} mudar={setA} formato={(x) => `${num(x)} cm`} />
          {rb && <Deslizante rotulo={rb} valor={b} min={1} max={8} passo={0.5} mudar={setB} formato={(x) => `${num(x)} cm`} />}
          {rc && <Deslizante rotulo={rc} valor={c} min={1} max={6} passo={0.5} mudar={setC} formato={(x) => `${num(x)} cm`} />}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Leitura rotulo={`Área total = ${m.formulaArea}`} valor={`${num(m.area)} cm²`} />
          <Leitura rotulo={`Volume = ${m.formulaVolume}`} valor={`${num(m.volume)} cm³`} />
        </div>
        <p className="mt-2 text-xs text-ink-soft">1 cm³ é o volume de um dado pequeno; 1.000 cm³ é um litro.</p>
      </Bancada>
      <ComoUsar
        passos={["Escolha o sólido e mude as medidas nos controles.", "Gire o desenho com o dedo ou o mouse e compare com a planificação.", "Leia a área e o volume e veja a fórmula de cada um."]}
        atividades={["Um cilindro de raio 2 cm e altura 4 cm e um cone com as mesmas medidas: quantos cones cabem no cilindro? Confira no volume.", "Dobre a aresta do cubo: a área fica 2, 4 ou 8 vezes maior? E o volume?", "Meça uma lata de leite ou de óleo em casa e calcule quantos cm³ (mL) ela comporta. Bate com o rótulo?"]}
      />
    </div>
  );
}

/** Contas do dia a dia: porcentagem, regra de três, parcelamento e orçamento da casa. */
export function ContasDoDia() {
  const [aba, setAba] = useState<"porcentagem" | "regra" | "parcela" | "orcamento">("porcentagem");
  const [p, setP] = useState({ x: "15", de: "80", a: "30", b: "120", valor: "100", seq: "10, -10" });
  const [r3, setR3] = useState({ a: "2", b: "10", c: "5", inversa: false });
  const [pc, setPc] = useState({ valor: "1200", juros: "3", n: "10", desconto: "5" });
  const [linhas, setLinhas] = useState<{ nome: string; valor: string; tipo: "entra" | "sai" }[]>([
    { nome: "Salário", valor: "1800", tipo: "entra" }, { nome: "Aluguel", valor: "700", tipo: "sai" }, { nome: "Mercado", valor: "600", tipo: "sai" }, { nome: "Luz e água", valor: "180", tipo: "sai" }, { nome: "Transporte", valor: "220", tipo: "sai" },
  ]);
  const n = (x: string) => Number(String(x).replace(/\./g, "").replace(",", "."));
  const campo = "mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5";
  const seq = p.seq.split(/[;,]\s*(?=-?\d)/).map((x) => n(x)).filter((x) => Number.isFinite(x));
  const vs = variacoes(n(p.valor), seq);
  const pr = prestacao(n(pc.valor), n(pc.juros), Math.max(1, Math.round(n(pc.n))));
  const aVista = n(pc.valor) * (1 - n(pc.desconto) / 100);
  const entra = linhas.filter((l) => l.tipo === "entra").reduce((s, l) => s + n(l.valor || "0"), 0);
  const sai = linhas.filter((l) => l.tipo === "sai").reduce((s, l) => s + n(l.valor || "0"), 0);
  return (
    <div>
      <Bancada titulo="Contas do dia a dia" subtitulo="Porcentagem, regra de três, parcelas e orçamento">
        <Escolha rotulo="Conta" valor={aba} opcoes={[["porcentagem", "Porcentagem"], ["regra", "Regra de três"], ["parcela", "À vista ou parcelado?"], ["orcamento", "Orçamento da casa"]]} mudar={setAba} />
        {aba === "porcentagem" && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded border border-rule p-3 text-sm"><p className="font-semibold">Quanto é x% de um valor?</p><div className="mt-1 grid grid-cols-2 gap-2"><label>%<input value={p.x} onChange={(e) => setP({ ...p, x: e.target.value })} className={campo} inputMode="decimal" /></label><label>de<input value={p.de} onChange={(e) => setP({ ...p, de: e.target.value })} className={campo} inputMode="decimal" /></label></div><p className="mt-2 font-mono">{num(n(p.x))}% de {num(n(p.de))} = <strong>{num((n(p.x) / 100) * n(p.de))}</strong></p><p className="text-xs text-ink-soft">Divida por 100 e multiplique.</p></div>
            <div className="rounded border border-rule p-3 text-sm"><p className="font-semibold">Quanto por cento um valor é do outro?</p><div className="mt-1 grid grid-cols-2 gap-2"><label>parte<input value={p.a} onChange={(e) => setP({ ...p, a: e.target.value })} className={campo} inputMode="decimal" /></label><label>todo<input value={p.b} onChange={(e) => setP({ ...p, b: e.target.value })} className={campo} inputMode="decimal" /></label></div><p className="mt-2 font-mono">{num(n(p.a))} ÷ {num(n(p.b))} = <strong>{num((n(p.a) / n(p.b)) * 100)}%</strong></p></div>
            <div className="rounded border border-rule p-3 text-sm"><p className="font-semibold">Aumentos e descontos seguidos</p><div className="mt-1 grid grid-cols-2 gap-2"><label>valor<input value={p.valor} onChange={(e) => setP({ ...p, valor: e.target.value })} className={campo} inputMode="decimal" /></label><label>% (use - para desconto)<input value={p.seq} onChange={(e) => setP({ ...p, seq: e.target.value })} className={campo} /></label></div><p className="mt-2 font-mono">fica <strong>{num(vs.final)}</strong>: variação de <strong>{num(vs.total)}%</strong></p><p className="text-xs text-ink-soft">Subir 10% e depois descer 10% não volta ao preço de antes.</p></div>
          </div>
        )}
        {aba === "regra" && (
          <div className="mt-4 max-w-xl text-sm">
            <div className="grid grid-cols-3 items-end gap-2">
              <label>Se<input value={r3.a} onChange={(e) => setR3({ ...r3, a: e.target.value })} className={campo} inputMode="decimal" /></label>
              <span className="pb-2 text-center">está para</span>
              <label>então<input value={r3.b} onChange={(e) => setR3({ ...r3, b: e.target.value })} className={campo} inputMode="decimal" /></label>
              <label>e<input value={r3.c} onChange={(e) => setR3({ ...r3, c: e.target.value })} className={campo} inputMode="decimal" /></label>
              <span className="pb-2 text-center">está para</span>
              <p className="pb-2 font-mono text-xl font-bold">x = {num(regraDeTres(n(r3.a), n(r3.b), n(r3.c), r3.inversa))}</p>
            </div>
            <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={r3.inversa} onChange={(e) => setR3({ ...r3, inversa: e.target.checked })} />Inversa (quando um aumenta, o outro diminui: mais pessoas, menos dias)</label>
            <p className="mt-2 font-mono text-xs">{r3.inversa ? `x = ${r3.a} × ${r3.b} ÷ ${r3.c}` : `x = ${r3.b} × ${r3.c} ÷ ${r3.a}`}</p>
          </div>
        )}
        {aba === "parcela" && (
          <div className="mt-4 grid gap-4 md:grid-cols-[18rem_1fr]">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="col-span-2">Preço<input value={pc.valor} onChange={(e) => setPc({ ...pc, valor: e.target.value })} className={campo} inputMode="decimal" /></label>
              <label>Parcelas<input value={pc.n} onChange={(e) => setPc({ ...pc, n: e.target.value })} className={campo} inputMode="numeric" /></label>
              <label>Juros ao mês (%)<input value={pc.juros} onChange={(e) => setPc({ ...pc, juros: e.target.value })} className={campo} inputMode="decimal" /></label>
              <label className="col-span-2">Desconto à vista (%)<input value={pc.desconto} onChange={(e) => setPc({ ...pc, desconto: e.target.value })} className={campo} inputMode="decimal" /></label>
            </div>
            <div className="grid content-start gap-2 sm:grid-cols-2">
              <Leitura rotulo={`${Math.round(n(pc.n))} parcelas de`} valor={real(pr.parcela)} />
              <Leitura rotulo="Total parcelado" valor={real(pr.total)} />
              <Leitura rotulo="Só de juros" valor={real(pr.juros)} destaque />
              <Leitura rotulo="À vista com desconto" valor={real(aVista)} />
              <p className="text-sm sm:col-span-2">Parcelando, você paga <strong>{real(pr.total - aVista)}</strong> a mais do que à vista ({num(((pr.total - aVista) / aVista) * 100, 1)}%). Conta pela tabela Price, a mais usada no comércio e nos bancos.</p>
            </div>
          </div>
        )}
        {aba === "orcamento" && (
          <div className="mt-4 text-sm">
            <table className="w-full max-w-2xl">
              <thead><tr className="text-left text-xs uppercase text-ink-soft"><th className="py-1">O quê</th><th>Valor (R$)</th><th>Tipo</th><th>Parte do que entra</th><th /></tr></thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="border-t border-rule">
                    <td className="py-1 pr-2"><input value={l.nome} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, nome: e.target.value.slice(0, 40) } : x)))} className="w-full border border-ink/20 bg-parchment px-1" aria-label="Nome" /></td>
                    <td className="pr-2"><input value={l.valor} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} inputMode="decimal" className="w-24 border border-ink/20 bg-parchment px-1" aria-label="Valor" /></td>
                    <td className="pr-2"><select value={l.tipo} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, tipo: e.target.value as "entra" | "sai" } : x)))} className="border border-ink/20 bg-parchment"><option value="entra">entra</option><option value="sai">sai</option></select></td>
                    <td className="font-mono">{l.tipo === "sai" && entra ? `${num((n(l.valor || "0") / entra) * 100, 0)}%` : ""}</td>
                    <td><button type="button" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))} aria-label={`Tirar ${l.nome}`} className="cursor-pointer px-2">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2"><BotaoClaro onClick={() => setLinhas((ls) => [...ls, { nome: "", valor: "", tipo: "sai" as const }].slice(0, 30))}>＋ Linha</BotaoClaro></div>
            <div className="mt-3 grid max-w-2xl grid-cols-3 gap-2">
              <Leitura rotulo="Entra" valor={real(entra)} />
              <Leitura rotulo="Sai" valor={real(sai)} />
              <Leitura rotulo="Sobra" valor={real(entra - sai)} destaque={entra - sai < 0} />
            </div>
            <p className="mt-2 text-xs text-ink-soft">Nada disto é guardado nem enviado: some ao fechar a página.</p>
          </div>
        )}
      </Bancada>
      <ComoUsar
        passos={["Escolha a conta: porcentagem, regra de três, parcelas ou orçamento.", "Troque os números de exemplo pelos da sua vida.", "Leia a explicação ao lado de cada resultado."]}
        atividades={["Uma loja aumentou o preço em 20% e depois deu 20% de desconto. O preço voltou ao de antes? Calcule com R$ 100.", "Se 3 kg de feijão custam R$ 24, quanto custam 5 kg? E se 4 pedreiros levam 6 dias numa obra, quantos dias levariam 8?", "Pegue uma propaganda de parcelamento e compare o total com o preço à vista: quanto você pagaria de juros?"]}
      />
    </div>
  );
}
