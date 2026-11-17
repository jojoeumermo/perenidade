// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { protecao } from "@/lib/rede/cliente-protecao";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { useProtecaoDoCartao } from "./use-cartao";
import "./protecao.css";

/**
 * O que a proteção pendura embaixo do texto do cartão (encaixe anexosDoCartao):
 *  - a resposta de quem a dona da conversa restringiu: o carimbo "aguardando a dona da conversa" para todos, com a frase certa para
 *    cada um. Quem escreveu lê a própria resposta e sabe que ela aguarda; a dona abre com um toque; para os outros, o texto some
 *    do cartão. A tela não finge nada para ninguém;
 *  - a citação que quem foi citada desvinculou;
 *  - as marcações aprovadas e, para quem foi marcada, aceitar ou recusar ali mesmo.
 */
export default function AnexoDeProtecao({ lang, post, situacao }: ContextoDoEncaixe & { post: Post }) {
  const meuHandle = situacao.handle ?? null;
  const { c, t, renovar } = useProtecaoDoCartao(post.id, lang);
  const [aberta, setAberta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  // A dona e os outros não veem o texto até abrir (a dona) — quem escreveu sempre vê o que escreveu.
  const esconde = c.aguardando && !post.meu && (c.recolhida || (c.dona && !aberta));
  useEffect(() => {
    const cartao = raiz.current?.closest("article");
    const texto = cartao?.querySelector<HTMLElement>(`[id="cw-${post.id}"]`);
    if (!texto) return;
    if (esconde) texto.dataset.ptRecolhida = "1";
    else delete texto.dataset.ptRecolhida;
    return () => {
      delete texto.dataset.ptRecolhida;
    };
  }, [esconde, post.id]);

  if (!t) return <div ref={raiz} hidden />;
  const nada = !c.aguardando && !c.solta && c.marcacoes.length === 0 && c.minha_marcacao !== "pendente";
  if (nada) return <div ref={raiz} hidden />;

  const agir = async (tarefa: () => Promise<unknown>) => {
    setOcupado(true);
    try {
      await tarefa();
      renovar();
    } catch {
      // a tela continua como estava; o próximo carregamento mostra a verdade do banco
    } finally {
      setOcupado(false);
    }
  };

  return (
    // Os toques aqui dentro não abrem o post (o cartão inteiro é clicável).
    <div ref={raiz} className="pt-anexo" onClick={(e) => e.stopPropagation()}>
      {c.aguardando && (
        <div className="pt-aguardando" role="note">
          <div className="pt-aguardando-alto">
            <span className="pt-selo al-cond">{t.cartao.aguardando}</span>
            {c.dona && (
              <>
                <button type="button" className="pt-botao-mini" aria-expanded={aberta} onClick={() => setAberta((x) => !x)}>
                  {aberta ? t.cartao.esconder : t.cartao.mostrar}
                </button>
                <button type="button" className="pt-botao-mini" disabled={ocupado} onClick={() => void agir(() => protecao.liberar(post.id, true))}>
                  {t.cartao.liberar}
                </button>
              </>
            )}
          </div>
          <p>{c.dona ? t.cartao.aguardandoDona : post.meu ? t.cartao.aguardandoAutora : t.cartao.aguardandoOutros}</p>
        </div>
      )}
      {c.solta && <p className="pt-solta">{t.cartao.solta}</p>}
      {c.marcacoes.length > 0 && (
        <p className="pt-marcacoes">
          <span>{t.marcacao.naFoto}:</span>
          {c.marcacoes.map((m) => (
            <span key={m.handle} className="pt-chip" title={m.codinome}>@{m.handle}</span>
          ))}
          {c.minha_marcacao === "aprovada" && meuHandle && (
            <button type="button" className="pt-botao-mini" disabled={ocupado} onClick={() => void agir(() => protecao.tirarMarcacao(post.id, meuHandle))}>
              {t.marcacao.tirarMinha}
            </button>
          )}
        </p>
      )}
      {c.minha_marcacao === "pendente" && (
        <div className="pt-aguardando">
          <p>{t.marcacao.voceFoiMarcada}</p>
          <div className="pt-aguardando-alto">
            <button type="button" className="pt-botao-mini" disabled={ocupado} onClick={() => void agir(() => protecao.decidir(post.id, true))}>{t.marcacao.aceitar}</button>
            <button type="button" className="pt-botao-mini" disabled={ocupado} onClick={() => void agir(() => protecao.decidir(post.id, false))}>{t.marcacao.recusar}</button>
          </div>
        </div>
      )}
    </div>
  );
}

