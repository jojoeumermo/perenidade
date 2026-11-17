// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useState } from "react";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { moderacaoDaComunidade } from "@/lib/rede/comunidade-moderacao";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { comReserva } from "@/lib/rede/reserva";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import type { SituacaoNaComunidade } from "@/lib/rede/tipos-comunidades";
import { codigoDoErro } from "../erros";
import { useTextosMod } from "../moderacao/base";
import { botao, botaoClaro, erroCom } from "./util";

// As perguntas e a soneca vêm em pedaços à parte (as perguntas só quando a comunidade pergunta).
const PerguntasParaEntrar = dynamic(() => import("../moderacao/PerguntasParaEntrar").then((m) => m.PerguntasParaEntrar), { ssr: false });
const Soneca = dynamic(() => import("../moderacao/Soneca").then((m) => m.Soneca), { ssr: false });

/**
 * Entrar, pedir para entrar (comunidade restrita), desistir do pedido e sair. Aberta entra na hora; restrita fica pendente até a
 * moderação aceitar e, se a comunidade faz perguntas, o pedido vai com as respostas (que somem quando o pedido é decidido);
 * fechada não tem botão (só por convite, núcleo ou turma). Quem foi banido não vê botão nenhum. Quem tem conta na Rede também
 * põe a comunidade em soneca (1 dia, 1 semana, 1 mês ou até desfazer), sem avisar ninguém.
 */
export function AcoesDaComunidade({
  slug,
  tipo,
  situacao,
  podeEntrar,
  s,
  sc,
  aoMudar,
}: {
  slug: string;
  tipo: "aberta" | "restrita" | "fechada";
  situacao: SituacaoNaComunidade;
  /** Conta na Rede (membro com consentimento): sem isso, só o convite para entrar na Rede. */
  podeEntrar: boolean;
  s: TextosDaRede;
  sc: TextosDeComunidades;
  aoMudar: (situacao: SituacaoNaComunidade) => void;
}) {
  const { lang = "pt" } = useParams<{ lang?: string }>() ?? {};
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [perguntar, setPerguntar] = useState(false);
  const sm = useTextosMod(lang, podeEntrar);

  async function fazer(acao: "entrar" | "sair") {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      // Na prévia (dados de exemplo) nada vai ao banco: a mudança fica só na tela.
      const r = previaDaAlumiaLigada()
        ? { situacao: (acao === "sair" ? null : tipo === "aberta" ? "membro" : "pendente") as SituacaoNaComunidade }
        : acao === "sair"
          ? await comunidades.sair(slug)
          : tipo === "restrita"
            // Restrita: pede pelo caminho das perguntas (sem perguntas, é o mesmo pedido de antes); banco sem a onda 9, o de antes.
            ? await comReserva(() => moderacaoDaComunidade.pedir(slug, []), () => comunidades.entrar(slug))
            : await comunidades.entrar(slug);
      aoMudar(r.situacao);
    } catch (e) {
      if (codigoDoErro(e) === "responda_perguntas") setPerguntar(true);
      else setErro(erroCom(s, sc, e));
    } finally {
      setOcupado(false);
    }
  }

  if (situacao === "banido") return null;
  const a = sc.acao;
  return (
    <div className="mt-3 font-sans">
      {!podeEntrar ? (
        <p className="text-sm text-ink-soft">{a.entrePrimeiro}</p>
      ) : perguntar ? (
        <PerguntasParaEntrar
          slug={slug}
          lang={lang}
          s={s}
          aoPedir={(nova) => {
            setPerguntar(false);
            aoMudar(nova);
          }}
          aoCancelar={() => setPerguntar(false)}
        />
      ) : situacao === "membro" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-soft">{a.membro}</span>
          <button type="button" disabled={ocupado} onClick={() => fazer("sair")} className={botaoClaro}>
            {ocupado ? a.trabalhando : a.sair}
          </button>
        </div>
      ) : situacao === "pendente" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-soft" role="status">{a.pendente}</span>
          <button type="button" disabled={ocupado} onClick={() => fazer("sair")} className={botaoClaro}>
            {ocupado ? a.trabalhando : a.desistir}
          </button>
        </div>
      ) : tipo === "fechada" ? null : (
        <button type="button" disabled={ocupado} onClick={() => fazer("entrar")} className={botao}>
          {ocupado ? a.trabalhando : tipo === "restrita" ? a.pedir : a.entrar}
        </button>
      )}
      {podeEntrar && !perguntar && sm && (
        <div className="mt-2">
          <Soneca lang={lang} s={s} sm={sm} tipo="comunidade" alvo={slug} rotulo={sm.o9.soneca.comunidade} />
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-sm text-oxblood">{erro}</p>}
    </div>
  );
}
