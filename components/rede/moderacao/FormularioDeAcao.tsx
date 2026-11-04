// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { AcaoDeModeracao } from "@/lib/rede/tipos-moderacao";
import { estilo, mensagemDeErro } from "./base";

/**
 * Uma ação de moderação com regra e motivo (o que a pessoa moderada vai ler), com segunda confirmação para o que apaga ou esconde.
 * Serve à denúncia aberta e aos posts retidos. `contexto` é a comunidade, para tirar ou devolver uma pessoa.
 */
export function FormularioDeAcao({
  s, sm, denuncia, alvoTipo, alvo, acoes, contexto, aoFeito,
}: {
  s: TextosDaRede;
  sm: TextosDaModeracao;
  denuncia: string | null;
  alvoTipo: "post" | "perfil";
  alvo: string;
  acoes: AcaoDeModeracao[];
  contexto?: string | null;
  aoFeito: () => void;
}) {
  const [acao, setAcao] = useState<AcaoDeModeracao>(acoes[0]);
  const [regra, setRegra] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const nomes = sm.moderar.acoes as Record<string, string>;
  const grave = acao === "remover" || acao === "reter" || acao === "banir";

  async function aplicar() {
    if (ocupado) return;
    if (grave && !confirmando) {
      setConfirmando(true);
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      await redeMod.agir(denuncia, alvoTipo, alvo, acao, regra.trim(), motivo.trim(), contexto ?? null);
      aoFeito();
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
      setConfirmando(false);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <label className="block text-sm">
        {sm.moderar.acao}
        <select value={acao} onChange={(e) => { setAcao(e.target.value as AcaoDeModeracao); setConfirmando(false); }} className={`${estilo.campo} mt-1`}>
          {acoes.map((a) => <option key={a} value={a}>{nomes[a]}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        {sm.moderar.regra}
        <input value={regra} onChange={(e) => setRegra(e.target.value)} maxLength={80} className={`${estilo.campo} mt-1`} />
      </label>
      <label className="block text-sm">
        {sm.moderar.motivo}
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} rows={3} className={`${estilo.campo} mt-1`} />
      </label>
      <p className="text-xs text-ink-soft">{sm.moderar.sobreOAviso}</p>
      {confirmando && <p role="alert" className="text-sm font-bold">{sm.moderar.confirmeDestrutivo}</p>}
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
      <button type="button" disabled={ocupado || regra.trim().length < 3 || motivo.trim().length < 3} onClick={() => void aplicar()} className={estilo.botaoForte}>
        {ocupado ? sm.moderar.aplicando : confirmando ? sm.confirmar : sm.moderar.aplicar}
      </button>
    </div>
  );
}
