// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Aviso, Fontes, Moldura } from "./Base";
import { CASOS_DE_TENSAO, FONTES_PONTO, PONTAS, TAMANHOS, TECIDOS, avaliarAgulha, type CasoDeTensao, type PontaDaAgulha } from "./dados/ponto";

const ACOES = [
  { id: "apertar", nome: "Apertar o botão de tensão do fio de cima" },
  { id: "afrouxar", nome: "Afrouxar o botão de tensão do fio de cima" },
  { id: "manter", nome: "Não mexer em nada" },
] as const;

const CORTE: Record<CasoDeTensao["ponto"], number> = { "em-cima": 18, "no-meio": 50, "em-baixo": 82 };

function Corte({ ponto }: { ponto: CasoDeTensao["ponto"] }) {
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label={`Corte do tecido: o fio de cima e o de baixo se encontram ${ponto === "no-meio" ? "no meio" : ponto === "em-cima" ? "perto da face de cima" : "perto da face de baixo"}`} className="h-24 w-28 border-2 border-ink bg-folha">
      <rect x="0" y="30" width="120" height="40" fill="currentColor" opacity="0.15" />
      <path d={`M10 8 Q60 ${CORTE[ponto]} 110 8`} fill="none" stroke="currentColor" strokeWidth="3" />
      <path d={`M10 92 Q60 ${100 - CORTE[ponto]} 110 92`} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6 4" />
      <circle cx="60" cy={ponto === "no-meio" ? 50 : ponto === "em-cima" ? 24 : 76} r="4" fill="currentColor" />
    </svg>
  );
}

/** Parte 1: agulha certa para cada tecido. Parte 2: ler o sintoma e ajustar a tensão. */
export default function AjusteOPonto() {
  const [t, setT] = useState(0);
  const [tam, setTam] = useState<number>(80);
  const [ponta, setPonta] = useState<PontaDaAgulha>("universal");
  const [testou, setTestou] = useState(false);
  const [c, setC] = useState(0);
  const [acao, setAcao] = useState<string | null>(null);
  const tecido = TECIDOS[t];
  const caso = CASOS_DE_TENSAO[c];
  const v = avaliarAgulha(tecido, tam, ponta);

  return (
    <Moldura titulo="Ajuste o ponto" intro="Costura boa começa por duas coisas: a agulha certa para o tecido e a tensão do fio equilibrada. Experimente, erre e veja o que aconteceria na máquina.">
      <h4 className="font-serif text-lg font-semibold">1. A agulha</h4>
      <div className="mt-2 flex flex-wrap items-end gap-4 font-sans text-sm">
        <label className="grid gap-1">
          Tecido
          <select value={t} onChange={(e) => { setT(Number(e.target.value)); setTestou(false); }} className="border-2 border-ink bg-transparent p-1">
            {TECIDOS.map((x, i) => (<option key={x.id} value={i}>{x.nome}</option>))}
          </select>
        </label>
        <label className="grid gap-1">
          Número da agulha (NM)
          <select value={tam} onChange={(e) => { setTam(Number(e.target.value)); setTestou(false); }} className="border-2 border-ink bg-transparent p-1">
            {TAMANHOS.map((n) => (<option key={n} value={n}>{n} ({(n / 100).toFixed(2).replace(".", ",")} mm)</option>))}
          </select>
        </label>
        <label className="grid gap-1">
          Ponta
          <select value={ponta} onChange={(e) => { setPonta(e.target.value as PontaDaAgulha); setTestou(false); }} className="border-2 border-ink bg-transparent p-1">
            {PONTAS.map((p) => (<option key={p.id} value={p.id}>{p.nome}</option>))}
          </select>
        </label>
        <button type="button" onClick={() => setTestou(true)} className="botao cursor-pointer">Costurar um retalho</button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{tecido.descricao}</p>
      {testou ? (
        v.ok ? (
          <Aviso><strong>Boa escolha. </strong>{tecido.retorno}</Aviso>
        ) : (
          <Aviso>{v.motivos.join(" ")}</Aviso>
        )
      ) : null}

      <h4 className="mt-6 font-serif text-lg font-semibold">2. A tensão</h4>
      <p className="mt-1 text-sm leading-relaxed">Antes de mexer no botão, sempre reenfie a máquina com o calcador levantado: muito sintoma é só fio mal enfiado.</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <Corte ponto={caso.ponto} />
        <div className="min-w-48 flex-1">
          <p className="leading-relaxed"><strong>O que se vê:</strong> {caso.sintoma}</p>
          <div className="mt-2 grid gap-2">
            {ACOES.map((a) => (
              <button key={a.id} type="button" onClick={() => setAcao(a.id)} aria-pressed={acao === a.id} className="guia-opcao text-left">{a.nome}</button>
            ))}
          </div>
        </div>
      </div>
      {acao ? (
        <Aviso>
          <strong>{acao === caso.acao ? "Certo. " : "Ainda não. "}</strong>
          {caso.explicacao}
        </Aviso>
      ) : null}
      <button type="button" onClick={() => { setC((c + 1) % CASOS_DE_TENSAO.length); setAcao(null); }} className="botao botao-papel mt-3 cursor-pointer">Outro retalho</button>
      <Fontes fontes={FONTES_PONTO} nota="O número da agulha é o diâmetro em centésimos de milímetro. A direção do ajuste de tensão segue a central de ajuda da Brother; o botão e o enfiamento mudam de máquina para máquina: o manual da sua é a referência." />
    </Moldura>
  );
}
