// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { b1 } from "@/lib/rede/cliente-b1";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { CaixaDePerguntas as Caixa } from "@/lib/rede/tipos-b1";
import type { Situacao } from "@/lib/rede/tipos";
import { previa } from "../conversa/base3";
import { Contador, erroDaB1, quandoCurto, useTextosB1 } from "./base";

const CAIXA_DA_PREVIA: Caixa = {
  existe: true, aberta: true, anonimas: true, chamada: "", cuida: false, pode_perguntar: true, pode_anonima: true,
  respondidas: [{ id: "p1", texto: "Como funciona a assembleia?", resposta: "Toda terça, às 19h, aberta a quem é da comunidade.", respondida_em: new Date().toISOString(), quem: null, minha: false }],
  minhas: [], fila: null,
};

/**
 * "Pergunte a…" (Onda B, F3): a caixa de perguntas de uma pessoa (alvo.handle) ou de uma comunidade (alvo.slug). Fila por ordem
 * de chegada; anônima só para nível 1 ou mais e quando a caixa aceita; nenhuma pergunta com dado pessoal (o banco confere). Quem
 * perguntou só aparece se quis; quem respondeu pela comunidade nunca aparece. Quem cuida vê a fila, responde, recusa e ajusta.
 */
export function CaixaDePerguntas({ alvo, nome, lang, s, situacao, aoAvisar }: { alvo: { handle?: string; slug?: string }; nome: string; lang: string; s: TextosDaRede; situacao: Situacao; aoAvisar: (texto: string, erro?: boolean) => void }) {
  const t = useTextosB1(lang);
  const [estado, setEstado] = useState<{ chave: string; caixa: Caixa | null; erro: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [texto, setTexto] = useState("");
  const [anonima, setAnonima] = useState(false);
  const [mostrarNome, setMostrarNome] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [ajustes, setAjustes] = useState<{ aberta: boolean; anonimas: boolean; chamada: string } | null>(null);
  const id = useId();
  const chave = `${alvo.handle ?? ""}:${alvo.slug ?? ""}:${versao}`;

  useEffect(() => {
    if (!t) return;
    let vivo = true;
    (previa() ? Promise.resolve(CAIXA_DA_PREVIA) : b1.caixa(alvo))
      .then((c) => vivo && setEstado({ chave, caixa: c, erro: "" }))
      .catch((e) => vivo && setEstado({ chave, caixa: null, erro: erroDaB1(s, t, e) }));
    return () => {
      vivo = false;
    };
    // alvo vem novo a cada desenho: a chave já diz quando mudou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, s, t]);

  if (!t || !estado) return <p role="status" className="al3-vazio">{s.estados.carregando}</p>;
  const p = t.perguntas;
  if (!estado.caixa) return <p role="alert" className="al3-vazio">{estado.erro}</p>;
  const c = estado.caixa;
  const titulo = alvo.slug ? p.tituloComunidade : preencher(p.titulo, { quem: nome });

  async function fazer(acao: () => Promise<unknown>, ok: string) {
    if (!t) return;
    setOcupado(true);
    try {
      if (!previa()) await acao();
      aoAvisar(ok);
      setVersao((v) => v + 1);
      return true;
    } catch (e) {
      aoAvisar(erroDaB1(s, t, e), true);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="al3-secao b1-entra">
      <h2 className="al3-cond">{titulo}</h2>
      {c.chamada && <p className="mt-1 font-bold">{c.chamada}</p>}
      <p className="b1-cinza mt-1">{p.regra}</p>

      {!c.aberta && !c.cuida && <p className="al3-vazio">{c.existe ? p.fechada : p.nuncaAberta}</p>}

      {c.pode_perguntar && situacao.logado && (
        <form
          className="b1-cartao mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void fazer(() => b1.perguntar(alvo, texto, anonima, mostrarNome && !anonima), p.enviada).then((ok) => ok && (setTexto(""), setAnonima(false), setMostrarNome(false)));
          }}
        >
          <label className="b1-rotulo" htmlFor={`${id}-q`} style={{ marginTop: 0 }}>{p.textoRotulo}</label>
          <textarea id={`${id}-q`} className="b1-area" maxLength={500} minLength={5} required value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Contador n={texto.length} max={500} modelo={t.notas.contador} />
          {c.pode_anonima && (
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={anonima} onChange={(e) => (setAnonima(e.target.checked), e.target.checked && setMostrarNome(false))} />
              {p.anonima}
            </label>
          )}
          <label className="flex min-h-11 items-center gap-2" data-desligado={anonima ? "" : undefined}>
            <input type="checkbox" className="h-5 w-5" checked={mostrarNome} disabled={anonima} onChange={(e) => setMostrarNome(e.target.checked)} />
            {p.mostrarNome}
          </label>
          <div className="b1-botoes">
            <button type="submit" className="b1-botao" data-cheio="" disabled={ocupado || texto.trim().length < 5}>
              {p.enviar}
            </button>
          </div>
        </form>
      )}

      {c.minhas.length > 0 && (
        <section className="mt-4" aria-labelledby={`${id}-minhas`}>
          <h3 id={`${id}-minhas`} className="font-bold">{p.minhas}</h3>
          <ul className="b1-lista">
            {c.minhas.map((m) => (
              <li key={m.id}>
                <span>{m.texto}</span>
                <button type="button" className="b1-link" disabled={ocupado} onClick={() => void fazer(() => b1.tratarPergunta(m.id, null, true), p.retirada)}>
                  {p.retirar}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.cuida && (
        <section className="b1-painel" aria-labelledby={`${id}-fila`}>
          <h3 id={`${id}-fila`} className="font-bold">{p.fila}</h3>
          {(c.fila ?? []).length === 0 ? (
            <p className="b1-cinza">{p.filaVazia}</p>
          ) : (
            <ol className="b1-lista">
              {(c.fila ?? []).map((q) => (
                <li key={q.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div>
                    <p className="b1-cinza">
                      {q.anonima ? <span className="b1-selo">{p.anonimaSelo}</span> : q.quem ? preencher(p.perguntou, { quem: q.quem }) : p.alguemPerguntou} ·{" "}
                      <time dateTime={q.criado_em}>{quandoCurto(lang, q.criado_em)}</time>
                    </p>
                    <p className="mt-1">{q.texto}</p>
                  </div>
                  {respondendo === q.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void fazer(() => b1.tratarPergunta(q.id, resposta), p.respondida).then((ok) => ok && (setRespondendo(null), setResposta("")));
                      }}
                    >
                      <label className="b1-rotulo" htmlFor={`${id}-r-${q.id}`}>{p.respostaRotulo}</label>
                      <textarea id={`${id}-r-${q.id}`} className="b1-area" maxLength={2000} required autoFocus value={resposta} onChange={(e) => setResposta(e.target.value)} />
                      <div className="b1-botoes">
                        <button type="submit" className="b1-botao" data-cheio="" disabled={ocupado || !resposta.trim()}>
                          {p.publicar}
                        </button>
                        <button type="button" className="b1-botao" onClick={() => setRespondendo(null)}>
                          {t.notas.cancelar}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="b1-botoes">
                      <button type="button" className="b1-botao" onClick={() => (setRespondendo(q.id), setResposta(""))}>
                        {p.responder}
                      </button>
                      <button type="button" className="b1-botao" disabled={ocupado} onClick={() => void fazer(() => b1.tratarPergunta(q.id, null), p.recusada)}>
                        {p.recusar}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          <details className="mt-3" onToggle={(e) => (e.currentTarget.open && !ajustes ? setAjustes({ aberta: c.aberta || !c.existe, anonimas: c.anonimas, chamada: c.chamada }) : undefined)}>
            <summary className="b1-link" style={{ display: "inline-flex", alignItems: "center" }}>{p.ajustes}</summary>
            {ajustes && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void fazer(() => b1.ajustarCaixa(alvo.slug ?? null, ajustes.aberta, ajustes.anonimas, ajustes.chamada), p.ajustesSalvos);
                }}
              >
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={ajustes.aberta} onChange={(e) => setAjustes({ ...ajustes, aberta: e.target.checked })} />
                  {p.abrir}
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={ajustes.anonimas} onChange={(e) => setAjustes({ ...ajustes, anonimas: e.target.checked })} />
                  {p.aceitarAnonimas}
                </label>
                <label className="b1-rotulo" htmlFor={`${id}-ch`}>{p.chamadaRotulo}</label>
                <input id={`${id}-ch`} className="b1-campo" maxLength={140} value={ajustes.chamada} onChange={(e) => setAjustes({ ...ajustes, chamada: e.target.value })} />
                <div className="b1-botoes">
                  <button type="submit" className="b1-botao" data-cheio="" disabled={ocupado}>
                    {p.salvarAjustes}
                  </button>
                </div>
              </form>
            )}
          </details>
        </section>
      )}

      <section className="mt-4" aria-labelledby={`${id}-resp`}>
        <h3 id={`${id}-resp`} className="font-bold">{p.respondidas}</h3>
        {c.respondidas.length === 0 ? (
          <p className="b1-cinza">{p.nenhuma}</p>
        ) : (
          c.respondidas.map((r) => (
            <article key={r.id} className="b1-cartao mt-2">
              <p className="b1-cinza">{r.quem ? preencher(p.perguntou, { quem: r.quem }) : p.alguemPerguntou}</p>
              <p className="mt-1 font-bold">{r.texto}</p>
              <p className="mt-2" style={{ lineHeight: 1.55 }}>{r.resposta}</p>
              <p className="b1-cinza mt-1">
                <time dateTime={r.respondida_em}>{quandoCurto(lang, r.respondida_em)}</time>
              </p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
