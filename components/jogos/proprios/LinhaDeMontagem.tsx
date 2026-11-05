// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { maisValia } from "@/lib/jogos-proprios/regras";
import { Barra, Campo, Moldura } from "./kit";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hh = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("pt-BR")} h`;

/** Linha de montagem: o dia de trabalho dividido entre o tempo que paga o salário e o tempo que gera valor para quem contrata. */
export default function LinhaDeMontagem() {
  const [horas, setHoras] = useState(8);
  const [salario, setSalario] = useState(120);
  const [valorHora, setValorHora] = useState(30);
  const r = maisValia(salario, valorHora, horas);
  return (
    <Moldura
      titulo="Linha de montagem"
      ajuda="Exemplo inventado: mexa nos três controles e veja em que hora do dia o trabalhador já produziu o valor do próprio salário. O que vem depois é o que Marx chamou de mais-valia."
      fontes={[{ titulo: "Karl Marx, O Capital, Livro I, caps. VII a IX (domínio público)" }]}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Horas da jornada" valor={horas} min={4} max={12} mudar={setHoras} formato={hh} />
        <Campo rotulo="Salário do dia" valor={salario} min={40} max={400} passo={10} mudar={setSalario} formato={brl} />
        <Campo rotulo="Valor criado por hora" valor={valorHora} min={10} max={100} passo={5} mudar={setValorHora} formato={brl} />
      </div>
      <div className="mt-4 flex h-10 border-2 border-ink" role="img" aria-label={`Das ${hh(horas)} do dia, ${hh(r.horasNecessarias)} pagam o salário e ${hh(r.horasExcedentes)} geram valor para quem contrata.`}>
        <div className="flex items-center justify-center bg-[#f0b323] text-xs font-bold" style={{ width: `${horas ? (r.horasNecessarias / horas) * 100 : 0}%` }}>{r.horasNecessarias > 0.8 ? "paga o salário" : ""}</div>
        <div className="flex flex-1 items-center justify-center bg-[#c21f16] text-xs font-bold text-white">{r.horasExcedentes > 0.8 ? "vai para quem contrata" : ""}</div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Barra rotulo="Fica com quem trabalha" valor={r.paraQuemTrabalha} total={r.valorDoDia} cor="#f0b323" />
        <Barra rotulo="Fica com quem contrata" valor={r.paraQuemContrata} total={r.valorDoDia} />
      </div>
      <p className="mt-3 text-sm" aria-live="polite">
        Em {hh(r.horasNecessarias)} o trabalhador já criou {brl(r.paraQuemTrabalha)}, o valor do salário. As outras {hh(r.horasExcedentes)} rendem {brl(r.paraQuemContrata)} a quem contrata. Taxa de mais-valia do exemplo: {Math.round(r.taxa * 100)}%.
      </p>
      <p className="mt-2 text-xs text-ink-soft">Fica de fora do exemplo, para não complicar: matéria-prima, aluguel, máquinas e impostos saem desse valor antes do lucro. Tente: o que acontece se a jornada cai para 6 horas e o salário continua igual?</p>
    </Moldura>
  );
}
