// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { escolherVia, modoDaVia, viaAtual, type Modo, type Via } from "@/lib/rede/caixas/vias";
import { mixnetLigada } from "@/lib/rede/mixnet/nym";
import { esquecerNesteAparelho, fecharHistorico, historicoTravado, travarHistorico } from "@/lib/rede/chat-chaveiro";
import { chat, PREVIA_DO_CHAT, type Prazo, type QuemPode, type SituacaoDoChat } from "@/lib/rede/cliente-chat";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import { Aparelhos } from "./Aparelhos";
import { botaoForte, botaoPerigo, erroDoChat } from "./comum";
import { Confirmar } from "./Confirmar";

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
  // A pergunta de "apagar tudo" na janela da Alumia (o confirm() do navegador saiu).
  const [perguntando, setPerguntando] = useState(false);
  // O chat só monta no navegador: a via e o modo (deste aparelho) são lidos direto. A cobertura é sempre ligada (onda R3, 3.3).
  const [modo, setModo] = useState<Modo>(() => modoDaVia());
  const [via, setVia] = useState<Via>(() => viaAtual().via);
  const comMixnet = mixnetLigada();

  async function mudarModo(novo: Modo) {
    setModo(novo);
    if (PREVIA_DO_CHAT) return;
    const r = await escolherVia(novo === "rapido" ? "tor" : "mixnet");
    setVia(r.via);
  }

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
    if (ocupado) return;
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
        <p className="font-semibold">{t.ajustes.cobertura}</p>
        <p className="mt-1 text-ink-soft">{t.ajustes.coberturaExplica}</p>
      </div>
      <div className="border-t border-rule pt-5">
        <fieldset>
          <legend className="font-semibold">{t.ajustes.via}</legend>
          <p className="mt-1 text-ink-soft">{via === "mixnet" ? t.ajustes.viaMixnet : via === "tor" ? t.ajustes.viaTor : t.ajustes.viaDireta}</p>
          {(["padrao", "rapido"] as const).map((m) => (
            <label key={m} className="mt-1 flex min-h-11 items-center gap-2">
              <input type="radio" name="chat-via" value={m} checked={modo === m} disabled={!comMixnet} onChange={() => void mudarModo(m)} />
              {m === "padrao" ? t.ajustes.modoPadrao : t.ajustes.modoRapido}
            </label>
          ))}
          <p className="mt-1 text-ink-soft">{t.ajustes.modoRapidoExplica}</p>
          {!comMixnet && <p className="mt-1 text-ink-soft">{t.ajustes.mixnetDesligada}</p>}
        </fieldset>
      </div>
      <div className="border-t border-rule pt-5">
        <Aparelhos t={t} s={s} conta={situacao.eu} codinome={situacao.codinome ?? null} modo="ligado" />
      </div>
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
        <button type="button" disabled={ocupado} onClick={() => setPerguntando(true)} className={`${botaoPerigo} mt-3`}>{t.ajustes.apagarTudo}</button>
        <p className="mt-4 text-ink-soft">{t.ajustes.sairRapido}</p>
      </div>
      <Confirmar
        pedido={perguntando ? { pergunta: t.ajustes.apagarTudoConfirma, sim: t.ajustes.apagarTudo, fazer: () => void apagarTudo() } : null}
        nao={t.confirmar.nao}
        aoFechar={() => setPerguntando(false)}
      />
    </div>
  );
}
