// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Aviso, Fontes, Moldura } from "./Base";
import { CENAS, FINAIS, FONTES_ENERGIA, INICIO, MEDIDORES, aplicar, classificar, type Escolha, type Placar } from "./dados/energia";

/** Cinco decisões, quatro medidores. Sem tempo e sem vidas: dá para voltar e escolher outro caminho. */
export default function TransicaoEnergetica() {
  const [cena, setCena] = useState(-1);
  const [placar, setPlacar] = useState<Placar>(INICIO);
  const [escolhida, setEscolhida] = useState<Escolha | null>(null);
  const atual = CENAS[cena];

  const escolher = (e: Escolha) => {
    if (escolhida) return;
    setEscolhida(e);
    setPlacar((p) => aplicar(p, e.efeito));
  };
  const reiniciar = () => {
    setCena(-1);
    setPlacar(INICIO);
    setEscolhida(null);
  };

  return (
    <Moldura titulo="Transição energética justa" intro="Limpar a energia é urgente, mas quem paga a conta da mudança? Decida cinco situações e acompanhe os quatro medidores. Os efeitos são didáticos; o que existe na lei vem com a fonte.">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Medidores">
        {MEDIDORES.map((m) => (
          <li key={m.id} title={m.ajuda} className="font-sans text-xs font-bold uppercase tracking-[0.08em]">
            <span className="flex justify-between">
              {m.nome} <span className="font-mono font-normal">{placar[m.id]}</span>
            </span>
            <span className="mt-1 block h-2.5 border border-ink" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={placar[m.id]} aria-label={m.nome}>
              <span className="block h-full bg-prelo-texto transition-[width] duration-300" style={{ width: `${placar[m.id]}%` }} />
            </span>
          </li>
        ))}
      </ul>

      {cena === -1 ? (
        <button type="button" onClick={() => setCena(0)} className="botao mt-5 cursor-pointer">
          Começar
        </button>
      ) : atual ? (
        <div className="mt-5">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">
            Decisão {cena + 1} de {CENAS.length} · {atual.titulo}
          </p>
          <p className="mt-2 font-serif text-xl leading-snug">{atual.texto}</p>
          <div className="mt-3 grid gap-2">
            {atual.escolhas.map((e) => (
              <button key={e.texto} type="button" onClick={() => escolher(e)} disabled={!!escolhida} aria-pressed={escolhida === e} className="guia-opcao text-left">
                {e.texto}
              </button>
            ))}
          </div>
          {escolhida ? (
            <div>
              <Aviso>{escolhida.retorno}</Aviso>
              <p className="mt-3 border-l-4 border-ink pl-3 text-sm leading-relaxed text-ink-soft">
                <strong className="font-sans text-xs uppercase tracking-[0.1em] text-ink">Na vida real</strong> {atual.naVidaReal.texto}{" "}
                <a href={atual.naVidaReal.fonte.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {atual.naVidaReal.fonte.nome}
                </a>
              </p>
              <button type="button" onClick={() => { setCena(cena + 1); setEscolhida(null); }} className="botao mt-4 cursor-pointer">
                {cena + 1 < CENAS.length ? "Próxima decisão" : "Ver como terminou"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 border-2 border-ink bg-ink p-5 text-parchment">
          <p className="font-serif text-2xl font-semibold">{FINAIS[classificar(placar)].titulo}</p>
          <p className="mt-2 leading-relaxed">{FINAIS[classificar(placar)].texto}</p>
          <button type="button" onClick={reiniciar} className="botao botao-papel mt-4 cursor-pointer">
            Tentar outro caminho
          </button>
        </div>
      )}
      <Fontes fontes={FONTES_ENERGIA} nota="Os números dos medidores não são medições: servem para comparar caminhos. Os fatos legais de cada decisão têm o artigo e a fonte." />
    </Moldura>
  );
}
