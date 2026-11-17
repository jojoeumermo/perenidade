// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useRef, useState } from "react";
import Link from "@/components/Link";
import { forum, LIMITES_DO_FORUM, resumoEmUmaLinha, ESTADOS_DO_TOPICO, type EstadoDoTopico, type ForumDaConversa, type TopicoDoForum } from "@/lib/rede/forum-conversa";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoForum } from "@/lib/rede/textos-forum-conversa";
import { enderecos } from "@/lib/rede/tipos";
import { previa } from "../conversa/base3";
import { CarimboDoEstado, erroDoForum } from "./base";
import "./forum.css";

/**
 * O alto da conversa quando ela é um tópico do fórum (onda 10, 10A): o carimbo "Tópico do fórum" com a situação, o resumo de uma
 * linha (de quem abriu ou da moderação: só o papel aparece) e, para quem pode mudar, a situação e o resumo ali mesmo. Diz de onde o
 * tópico veio, se veio de outra conversa, e para onde esta conversa continua. Quando a conversa não é tópico, a autora ou a
 * moderação a levam para o fórum ("Levar para o fórum").
 */
export function NoTopoDoTopico({
  dado,
  trocar,
  lang,
  s,
  tf,
  podeLevar,
  aoLevar,
}: {
  dado: ForumDaConversa;
  trocar: (novo: ForumDaConversa) => void;
  lang: string;
  s: TextosDaRede;
  tf: TextosDoForum;
  podeLevar: boolean;
  aoLevar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [status, setStatus] = useState<{ texto: string; erro?: boolean } | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const botaoResumo = useRef<HTMLButtonElement>(null);
  const id = useId();
  const item = dado.topico ? dado.item : null;
  const daRaiz = dado.continua.filter((c) => c.de === dado.raiz);

  async function mudar(acao: () => Promise<TopicoDoForum>, local: (t: TopicoDoForum) => TopicoDoForum, aviso: (t: TopicoDoForum) => string) {
    if (ocupado || !item) return;
    setOcupado(true);
    setStatus(null);
    try {
      const novo = previa() ? local(item) : await acao();
      trocar({ ...dado, item: novo });
      setStatus({ texto: aviso(novo) });
      return true;
    } catch (e) {
      setStatus({ texto: erroDoForum(tf, s, e), erro: true });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const mudarEstado = (e: EstadoDoTopico) =>
    void mudar(() => forum.estado(dado.raiz, e), (t) => ({ ...t, estado: e }), (t) => preencher(tf.topico.mudou, { estado: tf.estado[t.estado].toLowerCase() }));

  async function salvarResumo(novoTexto: string) {
    const limpo = resumoEmUmaLinha(novoTexto);
    const feito = await mudar(
      () => forum.resumo(dado.raiz, limpo),
      (t) => ({ ...t, resumo: limpo || null, resumo_de: limpo ? (t.meu ? "autora" : "moderacao") : null }),
      (t) => (t.resumo ? tf.resumo.salvo : tf.resumo.tirado),
    );
    if (feito) {
      setEditando(false);
      requestAnimationFrame(() => botaoResumo.current?.focus());
    }
  }

  return (
    <>
      {item && (
        <section className="f10 f10-topo" aria-labelledby={`${id}-t`}>
          <div className="f10-topo-linha">
            <p id={`${id}-t`} className="f10-topo-rotulo f10-cond">{tf.topico.carimbo}</p>
            <CarimboDoEstado estado={item.estado} tf={tf} />
          </div>

          {editando ? (
            <form
              className="f10-resumo-form"
              onSubmit={(e) => {
                e.preventDefault();
                void salvarResumo(texto);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditando(false);
                  requestAnimationFrame(() => botaoResumo.current?.focus());
                }
              }}
            >
              <label className="f10-campo" htmlFor={`${id}-r`}>
                <span>{tf.resumo.campo}</span>
              </label>
              <input
                ref={campo}
                id={`${id}-r`}
                className="f10-resumo-campo"
                value={texto}
                maxLength={LIMITES_DO_FORUM.resumo}
                onChange={(e) => setTexto(e.target.value.replace(/[\r\n]+/g, " "))}
                aria-describedby={`${id}-rd ${id}-rc`}
              />
              <p className="f10-campo-pe">
                <small id={`${id}-rd`}>{tf.resumo.dica}</small>
                <small id={`${id}-rc`} className="f10-conta" aria-live="polite">{preencher(tf.resumo.conta, { n: resumoEmUmaLinha(texto).length })}</small>
              </p>
              <div className="f10-acoes">
                <button type="submit" className="al-botao al-botao-primario al-botao-p" disabled={ocupado}>{tf.resumo.salvar}</button>
                <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setEditando(false)}>{tf.resumo.cancelar}</button>
              </div>
            </form>
          ) : (
            item.resumo && (
              <p className="f10-resumo f10-resumo-g">
                <span className="f10-resumo-de">{item.resumo_de === "moderacao" ? tf.resumo.daModeracao : tf.resumo.daAutora}</span>
                <span className="f10-resumo-texto">{item.resumo}</span>
              </p>
            )
          )}

          {dado.pode_mudar && !editando && (
            <div className="f10-topo-acoes">
              <div className="f10-fichas" role="group" aria-label={tf.topico.situacao}>
                {ESTADOS_DO_TOPICO.map((e) => (
                  <button key={e} type="button" aria-pressed={item.estado === e} disabled={ocupado} title={tf.estado.regra[e]} onClick={() => item.estado !== e && mudarEstado(e)}>
                    {tf.estado[e]}
                  </button>
                ))}
              </div>
              <div className="f10-acoes f10-acoes-justas">
                <button
                  ref={botaoResumo}
                  type="button"
                  className="al-botao al-botao-contorno al-botao-p"
                  onClick={() => {
                    setTexto(item.resumo ?? "");
                    setEditando(true);
                    requestAnimationFrame(() => campo.current?.focus());
                  }}
                >
                  {item.resumo ? tf.resumo.trocar : tf.resumo.escrever}
                </button>
                {item.resumo && (
                  <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={() => void salvarResumo("")}>
                    {tf.resumo.tirar}
                  </button>
                )}
              </div>
            </div>
          )}
          {dado.pode_mudar && <p className="f10-nota">{tf.topico.regraMudar}</p>}

          {dado.veio_de && (
            <p className="f10-veio">
              {tf.topico.veioDe} <Link href={enderecos.post(lang, dado.veio_de)}>{tf.topico.verOriginal}</Link>
            </p>
          )}
          {status && (
            <p className={status.erro ? "f10-erro" : "f10-status"} role={status.erro ? "alert" : "status"}>
              {status.texto}
            </p>
          )}
        </section>
      )}

      {daRaiz.map((c) => (
        <p key={c.topico} className="f10 f10-continua">
          <IconeSeta />
          <span>{tf.topico.continuaEm}:</span> <Link href={enderecos.post(lang, c.topico)}>{c.titulo}</Link>
        </p>
      ))}

      {!item && podeLevar && (
        <p className="f10 f10-levar">
          <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={aoLevar}>
            <IconeSeta />
            {tf.topico.levar}
          </button>
        </p>
      )}
    </>
  );
}

export function IconeSeta() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5v6a4 4 0 0 0 4 4h10M15 11l4 4-4 4" />
    </svg>
  );
}
