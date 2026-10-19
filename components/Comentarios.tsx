// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { BackendError, evaluatePost, hasBackend, rpc, useMe } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import { temTempoReal, transmitir, useSinal } from "@/lib/tempo-real";
import { L, useI18n } from "./I18n";

type S = Dict["videoLessons"]["comments"];

interface Comentario {
  id: string;
  corpo: string;
  pai: string | null;
  criado_em: string;
  retido: boolean;
  oculto: boolean;
  autor: string;
  autor_selo: keyof S["badges"] | null;
  meu: boolean;
}

/**
 * Comentários em tempo real de uma aula em vídeo: chegam sozinhos (pelo canal de tempo real, ou a cada poucos
 * segundos), com resposta a um comentário. Tudo passa pela mesma avaliação da Comunidade: o que respeita as regras
 * aparece na hora; o que fica em dúvida espera a mediação (só quem escreveu vê, marcado assim).
 */
export function Comentarios({ videoaula, s }: { videoaula: string; s: S }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const cadastro = useCadastro();
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [texto, setTexto] = useState("");
  const [resposta, setResposta] = useState<{ para: Comentario; texto: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const ultimo = useRef<string | null>(null);
  const quando = new Intl.DateTimeFormat(htmlLang[lang], { dateStyle: "medium", timeStyle: "short" });

  const buscar = useCallback(async (tudo = false) => {
    try {
      const novos = await rpc<Comentario[]>("comentarios_listar", { p_videoaula: videoaula, p_depois: tudo ? null : ultimo.current });
      if (!Array.isArray(novos)) return;
      setLista((antes) => {
        if (tudo || !antes) return novos;
        const ids = new Set(antes.map((c) => c.id));
        return [...antes, ...novos.filter((c) => !ids.has(c.id))];
      });
      if (novos.length) ultimo.current = novos[novos.length - 1].criado_em;
    } catch {
      setLista((antes) => antes ?? []);
    }
  }, [videoaula]);

  useEffect(() => {
    if (!hasBackend) return;
    ultimo.current = null;
    void buscar(true);
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") void buscar();
    }, temTempoReal ? 15_000 : 5000);
    return () => window.clearInterval(relogio);
  }, [buscar]);
  useSinal((sinal) => {
    if (sinal.alvo === videoaula) void buscar();
  }, ["comentario"]);

  async function enviar(corpo: string, pai: string | null) {
    setOcupado(true);
    setAviso("");
    try {
      const r = await rpc<{ id: string; retido: boolean; bloqueado: boolean; avaliando: boolean }>("comentario_enviar", { p_videoaula: videoaula, p_corpo: corpo, p_pai: pai });
      const veredito = r.avaliando ? await evaluatePost("comentario", r.id) : "";
      if (r.bloqueado || veredito === "bloquear") {
        setAviso(errorText(t, "conteudo_recusado"));
        return false;
      }
      if (r.retido && veredito !== "publicar") setAviso(s.held);
      else transmitir("comentario", videoaula);
      await buscar(true);
      return true;
    } catch (erro) {
      setAviso(errorText(t, erro instanceof BackendError ? erro.code : "falha"));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function apagar(c: Comentario) {
    if (!window.confirm(s.removeConfirm)) return;
    try {
      await rpc("comentario_apagar", { p_id: c.id });
      transmitir("comentario", videoaula);
      await buscar(true);
    } catch (erro) {
      setAviso(errorText(t, erro instanceof BackendError ? erro.code : "falha"));
    }
  }

  if (!hasBackend) return null;
  const logged = me.status === "in";
  const visiveis = (lista ?? []).filter((c) => !c.oculto || c.retido);
  const raiz = visiveis.filter((c) => !c.pai || !visiveis.some((x) => x.id === c.pai));
  const filhas = (id: string) => visiveis.filter((c) => c.pai === id);

  const item = (c: Comentario, resposta_: boolean) => (
    <li key={c.id} className={`py-3 ${resposta_ ? "ml-6 border-l-2 border-rule pl-4" : ""}`}>
      <p className="text-xs text-ink-soft">
        <strong className="text-ink">{c.autor || "—"}</strong>
        {c.autor_selo && <span className="ml-1 border border-gold px-1 font-mono text-[0.6rem] uppercase text-gold">{s.badges[c.autor_selo]}</span>}
        {" · "}<time dateTime={c.criado_em}>{quando.format(new Date(c.criado_em))}</time>
        {c.retido && <span className="ml-1 border border-oxblood px-1 font-mono text-[0.6rem] uppercase text-oxblood">{s.pending}</span>}
      </p>
      <p className="mt-1 whitespace-pre-line break-words">{c.corpo}</p>
      <p className="mt-1 flex gap-3 text-xs">
        {logged && !resposta_ && !c.retido && <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setResposta({ para: c, texto: "" })}>{s.reply}</button>}
        {c.meu && <button type="button" className="cursor-pointer text-ink-soft underline hover:text-oxblood" onClick={() => void apagar(c)}>{s.remove}</button>}
        <L href={`/denunciar?item=${encodeURIComponent(`/videoaulas?v=${videoaula}#comentario-${c.id}`)}`} className="text-ink-soft underline hover:text-oxblood">{t.common.report}</L>
      </p>
      {resposta?.para.id === c.id && (
        <form
          className="mt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await enviar(resposta.texto, c.id)) setResposta(null);
          }}
        >
          <label className="block text-xs text-ink-soft">
            {fill(s.replyingTo, { nome: c.autor || "—" })}
            <textarea value={resposta.texto} onChange={(e) => setResposta({ ...resposta, texto: e.target.value })} rows={2} maxLength={1000} required minLength={2} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 text-sm" autoFocus />
          </label>
          <p className="mt-1 flex gap-3">
            <button type="submit" disabled={ocupado} className="cursor-pointer bg-ink px-3 py-1 text-sm font-semibold text-parchment hover:bg-oxblood disabled:opacity-50">{s.send}</button>
            <button type="button" className="cursor-pointer text-sm underline" onClick={() => setResposta(null)}>{s.cancel}</button>
          </p>
        </form>
      )}
      {!resposta_ && filhas(c.id).length > 0 && <ul>{filhas(c.id).map((f) => item(f, true))}</ul>}
    </li>
  );

  return (
    <section className="mt-8 border-t-2 border-ink pt-4 font-sans text-sm" aria-labelledby="comentarios-titulo">
      <h3 id="comentarios-titulo" className="font-serif text-2xl font-semibold">
        {s.title} {lista && <span className="font-mono text-sm text-ink-soft">({visiveis.length})</span>}
      </h3>
      <p className="text-xs text-ink-soft">{s.live}</p>
      {logged ? (
        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await enviar(texto.trim(), null)) setTexto("");
          }}
        >
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1000} required minLength={2} placeholder={s.placeholder} aria-label={s.title} className="w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
          <button type="submit" disabled={ocupado || texto.trim().length < 2} className="mt-2 cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">{s.send}</button>
          <p className="mt-1 text-xs text-ink-soft">{s.rules}</p>
        </form>
      ) : (
        <p className="mt-3 flex flex-wrap gap-x-4">
          <L href="/entrar" className="underline hover:text-oxblood">{s.signIn}</L>
          {cadastro.aberto && <L href="/entrar?criar=1" className="font-medium underline hover:text-oxblood">{s.signUp}</L>}
        </p>
      )}
      {aviso && <p role="status" className="mt-2 text-oxblood">{aviso}</p>}
      {lista === null ? (
        <p className="mt-4 text-ink-soft">…</p>
      ) : visiveis.length === 0 ? (
        <p className="mt-4 text-ink-soft">{s.empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule" aria-live="polite">{raiz.map((c) => item(c, false))}</ul>
      )}
    </section>
  );
}
