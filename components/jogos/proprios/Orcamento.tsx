// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { CTB_2023, FONTE_CTB, FONTE_POF, POF_2017_2018, outrosGastos, pesoNaRenda, repartirCarga } from "@/lib/jogos-proprios/regras";
import { Barra, Campo, Moldura } from "./kit";

const pct = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("pt-BR")}%`;

/** Orçamento: quem paga a conta? Parte 1, o tamanho do Estado (dado da Receita). Parte 2, a família (dado do IBGE). Parte 3, o imposto no preço. */
export default function Orcamento() {
  const [carga, setCarga] = useState(CTB_2023.total);
  const [renda, setRenda] = useState(3000);
  const [aliquota, setAliquota] = useState(10);
  const reparto = repartirCarga(carga);
  const pof = [
    ["Habitação", POF_2017_2018.habitacao],
    ["Transporte", POF_2017_2018.transporte],
    ["Alimentação", POF_2017_2018.alimentacao],
    ["Outros gastos", outrosGastos()],
  ] as const;
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <Moldura
      titulo="Orçamento: quem paga a conta?"
      ajuda="Três balanças. Na primeira, o quanto o país arrecada. Na segunda, para onde vai o dinheiro de uma família. Na terceira, por que um mesmo imposto pesa diferente em famílias diferentes."
      fontes={[FONTE_CTB, FONTE_POF]}
    >
      <h3 className="font-serif text-lg font-semibold">1. O tamanho do bolo</h3>
      <Campo rotulo="Impostos e contribuições, em % de tudo o que o país produz (PIB)" valor={carga} min={15} max={45} passo={0.5} mudar={setCarga} formato={pct} />
      <p className="mt-1 text-sm">Em 2023 o Brasil arrecadou {pct(CTB_2023.total)} do PIB, segundo a Receita Federal: {pct(CTB_2023.uniao)} ficaram com a União, {pct(CTB_2023.estados)} com os estados e {pct(CTB_2023.municipios)} com os municípios. Na sua conta, mantida essa proporção, de cada R$ 100 que o país produz: União {(reparto.uniao).toLocaleString("pt-BR")} reais, estados {reparto.estados.toLocaleString("pt-BR")} e municípios {reparto.municipios.toLocaleString("pt-BR")}.</p>
      <p className="mt-1 text-xs text-ink-soft">Tamanho não diz tudo: importa quem paga e como o dinheiro volta (veja a checagem sobre a carga tributária).</p>

      <h3 className="mt-5 font-serif text-lg font-semibold">2. Para onde vai o dinheiro da família</h3>
      <Campo rotulo="Renda da família no mês" valor={renda} min={1000} max={10000} passo={100} mudar={setRenda} formato={brl} />
      <div className="mt-2 space-y-1.5">
        {pof.map(([nome, p]) => <Barra key={nome} rotulo={`${nome} (${pct(p)} em média)`} valor={(renda * p) / 100} total={renda} cor="#f0b323" />)}
      </div>
      <p className="mt-1 text-xs text-ink-soft">Percentuais médios das famílias brasileiras no total das despesas de consumo (IBGE, POF 2017-2018). A família mais pobre gasta fatia maior em habitação e alimentação do que a média: pela mesma pesquisa, famílias com renda até R$ 1,9 mil destinam 61,2% dos gastos a alimentação e habitação.</p>

      <h3 className="mt-5 font-serif text-lg font-semibold">3. O mesmo imposto, pesos diferentes</h3>
      <Campo rotulo="Imposto embutido no preço do que se compra" valor={aliquota} min={0} max={30} mudar={setAliquota} formato={pct} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="border-2 border-ink bg-parchment p-2 text-sm"><b>Família A</b> gasta 100% da renda em consumo. Paga {pct(pesoNaRenda(aliquota, 100))} da renda.</div>
        <div className="border-2 border-ink bg-parchment p-2 text-sm"><b>Família B</b> gasta 50% e guarda o resto. Paga {pct(pesoNaRenda(aliquota, 50))} da renda.</div>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Famílias e alíquota são exemplos de aritmética, não dados. A conta mostra que um imposto sobre o consumo pesa mais, proporcionalmente, em quem gasta quase tudo o que ganha. O que fazer a respeito (por exemplo, o peso relativo de impostos sobre consumo, renda e patrimônio) é um debate aberto: pense nos dois lados.</p>
    </Moldura>
  );
}
