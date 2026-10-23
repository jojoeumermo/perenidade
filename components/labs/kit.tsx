// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/**
 * O kit visual dos laboratórios: a bancada (um painel com cabeçalho), os controles (deslizante, escolha, botões), as
 * leituras (números grandes) e o roteiro "Preveja, rode, compare, explique". Tudo na identidade do site: pergaminho,
 * tinta e bordô, com a área do instrumento escura para os gráficos saltarem aos olhos.
 */
import { useState } from "react";
import { Selo, temSelo } from "../Selo";

export function Bancada({ titulo, subtitulo, children, acoes }: { titulo: string; subtitulo?: string; children: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <section className="overflow-hidden border-2 border-ink bg-folha shadow-[7px_7px_0_var(--sombra)]">
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-[#1f1a14] px-5 py-3.5 text-[#f4ecd8]">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[1.65rem] font-semibold leading-tight">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-sm text-[#cdbb91]">{subtitulo}</p>}
        </div>
        {acoes && <div className="ml-auto flex flex-wrap gap-2">{acoes}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Deslizante({ rotulo, valor, min, max, passo = 1, mudar, formato }: { rotulo: string; valor: number; min: number; max: number; passo?: number; mudar: (v: number) => void; formato?: (v: number) => string }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between gap-2"><span className="font-semibold">{rotulo}</span><span className="font-mono tabular-nums text-oxblood">{formato ? formato(valor) : valor}</span></span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => mudar(Number(e.target.value))} className="mt-1 w-full accent-[#c21f16]" />
    </label>
  );
}

export function Escolha<T extends string>({ rotulo, valor, opcoes, mudar }: { rotulo: string; valor: T; opcoes: [T, string][]; mudar: (v: T) => void }) {
  return (
    <div className="text-sm">
      <p className="font-semibold">{rotulo}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {opcoes.map(([id, nome]) => (
          <button key={id} type="button" aria-pressed={valor === id} onClick={() => mudar(id)} className={`cursor-pointer border-2 px-2.5 py-1 text-xs font-semibold ${valor === id ? "border-ink bg-ink text-parchment shadow-[2px_2px_0_var(--prelo)]" : "border-ink bg-folha hover:shadow-[2px_2px_0_var(--sombra)]"}`}>{nome}</button>
        ))}
      </div>
    </div>
  );
}

export function Botao({ children, onClick, primario = false, desligado = false, titulo }: { children: React.ReactNode; onClick: () => void; primario?: boolean; desligado?: boolean; titulo?: string }) {
  return (
    <button type="button" title={titulo} disabled={desligado} onClick={onClick} className={`cursor-pointer border-2 px-3.5 py-1.5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40 ${primario ? "border-[#f4ecd8] bg-[#c21f16] text-white shadow-[3px_3px_0_#f4ecd8] hover:bg-[#a51810]" : "border-[#f4ecd8]/60 bg-transparent text-inherit hover:border-current"}`}>
      {children}
    </button>
  );
}

export function BotaoClaro({ children, onClick, desligado = false }: { children: React.ReactNode; onClick: () => void; desligado?: boolean }) {
  return <button type="button" disabled={desligado} onClick={onClick} className="botao botao-papel botao-menor disabled:opacity-40">{children}</button>;
}

export function Leitura({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`border-2 px-3 py-2 ${destaque ? "border-[#c21f16] shadow-[3px_3px_0_var(--prelo)]" : "border-ink"} bg-parchment`}>
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-soft">{rotulo}</p>
      <p className="font-mono text-xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

/** Uma linha do tempo pequena (perda, população…), em SVG. Várias séries: [cor, valores]. */
export function Grafico({ series, altura = 90, max, rotulos }: { series: [string, number[]][]; altura?: number; max?: number; rotulos?: string[] }) {
  const n = Math.max(2, ...series.map(([, v]) => v.length));
  const topo = max ?? Math.max(1e-9, ...series.flatMap(([, v]) => v));
  return (
    <div>
      <svg viewBox={`0 0 300 ${altura}`} className="w-full border-2 border-ink bg-[#17130e]" preserveAspectRatio="none" role="img" aria-label="Gráfico da evolução">
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={300} y1={altura * f} y2={altura * f} stroke="#ffffff14" />)}
        {series.map(([cor, v], k) => (
          <polyline key={k} fill="none" stroke={cor} strokeWidth={2} vectorEffect="non-scaling-stroke" points={v.map((y, i) => `${(i / (n - 1)) * 300},${altura - (Math.min(y, topo) / topo) * (altura - 4) - 2}`).join(" ")} />
        ))}
      </svg>
      {rotulos && <p className="mt-1 flex flex-wrap gap-3 text-xs">{series.map(([cor], i) => <span key={i}><span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: cor }} />{rotulos[i]}</span>)}</p>}
    </div>
  );
}

/** O roteiro de todo laboratório: a pergunta, a previsão (anotada só aqui), rodar, comparar e a explicação. */
export function PrevejaRode({ pergunta, explicacao, limites, aprofundar }: { pergunta: string; explicacao: string; limites: string; aprofundar: string }) {
  const [previsao, setPrevisao] = useState("");
  const [visto, setVisto] = useState(false);
  return (
    <div className="border-2 border-dashed border-ink bg-parchment p-4 text-sm">
      <p className="rotulo text-[0.68rem]">Preveja · rode · compare · explique</p>
      <p className="mt-1 text-base font-semibold">{pergunta}</p>
      <label className="mt-2 block">Sua previsão (fica só aqui)<textarea value={previsao} onChange={(e) => setPrevisao(e.target.value)} rows={2} className="mt-1 w-full border-2 border-ink bg-folha p-2" placeholder="Eu acho que…" /></label>
      {!visto ? (
        <button type="button" onClick={() => setVisto(true)} className="mt-2 cursor-pointer font-semibold underline">Já rodei: comparar e ver a explicação</button>
      ) : (
        <div className="mt-3 space-y-2">
          {previsao && <p><strong>Você previu:</strong> {previsao}</p>}
          <p><strong>O que acontece:</strong> {explicacao}</p>
          <p className="text-ink-soft"><strong>Limites do modelo:</strong> {limites}</p>
          <p><strong>Para ir além:</strong> {aprofundar}</p>
        </div>
      )}
    </div>
  );
}

/** A navegação lateral dos laboratórios com vários módulos. */
export function Modulos<T extends string>({ itens, atual, escolher }: { itens: { id: T; nome: string; icone: string; resumo: string }[]; atual: T; escolher: (id: T) => void }) {
  return (
    <nav aria-label="Módulos do laboratório" className="flex gap-3 overflow-x-auto pr-1.5 pb-2 lg:flex-col lg:overflow-visible">
      <p className="hidden font-mono text-xs uppercase tracking-[0.2em] lg:block">{itens.length} experimentos</p>
      {itens.map((m) => (
        <button key={m.id} type="button" aria-current={atual === m.id ? "page" : undefined} onClick={() => escolher(m.id)} className={`flex min-w-56 cursor-pointer items-center gap-3.5 border-2 px-3.5 py-3 text-left transition-[transform,box-shadow] lg:min-w-0 ${atual === m.id ? "border-[#1f1a14] bg-[#1f1a14] text-[#f4ecd8] shadow-[4px_4px_0_var(--prelo)]" : "border-ink bg-folha hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--sombra)]"}`}>
          {temSelo(m.icone) ? (
            <span className={`selo h-[2.9rem] w-[2.9rem] ${atual === m.id ? "border-[#f4ecd8] bg-[#c21f16] text-[#f4ecd8] [--prelo-texto:#f4ecd8]" : ""}`}>
              <Selo nome={m.icone} className="h-[1.9rem] w-[1.9rem]" />
            </span>
          ) : (
            <span className="text-2xl leading-none" aria-hidden>{m.icone}</span>
          )}
          <span className="min-w-0"><span className="block text-[0.95rem] font-extrabold leading-tight">{m.nome}</span><span className={`mt-0.5 block text-[0.78rem] leading-snug ${atual === m.id ? "text-[#cdbb91]" : "text-ink-soft"}`}>{m.resumo}</span></span>
        </button>
      ))}
    </nav>
  );
}

/** Cor do mapa de decisão: laranja (-1) a azul (+1), passando pelo pergaminho no meio. */
export function corDaSaida(v: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, v));
  const azul = [32, 101, 196];
  const laranja = [232, 116, 43];
  const meio = [244, 235, 219];
  const alvo = t >= 0 ? azul : laranja;
  const k = Math.abs(t);
  return [0, 1, 2].map((i) => Math.round(meio[i] + (alvo[i] - meio[i]) * k)) as [number, number, number];
}
