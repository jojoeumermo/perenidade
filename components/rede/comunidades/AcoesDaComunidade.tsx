// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import type { SituacaoNaComunidade } from "@/lib/rede/tipos-comunidades";
import { botao, botaoClaro, erroCom } from "./util";

/**
 * Entrar, pedir para entrar (comunidade restrita), desistir do pedido e sair. Aberta entra na hora; restrita fica pendente até a
 * moderação aceitar; fechada não tem botão (só por convite, núcleo ou turma). Quem foi banido não vê botão nenhum.
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
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function fazer(acao: "entrar" | "sair") {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const r = await (acao === "entrar" ? comunidades.entrar(slug) : comunidades.sair(slug));
      aoMudar(r.situacao);
    } catch (e) {
      setErro(erroCom(s, sc, e));
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
      {erro && <p role="alert" className="mt-2 text-sm text-oxblood">{erro}</p>}
    </div>
  );
}
