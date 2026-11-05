// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Aviso, Fontes, Moldura } from "./Base";
import { ENIGMAS, FONTES_BUG, acertou } from "./dados/bug";

/** Cinco programas pequenos com um erro cada. Clique na linha errada; depois acompanhe a memória passo a passo. */
export default function BugNaMemoria() {
  const [n, setN] = useState(0);
  const [linha, setLinha] = useState<number | null>(null);
  const [passo, setPasso] = useState(0);
  const e = ENIGMAS[n];
  const resolvido = linha !== null && acertou(e, linha);

  const ir = (k: number) => {
    setN(k);
    setLinha(null);
    setPasso(0);
  };
  const atual = e.passos[Math.min(passo, e.passos.length - 1)];

  return (
    <Moldura titulo="O bug na memória" intro="Cada programa tem uma linha com o erro. Leia o código, use 'Passo a passo' para ver o que a memória guarda e clique na linha que está errada. Errar não custa nada.">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Escolher o enigma">
        {ENIGMAS.map((x, k) => (
          <button key={x.id} type="button" onClick={() => ir(k)} aria-pressed={k === n} className="botao botao-papel cursor-pointer text-sm">{k + 1}. {x.titulo}</button>
        ))}
      </div>
      <p className="mt-4 leading-relaxed"><strong>{e.linguagem}.</strong> {e.enunciado}</p>
      <ol className="mt-3 border-2 border-ink bg-folha font-mono text-sm" aria-label={`Código em ${e.linguagem}, clique na linha com o erro`}>
        {e.codigo.map((texto, k) => {
          const num = k + 1;
          const ativa = atual.linha === num && passo > 0;
          const escolhida = linha === num;
          return (
            <li key={k} className="flex">
              <button
                type="button"
                onClick={() => !resolvido && setLinha(num)}
                aria-label={`Linha ${num}: ${texto || "em branco"}`}
                aria-pressed={escolhida}
                className={`flex w-full cursor-pointer gap-3 px-2 py-1 text-left hover:bg-ink/10 ${escolhida ? (acertou(e, num) ? "bg-prelo-texto/25" : "bg-ink/20 line-through") : ""} ${ativa ? "outline outline-2 outline-prelo-texto" : ""}`}
              >
                <span aria-hidden="true" className="w-5 shrink-0 text-right text-ink-soft">{num}</span>
                <code className="whitespace-pre-wrap break-all">{texto || " "}</code>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm"><strong>O programa mostra:</strong> <code>{e.saida}</code></p>

      <div className="mt-3 border-2 border-ink p-3">
        <p className="font-sans text-xs font-bold uppercase tracking-[0.1em]">A memória</p>
        {passo === 0 ? <p className="mt-1 text-sm text-ink-soft">Nada ainda. Aperte &quot;Passo a passo&quot;.</p> : (
          <>
            <p className="mt-1 text-xs text-ink-soft">Depois da linha {atual.linha}:</p>
            <ul className="mt-1 font-mono text-sm">{atual.memoria.map((m) => (<li key={m}>{m}</li>))}</ul>
          </>
        )}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setPasso((p) => Math.min(p + 1, e.passos.length))} disabled={passo >= e.passos.length} className="botao cursor-pointer text-sm">Passo a passo</button>
          <button type="button" onClick={() => setPasso(0)} className="botao botao-papel cursor-pointer text-sm">Voltar ao começo</button>
        </div>
      </div>

      {linha !== null ? (
        resolvido ? (
          <Aviso>
            <strong>Achou, é a linha {e.linhaDoErro}. </strong>{e.explicacao}
            <span className="mt-2 block font-mono text-sm whitespace-pre-wrap">Correção: {e.correcao}</span>
            {e.fonte ? <a href={e.fonte.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-sans text-xs underline underline-offset-4">{e.fonte.nome}</a> : null}
          </Aviso>
        ) : (
          <Aviso>A linha {linha} não é a do erro. Use o passo a passo: em que momento o valor da memória deixa de ser o que você esperava?</Aviso>
        )
      ) : null}
      {resolvido && n + 1 < ENIGMAS.length ? <button type="button" onClick={() => ir(n + 1)} className="botao mt-3 cursor-pointer">Próximo enigma</button> : null}
      <Fontes fontes={FONTES_BUG} nota="Os códigos são originais do Instituto, escritos para o jogo. As afirmações sobre a linguagem vêm da documentação citada." />
    </Moldura>
  );
}
