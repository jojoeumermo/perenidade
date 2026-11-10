// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId } from "react";
import { somaDaEnquete } from "@/lib/rede/stories/visual";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { LIMITES_DO_STORY, type FigurinhaEnquete } from "@/lib/rede/tipos-stories";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["figurinha"]["enquete"];

/**
 * A enquete no visor (prancha celular-ver-story): voto secreto, que não se troca. Quem vota não vê soma nenhuma; a AUTORA vê a soma
 * em porcentagem, e só a partir de 3 votos (PLANO-ALUMIA §6.1; LGPD art. 11: o voto numa rede militante é opinião política).
 * Ninguém, nem a autora, vê quem votou em quê.
 */
export function EnqueteVer({ f, t, nome, meu, ocupado, aoVotar }: { f: FigurinhaEnquete; t: T; nome: string; meu: boolean; ocupado: boolean; aoVotar: (opcao: 0 | 1) => void }) {
  const id = useId();
  const soma = meu ? somaDaEnquete(f.soma) : null;
  const votei = f.meu_voto === 0 || f.meu_voto === 1;
  return (
    <div className="al-fg al-fg-enquete" role="group" aria-labelledby={id}>
      <p id={id} className="al-fg-enquete-pergunta">{f.pergunta}</p>
      <div className="al-fg-opcoes">
        {f.opcoes.map((op, i) => {
          const pct = soma?.pct[i];
          return (
            <button
              key={i}
              type="button"
              className="al-fg-opcao"
              aria-pressed={votei ? f.meu_voto === i : undefined}
              disabled={meu || votei || ocupado}
              onClick={() => aoVotar(i as 0 | 1)}
              style={{ isolation: "isolate" }}
            >
              {pct !== undefined ? <span aria-hidden className="al-fg-opcao-barra" style={{ width: `${pct}%` }} /> : null}
              {op}
              {pct !== undefined ? ` · ${preencherStory(t.soma, { pct })}` : ""}
            </button>
          );
        })}
      </div>
      <p className="al-fg-nota" aria-live="polite">
        {meu ? (soma ? `${preencherStory(t.total, { n: soma.total })} · ${t.notaAutora}` : `${t.poucas} ${t.notaAutora}`) : votei ? t.votou : preencherStory(t.nota, { nome })}
      </p>
    </div>
  );
}

/** A enquete no "criar": a pergunta e as duas opções (começa com "Vou" / "Não dá", como na prancha). */
export function EnqueteEditar({ pergunta, opcoes, t, aoMudar }: { pergunta: string; opcoes: [string, string]; t: T; aoMudar: (pergunta: string, opcoes: [string, string]) => void }) {
  const id = useId();
  return (
    <div className="al-fg al-fg-enquete">
      <label htmlFor={id} className="sr-only">{t.pergunta}</label>
      <input
        id={id}
        className="al-fg-campo al-fg-campo-limpo al-fg-enquete-pergunta"
        style={{ textAlign: "center", width: "100%", fontSize: 16 }}
        value={pergunta}
        maxLength={LIMITES_DO_STORY.pergunta}
        placeholder={t.perguntaVazia}
        onChange={(e) => aoMudar(e.target.value, opcoes)}
      />
      <div className="al-fg-opcoes" style={{ marginTop: 10 }}>
        {opcoes.map((op, i) => (
          <label key={i} className="al-fg-opcao" style={{ display: "grid", placeItems: "center" }}>
            <span className="sr-only">{preencherStory(t.opcao, { n: i + 1 })}</span>
            <input
              value={op}
              maxLength={LIMITES_DO_STORY.opcao}
              onChange={(e) => aoMudar(pergunta, (i === 0 ? [e.target.value, opcoes[1]] : [opcoes[0], e.target.value]) as [string, string])}
            />
          </label>
        ))}
      </div>
      <p className="al-fg-nota">{t.notaAutora}</p>
    </div>
  );
}
