// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";
import { BackendError, getClient, hasBackend, rpc, useMe } from "@/lib/backend";
import { L } from "../I18n";

interface Pauta {
  id: string;
  titulo: string;
  descricao: string;
  votos: number;
  origem: string;
  meu_voto: boolean;
}

interface Pautas {
  votacao: Pauta[];
  escolhidas: { id: string; titulo: string; status: string; episodio: string | null }[];
}

const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const botao = "cursor-pointer bg-ink px-5 py-2.5 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";

const motivo = (erro: unknown, s: Dict["podcast"]) => {
  const codigo = erro instanceof BackendError ? erro.code : "falha";
  if (codigo === "muitos_pedidos") return s.tooMany;
  if (codigo === "conteudo_recusado") return s.refused;
  if (codigo === "envios_pausados") return s.paused;
  return s.failed;
};

function Entrar({ s }: { s: Dict["podcast"] }) {
  return (
    <p className="mt-4 font-sans text-sm">
      <L href="/entrar" className="font-semibold underline hover:text-oxblood">{s.signIn}</L> {s.signInWhy}
    </p>
  );
}

/** Pautas em votação: cada pessoa com conta vota nas que quer ouvir (um voto por pauta) e pode sugerir outras. */
export function VotacaoDePautas({ s }: { s: Dict["podcast"] }) {
  const me = useMe();
  const [dados, setDados] = useState<Pautas | null>(null);
  const [volta, setVolta] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const dentro = me.status === "in";

  useEffect(() => {
    if (!hasBackend) return;
    let cancelado = false;
    rpc<Pautas>("podcast_pautas_publicas")
      .then((valor) => {
        if (!cancelado) setDados(valor);
      })
      .catch(() => {
        if (!cancelado) setDados({ votacao: [], escolhidas: [] });
      });
    return () => {
      cancelado = true;
    };
  }, [volta, me.status]);

  if (!hasBackend || !dados) return null;

  async function votar(pauta: Pauta) {
    setAviso("");
    try {
      await rpc("podcast_pauta_votar", { p_id: pauta.id, p_votar: !pauta.meu_voto });
      setVolta((v) => v + 1);
    } catch (erro) {
      setAviso(motivo(erro, s));
    }
  }

  async function sugerir() {
    setOcupado(true);
    setAviso("");
    try {
      await rpc("podcast_pauta_sugerir", { p_titulo: titulo, p_descricao: descricao });
      setTitulo("");
      setDescricao("");
      setAviso(s.suggested);
    } catch (erro) {
      setAviso(motivo(erro, s));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="pautas" className="border-4 border-ink p-5 sm:p-6">
      <h2 id="pautas" className="font-sans text-2xl font-black uppercase italic leading-none">{s.voteTitle}</h2>
      <p className="mt-2 text-ink-soft">{s.voteLead}</p>
      {dados.votacao.length === 0 && <p className="mt-4 font-sans text-sm text-ink-soft">{s.voteEmpty}</p>}
      <ol className="mt-4 space-y-2">
        {dados.votacao.map((pauta) => (
          <li key={pauta.id} className="flex items-start gap-3 border-b border-rule pb-2" lang="pt-BR">
            <button
              type="button"
              onClick={() => (dentro ? void votar(pauta) : setAviso(s.signInToVote))}
              aria-pressed={pauta.meu_voto}
              aria-label={`${pauta.meu_voto ? s.unvote : s.vote}: ${pauta.titulo}`}
              className={`flex w-14 shrink-0 cursor-pointer flex-col items-center border-2 py-1 font-sans text-xs font-bold ${pauta.meu_voto ? "border-oxblood bg-oxblood text-parchment" : "border-ink hover:border-oxblood hover:text-oxblood"}`}
            >
              <span aria-hidden>▲</span>
              {pauta.votos}
            </button>
            <span>
              <span className="block font-serif text-lg font-semibold leading-snug">{pauta.titulo}</span>
              {pauta.descricao && <span className="block text-sm text-ink-soft">{pauta.descricao}</span>}
            </span>
          </li>
        ))}
      </ol>
      {dados.escolhidas.length > 0 && (
        <>
          <h3 className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-gold">{s.chosen}</h3>
          <ul className="mt-2 space-y-1 font-sans text-sm" lang="pt-BR">
            {dados.escolhidas.map((pauta) => (
              <li key={pauta.id}>
                ★ {pauta.episodio ? <L href={`/podcasts/${pauta.episodio}`} className="underline hover:text-oxblood">{pauta.titulo}</L> : pauta.titulo}
                <span className="text-ink-soft"> · {pauta.status === "gravada" ? s.recorded : s.inProduction}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {dentro ? (
        <form className="mt-6 space-y-3 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void sugerir(); }}>
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-gold">{s.suggestTitle}</h3>
          <label className="block">
            {s.suggestLabel}
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={5} maxLength={140} className={campo} />
          </label>
          <label className="block">
            {s.suggestWhy}
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} rows={2} className={campo} />
          </label>
          <button type="submit" disabled={ocupado || titulo.trim().length < 5} className={botao}>{s.suggest}</button>
        </form>
      ) : (
        <Entrar s={s} />
      )}
      <p role="status" className="mt-2 min-h-5 font-sans text-sm text-oxblood">{aviso}</p>
    </section>
  );
}

/** Grava até 90 segundos pelo microfone do aparelho. */
function useGravador() {
  const [estado, setEstado] = useState<"parado" | "gravando" | "pronto" | "negado">("parado");
  const [segundos, setSegundos] = useState(0);
  const [audio, setAudio] = useState<{ blob: Blob; url: string; ext: string } | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const relogio = useRef(0);

  const parar = useCallback(() => {
    gravador.current?.stop();
    window.clearInterval(relogio.current);
  }, []);

  async function gravar() {
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(fluxo, tipo ? { mimeType: tipo, audioBitsPerSecond: 48000 } : undefined);
      const partes: Blob[] = [];
      rec.ondataavailable = (e) => partes.push(e.data);
      rec.onstop = () => {
        fluxo.getTracks().forEach((faixa) => faixa.stop());
        const mime = (rec.mimeType || tipo || "audio/webm").split(";")[0];
        const blob = new Blob(partes, { type: mime });
        setAudio({ blob, url: URL.createObjectURL(blob), ext: mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm" });
        setEstado("pronto");
      };
      rec.start();
      gravador.current = rec;
      setSegundos(0);
      setEstado("gravando");
      const inicio = Date.now();
      relogio.current = window.setInterval(() => {
        const passados = Math.floor((Date.now() - inicio) / 1000);
        setSegundos(passados);
        if (passados >= 90) parar();
      }, 250);
    } catch {
      setEstado("negado");
    }
  }

  const descartar = () => {
    if (audio) URL.revokeObjectURL(audio.url);
    setAudio(null);
    setEstado("parado");
  };
  useEffect(() => () => window.clearInterval(relogio.current), []);
  return { estado, segundos, audio, gravar, parar, descartar };
}

/** "Pergunte ao podcast": por escrito ou com a própria voz. Só a equipe do podcast lê; as escolhidas vão ao ar. */
export function PergunteAoPodcast({ s, episodio }: { s: Dict["podcast"]; episodio?: string }) {
  const me = useMe();
  const [texto, setTexto] = useState("");
  const [assinatura, setAssinatura] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const gravador = useGravador();
  if (!hasBackend) return null;

  async function enviar() {
    setOcupado(true);
    setAviso("");
    try {
      let caminho = "";
      if (gravador.audio) {
        const supabase = await getClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new BackendError("entre_primeiro");
        caminho = `perguntas/${data.user.id}/p-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}.${gravador.audio.ext}`;
        const { error } = await supabase.storage.from("podcast-producao").upload(caminho, gravador.audio.blob, { contentType: gravador.audio.blob.type || "audio/webm", upsert: false });
        if (error) throw new BackendError("falha");
      }
      await rpc("podcast_perguntar", { p_texto: texto, p_audio: caminho, p_assinatura: assinatura, p_episodio: episodio ?? null });
      setTexto("");
      gravador.descartar();
      setAviso(s.askSent);
    } catch (erro) {
      setAviso(motivo(erro, s));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="pergunte" className="bg-ink p-5 text-parchment sm:p-6">
      <h2 id="pergunte" className="font-sans text-2xl font-black uppercase italic leading-none">{s.askTitle}</h2>
      <p className="mt-2 opacity-85">{s.askLead}</p>
      {me.status !== "in" ? (
        <p className="mt-4 font-sans text-sm">
          <L href="/entrar" className="font-semibold underline hover:text-gold">{s.signIn}</L> {s.signInWhy}
        </p>
      ) : (
        <form className="mt-4 space-y-3 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
          <label className="block">
            {s.askText}
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1500} rows={3} className={`${campo} text-ink`} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {gravador.estado === "gravando" ? (
              <button type="button" onClick={gravador.parar} className="cursor-pointer border-2 border-parchment px-4 py-2 font-semibold">
                <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#e0483d]" />
                {s.stop} · {gravador.segundos}s / 90s
              </button>
            ) : gravador.audio ? (
              <>
                <audio controls src={gravador.audio.url} className="h-10 max-w-full" />
                <button type="button" onClick={gravador.descartar} className="cursor-pointer underline">{s.discard}</button>
              </>
            ) : (
              <button type="button" onClick={() => void gravador.gravar()} className="cursor-pointer border-2 border-parchment px-4 py-2 font-semibold hover:bg-parchment hover:text-ink">
                🎙 {s.record}
              </button>
            )}
            {gravador.estado === "negado" && <span className="text-gold">{s.micDenied}</span>}
          </div>
          <label className="block">
            {s.askSign}
            <input value={assinatura} onChange={(e) => setAssinatura(e.target.value)} maxLength={60} placeholder={s.askSignExample} className={`${campo} text-ink`} />
          </label>
          <button type="submit" disabled={ocupado || gravador.estado === "gravando" || (!texto.trim() && !gravador.audio)} className="cursor-pointer bg-oxblood px-5 py-2.5 font-semibold text-parchment hover:bg-parchment hover:text-ink disabled:cursor-not-allowed disabled:opacity-50">
            {s.askSend}
          </button>
          <p className="text-xs opacity-75">{s.askPrivacy}</p>
        </form>
      )}
      <p role="status" className="mt-2 min-h-5 font-sans text-sm text-gold">{aviso}</p>
    </section>
  );
}
