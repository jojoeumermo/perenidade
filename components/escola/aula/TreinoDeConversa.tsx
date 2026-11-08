// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { askAssistant } from "@/lib/backend";
import { preencher } from "@/lib/escola/textos";

interface Fala {
  de: "pessoa" | "assistente";
  texto: string;
}

/** As falas que vão ao assistente: as 8 últimas (o mesmo limite da função, LIMITES_DO_ACOMPANHANTE.itens). */
const ULTIMAS = 8;

function ComNegrito({ texto }: { texto: string }) {
  return (
    <>
      {texto
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p.split("**").map((parte, k) => (k % 2 ? <strong key={k}>{parte}</strong> : parte))}</p>
        ))}
    </>
  );
}

/**
 * Treinar a conversa (prancha Aula): o assistente (supabase/functions/assistente, modo "treino-conversa") faz o papel de
 * alguém que pensa diferente, a partir do argumento da própria aula (o bloco "O outro lado") e do papel do caderno; a
 * pessoa pratica o que a aula ensinou e, quando quiser, pede o retorno, sem nota. A conversa fica SÓ na memória desta
 * aba: fechou, apagou. Antes de começar, o aviso de que o texto vai para um serviço de outra empresa.
 */
export function TreinoDeConversa({ lang, aula, habilidade, papel, trecho, t }: { lang: Locale; aula: string; habilidade: string; papel: string; trecho: string; t: TextosDaFormacao["aula"]["treino"] }) {
  const [aberto, setAberto] = useState(false);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [erro, setErro] = useState("");
  const vez = useRef(0);
  const id = useId();

  async function mandar(pergunta: string, antes: Fala[]) {
    const minha = ++vez.current;
    setEsperando(true);
    setErro("");
    const r = await askAssistant({
      modo: "treino-conversa",
      pergunta,
      disciplina: "formacao-militante",
      idioma: lang,
      aulas: [],
      historico: antes.slice(-ULTIMAS),
      contexto: { aula, trecho, papel },
    });
    if (minha !== vez.current) return;
    setEsperando(false);
    if (r.ok) setFalas((f) => [...f, { de: "assistente", texto: r.texto }]);
    else setErro(r.recusa ? t.recusa : r.erro === "assistente_desligado" ? t.desligado : t.erro);
  }

  const comecar = () => {
    setAberto(true);
    setFalas([]);
    void mandar("", []);
  };

  const responder = (texto: string) => {
    const limpo = texto.trim();
    if (!limpo || esperando) return;
    const antes = falas;
    setFalas([...antes, { de: "pessoa", texto: limpo }]);
    setRascunho("");
    void mandar(limpo, antes);
  };

  const fechar = () => {
    vez.current++;
    setAberto(false);
    setFalas([]);
    setRascunho("");
    setEsperando(false);
    setErro("");
  };

  return (
    <section aria-labelledby={`${id}-t`} className="efa-cartao efa-treino">
      <h2 id={`${id}-t`} className="ef-t">
        {t.titulo}
      </h2>
      <p>{preencher(t.lead, { papel, habilidade })}</p>
      {!aberto ? (
        <button type="button" className="ef-botao-escuro efa-botao-pequeno" onClick={comecar}>
          {t.comecar}
        </button>
      ) : (
        <div className="efa-treino-sala">
          <p className="efa-pequeno">{t.aviso}</p>
          <ol className="efa-falas" aria-live="polite">
            {falas.map((f, i) => (
              <li key={i} data-de={f.de}>
                <span className="efa-quem">{f.de === "pessoa" ? t.voce : t.assistente}</span>
                <ComNegrito texto={f.texto} />
              </li>
            ))}
          </ol>
          <p role="status" className="efa-pequeno">
            {esperando ? t.pensando : erro}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              responder(rascunho);
            }}
          >
            <label htmlFor={`${id}-fala`} className="sr-only">
              {t.rotulo}
            </label>
            <textarea id={`${id}-fala`} rows={3} maxLength={1500} value={rascunho} onChange={(e) => setRascunho(e.target.value)} className="efa-treino-campo" />
            <div className="efa-treino-botoes">
              <button type="submit" className="ef-botao-escuro efa-botao-pequeno" disabled={esperando || !rascunho.trim()}>
                {t.enviar}
              </button>
              <button type="button" className="efa-botao-texto" disabled={esperando || falas.length < 2} onClick={() => responder(t.pedidoRetorno)}>
                {t.retorno}
              </button>
              <button type="button" className="efa-botao-texto" onClick={comecar}>
                {t.recomecar}
              </button>
              <button type="button" className="efa-botao-texto" onClick={fechar}>
                {t.fechar}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
