// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId } from "react";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { LIMITES_DO_STORY, type FigurinhaTeste } from "@/lib/rede/tipos-stories";
import { preencherStory } from "../stories/usar";
import { PorQueSemNumero } from "../uso/PorQueSemNumero";

type T = TextosDosStories["figurinha"]["teste"];
const LETRAS = ["A", "B", "C", "D"];

/**
 * O teste com resposta certa no visor (P5, A16). Quem vê escolhe uma opção e só então fica sabendo qual era a certa: a resposta vai
 * pelo servidor do site (a marca de "já respondeu"), e a opção, para uma urna sem pessoa. A autora vê a certa e a soma por opção, só
 * a partir de 3 respostas. Ninguém (nem a autora) vê quem respondeu, nem o que cada pessoa respondeu.
 */
export function TesteVer({ f, t, nome, meu, ocupado, aoResponder }: { f: FigurinhaTeste; t: T; nome: string; meu: boolean; ocupado: boolean; aoResponder: (opcao: number) => void }) {
  const id = useId();
  const respondeu = typeof f.minha === "number" || !!f.ja_respondeu;
  const certa = typeof f.certa === "number" ? f.certa : null;
  const total = meu && f.soma ? f.soma.reduce((a, b) => a + b, 0) : 0;
  const mostrarCerta = certa !== null && (meu || respondeu);
  return (
    <div className="al-fg al-fg-enquete al-fg-teste" role="group" aria-labelledby={id}>
      <p className="al-fg-etiqueta al-fg-teste-etiqueta">{t.rotulo}</p>
      <p id={id} className="al-fg-enquete-pergunta">{f.pergunta}</p>
      <div className="al-fg-opcoes al-fg-teste-opcoes">
        {f.opcoes.map((op, i) => {
          const pct = meu && f.soma && total > 0 ? Math.round((f.soma[i] / total) * 100) : undefined;
          const estado = mostrarCerta ? (i === certa ? "certa" : f.minha === i ? "errada" : "outra") : undefined;
          return (
            <button
              key={i}
              type="button"
              className="al-fg-opcao al-fg-teste-opcao"
              data-estado={estado}
              aria-pressed={respondeu && typeof f.minha === "number" ? f.minha === i : undefined}
              disabled={meu || respondeu || ocupado}
              onClick={() => aoResponder(i)}
              style={{ isolation: "isolate" }}
            >
              {pct !== undefined ? <span aria-hidden className="al-fg-opcao-barra" style={{ width: `${pct}%` }} /> : null}
              <span className="al-fg-teste-letra" aria-hidden>
                {LETRAS[i]}
              </span>
              {op}
              {pct !== undefined ? ` · ${pct}%` : ""}
              {estado === "certa" ? <span className="sr-only"> ({t.certa})</span> : estado === "errada" ? <span className="sr-only"> ({t.errada})</span> : null}
            </button>
          );
        })}
      </div>
      <p className="al-fg-nota" aria-live="polite">
        {meu
          ? f.soma
            ? `${preencherStory(t.total, { n: total })} · ${t.notaAutora}`
            : `${t.poucas} ${t.notaAutora}`
          : respondeu
            ? typeof f.minha === "number" && certa !== null
              ? f.minha === certa
                ? t.acertou
                : t.errou
              : t.jaRespondeu
            : preencherStory(t.nota, { nome })}
        {meu && !f.soma ? <PorQueSemNumero motivo="piso" /> : null}
      </p>
    </div>
  );
}

/** O teste no "criar": a pergunta, de 2 a 4 opções e qual é a certa (a autora marca). */
export function TesteEditar({
  pergunta,
  opcoes,
  certa,
  t,
  aoMudar,
}: {
  pergunta: string;
  opcoes: string[];
  certa: number;
  t: T;
  aoMudar: (pergunta: string, opcoes: string[], certa: number) => void;
}) {
  const id = useId();
  const tirar = (i: number) => {
    const novas = opcoes.filter((_, k) => k !== i);
    aoMudar(pergunta, novas, certa === i ? 0 : certa > i ? certa - 1 : certa);
  };
  return (
    <div className="al-fg al-fg-enquete al-fg-teste">
      <p className="al-fg-etiqueta al-fg-teste-etiqueta">{t.rotulo}</p>
      <label htmlFor={id} className="sr-only">
        {t.pergunta}
      </label>
      <input
        id={id}
        className="al-fg-campo al-fg-campo-limpo al-fg-enquete-pergunta"
        style={{ textAlign: "center", width: "100%", fontSize: 16 }}
        value={pergunta}
        maxLength={LIMITES_DO_STORY.pergunta}
        placeholder={t.perguntaVazia}
        onChange={(e) => aoMudar(e.target.value, opcoes, certa)}
      />
      <div className="al-fg-opcoes al-fg-teste-opcoes" role="radiogroup" aria-label={t.qualCerta} style={{ marginTop: 10 }}>
        {opcoes.map((op, i) => (
          <div key={i} className="al-fg-opcao al-fg-teste-opcao" data-estado={i === certa ? "certa" : undefined}>
            <button
              type="button"
              role="radio"
              aria-checked={i === certa}
              className="al-fg-teste-marcar"
              aria-label={preencherStory(t.marcarCerta, { n: i + 1 })}
              onClick={() => aoMudar(pergunta, opcoes, i)}
            >
              {LETRAS[i]}
            </button>
            <label className="al-fg-teste-campo">
              <span className="sr-only">{preencherStory(t.opcao, { n: i + 1 })}</span>
              <input value={op} maxLength={LIMITES_DO_STORY.opcao} placeholder={preencherStory(t.opcao, { n: i + 1 })} onChange={(e) => aoMudar(pergunta, opcoes.map((x, k) => (k === i ? e.target.value : x)), certa)} />
            </label>
            {opcoes.length > 2 ? (
              <button type="button" className="al-fg-teste-tirar" aria-label={preencherStory(t.tirarOpcao, { n: i + 1 })} onClick={() => tirar(i)}>
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {opcoes.length < LIMITES_DO_STORY.opcoesDoTeste ? (
        <button type="button" className="al-fg-teste-mais" onClick={() => aoMudar(pergunta, [...opcoes, ""], certa)}>
          {t.maisOpcao}
        </button>
      ) : null}
      <p className="al-fg-nota">{t.notaCriar}</p>
    </div>
  );
}
