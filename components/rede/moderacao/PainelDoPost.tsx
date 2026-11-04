// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import type { Post } from "@/lib/rede/tipos";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { AcaoDeModeracao } from "@/lib/rede/tipos-moderacao";
import { estilo, mensagemDeErro, tempoLento } from "./base";

const SEGUNDOS = [0, 30, 60, 300, 900, 3600];

/**
 * O painel de quem modera, no próprio post (só aparece quando o post diz `modero`): ação com regra e motivo, e modo lento da conversa.
 * Remover e reter pedem uma segunda confirmação na própria página.
 */
export function PainelDoPost({ post, s, sm, aoFechar, aoAgir }: { post: Post; s: TextosDaRede; sm: TextosDaModeracao; aoFechar: () => void; aoAgir?: () => void }) {
  const [acao, setAcao] = useState<AcaoDeModeracao>(post.retido ? "restaurar" : "remover");
  const [regra, setRegra] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [lento, setLento] = useState(0);
  const acoes = sm.moderar.acoes as Record<string, string>;
  const doPost: AcaoDeModeracao[] = ["remover", "reter", "restaurar", post.travado ? "destravar" : "travar", "avisar"];
  const grave = acao === "remover" || acao === "reter";

  async function aplicar() {
    if (ocupado) return;
    if (grave && !confirmando) {
      setConfirmando(true);
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      await redeMod.agir(null, "post", post.id, acao, regra.trim(), motivo.trim());
      setFeito(sm.moderar.feito);
      setConfirmando(false);
      aoAgir?.();
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    } finally {
      setOcupado(false);
    }
  }

  async function mudarLento(segundos: number) {
    setLento(segundos);
    setErro("");
    try {
      await redeMod.modoLento("conversa", post.id, segundos);
      setFeito(sm.moderar.feito);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }

  return (
    <div className={`${estilo.caixa} mt-2 w-full basis-full space-y-3`} role="group" aria-label={sm.moderar.titulo}>
      <p className="font-bold">{sm.moderar.titulo}</p>
      <label className="block text-sm">
        {sm.moderar.acao}
        <select value={acao} onChange={(e) => { setAcao(e.target.value as AcaoDeModeracao); setConfirmando(false); }} className={`${estilo.campo} mt-1`}>
          {doPost.map((a) => <option key={a} value={a}>{acoes[a]}</option>)}
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
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado || regra.trim().length < 3 || motivo.trim().length < 3} onClick={() => void aplicar()} className={estilo.botaoForte}>
          {ocupado ? sm.moderar.aplicando : confirmando ? sm.confirmar : sm.moderar.aplicar}
        </button>
        <button type="button" className={estilo.botao} onClick={aoFechar}>{sm.fechar}</button>
      </div>
      <label className="block text-sm">
        {sm.moderar.modoLento}
        <select value={lento} onChange={(e) => void mudarLento(Number(e.target.value))} className={`${estilo.campo} mt-1`}>
          {SEGUNDOS.map((n) => <option key={n} value={n}>{tempoLento(sm, n)}</option>)}
        </select>
        <span className="text-xs text-ink-soft">{sm.moderar.modoLentoAjuda}</span>
      </label>
      {feito && <p role="status" className="text-sm font-bold">{feito}</p>}
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
    </div>
  );
}
