// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { conversa } from "@/lib/rede/cliente-conversa";
import { faltaFuncaoNoBanco } from "@/lib/rede/reserva";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { NotasDoPost } from "@/lib/rede/tipos-b1";
import type { Situacao } from "@/lib/rede/tipos";
import { Contador, erroDaB1, quandoCurto, useTextosB1 } from "../b1/base";
import { codigoDoErro } from "../erros";
import { previa } from "./base3";

/** Na prévia (sem banco): nenhuma nota, e a pessoa pode propor e avaliar, para ver o formulário. */
const NOTAS_DA_PREVIA: NotasDoPost = { mostradas: [], para_avaliar: [], minha: null, pode_propor: true, pode_avaliar: true, modera: false, ocultas: null };

/**
 * As notas de contexto de um post (ALUMIA-FUNCOES-E-IDEIAS, Onda B, F3): a que aparece, com a fonte, logo abaixo do post; a regra
 * inteira a um toque ("Como funciona"); para quem tem nível, as propostas para avaliar ("ajuda" / "não ajuda") e o formulário de
 * propor. Quem propôs e quem avaliou nunca aparecem (LGPD art. 11), e nenhum aviso vai a quem interagiu com o post.
 */
export function NotasDeContexto({ post, lang, s, situacao, aoAvisar }: { post: string; lang: string; s: TextosDaRede; situacao: Situacao; aoAvisar: (texto: string, erro?: boolean) => void }) {
  const t = useTextosB1(lang);
  const [dado, setDado] = useState<{ post: string; n: NotasDoPost } | null>(null);
  const [versao, setVersao] = useState(0);
  const [regra, setRegra] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [fonte, setFonte] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nova, setNova] = useState<string | null>(null);
  const idRegra = useId();
  const idForm = useId();
  const caixa = useRef<HTMLTextAreaElement>(null);
  const avisar = useRef(aoAvisar);
  const erroRef = useRef<(e: unknown) => void>(() => {});
  useEffect(() => {
    avisar.current = aoAvisar;
  });

  useEffect(() => {
    let vivo = true;
    (previa() ? Promise.resolve(NOTAS_DA_PREVIA) : conversa.notas(post))
      .then((n) => vivo && setDado({ post, n }))
      // Banco sem a B1, ou post fora do alcance: a seção não aparece, calada (não promete o que não faz). Outro erro (limite,
      // conta suspensa): também não aparece, mas a pessoa fica sabendo o motivo.
      .catch((e) => {
        if (!vivo) return;
        setDado({ post, n: { ...NOTAS_DA_PREVIA, pode_propor: false, pode_avaliar: false } });
        if (!faltaFuncaoNoBanco(e) && codigoDoErro(e) !== "nao_encontrado") erroRef.current(e);
      });
    return () => {
      vivo = false;
    };
  }, [post, versao]);

  useEffect(() => {
    if (escrevendo) caixa.current?.focus();
  }, [escrevendo]);

  const erro = useCallback((e: unknown) => t && avisar.current(erroDaB1(s, t, e), true), [s, t]);
  useEffect(() => {
    erroRef.current = (e) => void erro(e);
  });

  if (!t || !dado || dado.post !== post) return null;
  const n = dado.n;
  const temAlgo = n.mostradas.length > 0 || n.para_avaliar.length > 0 || n.minha || n.pode_propor || (n.ocultas?.length ?? 0) > 0;
  if (!temAlgo) return null;
  const nt = t.notas;

  async function enviar() {
    if (!t) return;
    setOcupado(true);
    try {
      if (!previa()) await conversa.proporNota(post, texto, fonte);
      avisar.current(nt.enviada);
      setEscrevendo(false);
      setTexto("");
      setFonte("");
      if (previa()) setDado({ post, n: { ...n, minha: { id: "previa", texto, fonte, situacao: "proposta" } } });
      else setVersao((v) => v + 1);
    } catch (e) {
      erro(e);
    } finally {
      setOcupado(false);
    }
  }

  async function avaliar(id: string, ajuda: boolean | null) {
    setOcupado(true);
    try {
      const r = previa() ? { minha: ajuda, mostrada: false } : await conversa.avaliarNota(id, ajuda);
      avisar.current(nt.avaliada);
      if (r.mostrada) setNova(id);
      setDado({ post, n: { ...n, para_avaliar: n.para_avaliar.map((x) => (x.id === id ? { ...x, minha: r.minha, mostrada: r.mostrada } : x)) } });
      if (r.mostrada && !previa()) setVersao((v) => v + 1);
    } catch (e) {
      erro(e);
    } finally {
      setOcupado(false);
    }
  }

  async function retirar() {
    if (!n.minha) return;
    setOcupado(true);
    try {
      if (!previa()) await conversa.retirarNota(n.minha.id);
      avisar.current(nt.retirada);
      if (previa()) setDado({ post, n: { ...n, minha: null } });
      else setVersao((v) => v + 1);
    } catch (e) {
      erro(e);
    } finally {
      setOcupado(false);
    }
  }

  async function moderar(id: string, ocultar: boolean) {
    setOcupado(true);
    try {
      await conversa.ocultarNota(id, ocultar);
      setVersao((v) => v + 1);
    } catch (e) {
      erro(e);
    } finally {
      setOcupado(false);
    }
  }

  const fonteOk = /^https?:\/\/[^/@\s]+(\/\S*)?$/i.test(fonte.trim()) && fonte.trim().length >= 10;
  const textoOk = texto.trim().length >= 20 && texto.trim().length <= 500;

  return (
    <section className="al3-secao b1-entra" aria-labelledby={`${idRegra}-t`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${idRegra}-t`} className="al3-cond" style={{ fontSize: "1.25rem", margin: 0 }}>
          {nt.titulo}
        </h2>
        <button type="button" className="b1-link" aria-expanded={regra} aria-controls={idRegra} onClick={() => setRegra((r) => !r)}>
          {nt.verRegra}
        </button>
      </div>
      {regra && (
        <p id={idRegra} className="b1-painel b1-cinza">
          {nt.regra}
        </p>
      )}

      {n.mostradas.map((m) => (
        <article key={m.id} className="b1-cartao b1-nota mt-3" data-nova={nova === m.id ? "" : undefined} aria-label={nt.titulo}>
          <p className="b1-nota-cabeca">
            <IconeContexto />
            {nt.titulo}
          </p>
          <p className="mt-1" style={{ lineHeight: 1.55 }}>{m.texto}</p>
          <p className="b1-nota-fonte">
            <span className="font-bold">{nt.fonte}:</span>
            <a href={m.fonte} target="_blank" rel="noopener noreferrer nofollow ugc">
              {m.fonte.replace(/^https?:\/\//, "").slice(0, 80)}
            </a>
          </p>
          <p className="b1-cinza mt-1">
            <time dateTime={m.criado_em}>{quandoCurto(lang, m.criado_em)}</time>
          </p>
        </article>
      ))}

      {n.minha && (
        <div className="b1-cartao mt-3">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {nt.minha}
            <span className="b1-selo">{nt.situacao[n.minha.situacao]}</span>
          </p>
          <p className="mt-1">{n.minha.texto}</p>
          {n.minha.situacao !== "oculta" && (
            <div className="b1-botoes">
              <button
                type="button"
                className="b1-botao"
                onClick={() => {
                  setTexto(n.minha?.texto ?? "");
                  setFonte(n.minha?.fonte ?? "");
                  setEscrevendo(true);
                }}
              >
                {nt.reescrever}
              </button>
              <button type="button" className="b1-botao" disabled={ocupado} onClick={() => void retirar()}>
                {nt.retirar}
              </button>
            </div>
          )}
        </div>
      )}

      {n.para_avaliar.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold">{nt.avaliarTitulo}</h3>
          <p className="b1-cinza">{nt.avaliarDica}</p>
          {n.para_avaliar.map((x) => (
            <div key={x.id} className="b1-cartao mt-2" role="group" aria-label={x.texto.slice(0, 60)}>
              <p style={{ lineHeight: 1.55 }}>{x.texto}</p>
              <p className="b1-nota-fonte">
                <span className="font-bold">{nt.fonte}:</span>
                <a href={x.fonte} target="_blank" rel="noopener noreferrer nofollow ugc">
                  {x.fonte.replace(/^https?:\/\//, "").slice(0, 80)}
                </a>
              </p>
              {x.mostrada && <p className="b1-cinza mt-1">{nt.jaAparece}</p>}
              <div className="b1-botoes">
                <button type="button" className="b1-botao" aria-pressed={x.minha === true} disabled={ocupado} onClick={() => void avaliar(x.id, x.minha === true ? null : true)}>
                  {nt.ajuda}
                </button>
                <button type="button" className="b1-botao" aria-pressed={x.minha === false} disabled={ocupado} onClick={() => void avaliar(x.id, x.minha === false ? null : false)}>
                  {nt.naoAjuda}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {n.modera && (n.mostradas.length > 0 || (n.ocultas?.length ?? 0) > 0) && (
        <details className="mt-4">
          <summary className="b1-link" style={{ display: "inline-flex", alignItems: "center" }}>{nt.ocultas}</summary>
          {n.mostradas.map((m) => (
            <div key={m.id} className="b1-cartao mt-2">
              <p>{m.texto}</p>
              <button type="button" className="b1-botao mt-2" disabled={ocupado} onClick={() => void moderar(m.id, true)}>
                {nt.ocultar}
              </button>
            </div>
          ))}
          {(n.ocultas ?? []).map((m) => (
            <div key={m.id} className="b1-cartao mt-2">
              <p>{m.texto}</p>
              <button type="button" className="b1-botao mt-2" disabled={ocupado} onClick={() => void moderar(m.id, false)}>
                {nt.devolver}
              </button>
            </div>
          ))}
        </details>
      )}

      {situacao.logado && n.pode_propor && !escrevendo && !n.minha && (
        <button type="button" className="b1-botao mt-3" aria-expanded={false} aria-controls={idForm} onClick={() => setEscrevendo(true)}>
          {nt.propor}
        </button>
      )}
      {situacao.logado && !n.pode_propor && !n.pode_avaliar && !n.minha && <p className="b1-cinza mt-2">{nt.nivel}</p>}

      {escrevendo && (
        <form
          id={idForm}
          className="b1-painel"
          onSubmit={(e) => {
            e.preventDefault();
            if (textoOk && fonteOk) void enviar();
          }}
        >
          <label className="b1-rotulo" htmlFor={`${idForm}-texto`}>{nt.textoRotulo}</label>
          <textarea ref={caixa} id={`${idForm}-texto`} className="b1-area" maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} required minLength={20} />
          <Contador n={texto.length} max={500} modelo={nt.contador} />
          <label className="b1-rotulo" htmlFor={`${idForm}-fonte`}>{nt.fonteRotulo}</label>
          <input id={`${idForm}-fonte`} className="b1-campo" type="url" inputMode="url" maxLength={500} value={fonte} onChange={(e) => setFonte(e.target.value)} required placeholder="https://" />
          <p className="b1-cinza mt-2">{nt.regra}</p>
          <div className="b1-botoes">
            <button type="submit" className="b1-botao" data-cheio="" disabled={ocupado || !textoOk || !fonteOk}>
              {nt.enviar}
            </button>
            <button type="button" className="b1-botao" onClick={() => setEscrevendo(false)}>
              {nt.cancelar}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function IconeContexto() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M12 8.5v3M12 13.8v.2" />
    </svg>
  );
}
