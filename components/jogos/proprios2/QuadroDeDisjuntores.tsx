// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Fontes, Moldura } from "./Base";
import {
  AVISO_DE_SEGURANCA,
  CIRCUITOS,
  DISJUNTORES,
  FONTES_DISJUNTORES,
  SECOES,
  TEXTO_DA_FALHA,
  avaliarCircuito,
  combinacoesQueServem,
  secaoMinima,
  type Circuito,
  type Escolhas,
} from "./dados/disjuntores";

const PADRAO: Escolhas = { secao: 1.5, disjuntor: 10, dr: false };
const fmt = (n: number) => String(n).replace(".", ",");

function Linha({ c }: { c: Circuito }) {
  const [e, setE] = useState<Escolhas>(PADRAO);
  const [testado, setTestado] = useState(false);
  const v = avaliarCircuito(c, e);
  const servem = combinacoesQueServem(c);
  const mudar = (parcial: Partial<Escolhas>) => {
    setE((x) => ({ ...x, ...parcial }));
    setTestado(false);
  };
  return (
    <li className="border-2 border-ink p-3">
      <p className="font-serif text-lg font-semibold">{c.nome}</p>
      <p className="text-sm text-ink-soft">
        {c.watts} W em {c.volts} V: corrente de projeto Ib = {c.watts} / {c.volts} = {fmt(v.ib)} A{c.molhada ? " · área molhada" : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-4 font-sans text-sm">
        <label className="grid gap-1">
          Fio de cobre (mm²)
          <select value={e.secao} onChange={(ev) => mudar({ secao: Number(ev.target.value) })} className="border-2 border-ink bg-transparent p-1">
            {SECOES.map((s) => (<option key={s} value={s}>{fmt(s)} mm²</option>))}
          </select>
        </label>
        <label className="grid gap-1">
          Disjuntor (A)
          <select value={e.disjuntor} onChange={(ev) => mudar({ disjuntor: Number(ev.target.value) })} className="border-2 border-ink bg-transparent p-1">
            {DISJUNTORES.map((d) => (<option key={d} value={d}>{d} A</option>))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={e.dr} onChange={(ev) => mudar({ dr: ev.target.checked })} className="h-5 w-5" />
          DR de 30 mA
        </label>
        <button type="button" onClick={() => setTestado(true)} className="botao cursor-pointer">Ligar tudo e testar</button>
      </div>
      <div role="status" aria-live="polite" className="mt-2">
        {testado ? (
          v.ok ? (
            <p className="border-l-4 border-prelo-texto pl-3 text-sm leading-relaxed">
              <strong>Funciona e está protegido.</strong> Ib = {fmt(v.ib)} A ≤ disjuntor {e.disjuntor} A ≤ fio {fmt(e.secao)} mm², que aguenta {fmt(v.iz)} A (tabela simplificada).
            </p>
          ) : (
            <ul className="space-y-1">
              {v.falhas.map((f) => (
                <li key={f} className="border-l-4 border-ink pl-3 text-sm leading-relaxed">{TEXTO_DA_FALHA[f]}</li>
              ))}
              <li className="pl-3 text-xs text-ink-soft">Pode errar à vontade: é uma simulação. Seção mínima desse circuito: {fmt(secaoMinima(c.tipo))} mm². Combinações que servem: {servem.map((s) => `${fmt(s.secao)} mm² com ${s.disjuntor} A`).join("; ")}.</li>
            </ul>
          )
        ) : null}
      </div>
    </li>
  );
}

/** Cinco circuitos de uma casa. A regra central: corrente do circuito ≤ disjuntor ≤ o que o fio aguenta. */
export default function QuadroDeDisjuntores() {
  return (
    <Moldura titulo="Quadro de disjuntores" intro="Monte o quadro de uma casa simples: para cada circuito, escolha o fio, o disjuntor e se leva DR. A regra de ouro é Ib ≤ In ≤ Iz: a corrente do circuito não passa do disjuntor, e o disjuntor não passa do que o fio aguenta.">
      <p className="border-2 border-ink bg-folha p-3 text-sm leading-relaxed"><strong>Segurança. </strong>{AVISO_DE_SEGURANCA}</p>
      <ul className="mt-4 grid gap-3">
        {CIRCUITOS.map((c) => (<Linha key={c.id} c={c} />))}
      </ul>
      <Fontes
        fontes={FONTES_DISJUNTORES}
        nota="Valores de capacidade de condução: fio de cobre, isolação PVC, método B1, dois condutores carregados, 30 °C, sem fatores de correção (Tabela 36 da NBR 5410:2004, conferida em fonte secundária). Seção mínima: 1,5 mm² para iluminação e 2,5 mm² para os demais circuitos. DR de 30 mA em áreas molhadas. A norma é da ABNT e é paga: confira nela antes de qualquer obra."
      />
    </Moldura>
  );
}
