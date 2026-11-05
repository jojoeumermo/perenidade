// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { CENAS_DE_NEGOCIACAO, finalDaNegociacao, rodarNegociacao } from "@/lib/jogos-proprios/regras";
import { Barra, Btn, Moldura } from "./kit";

/** Negociação coletiva: três cenas de texto, sem vitória nem derrota única. Cada final mostra o que a escolha costuma custar. */
export default function NegociacaoColetiva() {
  const [escolhas, setEscolhas] = useState<number[]>([]);
  const cena = CENAS_DE_NEGOCIACAO[escolhas.length];
  const ultima = escolhas.length > 0 ? CENAS_DE_NEGOCIACAO[escolhas.length - 1].escolhas[escolhas[escolhas.length - 1]] : null;
  const m = rodarNegociacao(escolhas);
  const fim = finalDaNegociacao(m.forca, m.abertura);

  return (
    <Moldura
      titulo="Negociação coletiva"
      ajuda="Você está na mesa do sindicato de uma empresa inventada. Três decisões, nenhuma perfeita."
      fontes={[{ titulo: "Constituição de 1988, arts. 7º, XXVI, 8º, VI e 9º", url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" }]}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Barra rotulo="Força da categoria" valor={Math.max(0, m.forca + 3)} total={9} />
        <Barra rotulo="Abertura da empresa" valor={Math.max(0, m.abertura + 3)} total={9} cor="#f0b323" />
      </div>
      {ultima && <p className="mt-3 border-l-4 border-ink pl-3 text-sm" aria-live="polite">{ultima.retorno}</p>}
      {cena ? (
        <div className="mt-3">
          <h3 className="font-serif text-lg font-semibold">{cena.titulo}</h3>
          <p className="mt-1 text-sm">{cena.texto}</p>
          <div className="mt-3 flex flex-col gap-2">
            {cena.escolhas.map((e, k) => (
              <Btn key={e.texto} onClick={() => setEscolhas((l) => [...l, k])}>{e.texto}</Btn>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3" aria-live="polite">
          <h3 className="font-serif text-xl font-semibold">{fim.titulo}</h3>
          <p className="mt-1 text-sm">{fim.texto}</p>
          <p className="mt-2 text-xs text-ink-soft">Existem outros caminhos: tente de novo escolhendo diferente e compare.</p>
          <div className="mt-2"><Btn onClick={() => setEscolhas([])}>Jogar de novo</Btn></div>
        </div>
      )}
    </Moldura>
  );
}
