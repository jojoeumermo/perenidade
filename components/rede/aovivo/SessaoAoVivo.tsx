// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { aoVivo } from "@/lib/rede/mapa/cliente";
import { LIMITES_DO_AO_VIVO as L, MOTIVOS_DA_RETIRADA, type MotivoDaRetirada, type PerguntaAoVivo, type SessaoAoVivo, type SessaoComPerguntas } from "@/lib/rede/mapa/tipos";
import { preencher } from "@/lib/rede/preencher";
import type { Situacao } from "@/lib/rede/tipos";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { diaCurto, fraseDoErro, horaCurta } from "../mapa/comum";
import type { TextosDoAoVivo } from "./textos";

type T = TextosDoAoVivo;
const A_CADA = 15_000;

/** O carimbo do momento: no ar (vermelho), marcada, encerrada; convite, recusa e cancelamento para quem cuida. */
export function CarimboDaSessao({ t, s }: { t: T; s: Pick<SessaoAoVivo, "situacao" | "momento"> }) {
  const chave = s.situacao === "marcada" ? s.momento : s.situacao;
  return (
    <span className="av-carimbo" data-tom={chave === "ao_vivo" ? "vermelho" : chave === "encerrada" || s.situacao !== "marcada" ? "apagado" : undefined}>
      {t.momento[chave]}
    </span>
  );
}

/** "Pergunte a Fulana · na comunidade X" e o horário. */
export function CabecaDaSessao({ t, lang, s, nivel = 2 }: { t: T; lang: string; s: SessaoAoVivo; nivel?: 1 | 2 | 3 }) {
  const Titulo = `h${nivel}` as "h1" | "h2" | "h3";
  return (
    <div className="av-cabeca-sessao">
      <div className="av-linha">
        <CarimboDaSessao t={t} s={s} />
        {s.perguntas !== null && <span className="av-miudo">{preencher(t.sessao.perguntas, { n: s.perguntas })}</span>}
      </div>
      <Titulo className="av-titulo-sessao al-cond">{s.titulo}</Titulo>
      <p className="av-quem">
        {preencher(t.sessao.pergunteA, { nome: s.convidada.nome })}
        {s.de.tipo === "comunidade" && <> · {preencher(t.sessao.naComunidade, { nome: s.de.nome })}</>}
      </p>
      <p className="av-miudo">
        <time dateTime={s.inicio}>{preencher(t.sessao.quando, { dia: diaCurto(lang, s.inicio), inicio: horaCurta(lang, s.inicio), fim: horaCurta(lang, s.fim) })}</time>
      </p>
    </div>
  );
}

function RotuloDaPergunta({ t, q }: { t: T; q: PerguntaAoVivo }) {
  if (q.minha) return <>{t.fila.minha}</>;
  return <>{q.quem ? preencher(t.fila.perguntou, { quem: q.quem }) : t.fila.alguem}</>;
}

/**
 * Uma sessão de "Pergunte a…" ao vivo (frente 13B, L1-17). As perguntas aparecem na ordem em que chegaram, numeradas; a da vez é a
 * primeira da fila. A pessoa convidada só responde ou passa a da vez (o banco também barra). Quem cuida retira com um motivo da
 * lista. Ninguém vota. A tela se atualiza a cada 15 s enquanto a sessão não acabou e a aba está à vista.
 */
export function SessaoAoVivoTela({ t, lang, id, situacao }: { t: T; lang: string; id: string; situacao: Situacao }) {
  const [sessao, setSessao] = useState<SessaoComPerguntas | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [vez, setVez] = useState(0);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState("");
  const [mostrarNome, setMostrarNome] = useState(false);
  const [resposta, setResposta] = useState("");
  const [retirando, setRetirando] = useState<{ id: string; motivo: MotivoDaRetirada } | null>(null);
  const uid = useId();

  useEffect(() => {
    let vivo = true;
    aoVivo.sessao(id).then(
      (s) => {
        if (!vivo) return;
        setSessao(s);
        setErro(null);
      },
      (e: unknown) => vivo && setErro(e ?? new Error("falha")),
    );
    return () => {
      vivo = false;
    };
  }, [id, vez]);

  const terminou = sessao?.momento === "encerrada" || (sessao && sessao.situacao !== "marcada" && sessao.situacao !== "convite");
  useEffect(() => {
    if (!sessao || terminou) return;
    const relogio = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") setVez((v) => v + 1);
    }, A_CADA);
    return () => clearInterval(relogio);
  }, [sessao, terminou]);

  const fazer = useCallback(
    async (acao: () => Promise<unknown>, ok: string) => {
      setOcupado(true);
      try {
        await acao();
        setAviso({ texto: ok });
        setVez((v) => v + 1);
        return true;
      } catch (e) {
        setAviso({ texto: fraseDoErro(t.erros, e), erro: true });
        setVez((v) => v + 1);
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [t],
  );

  if (erro && !sessao) {
    return (
      <EstadoDaAlumia erro texto={fraseDoErro(t.erros, erro)}>
        <Botao variante="contorno" onClick={() => setVez((v) => v + 1)}>{t.tentar}</Botao>
      </EstadoDaAlumia>
    );
  }
  if (!sessao) return <p className="av-miudo" role="status">{t.carregando}</p>;

  const daVez = sessao.lista.find((q) => q.id === sessao.vez) ?? null;
  const respondeAgora = sessao.sou_convidada && sessao.situacao === "marcada" && sessao.momento === "ao_vivo";
  const podeCancelar = (sessao.cuida || sessao.sou_convidada) && (sessao.situacao === "marcada" || sessao.situacao === "convite") && sessao.momento !== "encerrada";

  return (
    <article className="av-sessao" aria-labelledby={`${uid}-titulo`}>
      <div id={`${uid}-titulo`}>
        <CabecaDaSessao t={t} lang={lang} s={sessao} nivel={1} />
      </div>
      <p className="av-regra">{t.sessao.regra}</p>
      <p className="av-miudo">{t.sessao.quemPerguntou}</p>
      {sessao.momento === "antes" && sessao.situacao === "marcada" && (
        <p className="av-nota">{preencher(t.sessao.aguarde, { quando: `${diaCurto(lang, sessao.inicio)} · ${horaCurta(lang, sessao.inicio)}` })}</p>
      )}
      {sessao.momento === "encerrada" && <p className="av-nota">{t.sessao.encerrada}</p>}
      <p className="av-aviso" role="status" aria-live="polite" data-erro={aviso?.erro ? "" : undefined}>{aviso?.texto ?? ""}</p>

      <div className="av-colunas">
        <div className="av-principal">
          {sessao.sou_convidada && sessao.situacao === "marcada" && sessao.momento !== "encerrada" && (
            <section className="av-cartao av-responder" aria-labelledby={`${uid}-resp`}>
              <h2 id={`${uid}-resp`} className="av-subtitulo al-cond">{t.responder.titulo}</h2>
              <p className="av-miudo">{t.responder.explica}</p>
              {!respondeAgora ? (
                <p className="av-miudo">{t.responder.antes}</p>
              ) : !daVez ? (
                <p className="av-miudo">{t.responder.nada}</p>
              ) : (
                <form
                  className="av-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void fazer(() => aoVivo.responder(daVez.id, resposta), t.responder.respondida).then((ok) => ok && setResposta(""));
                  }}
                >
                  <blockquote className="av-davez">
                    <span className="av-miudo">
                      <RotuloDaPergunta t={t} q={daVez} />
                    </span>
                    <p>{daVez.texto}</p>
                  </blockquote>
                  <label className="av-campo">
                    <span>{t.responder.rotulo}</span>
                    <textarea maxLength={L.resposta} required value={resposta} onChange={(e) => setResposta(e.target.value)} />
                  </label>
                  <div className="av-acoes">
                    <Botao type="submit" disabled={ocupado || !resposta.trim()}>{t.responder.publicar}</Botao>
                    <Botao variante="contorno" disabled={ocupado} onClick={() => void fazer(() => aoVivo.responder(daVez.id, null), t.responder.passou)}>{t.responder.passar}</Botao>
                  </div>
                </form>
              )}
            </section>
          )}

          <section aria-labelledby={`${uid}-fila`}>
            <h2 id={`${uid}-fila`} className="av-subtitulo al-cond">{t.fila.titulo}</h2>
            {sessao.lista.length === 0 ? (
              <p className="av-miudo">{t.fila.vazia}</p>
            ) : (
              <ol className="av-fila">
                {sessao.lista.map((q, i) => (
                  <li key={q.id} className="av-pergunta" data-situacao={q.situacao} data-vez={q.id === sessao.vez ? "" : undefined}>
                    <span className="av-posicao al-cond" aria-hidden>{preencher(t.fila.posicao, { n: i + 1 })}</span>
                    <div className="av-pergunta-corpo">
                      <p className="av-linha av-miudo">
                        <span className="av-selo" data-situacao={q.situacao}>
                          {q.situacao === "fila" ? (q.id === sessao.vez ? t.fila.daVez : t.fila.esperando) : t.fila[q.situacao]}
                        </span>
                        {q.situacao !== "retirada" && <RotuloDaPergunta t={t} q={q} />}
                        {q.situacao === "retirada" && q.motivo && <span>{t.moderar.motivos[q.motivo]}</span>}
                      </p>
                      {q.texto && <p className="av-pergunta-texto">{q.texto}</p>}
                      {q.resposta && (
                        <div className="av-resposta">
                          <p className="av-miudo">{sessao.convidada.nome}</p>
                          <p>{q.resposta}</p>
                        </div>
                      )}
                      <div className="av-acoes">
                        {q.minha && q.situacao === "fila" && (
                          <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => void fazer(() => aoVivo.retirar(q.id), t.fila.retiradaMinha)}>{t.fila.retirarMinha}</Botao>
                        )}
                        {sessao.cuida && q.situacao !== "retirada" && retirando?.id !== q.id && (
                          <Botao variante="fantasma" tamanho="p" onClick={() => setRetirando({ id: q.id, motivo: "fora_do_tema" })}>{t.moderar.retirar}</Botao>
                        )}
                      </div>
                      {sessao.cuida && retirando?.id === q.id && (
                        <form
                          className="av-retirar"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void fazer(() => aoVivo.retirar(q.id, retirando.motivo), t.moderar.feito).then((ok) => ok && setRetirando(null));
                          }}
                        >
                          <label className="av-campo">
                            <span>{t.moderar.motivo}</span>
                            <select value={retirando.motivo} onChange={(e) => setRetirando({ id: q.id, motivo: e.target.value as MotivoDaRetirada })}>
                              {MOTIVOS_DA_RETIRADA.map((m) => (
                                <option key={m} value={m}>{t.moderar.motivos[m]}</option>
                              ))}
                            </select>
                          </label>
                          <div className="av-acoes">
                            <Botao type="submit" tamanho="p" disabled={ocupado}>{t.moderar.confirmar}</Botao>
                            <Botao variante="fantasma" tamanho="p" onClick={() => setRetirando(null)}>{t.moderar.desistir}</Botao>
                          </div>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="av-lado">
          {sessao.pode_perguntar ? (
            <form
              className="av-cartao av-form"
              onSubmit={(e) => {
                e.preventDefault();
                void fazer(() => aoVivo.perguntar(sessao.id, texto, mostrarNome), t.perguntar.enviada).then((ok) => ok && (setTexto(""), setMostrarNome(false)));
              }}
            >
              <label className="av-campo">
                <span className="av-subtitulo al-cond">{t.perguntar.rotulo}</span>
                <textarea maxLength={L.pergunta} minLength={L.perguntaMin} required value={texto} onChange={(e) => setTexto(e.target.value)} />
              </label>
              <p className="av-miudo" aria-live="polite">{preencher(t.perguntar.contador, { n: texto.length, max: L.pergunta })}</p>
              <label className="av-marcar">
                <input type="checkbox" checked={mostrarNome} onChange={(e) => setMostrarNome(e.target.checked)} />
                {t.perguntar.mostrarNome}
              </label>
              <Botao type="submit" disabled={ocupado || texto.trim().length < L.perguntaMin}>{t.perguntar.enviar}</Botao>
            </form>
          ) : (
            !situacao.logado && sessao.momento !== "encerrada" && <p className="av-cartao av-miudo">{t.perguntar.entrar}</p>
          )}
          {podeCancelar && (
            <Botao
              variante="contorno"
              tamanho="p"
              disabled={ocupado}
              onClick={() => {
                if (window.confirm(t.sessao.cancelarConfirmar)) void fazer(() => aoVivo.cancelar(sessao.id), t.sessao.cancelada);
              }}
            >
              {t.sessao.cancelar}
            </Botao>
          )}
          <Link href={`/${lang}/alumia/mapa/ao-vivo`} className="av-link">{t.voltar}</Link>
        </aside>
      </div>
    </article>
  );
}
