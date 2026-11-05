// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { diaDeTrabalho, parteDoTempoLivre } from "@/lib/jogos-proprios/regras";
import { Barra, Campo, Moldura } from "./kit";

const hh = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("pt-BR")} h`;

/** A catraca e o relógio: o dia de 24 horas de quem trabalha. A catraca cobra em dinheiro; o trajeto cobra em tempo. */
export default function CatracaERelogio() {
  const [trabalho, setTrabalho] = useState(8);
  const [trajeto, setTrajeto] = useState(2);
  const [sono, setSono] = useState(7);
  const d = diaDeTrabalho(trabalho, trajeto, sono);
  return (
    <Moldura
      titulo="A catraca e o relógio"
      ajuda="Exemplo: um dia tem 24 horas. Escolha quanto vão para o trabalho, para o trajeto e para o sono, e veja o que sobra para comer, cuidar de casa, estudar, descansar e ficar com quem se ama."
      fontes={[{ titulo: "Constituição de 1988, art. 7º, XIII (limite de oito horas diárias de jornada normal)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" }]}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Trabalho" valor={trabalho} min={0} max={12} passo={0.5} mudar={setTrabalho} formato={hh} />
        <Campo rotulo="Ida e volta do trabalho" valor={trajeto} min={0} max={5} passo={0.5} mudar={setTrajeto} formato={hh} />
        <Campo rotulo="Sono" valor={sono} min={4} max={10} passo={0.5} mudar={setSono} formato={hh} />
      </div>
      <div className="mt-3 space-y-1.5">
        <Barra rotulo="Trabalho" valor={d.trabalho} total={24} cor="#1f1a14" />
        <Barra rotulo="Trajeto" valor={d.deslocamento} total={24} cor="#c21f16" />
        <Barra rotulo="Sono" valor={d.sono} total={24} cor="#6b7fa8" />
        <Barra rotulo="Sobra para a vida" valor={Math.max(0, d.sobra)} total={24} cor="#f0b323" />
      </div>
      <p className="mt-3 text-sm" aria-live="polite">
        {d.sobra < 0
          ? "A conta não fecha: passou de 24 horas. Tire horas de algum lugar."
          : `Sobram ${hh(d.sobra)}. O trajeto leva ${parteDoTempoLivre(d)}% do tempo que não é trabalho nem sono. ${d.trabalho > 8 ? "Atenção: a Constituição fala em jornada normal de até oito horas por dia, com compensação ou redução por acordo ou convenção coletiva." : ""}`}
      </p>
      <p className="mt-1 text-xs text-ink-soft">Os números são de brincadeira, para sentir o peso do relógio. Quanto custa a passagem e quanto tempo a cidade toma de quem trabalha é pauta de luta por tarifa e por transporte público de qualidade.</p>
    </Moldura>
  );
}
