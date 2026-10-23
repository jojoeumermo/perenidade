// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { lerCalculadora, lerDados, lerGrafico } from "@/lib/interativos";
import { lerMapa, lerMusica, lerSimulacao } from "@/lib/interativos-mais";
import { tools } from "@/lib/areas";
import { lerRecurso, RECURSOS_DISPONIVEIS, type TipoDeRecurso } from "./Recurso";

// Os formulários dos blocos de ciência e dos outros que eram só texto: gráfico de função, calculadora de variáveis,
// gráfico de dados, simulação física, mapa, música com letra e ferramenta do site. Quem escreve preenche campos; o
// editor escreve o bloco. Se o bloco tiver algo que o formulário não conhece, ele avisa e manda para o modo avançado,
// para nada se perder.

const campo = "w-full border-2 border-ink/30 bg-parchment px-2 py-1.5 text-sm focus:border-ink focus:outline-none";
const mais = "cursor-pointer border-2 border-dashed border-ink px-3 py-1.5 text-sm font-bold hover:border-oxblood hover:text-oxblood";
const tirar = "cursor-pointer px-2 text-lg leading-none text-ink-soft hover:text-oxblood";
const rotulo = "block text-xs font-semibold";
const cartao = "border-2 border-ink/20 bg-parchment-deep p-3";
const num = (n: number | string) => String(n).replace(".", ",");
const linhasDe = (spec: string) => spec.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

function Linhas<T>({ itens, mudar, novo, rotuloNovo, linha }: { itens: T[]; mudar: (l: T[]) => void; novo: () => T; rotuloNovo: string; linha: (item: T, trocar: (t: T) => void) => React.ReactNode }) {
  return (
    <div className="space-y-2">
      {itens.map((item, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="min-w-0 flex-1">{linha(item, (t) => mudar(itens.map((x, j) => (j === i ? t : x))))}</div>
          <button type="button" aria-label="Tirar" title="Tirar" onClick={() => mudar(itens.filter((_, j) => j !== i))} className={tirar}>✕</button>
        </div>
      ))}
      <button type="button" className={mais} onClick={() => mudar([...itens, novo()])}>+ {rotuloNovo}</button>
    </div>
  );
}

/** O bloco tem algo que o formulário não sabe mostrar: melhor editar como texto do que perder. */
export function SoNoAvancado() {
  return <p className="border-l-4 border-gold bg-parchment-deep px-3 py-2 text-sm">Este bloco usa recursos que o formulário ainda não mostra. Edite pelo <strong>modo avançado</strong> (logo abaixo) para não perder nada.</p>;
}

// ───────────── Gráfico de função ─────────────

export function FormGrafico({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const conhecidas = linhasDe(spec).every((l) => /^(y|[fgh]\s*\(\s*x\s*\))\s*=|^[a-z]{1,8}\s*=\s*-?[\d.,]+|^[xy]\s+de\s|^ponto\s*\(/i.test(l));
  const g = lerGrafico(spec);
  const [v, setV] = useState(() => ({
    funcoes: g.funcoes.length ? g.funcoes.map((f) => f.expr) : [""],
    controles: g.parametros.map((p) => ({ nome: p.nome, valor: num(p.valor), min: num(p.min), max: num(p.max) })),
    xmin: num(g.x[0]),
    xmax: num(g.x[1]),
    pontos: g.pontos.map((p) => ({ x: num(p.x), y: num(p.y), nome: p.rotulo })),
  }));
  if (!conhecidas && spec.trim()) return <SoNoAvancado />;
  const salvar = (n: typeof v) => {
    setV(n);
    mudar([
      ...n.funcoes.filter((f) => f.trim()).map((f) => `y = ${f.trim()}`),
      ...n.controles.filter((c) => c.nome.trim()).map((c) => `${c.nome.trim()} = ${c.valor || "1"} [${c.min || "-5"}; ${c.max || "5"}]`),
      `x de ${n.xmin || "-10"} a ${n.xmax || "10"}`,
      ...n.pontos.filter((p) => p.x.trim() && p.y.trim()).map((p) => `ponto (${p.x.trim()}; ${p.y.trim()}) ${p.nome.trim()}`.trim()),
    ].join("\n"));
  };
  return (
    <div className="space-y-4">
      <div>
        <p className={rotulo}>Funções (até quatro): escreva depois do “y =”, como 2*x + 1 ou a*x^2</p>
        <Linhas itens={v.funcoes} mudar={(f) => salvar({ ...v, funcoes: f.slice(0, 4) })} novo={() => ""} rotuloNovo="outra função" linha={(f, t) => (
          <span className="flex items-center gap-2"><span className="font-mono text-sm">y =</span><input value={f} onChange={(e) => t(e.target.value)} placeholder="a*x^2 + b*x + c" aria-label="Função" className={`${campo} font-mono`} /></span>
        )} />
      </div>
      <div>
        <p className={rotulo}>Controles deslizantes: cada letra da função que a pessoa pode mexer</p>
        <Linhas itens={v.controles} mudar={(c) => salvar({ ...v, controles: c.slice(0, 6) })} novo={() => ({ nome: "", valor: "1", min: "-5", max: "5" })} rotuloNovo="controle" linha={(c, t) => (
          <div className="grid grid-cols-4 gap-1">
            <input value={c.nome} onChange={(e) => t({ ...c, nome: e.target.value.replace(/[^a-z]/gi, "").slice(0, 8) })} placeholder="letra" aria-label="Letra" className={`${campo} font-mono`} />
            <input value={c.valor} onChange={(e) => t({ ...c, valor: e.target.value })} placeholder="começa em" aria-label="Valor inicial" className={campo} />
            <input value={c.min} onChange={(e) => t({ ...c, min: e.target.value })} placeholder="mínimo" aria-label="Mínimo" className={campo} />
            <input value={c.max} onChange={(e) => t({ ...c, max: e.target.value })} placeholder="máximo" aria-label="Máximo" className={campo} />
          </div>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={rotulo}>Eixo x começa em<input value={v.xmin} onChange={(e) => salvar({ ...v, xmin: e.target.value })} className={`${campo} mt-1`} /></label>
        <label className={rotulo}>e vai até<input value={v.xmax} onChange={(e) => salvar({ ...v, xmax: e.target.value })} className={`${campo} mt-1`} /></label>
      </div>
      <div>
        <p className={rotulo}>Pontos marcados (opcional)</p>
        <Linhas itens={v.pontos} mudar={(p) => salvar({ ...v, pontos: p })} novo={() => ({ x: "", y: "", nome: "" })} rotuloNovo="ponto" linha={(p, t) => (
          <div className="grid grid-cols-3 gap-1">
            <input value={p.x} onChange={(e) => t({ ...p, x: e.target.value })} placeholder="x" aria-label="x" className={campo} />
            <input value={p.y} onChange={(e) => t({ ...p, y: e.target.value })} placeholder="y" aria-label="y" className={campo} />
            <input value={p.nome} onChange={(e) => t({ ...p, nome: e.target.value })} placeholder="nome" aria-label="Nome do ponto" className={campo} />
          </div>
        )} />
      </div>
    </div>
  );
}

// ───────────── Calculadora de variáveis ─────────────

export function FormCalculadora({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const c = lerCalculadora(spec);
  const [v, setV] = useState(() => ({
    nome: c?.resultado.nome ?? "", formula: c?.resultado.expr ?? "", rotulo: c?.resultado.rotulo ?? "",
    campos: c?.campos.map((x) => ({ nome: x.nome, valor: num(x.valor), rotulo: x.rotulo })) ?? [{ nome: "", valor: "", rotulo: "" }],
  }));
  if (!c && spec.trim()) return <SoNoAvancado />;
  const salvar = (n: typeof v) => {
    setV(n);
    mudar([`${n.nome || "r"} = ${n.formula} | ${n.rotulo || n.nome || "resultado"}`, ...n.campos.filter((x) => x.nome.trim()).map((x) => `${x.nome.trim()} = ${x.valor || "0"} | ${x.rotulo || x.nome}`)].join("\n"));
  };
  return (
    <div className="space-y-4">
      <div className={cartao}>
        <p className={rotulo}>O que a calculadora calcula</p>
        <div className="mt-1 grid gap-1 sm:grid-cols-[6rem_1fr]">
          <input value={v.nome} onChange={(e) => salvar({ ...v, nome: e.target.value.replace(/[^\w]/g, "").slice(0, 16) })} placeholder="v" aria-label="Nome do resultado" className={`${campo} font-mono`} />
          <input value={v.formula} onChange={(e) => salvar({ ...v, formula: e.target.value })} placeholder="Fórmula, como d / t" aria-label="Fórmula" className={`${campo} font-mono`} />
        </div>
        <input value={v.rotulo} onChange={(e) => salvar({ ...v, rotulo: e.target.value })} placeholder="Como aparece: velocidade (m/s)" aria-label="Nome do resultado na tela" className={`${campo} mt-1`} />
      </div>
      <div>
        <p className={rotulo}>Os campos que a pessoa preenche (uma letra da fórmula em cada)</p>
        <Linhas itens={v.campos} mudar={(x) => salvar({ ...v, campos: x.slice(0, 8) })} novo={() => ({ nome: "", valor: "", rotulo: "" })} rotuloNovo="campo" linha={(x, t) => (
          <div className="grid grid-cols-[5rem_6rem_1fr] gap-1">
            <input value={x.nome} onChange={(e) => t({ ...x, nome: e.target.value.replace(/[^\w]/g, "").slice(0, 16) })} placeholder="d" aria-label="Letra" className={`${campo} font-mono`} />
            <input value={x.valor} onChange={(e) => t({ ...x, valor: e.target.value })} placeholder="100" aria-label="Valor de exemplo" className={campo} />
            <input value={x.rotulo} onChange={(e) => t({ ...x, rotulo: e.target.value })} placeholder="distância (m)" aria-label="Nome na tela" className={campo} />
          </div>
        )} />
      </div>
    </div>
  );
}

// ───────────── Gráfico de dados ─────────────

export function FormDados({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const d = lerDados(spec);
  const [v, setV] = useState(() => ({
    tipo: d.tipo, titulo: d.titulo,
    colunas: d.cabecalho.length ? d.cabecalho : ["", "Valor"],
    linhas: d.linhas.length ? d.linhas.map((l) => [l.rotulo, ...l.valores.map(num)]) : [["", ""], ["", ""]],
  }));
  const salvar = (n: typeof v) => {
    setV(n);
    mudar([`tipo: ${n.tipo}`, n.titulo ? `titulo: ${n.titulo}` : "", n.colunas.map((c, i) => c || (i === 0 ? "Item" : `Série ${i}`)).join(" | "), ...n.linhas.filter((l) => l[0]?.trim()).map((l) => l.map((x) => x.trim() || "0").join(" | "))].filter(Boolean).join("\n"));
  };
  const largura = v.colunas.length;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={rotulo}>Tipo de gráfico
          <select value={v.tipo} onChange={(e) => salvar({ ...v, tipo: e.target.value as typeof v.tipo })} className={`${campo} mt-1`}>
            <option value="barras">Barras</option><option value="linhas">Linhas</option><option value="pizza">Pizza</option>
          </select>
        </label>
        <label className={rotulo}>Título<input value={v.titulo} onChange={(e) => salvar({ ...v, titulo: e.target.value })} placeholder="Chuva em 2024" className={`${campo} mt-1`} /></label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {v.colunas.map((c, i) => (
                <th key={i} className="p-0.5"><input value={c} onChange={(e) => salvar({ ...v, colunas: v.colunas.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={i === 0 ? "Coluna dos nomes (Mês)" : "Nome da série"} aria-label={`Cabeçalho ${i + 1}`} className={`${campo} font-semibold`} /></th>
              ))}
              <th className="w-20 text-left">{largura < 4 && <button type="button" className={tirar} title="Mais uma série" onClick={() => salvar({ ...v, colunas: [...v.colunas, ""], linhas: v.linhas.map((l) => [...l, ""]) })}>＋</button>}</th>
            </tr>
          </thead>
          <tbody>
            {v.linhas.map((l, i) => (
              <tr key={i}>
                {Array.from({ length: largura }, (_, j) => (
                  <td key={j} className="p-0.5"><input value={l[j] ?? ""} onChange={(e) => salvar({ ...v, linhas: v.linhas.map((x, k) => (k === i ? x.map((y, m) => (m === j ? e.target.value : y)) : x)) })} placeholder={j === 0 ? "Jan" : "0"} aria-label={`Linha ${i + 1}, coluna ${j + 1}`} className={campo} /></td>
                ))}
                <td><button type="button" aria-label="Tirar a linha" className={tirar} onClick={() => salvar({ ...v, linhas: v.linhas.filter((_, k) => k !== i) })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className={mais} onClick={() => salvar({ ...v, linhas: [...v.linhas, Array.from({ length: largura }, () => "")] })}>+ outra linha</button>
    </div>
  );
}

// ───────────── Simulação física ─────────────

type ObjetoSim = { tipo: "bola" | "caixa" | "rampa" | "pendulo"; nome: string; x: string; y: string; x2: string; y2: string; tamanho: string; altura: string; angulo: string; cor: string; fixo: boolean; vx: string; vy: string };
const NOMES_SIM = { bola: "Bola", caixa: "Caixa", rampa: "Rampa", pendulo: "Pêndulo" } as const;
const CORES_SIM = ["", "azul", "vermelho", "verde", "amarelo", "laranja", "roxo", "preto", "cinza"];

export function FormSimulacao({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const conhecidas = linhasDe(spec).every((l) => /^(gravidade|chao|chão|paredes)\s*:|^mostrar\s|^(bola|caixa|rampa|pendulo|pêndulo)\b/i.test(l) && !/\b(quique|atrito|massa)\b/i.test(l));
  const s = lerSimulacao(spec);
  const [v, setV] = useState(() => ({
    gravidade: num(s.gravidade),
    objetos: s.corpos.map<ObjetoSim>((c) => ({ tipo: c.tipo, nome: c.nome, x: num(c.x), y: num(c.y), x2: num(c.x2), y2: num(c.y2), tamanho: num(c.tipo === "bola" ? c.raio : c.tipo === "pendulo" ? c.comprimento : c.largura), altura: num(c.altura), angulo: num(c.angulo), cor: c.cor, fixo: c.fixo && c.tipo !== "rampa", vx: num(c.vx), vy: num(c.vy) })),
    mostrar: s.mostrar.join(" "),
  }));
  if (!conhecidas && spec.trim()) return <SoNoAvancado />;
  const linhaDe = (o: ObjetoSim) => {
    const nome = o.nome.trim() ? ` ${o.nome.trim().replace(/\s+/g, "")}` : "";
    const cor = o.cor ? ` cor ${o.cor}` : "";
    const vel = (o.vx && o.vx !== "0") || (o.vy && o.vy !== "0") ? ` velocidade (${o.vx || "0"}; ${o.vy || "0"})` : "";
    if (o.tipo === "rampa") return `rampa${nome} de (${o.x}; ${o.y}) a (${o.x2}; ${o.y2})${cor}`;
    if (o.tipo === "bola") return `bola${nome} em (${o.x}; ${o.y}) raio ${o.tamanho || "0,4"}${o.fixo ? " fixa" : ""}${vel}${cor}`;
    if (o.tipo === "pendulo") return `pendulo${nome} em (${o.x}; ${o.y}) comprimento ${o.tamanho || "3"} angulo ${o.angulo || "30"}${cor}`;
    return `caixa${nome} em (${o.x}; ${o.y}) tamanho ${o.tamanho || "1"}x${o.altura || "1"}${o.angulo && o.angulo !== "0" ? ` angulo ${o.angulo}` : ""}${o.fixo ? " fixa" : ""}${vel}${cor}`;
  };
  const salvar = (n: typeof v) => {
    setV(n);
    mudar([`gravidade: ${n.gravidade || "9,8"}`, ...n.objetos.map(linhaDe), n.mostrar.trim() ? `mostrar ${n.mostrar.trim()}` : ""].filter(Boolean).join("\n"));
  };
  const novo = (tipo: ObjetoSim["tipo"]): ObjetoSim => ({ tipo, nome: "", x: "4", y: "6", x2: "10", y2: "2", tamanho: tipo === "bola" ? "0,4" : tipo === "pendulo" ? "3" : "1", altura: "1", angulo: tipo === "pendulo" ? "40" : "0", cor: "", fixo: false, vx: "0", vy: "0" });
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">O quadro tem 16 m de largura e 9 m de altura; o chão fica em y = 0. Medidas em metros.</p>
      <label className={rotulo}>Gravidade (m/s²: 9,8 na Terra, 1,6 na Lua, 0 no espaço)<input value={v.gravidade} onChange={(e) => salvar({ ...v, gravidade: e.target.value })} className={`${campo} mt-1 max-w-32`} /></label>
      <div className="space-y-2">
        {v.objetos.map((o, i) => {
          const t = (n: ObjetoSim) => salvar({ ...v, objetos: v.objetos.map((x, j) => (j === i ? n : x)) });
          return (
            <div key={i} className={`${cartao} space-y-1`}>
              <p className="flex items-center justify-between text-sm font-bold">{NOMES_SIM[o.tipo]}<button type="button" aria-label="Tirar" className={tirar} onClick={() => salvar({ ...v, objetos: v.objetos.filter((_, j) => j !== i) })}>✕</button></p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                <input value={o.nome} onChange={(e) => t({ ...o, nome: e.target.value.slice(0, 12) })} placeholder="nome (A)" aria-label="Nome" className={campo} />
                <input value={o.x} onChange={(e) => t({ ...o, x: e.target.value })} placeholder="x" aria-label={o.tipo === "rampa" ? "x do começo" : "x"} className={campo} />
                <input value={o.y} onChange={(e) => t({ ...o, y: e.target.value })} placeholder="y" aria-label={o.tipo === "rampa" ? "y do começo" : "y"} className={campo} />
                <select value={o.cor} onChange={(e) => t({ ...o, cor: e.target.value })} aria-label="Cor" className={campo}>{CORES_SIM.map((c) => <option key={c} value={c}>{c || "cor padrão"}</option>)}</select>
                {o.tipo === "rampa" && <><input value={o.x2} onChange={(e) => t({ ...o, x2: e.target.value })} placeholder="x do fim" aria-label="x do fim" className={campo} /><input value={o.y2} onChange={(e) => t({ ...o, y2: e.target.value })} placeholder="y do fim" aria-label="y do fim" className={campo} /></>}
                {o.tipo === "bola" && <input value={o.tamanho} onChange={(e) => t({ ...o, tamanho: e.target.value })} placeholder="raio (m)" aria-label="Raio" className={campo} />}
                {o.tipo === "caixa" && <><input value={o.tamanho} onChange={(e) => t({ ...o, tamanho: e.target.value })} placeholder="largura (m)" aria-label="Largura" className={campo} /><input value={o.altura} onChange={(e) => t({ ...o, altura: e.target.value })} placeholder="altura (m)" aria-label="Altura" className={campo} /></>}
                {o.tipo === "pendulo" && <><input value={o.tamanho} onChange={(e) => t({ ...o, tamanho: e.target.value })} placeholder="comprimento (m)" aria-label="Comprimento" className={campo} /><input value={o.angulo} onChange={(e) => t({ ...o, angulo: e.target.value })} placeholder="ângulo (graus)" aria-label="Ângulo" className={campo} /></>}
                {(o.tipo === "bola" || o.tipo === "caixa") && <><input value={o.vx} onChange={(e) => t({ ...o, vx: e.target.value })} placeholder="velocidade →" aria-label="Velocidade horizontal" className={campo} /><input value={o.vy} onChange={(e) => t({ ...o, vy: e.target.value })} placeholder="velocidade ↑" aria-label="Velocidade vertical" className={campo} /></>}
              </div>
              {(o.tipo === "bola" || o.tipo === "caixa") && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={o.fixo} onChange={(e) => t({ ...o, fixo: e.target.checked })} />Fica parado no lugar (fixo)</label>}
            </div>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-2">{(Object.keys(NOMES_SIM) as ObjetoSim["tipo"][]).map((tipo) => <button key={tipo} type="button" className={mais} onClick={() => salvar({ ...v, objetos: [...v.objetos, novo(tipo)].slice(0, 30) })}>+ {NOMES_SIM[tipo]}</button>)}</p>
      <label className={rotulo}>Mostrar a velocidade e a altura de (nomes separados por espaço, opcional)<input value={v.mostrar} onChange={(e) => salvar({ ...v, mostrar: e.target.value })} placeholder="A" className={`${campo} mt-1`} /></label>
    </div>
  );
}

// ───────────── Mapa ─────────────

const FOCOS = ["mundo", "América do Sul", "América do Norte", "América Central", "Europa", "África", "Ásia", "Oceania", "Brasil"];

export function FormMapa({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const m = lerMapa(spec);
  const [v, setV] = useState(() => ({
    titulo: m.titulo, foco: m.foco || "mundo", destaques: m.destaques.join(", "),
    pontos: m.pontos.map((p) => ({ lat: num(p.lat), lon: num(p.lon), nome: p.rotulo })),
    rotas: m.rotas.map((r) => ({ trecho: r.trecho.map(([a, b]) => `${num(a)} ${num(b)}`).join(" > "), nome: r.rotulo })),
  }));
  const salvar = (n: typeof v) => {
    setV(n);
    mudar([
      n.titulo ? `titulo: ${n.titulo}` : "", `foco: ${n.foco || "mundo"}`, n.destaques.trim() ? `destacar: ${n.destaques}` : "",
      ...n.pontos.filter((p) => p.lat.trim() && p.lon.trim()).map((p) => `ponto ${p.lat.trim()} ${p.lon.trim()} | ${p.nome.trim()}`),
      ...n.rotas.filter((r) => r.trecho.includes(">")).map((r) => `rota ${r.trecho.trim()} | ${r.nome.trim()}`),
    ].filter(Boolean).join("\n"));
  };
  return (
    <div className="space-y-3">
      <label className={rotulo}>Título<input value={v.titulo} onChange={(e) => salvar({ ...v, titulo: e.target.value })} placeholder="A viagem de Vasco da Gama (1497–1498)" className={`${campo} mt-1`} /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={rotulo}>Onde o mapa abre (região ou país)<input list="focos-do-mapa" value={v.foco} onChange={(e) => salvar({ ...v, foco: e.target.value })} className={`${campo} mt-1`} /><datalist id="focos-do-mapa">{FOCOS.map((f) => <option key={f} value={f} />)}</datalist></label>
        <label className={rotulo}>Países pintados (separados por vírgula)<input value={v.destaques} onChange={(e) => salvar({ ...v, destaques: e.target.value })} placeholder="Portugal, Índia" className={`${campo} mt-1`} /></label>
      </div>
      <div>
        <p className={rotulo}>Lugares marcados: latitude e longitude (no Google Maps, clique com o botão direito no lugar e copie os números)</p>
        <Linhas itens={v.pontos} mudar={(p) => salvar({ ...v, pontos: p })} novo={() => ({ lat: "", lon: "", nome: "" })} rotuloNovo="lugar" linha={(p, t) => (
          <div className="grid grid-cols-3 gap-1">
            <input value={p.lat} onChange={(e) => t({ ...p, lat: e.target.value })} placeholder="latitude (-22,9)" aria-label="Latitude" className={campo} />
            <input value={p.lon} onChange={(e) => t({ ...p, lon: e.target.value })} placeholder="longitude (-43,2)" aria-label="Longitude" className={campo} />
            <input value={p.nome} onChange={(e) => t({ ...p, nome: e.target.value })} placeholder="nome (Rio de Janeiro)" aria-label="Nome do lugar" className={campo} />
          </div>
        )} />
      </div>
      <div>
        <p className={rotulo}>Rotas (opcional): pares “latitude longitude” separados por &gt;</p>
        <Linhas itens={v.rotas} mudar={(r) => salvar({ ...v, rotas: r })} novo={() => ({ trecho: "", nome: "" })} rotuloNovo="rota" linha={(r, t) => (
          <div className="grid gap-1 sm:grid-cols-[1fr_12rem]">
            <input value={r.trecho} onChange={(e) => t({ ...r, trecho: e.target.value })} placeholder="38,72 -9,14 > 14,9 -23,5 > 11,25 75,78" aria-label="Trecho da rota" className={`${campo} font-mono`} />
            <input value={r.nome} onChange={(e) => t({ ...r, nome: e.target.value })} placeholder="nome da rota" aria-label="Nome da rota" className={campo} />
          </div>
        )} />
      </div>
    </div>
  );
}

// ───────────── Música com letra ─────────────

const fmtTempo = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;

export function FormMusica({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const m = lerMusica(spec);
  const [v, setV] = useState(() => ({ audio: m.audio, credito: m.credito, lingua: m.lingua, versos: m.linhas.length ? m.linhas.map((l) => ({ t: fmtTempo(l.t), texto: l.texto, traducao: l.traducao })) : [{ t: "0:00", texto: "", traducao: "" }] }));
  const salvar = (n: typeof v) => {
    setV(n);
    mudar([`audio: ${n.audio}${n.credito ? ` | ${n.credito}` : ""}`, n.lingua ? `lingua: ${n.lingua}` : "", ...n.versos.filter((x) => x.texto.trim()).map((x) => `${x.t || "0:00"} | ${x.texto.trim()}${x.traducao.trim() ? ` | ${x.traducao.trim()}` : ""}`)].filter(Boolean).join("\n"));
  };
  return (
    <div className="space-y-3">
      <label className={rotulo}>Endereço do áudio no site (envie em Materiais e arquivos; só com licença livre ou em domínio público)<input value={v.audio} onChange={(e) => salvar({ ...v, audio: e.target.value })} placeholder="/arquivos/…mp3" className={`${campo} mt-1 font-mono`} /></label>
      <label className={rotulo}>Crédito: título, autoria e licença<input value={v.credito} onChange={(e) => salvar({ ...v, credito: e.target.value })} placeholder="Título — autoria (domínio público)" className={`${campo} mt-1`} /></label>
      <label className={rotulo}>Língua da letra (para a voz e o destaque)<input value={v.lingua} onChange={(e) => salvar({ ...v, lingua: e.target.value })} placeholder="es-ES" className={`${campo} mt-1 max-w-40`} /></label>
      <div>
        <p className={rotulo}>Versos: quando aparece (minuto:segundo), a letra e a tradução</p>
        <Linhas itens={v.versos} mudar={(x) => salvar({ ...v, versos: x })} novo={() => ({ t: "", texto: "", traducao: "" })} rotuloNovo="verso" linha={(x, t) => (
          <div className="grid gap-1 sm:grid-cols-[5rem_1fr_1fr]">
            <input value={x.t} onChange={(e) => t({ ...x, t: e.target.value })} placeholder="0:05" aria-label="Tempo" className={`${campo} font-mono`} />
            <input value={x.texto} onChange={(e) => t({ ...x, texto: e.target.value })} placeholder="Letra" aria-label="Letra" className={campo} />
            <input value={x.traducao} onChange={(e) => t({ ...x, traducao: e.target.value })} placeholder="Tradução (opcional)" aria-label="Tradução" className={campo} />
          </div>
        )} />
      </div>
    </div>
  );
}

// ───────────── Ferramenta do site ─────────────

export function FormFerramenta({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const [nome = "", texto = ""] = (spec.split(/\r?\n/)[0] ?? "").split("|").map((x) => x.trim());
  const [v, setV] = useState({ nome, texto });
  const salvar = (n: typeof v) => { setV(n); mudar(`${n.nome} | ${n.texto || "Abrir a ferramenta"}`); };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className={rotulo}>Qual ferramenta<select value={v.nome} onChange={(e) => salvar({ ...v, nome: e.target.value })} className={`${campo} mt-1`}><option value="">Escolha…</option>{tools.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}</select></label>
      <label className={rotulo}>Texto do botão<input value={v.texto} onChange={(e) => salvar({ ...v, texto: e.target.value })} placeholder="Abrir o simulador do sistema solar" className={`${campo} mt-1`} /></label>
    </div>
  );
}

// ───────────── Recurso do site (laboratório, obra, estúdio, PhET) ─────────────

const NOMES_DE_RECURSO: Record<TipoDeRecurso, string> = { laboratorio: "Laboratório do site", obra: "Obra do acervo", estudio: "Editor do Estúdio de prática", phet: "Simulação do PhET" };

export function FormRecurso({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const lido = lerRecurso(spec);
  const [v, setV] = useState({ tipo: (lido?.tipo ?? "laboratorio") as TipoDeRecurso, id: lido?.id ?? "", altura: String(lido?.altura ?? 640) });
  const salvar = (n: typeof v) => { setV(n); mudar(`${n.tipo}: ${n.id}${n.altura && n.altura !== "640" ? `\naltura: ${n.altura}` : ""}`); };
  const opcoes = v.tipo === "obra" ? null : RECURSOS_DISPONIVEIS[v.tipo];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {(Object.keys(NOMES_DE_RECURSO) as TipoDeRecurso[]).map((tipo) => (
          <button key={tipo} type="button" aria-pressed={v.tipo === tipo} onClick={() => salvar({ ...v, tipo, id: "" })} className={`cursor-pointer border-2 px-2 py-1 text-sm ${v.tipo === tipo ? "border-ink bg-ink text-parchment" : "border-ink/20 hover:border-ink"}`}>{NOMES_DE_RECURSO[tipo]}</button>
        ))}
      </div>
      {opcoes ? (
        <label className={rotulo}>Qual<select value={v.id} onChange={(e) => salvar({ ...v, id: e.target.value })} className={`${campo} mt-1`}><option value="">Escolha…</option>{opcoes.map((id) => <option key={id} value={id}>{id.replace(/-/g, " ")}</option>)}</select></label>
      ) : (
        <label className={rotulo}>Endereço da obra no acervo (o final de institutolucia.org/pt/acervo/…)<input value={v.id} onChange={(e) => salvar({ ...v, id: e.target.value.trim().toLowerCase().replace(/^.*\/acervo\//, "") })} placeholder="1984" className={`${campo} mt-1 font-mono`} /></label>
      )}
      {v.tipo !== "obra" && <label className={rotulo}>Altura do quadro (px)<input inputMode="numeric" value={v.altura} onChange={(e) => salvar({ ...v, altura: e.target.value.replace(/\D/g, "") })} className={`${campo} mt-1 max-w-32`} /></label>}
    </div>
  );
}
