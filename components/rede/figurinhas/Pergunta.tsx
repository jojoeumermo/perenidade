// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { LIMITES_DO_STORY } from "@/lib/rede/tipos-stories";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["figurinha"]["pergunta"];

/**
 * A figurinha de pergunta no visor: a resposta vai SÓ para a autora (como a resposta ao story) e some com ele. A autora vê a própria
 * pergunta sem campo (as respostas chegam nos avisos dela).
 */
export function PerguntaVer({ texto, t, nome, meu, enviar, aoFoco }: { texto: string; t: T; nome: string; meu: boolean; enviar: (resposta: string) => Promise<boolean>; aoFoco: (dentro: boolean) => void }) {
  const id = useId();
  const [resposta, setResposta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  return (
    <form
      className="al-fg al-fg-papel al-fg-torto-dir"
      aria-labelledby={id}
      onSubmit={async (e) => {
        e.preventDefault();
        const r = resposta.trim();
        if (!r || ocupado) return;
        setOcupado(true);
        if (await enviar(r)) setResposta("");
        setOcupado(false);
      }}
    >
      <p className="al-fg-etiqueta">{t.rotulo}</p>
      <p id={id} className="al-fg-pergunta-texto">{texto}</p>
      {meu ? (
        <p className="al-fg-campo" style={{ display: "flex", alignItems: "center" }}>{t.soParaVoce}</p>
      ) : (
        <>
          <label htmlFor={`${id}-r`} className="sr-only">{t.responder}</label>
          <input
            id={`${id}-r`}
            className="al-fg-campo"
            value={resposta}
            maxLength={LIMITES_DO_STORY.resposta}
            placeholder={preencherStory(t.soParaAutora, { nome })}
            disabled={ocupado}
            enterKeyHint="send"
            autoComplete="off"
            onChange={(e) => setResposta(e.target.value)}
            onFocus={() => aoFoco(true)}
            onBlur={() => aoFoco(false)}
          />
        </>
      )}
    </form>
  );
}

/** A figurinha de pergunta no "criar" (prancha celular-criar-story): a pessoa escreve a pergunta; o campo mostra a regra. */
export function PerguntaEditar({ texto, t, aoMudar }: { texto: string; t: T; aoMudar: (texto: string) => void }) {
  const id = useId();
  return (
    <div className="al-fg al-fg-papel al-fg-torto-dir">
      <p className="al-fg-etiqueta" aria-hidden>{t.rotulo}</p>
      <label htmlFor={id} className="sr-only">{t.rotulo}</label>
      <textarea
        id={id}
        className="al-fg-campo al-fg-campo-limpo al-fg-pergunta-texto"
        rows={2}
        style={{ resize: "none", width: "100%" }}
        value={texto}
        maxLength={LIMITES_DO_STORY.pergunta}
        placeholder={t.vazio}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <p className="al-fg-campo" aria-hidden style={{ display: "flex", alignItems: "center", margin: 0 }}>{t.soParaVoce}</p>
    </div>
  );
}
