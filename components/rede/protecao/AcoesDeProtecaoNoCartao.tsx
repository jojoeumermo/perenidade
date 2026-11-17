// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { protecao } from "@/lib/rede/cliente-protecao";
import { encher } from "@/lib/rede/textos-protecao";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { useProtecaoDoCartao } from "./use-cartao";
import "./protecao.css";

function Escudo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6z" />
    </svg>
  );
}

/**
 * No menu "mais" do cartão (encaixe acoesDoCartao): restringir ou deixar de restringir quem escreveu; desvincular o meu post de uma
 * citação; recolher de novo uma resposta que eu liberei. Só aparece o que vale para quem está vendo, e só com conta.
 */
export default function AcoesDeProtecaoNoCartao({ lang, post, situacao }: ContextoDoEncaixe & { post: Post }) {
  const { c, t, renovar } = useProtecaoDoCartao(post.id, lang);
  const [confirmar, setConfirmar] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  if (!t || !situacao.logado || !situacao.membro) return null;

  const handle = post.autor.handle;
  // Conta de fora (Fediverso, "nome@servidor") não se restringe por aqui: a regra é da Faixa 2.
  const restringivel = !post.meu && handle !== null && /^[a-z0-9_]{3,20}$/.test(handle) && handle !== situacao.handle;
  const agir = async (tarefa: () => Promise<unknown>, feito: string) => {
    setOcupado(true);
    try {
      await tarefa();
      setNota(feito);
      renovar();
    } catch {
      setNota(t.erro);
    } finally {
      setOcupado(false);
    }
  };
  const parar = (e: React.MouseEvent) => e.stopPropagation();
  const classe = "al2-acao justify-start";

  return (
    <div onClick={parar} className="contents">
      {restringivel && (
        <button type="button" className={classe} disabled={ocupado} onClick={() => void agir(
          () => protecao.restringir(handle as string, !c.restringi),
          encher(c.restringi ? t.restringir.tirou : t.restringir.restringiu, { handle: `@${handle}` }),
        )}>
          <Escudo />
          {encher(c.restringi ? t.cartao.tirarRestricao : t.cartao.restringir, { handle: `@${handle}` })}
        </button>
      )}
      {c.citacao_minha && !confirmar && (
        <button type="button" className={classe} disabled={ocupado} onClick={() => setConfirmar(true)}>
          <Escudo />
          {t.cartao.soltar}
        </button>
      )}
      {c.citacao_minha && confirmar && (
        <div className="pt-aguardando" role="group" aria-label={t.cartao.soltar}>
          <p>{t.cartao.soltarConfirma}</p>
          <div className="pt-aguardando-alto">
            <button type="button" className="pt-botao-mini" disabled={ocupado} onClick={() => void agir(() => protecao.soltarCitacao(post.id), t.cartao.soltou).then(() => setConfirmar(false))}>
              {t.cartao.soltarSim}
            </button>
            <button type="button" className="pt-botao-mini" onClick={() => setConfirmar(false)}>{t.cartao.cancelar}</button>
          </div>
        </div>
      )}
      {c.dona && (
        <button type="button" className={classe} disabled={ocupado} onClick={() => void agir(
          () => protecao.liberar(post.id, !c.liberada),
          c.liberada ? t.cartao.recolheu : t.cartao.liberou,
        )}>
          <Escudo />
          {c.liberada ? t.cartao.recolher : t.cartao.liberar}
        </button>
      )}
      {nota && (
        <p role="status" className="pt-nota" style={{ padding: "0.25rem 0.75rem" }}>
          {nota}
        </p>
      )}
    </div>
  );
}
