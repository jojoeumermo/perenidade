// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { CONQUISTAS, FONTES_1917, PAUTA_1917 } from "@/lib/jogos-proprios/regras";
import { Btn, Moldura } from "./kit";

/** Conquistas e greves: ligar o direito à lei que o garante e, depois, separar o que estava na pauta da greve de 1917. */
export default function ConquistasEGreves() {
  // Rodada 1: cada direito tem 3 leis para escolher (a certa e duas de outros direitos).
  const [resp, setResp] = useState<Record<string, string>>({});
  const [pauta, setPauta] = useState<string[]>([]);
  const [pautaVista, setPautaVista] = useState(false);

  const opcoes = (id: string) => {
    const i = CONQUISTAS.findIndex((c) => c.id === id);
    const outras = [CONQUISTAS[(i + 2) % CONQUISTAS.length], CONQUISTAS[(i + 5) % CONQUISTAS.length]];
    // Ordem fixa e variada (não aleatória: o servidor e o navegador desenham igual).
    const lista = [CONQUISTAS[i], ...outras];
    return i % 3 === 0 ? lista : i % 3 === 1 ? [lista[1], lista[0], lista[2]] : [lista[1], lista[2], lista[0]];
  };

  return (
    <Moldura
      titulo="Conquistas e greves"
      ajuda="Direito não caiu do céu: está escrito em lei, e muitas vezes veio depois de gente parar de trabalhar para pedir. Ligue cada direito à lei que o garante."
      fontes={[{ titulo: "Constituição de 1988", url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" }, { titulo: "Lei nº 4.090/1962", url: "https://www.planalto.gov.br/ccivil_03/leis/l4090.htm" }, { titulo: "Lei nº 605/1949", url: "https://www.planalto.gov.br/ccivil_03/leis/l0605.htm" }, ...FONTES_1917]}
    >
      <ol className="space-y-3">
        {CONQUISTAS.map((c) => (
          <li key={c.id} className="border-2 border-ink bg-parchment p-3">
            <p className="font-bold" id={`cq-${c.id}`}>{c.direito}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby={`cq-${c.id}`}>
              {opcoes(c.id).map((o) => (
                <Btn key={o.id} ativo={resp[c.id] === o.id} onClick={() => setResp((r) => ({ ...r, [c.id]: o.id }))}>{o.lei}</Btn>
              ))}
            </div>
            {resp[c.id] && (
              <p className="mt-2 text-sm" aria-live="polite">
                {resp[c.id] === c.id ? "Isso. " : "Ainda não. "}
                {resp[c.id] === c.id && <a href={c.fonte.url} target="_blank" rel="noopener noreferrer" className="underline">Ver o texto da lei</a>}
              </p>
            )}
          </li>
        ))}
      </ol>

      <h3 className="mt-6 font-serif text-xl font-semibold">Em 1917, em São Paulo</h3>
      <p className="text-sm text-ink-soft">A greve geral de julho de 1917 apresentou uma pauta de reivindicações. Marque o que estava nela e depois confira.</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {PAUTA_1917.map((p) => (
          <li key={p.id}>
            <Btn ativo={pauta.includes(p.id)} onClick={() => { setPautaVista(false); setPauta((l) => (l.includes(p.id) ? l.filter((x) => x !== p.id) : [...l, p.id])); }}>{p.texto}</Btn>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn tipo="tinta" onClick={() => setPautaVista(true)}>Conferir a pauta</Btn>
        <Btn onClick={() => { setPauta([]); setPautaVista(false); setResp({}); }}>Recomeçar</Btn>
      </div>
      {pautaVista && (
        <div className="mt-3 text-sm" aria-live="polite">
          <p>Estavam na pauta: {PAUTA_1917.filter((p) => p.estavaNaPauta).map((p) => p.texto.toLowerCase()).join("; ")}.</p>
          <p className="mt-1">Você acertou {PAUTA_1917.filter((p) => p.estavaNaPauta === pauta.includes(p.id)).length} de {PAUTA_1917.length}. FGTS, 13º salário e licença-gestante de 120 dias não estavam nela: aparecem em leis e na Constituição mais tarde. As fontes divergem em alguns detalhes, como o percentual do aumento pedido; por isso o jogo não cita número.</p>
        </div>
      )}
    </Moldura>
  );
}
