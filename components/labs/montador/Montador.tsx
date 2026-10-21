// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { type Aparelho, CASOS, SEGURANCA } from "./casos";
import { fonteAtx, BANCADA_ELETRICA } from "../eletrica/multimetro";
import { MultimetroVisual } from "../eletrica/MultimetroVisual";
import { ETAPAS } from "./pecas";
import { BancadaVisual } from "./BancadaVisual";
import { Resistores } from "./Resistores";

const ABAS = [
  { id: "montar", nome: "Montar o PC" },
  { id: "ordem", nome: "Ordem da montagem" },
  { id: "multimetro", nome: "Multímetro" },
  { id: "resistores", nome: "Resistores e Lei de Ohm" },
  { id: "casos", nome: "Casos de bancada" },
  { id: "seguranca", nome: "Segurança" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

const caixa = "border-2 border-ink bg-parchment-deep p-3";
const rotulo = "font-mono text-[0.65rem] uppercase tracking-widest text-gold";

function embaralhar<T>(lista: T[]) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function Ordem() {
  const [baralho, setBaralho] = useState<string[] | null>(null);
  const [feitas, setFeitas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState(0);
  if (!baralho) return <button type="button" onClick={() => setBaralho(embaralhar(ETAPAS))} className="cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood">Embaralhar as etapas e começar</button>;
  const escolher = (x: string) => {
    if (ETAPAS[feitas.length] === x) { setFeitas((f) => [...f, x]); setErro(null); }
    else { setErros((n) => n + 1); setErro(`Ainda não: antes vem “${ETAPAS[feitas.length]}”.`); }
  };
  const fim = feitas.length === ETAPAS.length;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className={rotulo}>Toque na próxima etapa</p>
        <ul className="mt-1 space-y-1">
          {baralho.filter((x) => !feitas.includes(x)).map((x) => <li key={x}><button type="button" onClick={() => escolher(x)} className="w-full cursor-pointer border-2 border-rule px-2 py-1.5 text-left hover:border-ink">{x}</button></li>)}
        </ul>
        {erro && <p role="alert" className="mt-2 text-oxblood">{erro}</p>}
      </div>
      <div className={caixa}>
        <p className={rotulo}>Sua montagem ({feitas.length}/{ETAPAS.length}) · erros: {erros}</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">{feitas.map((x) => <li key={x}>{x}</li>)}</ol>
        {fim && (
          <p className="mt-3 font-semibold text-ok">
            Montado! {erros === 0 ? "Sem nenhum erro." : `Com ${erros} tropeço(s).`}{" "}
            <button type="button" onClick={() => { setBaralho(embaralhar(ETAPAS)); setFeitas([]); setErros(0); }} className="cursor-pointer font-normal underline">De novo</button>
          </p>
        )}
        <p className="mt-3 text-xs text-ink-soft">Por que nessa ordem: processador, cooler e memória entram mais fácil com a placa fora do gabinete; o primeiro teste é com a tampa aberta, para corrigir sem desmontar tudo.</p>
      </div>
    </div>
  );
}

function Casos() {
  const [filtro, setFiltro] = useState<Aparelho | "Todos">("Todos");
  const lista = CASOS.filter((c) => filtro === "Todos" || c.aparelho === filtro);
  const [id, setId] = useState(CASOS[0].id);
  const caso = CASOS.find((c) => c.id === id) ?? lista[0];
  const [feitos, setFeitos] = useState<number[]>([]);
  const [palpite, setPalpite] = useState<number | null>(null);
  const [resolvidos, setResolvidos] = useState<Record<string, boolean>>({});
  const abrir = (novo: string) => { setId(novo); setFeitos([]); setPalpite(null); };
  const minutos = feitos.reduce((s, i) => s + caso.testes[i].minutos, 0);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {(["Todos", "Computador", "Notebook", "Celular", "Eletrônica"] as const).map((a) => <button key={a} type="button" aria-pressed={filtro === a} onClick={() => { setFiltro(a); const p = CASOS.find((c) => a === "Todos" || c.aparelho === a); if (p) abrir(p.id); }} className={`cursor-pointer border-2 px-2 py-1 ${filtro === a ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>{a}</button>)}
        <span className="ml-auto text-ink-soft">Resolvidos: {Object.values(resolvidos).filter(Boolean).length}/{CASOS.length}</span>
      </div>
      <ol className="mt-3 flex flex-wrap gap-1">
        {lista.map((c) => <li key={c.id}><button type="button" onClick={() => abrir(c.id)} className={`cursor-pointer border px-2 py-1 text-xs ${c.id === caso.id ? "border-ink bg-ink text-parchment" : resolvidos[c.id] ? "border-ok text-ok" : "border-rule"}`}>{resolvidos[c.id] ? "✓ " : ""}{c.titulo}</button></li>)}
      </ol>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className={rotulo}>{caso.aparelho} · ordem de serviço</p>
          <p className="mt-1 font-serif text-xl font-semibold">{caso.titulo}</p>
          <p className="mt-1 italic">{caso.relato}</p>
          <p className={`${rotulo} mt-4`}>Testes (tempo gasto: {minutos} min)</p>
          <ul className="mt-1 space-y-1">
            {caso.testes.map((t, i) => (
              <li key={t.nome}>
                <button type="button" disabled={feitos.includes(i)} onClick={() => setFeitos((f) => [...f, i])} className="w-full cursor-pointer border-2 border-rule px-2 py-1.5 text-left hover:border-ink disabled:cursor-default disabled:border-ink">
                  {t.nome} <span className="text-xs text-ink-soft">({t.minutos} min)</span>
                  {feitos.includes(i) && <span className="mt-1 block font-mono text-xs">→ {t.resultado}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className={caixa}>
          <p className={rotulo}>Diagnóstico</p>
          <ul className="mt-1 space-y-1">
            {caso.hipoteses.map((h, i) => (
              <li key={h}>
                <button type="button" disabled={palpite !== null} onClick={() => { setPalpite(i); setResolvidos((r) => ({ ...r, [caso.id]: r[caso.id] || i === caso.certa })); }} className={`w-full cursor-pointer border-2 px-2 py-1.5 text-left disabled:cursor-default ${palpite === null ? "border-rule hover:border-ink" : i === caso.certa ? "border-ok" : i === palpite ? "border-oxblood" : "border-rule opacity-60"}`}>{h}</button>
              </li>
            ))}
          </ul>
          {palpite !== null && (
            <div className="mt-3">
              <p className="font-semibold">{palpite === caso.certa ? (feitos.length === 0 ? "Acertou, mas no chute: técnico bom testa antes de trocar peça." : minutos <= 10 ? "Certo, e rápido!" : "Certo. Dava para chegar lá com menos testes.") : "Não é isso."}</p>
              <p className="mt-1">{caso.explica}</p>
              <button type="button" onClick={() => { setFeitos([]); setPalpite(null); }} className="mt-2 cursor-pointer underline">Refazer o caso</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A bancada do técnico: montagem com compatibilidade de verdade, multímetro, eletrônica básica e casos de conserto. */
export function Montador() {
  const [aba, setAba] = useState<Aba>("montar");
  return (
    <div className="mt-6 font-sans text-sm">
      <div role="tablist" aria-label="Partes da bancada" className="flex flex-wrap gap-1 border-b-2 border-ink">
        {ABAS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)} className={`-mb-0.5 cursor-pointer border-2 border-b-0 px-3 py-1.5 font-semibold ${aba === a.id ? "border-ink bg-parchment-deep" : "border-transparent text-ink-soft hover:text-ink"}`}>{a.nome}</button>)}
      </div>
      <div role="tabpanel" className="pt-5">
        {aba === "montar" && <BancadaVisual />}
        {aba === "ordem" && <Ordem />}
        {aba === "multimetro" && <MultimetroDaBancada />}
        {aba === "resistores" && <Resistores />}
        {aba === "casos" && <Casos />}
        {aba === "seguranca" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SEGURANCA.map(([t, x]) => <div key={t} className={caixa}><p className="font-semibold">{t}</p><p className="mt-1 text-ink-soft">{x}</p></div>)}
          </div>
        )}
      </div>
      <p className="mt-8 text-xs text-ink-soft">Peças genéricas, sem marca, com valores típicos arredondados para o estudo. Na vida real, confira sempre o manual da placa-mãe e a ficha técnica de cada peça.</p>
    </div>
  );
}

/** O multímetro na bancada de informática: a fonte ATX (ligada pelo teste do clipe ou em espera), a bateria da placa e o carregador. */
function MultimetroDaBancada() {
  const [ligada, setLigada] = useState(false);
  const pecas = [...fonteAtx(ligada), ...BANCADA_ELETRICA.filter((p) => ["tomada127", "fusivel", "fio", "resistor1k"].includes(p.id))];
  return (
    <div>
      <label className="mb-3 flex items-center gap-2 font-sans text-sm"><input type="checkbox" checked={ligada} onChange={(e) => setLigada(e.target.checked)} /> Fonte ATX ligada (teste do clipe: verde no preto, sem placa-mãe)</label>
      <MultimetroVisual
        pecas={pecas}
        titulo="Bancada de informática"
        missoes={[
          { texto: "Com a fonte ligada, meça os 12 V do fio amarelo.", peca: "atx-amarelo", chaves: ["vdc20"] },
          { texto: "Descubra se a bateria da placa-mãe está fraca.", peca: "cr2032", chaves: ["vdc20"] },
          { texto: "Confira a saída do carregador do notebook.", peca: "carregador-note", chaves: ["vdc20", "vdc200"] },
          { texto: "Descubra se o fusível queimou.", peca: "fusivel", chaves: ["cont", "ohm200", "ohm2k"] },
        ]}
      />
    </div>
  );
}
