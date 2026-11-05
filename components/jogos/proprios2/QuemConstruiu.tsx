// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Aviso, Fontes, Moldura } from "./Base";
import { OBRAS } from "./dados/quem-construiu";

/** Cinco obras, cinco perguntas. Termina: não há pontuação acumulada nem sequência. */
export default function QuemConstruiu() {
  const [i, setI] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [acertos, setAcertos] = useState(0);
  const fim = i >= OBRAS.length;
  const o = OBRAS[Math.min(i, OBRAS.length - 1)];

  const responder = (n: number) => {
    if (escolha !== null) return;
    setEscolha(n);
    if (n === o.certa) setAcertos((a) => a + 1);
  };
  const recomecar = () => {
    setI(0);
    setEscolha(null);
    setAcertos(0);
  };

  return (
    <Moldura titulo="Quem construiu a cidade?" intro="Toda obra famosa tem um nome na placa. Aqui a pergunta é outra: quem a levantou de verdade? Cada resposta vem com a fonte.">
      {fim ? (
        <div>
          <p className="font-serif text-xl">
            Você acertou {acertos} de {OBRAS.length}.
          </p>
          <p className="mt-2 leading-relaxed">Errar aqui faz parte: as respostas certas costumam ser as que o livro de escola não conta. Leia de novo as explicações e as fontes.</p>
          <button type="button" onClick={recomecar} className="botao mt-4 cursor-pointer">
            Jogar de novo
          </button>
        </div>
      ) : (
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">
            Obra {i + 1} de {OBRAS.length} · {o.obra}
          </p>
          <fieldset className="mt-2">
            <legend className="font-serif text-xl leading-snug">{o.pergunta}</legend>
            <div className="mt-3 grid gap-2">
              {o.opcoes.map((texto, n) => {
                const marca = escolha === null ? "" : n === o.certa ? " border-prelo-texto font-semibold" : n === escolha ? " opacity-70 line-through" : " opacity-70";
                return (
                  <button key={texto} type="button" onClick={() => responder(n)} disabled={escolha !== null} aria-pressed={escolha === n} className={`guia-opcao text-left${marca}`}>
                    {texto}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {escolha !== null ? (
            <div>
              <Aviso>
                <strong>{escolha === o.certa ? "Certo. " : "Ainda não. "}</strong>
                {o.explicacao}
              </Aviso>
              <p className="mt-2 font-sans text-xs text-ink-soft">
                Fonte:{" "}
                <a href={o.fonte.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {o.fonte.nome}
                </a>
              </p>
              <button type="button" onClick={() => { setI(i + 1); setEscolha(null); }} className="botao mt-4 cursor-pointer">
                {i + 1 < OBRAS.length ? "Próxima obra" : "Ver o resultado"}
              </button>
            </div>
          ) : null}
        </div>
      )}
      <Fontes fontes={OBRAS.map((x) => x.fonte)} nota="Os textos das fontes vêm da Wikipédia, licenciados em CC BY-SA 4.0; as respostas acima são resumos nossos." />
    </Moldura>
  );
}
