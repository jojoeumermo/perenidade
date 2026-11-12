// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { esquecerNesteAparelho, fecharHistorico, historicoTravado, travarHistorico } from "@/lib/rede/chat-chaveiro";
import { chat, type Prazo, type QuemPode, type SituacaoDoChat } from "@/lib/rede/cliente-chat";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import { botaoForte, botaoPerigo, erroDoChat } from "./comum";

const QUEM: QuemPode[] = ["pedidos", "seguidos", "ninguem"];
const PRAZOS: Prazo[] = [1, 7, 30];

/** Quem pode me chamar, o prazo padrão das conversas novas e "apagar tudo do chat" (LGPD art. 18, VI). */
export function Ajustes({ t, s, situacao, aoMudar, aoApagarTudo }: { t: TextosDoChat; s: TextosDaRede; situacao: SituacaoDoChat; aoMudar: (nova: SituacaoDoChat) => void; aoApagarTudo: () => Promise<void> }) {
  const [quem, setQuem] = useState<QuemPode>(situacao.quem_pode);
  const [prazo, setPrazo] = useState<Prazo>(situacao.prazo_dias);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [travado, setTravado] = useState(false);
  const [senha, setSenha] = useState("");

  useEffect(() => {
    let vivo = true;
    void historicoTravado(situacao.eu).then((v) => vivo && setTravado(v), () => undefined);
    return () => {
      vivo = false;
    };
  }, [situacao.eu]);

  async function travar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (senha.length < 8) {
      setAviso(t.selado.senhaCurta);
      return;
    }
    setOcupado(true);
    try {
      await travarHistorico(situacao.eu, senha);
      setSenha("");
      setTravado(true);
      setAviso(t.selado.travadoOk);
    } catch (erro) {
      setAviso(erroDoChat(t, s, erro));
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      const r = await chat.prefs(quem, prazo);
      aoMudar({ ...situacao, quem_pode: r.quem_pode, prazo_dias: r.prazo_dias });
      setAviso(t.ajustes.salvo);
    } catch (erro) {
      setAviso(erroDoChat(t, s, erro));
    } finally {
      setOcupado(false);
    }
  }

  async function apagarTudo() {
    if (ocupado || !window.confirm(t.ajustes.apagarTudoConfirma)) return;
    setOcupado(true);
    try {
      await chat.apagarTudo();
      await esquecerNesteAparelho(situacao.eu);
      setAviso(t.ajustes.apagado);
      await aoApagarTudo();
    } catch (erro) {
      setAviso(erroDoChat(t, s, erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-6 px-[18px] py-5 text-sm">
      <form onSubmit={(e) => void salvar(e)} className="space-y-4">
        <fieldset>
          <legend className="font-semibold">{t.ajustes.quemPode}</legend>
          {QUEM.map((q) => (
            <label key={q} className="mt-1 flex min-h-11 items-center gap-2">
              <input type="radio" name="chat-quem-pode" value={q} checked={quem === q} onChange={() => setQuem(q)} />
              {t.ajustes[q]}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{t.ajustes.prazoPadrao}</span>
          <select value={prazo} onChange={(e) => setPrazo(Number(e.target.value) as Prazo)} className="min-h-11 rounded-md border border-rule bg-parchment px-2">
            {PRAZOS.map((d) => (
              <option key={d} value={d}>{d === 1 ? t.acoes.dia : preencher(t.acoes.dias, { n: d })}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={ocupado} className={botaoForte}>{t.ajustes.salvar}</button>
      </form>
      {aviso && <p role="status">{aviso}</p>}
      <div className="border-t border-rule pt-5">
        <p className="font-semibold">{t.selado.travarTitulo}</p>
        <p className="mt-1 text-ink-soft">{t.selado.travarExplica}</p>
        {travado ? (
          <button type="button" className={`${botaoForte} mt-3`} onClick={() => { fecharHistorico(situacao.eu); setAviso(t.selado.trancadoAgora); }}>{t.selado.fecharAgora}</button>
        ) : (
          <form onSubmit={(e) => void travar(e)} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span>{t.selado.senhaDaTrava}</span>
              <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="min-h-11 rounded-md border border-rule bg-parchment px-2" />
            </label>
            <button type="submit" disabled={ocupado} className={botaoForte}>{t.selado.travar}</button>
          </form>
        )}
      </div>
      <div className="border-t border-rule pt-5">
        <p className="text-ink-soft">{t.ajustes.apagarTudoExplica}</p>
        <button type="button" disabled={ocupado} onClick={() => void apagarTudo()} className={`${botaoPerigo} mt-3`}>{t.ajustes.apagarTudo}</button>
        <p className="mt-4 text-ink-soft">{t.ajustes.sairRapido}</p>
      </div>
    </div>
  );
}
