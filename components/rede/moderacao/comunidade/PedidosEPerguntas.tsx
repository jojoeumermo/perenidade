// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { chamarDaModeracao, LIMITES, moderacaoDaComunidade, PREVIA_DA_MODERACAO, type PedidosComRespostas } from "@/lib/rede/comunidade-moderacao";
import { preencher } from "@/lib/rede/preencher";
import { comReserva } from "@/lib/rede/reserva";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { dataCurta, mensagemDeErro } from "../base";

/** Aceitar ou recusar um pedido: na prévia, pelo dublê; fora dela, a função de sempre do banco. */
const decidirPedido = (slug: string, usuario: string, aceita: boolean) =>
  PREVIA_DA_MODERACAO
    ? chamarDaModeracao<{ ok: boolean }>("rede_com_decidir_pedido", { p_slug: slug, p_usuario: usuario, p_aceita: aceita })
    : comunidades.decidirPedido(slug, usuario, aceita);

/**
 * Os pedidos para entrar com as respostas de cada pessoa (as respostas somem quando o pedido é decidido) e as perguntas que a
 * comunidade faz (até 3). Só comunidade restrita (com pedido de entrada) faz perguntas.
 */
export function PedidosEPerguntas({ slug, lang, s, sm, restrita, aoMudar }: { slug: string; lang: string; s: Pick<TextosDaRede, "erros">; sm: TextosDaModeracao; restrita: boolean; aoMudar?: () => void }) {
  const tp = sm.o9.pedidos;
  const tq = sm.o9.perguntas;
  const [dado, setDado] = useState<PedidosComRespostas | null>(null);
  const [perguntas, setPerguntas] = useState<string[]>(["", "", ""]);
  const [rodada, setRodada] = useState(0);
  const [aviso, setAviso] = useState<{ onde: "pedidos" | "perguntas"; texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const recarregar = useCallback(() => setRodada((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    // Banco sem a onda 9: os pedidos de antes, sem respostas.
    comReserva(() => moderacaoDaComunidade.pedidos(slug), async () => ({ perguntas: [], itens: (await comunidades.pedidos(slug)).itens.map((p) => ({ ...p, respostas: [] })) }))
      .then((d) => {
        if (!vivo) return;
        setDado(d);
        setPerguntas([0, 1, 2].map((i) => d.perguntas[i] ?? ""));
      })
      .catch((e) => vivo && setAviso({ onde: "pedidos", texto: mensagemDeErro(s, sm, e), erro: true }));
    return () => {
      vivo = false;
    };
  }, [slug, rodada, s, sm]);

  async function rodar(onde: "pedidos" | "perguntas", tarefa: () => Promise<string>) {
    if (ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      setAviso({ onde, texto: await tarefa(), erro: false });
    } catch (e) {
      setAviso({ onde, texto: mensagemDeErro(s, sm, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  const mensagem = (onde: "pedidos" | "perguntas") =>
    aviso?.onde === onde && <p className={aviso.erro ? "m9-erro" : "m9-status"} role={aviso.erro ? "alert" : "status"}>{aviso.texto}</p>;

  return (
    <>
      <section className="m9-secao" aria-labelledby={`m9-pedidos-${slug}`}>
        <h3 id={`m9-pedidos-${slug}`} className="m9-secao-titulo m9-cond"><span className="m9-ladrilho" aria-hidden>4</span>{tp.titulo}</h3>
        {!dado ? (
          aviso?.erro ? null : <p className="m9-nota" role="status">{sm.carregando}</p>
        ) : dado.itens.length === 0 ? (
          <p className="m9-vazio">{tp.vazio}</p>
        ) : (
          <ul className="m9-pedidos">
            {dado.itens.map((p) => (
              <li key={p.usuario} className="m9-pedido">
                <div className="m9-pedido-topo">
                  <strong>{p.codinome}</strong>
                  <span className="m9-nota">{dataCurta(p.quando, lang)}</span>
                </div>
                {p.respostas.length > 0 ? (
                  <dl>
                    {p.respostas.map((r, i) => (
                      <div key={i}>
                        <dt>{dado.perguntas[i] ?? preencher(tq.pergunta, { n: i + 1 })}</dt>
                        <dd>{r}</dd>
                      </div>
                    ))}
                  </dl>
                ) : dado.perguntas.length > 0 ? <p className="m9-nota">{tp.semResposta}</p> : null}
                <div className="m9-acoes">
                  <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={ocupado}
                    onClick={() => void rodar("pedidos", async () => { await decidirPedido(slug, p.usuario, true); recarregar(); aoMudar?.(); return tp.aceito; })}>
                    {tp.aceitar}
                  </button>
                  <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado}
                    onClick={() => void rodar("pedidos", async () => { await decidirPedido(slug, p.usuario, false); recarregar(); aoMudar?.(); return tp.recusado; })}>
                    {tp.recusar}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {mensagem("pedidos")}
      </section>

      <section className="m9-secao" aria-labelledby={`m9-perguntas-${slug}`}>
        <h3 id={`m9-perguntas-${slug}`} className="m9-secao-titulo m9-cond"><span className="m9-ladrilho" aria-hidden>5</span>{tq.titulo}</h3>
        <p className="m9-lead">{restrita ? tq.ajuda : tq.soRestrita}</p>
        {restrita && (
          <>
            <div className="m9-campos">
              {perguntas.map((q, i) => (
                <label key={i} className="m9-campo">
                  {preencher(tq.pergunta, { n: i + 1 })}
                  <input value={q} maxLength={LIMITES.perguntaMax} onChange={(e) => setPerguntas((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                </label>
              ))}
            </div>
            <div className="m9-acoes">
              <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={ocupado}
                onClick={() => void rodar("perguntas", async () => { await moderacaoDaComunidade.salvarPerguntas(slug, perguntas.map((x) => x.trim()).filter(Boolean)); recarregar(); return tq.salvo; })}>
                {tq.salvar}
              </button>
            </div>
            {mensagem("perguntas")}
          </>
        )}
      </section>
    </>
  );
}
