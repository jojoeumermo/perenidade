// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import { type Aula, conferirEducadores, Credencial, type Fala, faixaPreta, provaDaPresenca, Transmissao } from "@/lib/aovivo";
import { BackendError, evaluatePost, hasBackend, rpc, useMe } from "@/lib/backend";
import { type Presente, Sala, temTempoReal, transmitir, useSinal } from "@/lib/tempo-real";
import { lerSalaJitsi } from "@/lib/jitsi";
import { safeLink } from "@/lib/text";
import { JitsiSala } from "../JitsiSala";
import { TocadorYoutube } from "../TocadorYoutube";
import { L, useI18n } from "../I18n";
import { CartaoDeAula, type LiveStrings } from "./Agenda";

const botao = "cursor-pointer bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const vermelho = "cursor-pointer bg-[#c21f16] px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";

const chaveDoNavegador = () => {
  try {
    const guardada = sessionStorage.getItem("lucia:sala-chave");
    if (guardada) return guardada;
    const nova = Math.random().toString(36).slice(2, 12);
    sessionStorage.setItem("lucia:sala-chave", nova);
    return nova;
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
};

function Video({ fluxo, nome, mudo = false, espelho = false, destaque = false }: { fluxo: MediaStream; nome: string; mudo?: boolean; espelho?: boolean; destaque?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== fluxo) ref.current.srcObject = fluxo;
  }, [fluxo]);
  return (
    <figure className={`relative overflow-hidden border-2 border-ink bg-[#17130e] ${destaque ? "aspect-video" : "aspect-video"}`}>
      <video ref={ref} autoPlay playsInline muted={mudo} className={`h-full w-full object-contain ${espelho ? "scale-x-[-1]" : ""}`} />
      <figcaption className="absolute bottom-0 left-0 bg-ink/80 px-2 py-0.5 font-mono text-xs text-parchment">{nome}</figcaption>
    </figure>
  );
}

/** O bate-papo da aula: guardado no banco, lido por todos, falado por quem tem conta. */
function Conversa({ aula, s, conduzo }: { aula: Aula; s: LiveStrings; conduzo: boolean }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [falas, setFalas] = useState<Fala[]>([]);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<"fala" | "pergunta">("fala");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const ultima = useRef<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const hora = new Intl.DateTimeFormat(htmlLang[lang], { hour: "2-digit", minute: "2-digit" });

  const buscar = useCallback(async (tudo = false) => {
    try {
      const novas = await rpc<Fala[]>("aula_chat_listar", { p_aula: aula.id, p_depois: tudo ? null : ultima.current });
      if (novas.length === 0) return;
      setFalas((antes) => {
        const ids = new Set(antes.map((f) => f.id));
        const lista = tudo ? novas : [...antes, ...novas.filter((f) => !ids.has(f.id))];
        return lista.slice(-300);
      });
      ultima.current = novas[novas.length - 1].criado_em;
    } catch {
      // a próxima rodada tenta de novo
    }
  }, [aula.id]);

  useEffect(() => {
    void buscar(true);
    // Sem canal de tempo real, três segundos; com ele, dez (o aviso instantâneo chega pelo canal).
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") void buscar();
    }, temTempoReal ? 10_000 : 3000);
    return () => window.clearInterval(relogio);
  }, [buscar]);
  useSinal(() => void buscar(), ["aula_chat"]);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [falas.length]);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    setOcupado(true);
    setAviso("");
    try {
      const r = await rpc<{ id: string; retido?: boolean; avaliando?: boolean }>("aula_chat_enviar", { p_aula: aula.id, p_corpo: limpo, p_tipo: tipo });
      // Com a segunda avaliação ligada, a fala espera por ela (alguns segundos); em dúvida, vai para a mediação.
      const veredito = r.avaliando ? await evaluatePost("aula_chat", r.id) : "";
      setTexto("");
      if (veredito === "bloquear") setAviso(errorText(t, "conteudo_recusado"));
      else if (r.retido && veredito !== "publicar") setAviso(s.chatHeld);
      else transmitir("aula_chat_enviar", aula.id);
      await buscar(true);
    } catch (erro) {
      setAviso(errorText(t, erro instanceof BackendError ? erro.code : "falha"));
    } finally {
      setOcupado(false);
    }
  }

  async function esconder(fala: Fala) {
    try {
      await rpc("aula_chat_moderar", { p_id: fala.id, p_ocultar: !fala.oculta });
      transmitir("aula_chat_moderar", aula.id);
      setFalas((antes) => antes.map((f) => (f.id === fala.id ? { ...f, oculta: !f.oculta } : f)));
    } catch {
      // nada
    }
  }

  const fechado = aula.status === "encerrada" || aula.status === "cancelada";
  return (
    <section aria-label={s.chat} className="flex min-h-[24rem] flex-col border-2 border-ink bg-parchment">
      <div className="flex-1 space-y-2 overflow-y-auto p-3 [scrollbar-width:thin]" aria-live="polite">
        {falas.length === 0 && <p className="py-8 text-center text-sm text-ink-soft">{s.chatEmpty}</p>}
        {falas.map((fala) =>
          fala.tipo === "sistema" ? (
            <p key={fala.id} className="py-1 text-center font-mono text-xs uppercase tracking-widest text-ink-soft">— {fala.corpo} —</p>
          ) : (
            <div key={fala.id} className={`border-l-2 pl-2 ${fala.tipo === "pergunta" ? "border-gold bg-parchment-deep py-1" : "border-transparent"} ${fala.oculta ? "opacity-40" : ""}`}>
              <p className="text-xs">
                <strong>{fala.nome || "—"}</strong> <span className="text-ink-soft">{hora.format(new Date(fala.criado_em))}</span>
                {fala.tipo === "pergunta" && <span className="ml-1 bg-gold px-1 font-mono text-[0.6rem] uppercase text-ink">{s.question}</span>}
                {fala.retido && <span className="ml-1 border border-oxblood px-1 font-mono text-[0.6rem] uppercase text-oxblood">{s.chatPending}</span>}
                {(conduzo || (me.status === "in" && me.me.id === fala.autor)) && (
                  <button type="button" className="ml-2 cursor-pointer text-ink-soft underline hover:text-oxblood" onClick={() => void esconder(fala)}>{fala.oculta ? s.show : s.hide}</button>
                )}
              </p>
              <p className="whitespace-pre-line break-words text-sm">{fala.corpo}</p>
            </div>
          ),
        )}
        <div ref={fim} />
      </div>
      {fechado ? (
        <p className="border-t border-rule p-3 text-center text-xs text-ink-soft">{s.chatClosed}</p>
      ) : me.status === "in" ? (
        <form className="border-t border-rule p-2" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
          <div className="flex gap-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} placeholder={s.chatPlaceholder} aria-label={s.chat} className="min-w-0 flex-1 border-2 border-ink bg-parchment-deep px-3 py-2 text-sm" />
            <button type="submit" className={botao} disabled={ocupado || !texto.trim()}>{s.send}</button>
          </div>
          <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={tipo === "pergunta"} onChange={(e) => setTipo(e.target.checked ? "pergunta" : "fala")} /> {s.markQuestion}
          </label>
          {aviso && <p role="alert" className="mt-1 text-xs text-oxblood">{aviso}</p>}
        </form>
      ) : (
        <p className="border-t border-rule p-3 text-center text-xs text-ink-soft">
          <L href="/entrar" className="underline hover:text-oxblood">{s.signInToChat}</L>
        </p>
      )}
    </section>
  );
}

/**
 * A sala de uma aula ao vivo. Quem ensina liga a câmera (ou a tela) e o microfone, começa a aula e, no fim, encerra;
 * quem assiste vê o vídeo, levanta a mão e fala no bate-papo. O vídeo vai direto entre os navegadores; o bate-papo
 * fica guardado como registro da aula.
 */
export function SalaDeAula({ s }: { s: LiveStrings }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const id = params.get("aula") ?? "";
  const me = useMe();
  const [aula, setAula] = useState<Aula | null>(null);
  const [erro, setErro] = useState("");
  const [tick, setTick] = useState(0);
  const recarregar = useCallback(() => setTick((n) => n + 1), []);
  useSinal(recarregar, ["aula_ao_vivo"]);

  useEffect(() => {
    if (!hasBackend || !id) return;
    let cancelado = false;
    rpc<Aula | null>("aula_ao_vivo_ver", { p_id: id })
      .then((dados) => {
        if (cancelado) return;
        if (!dados) setErro(t.errors.nao_encontrado);
        else setAula(dados);
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(errorText(t, e instanceof BackendError ? e.code : "falha"));
      });
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 30_000);
    return () => {
      cancelado = true;
      window.clearInterval(relogio);
    };
  }, [id, tick, t, recarregar]);

  if (!hasBackend) return <p className="mt-10 text-lg text-ink-soft">{s.offline}</p>;
  if (erro) return <p role="alert" className="mt-10 text-lg text-oxblood">{erro}</p>;
  if (!aula) return <p className="mt-10 font-mono text-xs text-ink-soft">{t.common.loading}</p>;
  const conduzo = aula.conduzo && me.status === "in";
  return <Dentro key={`${aula.id}-${conduzo}`} aula={aula} s={s} conduzo={conduzo} nome={me.status === "in" ? me.me.nome : ""} recarregar={recarregar} />;
}

function Dentro({ aula, s, conduzo, nome, recarregar }: { aula: Aula; s: LiveStrings; conduzo: boolean; nome: string; recarregar: () => void }) {
  const { t } = useI18n();
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [fluxos, setFluxos] = useState<Record<string, MediaStream>>({});
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [fonte, setFonte] = useState<"camera" | "tela" | "audio">("camera");
  const [mudo, setMudo] = useState(false);
  const [mao, setMao] = useState(false);
  const [aviso, setAviso] = useState("");
  const [canal, setCanal] = useState<"abrindo" | "aberto" | "sem">("abrindo");
  const [gravando, setGravando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const sala = useRef<Sala | null>(null);
  const transmissao = useRef<Transmissao | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const eu = useRef<Presente>({ chave: chaveDoNavegador(), nome: nome || s.someone, papel: conduzo ? "educador" : "aluno" });
  // As chaves de quem conduz, como o banco as conhece agora (a aula é relida a cada 30 s e a cada aviso da sala).
  const chaves = useRef<string[] | undefined>(aula.chaves);
  const ultimaLista = useRef<Presente[]>([]);

  /**
   * Confere quem diz conduzir (chave registrada no banco e presença assinada) antes de mostrar e de pedir o vídeo. Quem diz
   * conduzir sem a assinatura conferir aparece e é tratado como quem assiste: não manda vídeo para ninguém.
   */
  const reconferir = useCallback(async () => {
    const lista = ultimaLista.current;
    const transmissor = transmissao.current;
    if (!transmissor) return;
    const conferidos = await conferirEducadores(aula.id, lista, chaves.current);
    if (transmissao.current !== transmissor) return;
    transmissor.educadores = conferidos;
    const visiveis = chaves.current === undefined ? lista : lista.map((p) => (p.papel === "educador" && p.chave !== eu.current.chave && !conferidos.has(p.chave) ? { ...p, papel: "aluno" as const } : p));
    setPresentes(visiveis);
    await transmissor.aoPresenca(visiveis);
    // Quem assiste pede o vídeo a quem ensina (cobre quem chegou antes de a câmera ligar).
    if (eu.current.papel === "aluno") transmissor.pedir(visiveis.filter((p) => p.papel === "educador"));
  }, [aula.id]);

  useEffect(() => {
    chaves.current = aula.chaves;
    void reconferir();
  }, [aula.chaves, reconferir]);

  // Entra na sala (presença + sinais). O vídeo só liga quando quem ensina aperta o botão.
  useEffect(() => {
    const presente = eu.current;
    const nova = new Sala(
      aula.id,
      presente,
      (de, dados, assinatura) => void transmissao.current?.aoSinal(de, dados, assinatura),
      (lista) => {
        ultimaLista.current = lista;
        void reconferir();
      },
    );
    sala.current = nova;
    transmissao.current = new Transmissao(
      nova,
      presente,
      (de, fluxo) =>
        setFluxos((antes) => {
          const proximo = { ...antes };
          if (fluxo) proximo[de] = fluxo;
          else delete proximo[de];
          return proximo;
        }),
      aula.id,
      // Com o banco que já guarda as chaves da sala, a conferência vale; com o antigo, a sala segue como antes.
      chaves.current !== undefined,
    );
    void nova.entrar().then((ok) => setCanal(ok ? "aberto" : "sem"));
    return () => {
      transmissao.current?.fechar();
      transmissao.current = null;
      nova.sair();
      sala.current = null;
    };
  }, [aula.id, reconferir]);

  // Quem conduz: gera a chave desta aba, registra a parte pública no banco e passa a assinar a presença e os sinais.
  // Sem isso, quem assiste não aceita o vídeo desta aba (é o que impede um estranho de se passar por quem ensina).
  useEffect(() => {
    if (!conduzo || chaves.current === undefined) return;
    let vivo = true;
    void (async () => {
      try {
        const credencial = await Credencial.nova();
        await rpc("aula_ao_vivo_sala_chave", { p_id: aula.id, p_publica: credencial.publica });
        const prova = await credencial.assinar(provaDaPresenca(aula.id, eu.current.chave));
        if (!vivo) return;
        if (transmissao.current) transmissao.current.credencial = credencial;
        eu.current = { ...eu.current, publica: credencial.publica, prova };
        await sala.current?.atualizar({ publica: credencial.publica, prova });
        // As outras abas releem a aula (e as chaves) na hora.
        transmitir("aula_ao_vivo_sala_chave", aula.id);
      } catch (e) {
        if (vivo) setAviso(errorText(t, e instanceof BackendError ? e.code : "falha"));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [aula.id, conduzo, t]);

  async function ligar(modo: "camera" | "tela" | "audio") {
    setAviso("");
    try {
      const microfone = local?.getAudioTracks()[0] ?? (await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })).getAudioTracks()[0];
      let video: MediaStreamTrack;
      if (modo === "camera") video = (await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } })).getVideoTracks()[0];
      else if (modo === "tela") video = (await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false })).getVideoTracks()[0];
      else video = faixaPreta();
      video.onended = () => void ligar("audio");
      if (local && transmissao.current) {
        await transmissao.current.trocarVideo(video);
        setLocal(new MediaStream(transmissao.current.local!.getTracks()));
      } else {
        const fluxo = new MediaStream([microfone, video]);
        if (transmissao.current) transmissao.current.local = fluxo;
        setLocal(fluxo);
        await transmissao.current?.aoPresenca(presentes);
      }
      setFonte(modo);
    } catch {
      setAviso(s.mediaFailed);
    }
  }

  function desligar() {
    transmissao.current?.fechar();
    setLocal(null);
    setFluxos({});
  }

  function alternarMudo() {
    const trilho = local?.getAudioTracks()[0];
    if (!trilho) return;
    trilho.enabled = mudo;
    setMudo(!mudo);
  }

  function gravar() {
    if (!local) return;
    if (gravando) {
      gravador.current?.stop();
      return;
    }
    try {
      const rec = new MediaRecorder(local, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
      pedacos.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && pedacos.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(pedacos.current, { type: "video/webm" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${aula.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 50)}.webm`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        setGravando(false);
      };
      rec.start(2000);
      gravador.current = rec;
      setGravando(true);
    } catch {
      setAviso(s.recordFailed);
    }
  }

  async function estado(status: Aula["status"]) {
    setOcupado(true);
    setAviso("");
    try {
      await rpc("aula_ao_vivo_estado", { p_id: aula.id, p_status: status });
      transmitir("aula_ao_vivo_estado", aula.id);
      recarregar();
    } catch (erro) {
      setAviso(errorText(t, erro instanceof BackendError ? erro.code : "falha"));
    } finally {
      setOcupado(false);
    }
  }

  async function levantarMao() {
    const nova = !mao;
    setMao(nova);
    await sala.current?.atualizar({ mao: nova });
  }

  // A sala do Jitsi (se a aula tem uma no servidor configurado) abre aqui dentro, sem sair do site.
  const jitsi = aula.sala_externa ? lerSalaJitsi(aula.sala_externa) : null;
  const salaJitsi = jitsi?.sala ?? null;
  const [naSala, setNaSala] = useState(false);
  const { lang } = useI18n();
  const educadores = presentes.filter((p) => p.papel === "educador");
  const alunos = presentes.filter((p) => p.papel === "aluno");
  const maos = presentes.filter((p) => p.mao);
  const nomeDe = (chave: string) => presentes.find((p) => p.chave === chave)?.nome ?? s.someone;
  const videos = Object.entries(fluxos);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4">
        <CartaoDeAula aula={aula} s={s} recarregar={recarregar} aberto />

        {aula.status === "cancelada" && <p className="border-2 border-oxblood p-4 font-sans text-sm text-oxblood">{s.cancelled}</p>}
        {aula.status === "encerrada" && (
          <p className="border-2 border-ink p-4 font-sans text-sm">
            {s.ended}
            {aula.gravacao && (
              <>
                {" "}<a href={aula.gravacao} className="underline hover:text-oxblood" target={aula.gravacao.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">{s.watchRecording}</a>
              </>
            )}
          </p>
        )}

        {aula.youtube && (aula.status === "ao_vivo" || aula.status === "agendada") && (
          <section aria-label={s.youtubeLive} className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.youtubeLive}</p>
            <TocadorYoutube id={aula.youtube} titulo={aula.titulo} aoVivo textos={{ assistir: s.youtubeWatch, aviso: s.youtubeNote }} />
          </section>
        )}

        {salaJitsi && aula.status !== "cancelada" && aula.status !== "encerrada" && (
          naSala ? (
            <JitsiSala sala={salaJitsi} servidor={jitsi?.servidor} nome={eu.current.nome} conduzo={conduzo} lang={lang} assunto={aula.titulo} aoSair={() => setNaSala(false)} />
          ) : (
            (conduzo || aula.status === "ao_vivo") && (
              <p>
                <button type="button" className={vermelho} onClick={() => setNaSala(true)}>{conduzo ? "Abrir a sala de vídeo (Jitsi)" : "Entrar na aula (Jitsi)"}</button>
                <span className="ml-3 font-sans text-xs text-ink-soft">Jitsi Meet, código aberto; sem gravação e sem limite de tempo.</span>
              </p>
            )
          )
        )}

        {/* Os vídeos: o meu (quem ensina) e os de quem ensina (quem assiste). */}
        {(local || videos.length > 0) && (
          <div className={`grid gap-3 ${videos.length + (local ? 1 : 0) > 1 ? "sm:grid-cols-2" : ""}`}>
            {local && <Video fluxo={local} nome={`${eu.current.nome} (${s.you})`} mudo espelho={fonte === "camera"} />}
            {videos.map(([chave, fluxo]) => <Video key={chave} fluxo={fluxo} nome={nomeDe(chave)} destaque />)}
          </div>
        )}
        {!local && videos.length === 0 && aula.status !== "encerrada" && aula.status !== "cancelada" && (
          <div className="flex aspect-video flex-col items-center justify-center border-2 border-dashed border-rule bg-parchment-deep p-6 text-center font-sans text-sm text-ink-soft">
            {canal === "sem" ? (
              <p>{s.noChannel}</p>
            ) : conduzo ? (
              <p>{s.hostHint}</p>
            ) : aula.status === "ao_vivo" ? (
              <p>{s.waitingVideo}</p>
            ) : (
              <p>{s.notStarted}</p>
            )}
            {aula.sala_externa && safeLink(aula.sala_externa) && (
              <a href={aula.sala_externa} target="_blank" rel="noopener noreferrer" className={`${botao} mt-4`}>{s.externalRoom} ↗</a>
            )}
          </div>
        )}
        {aula.sala_externa && safeLink(aula.sala_externa) && (local || videos.length > 0) && (
          <p className="font-sans text-xs text-ink-soft">
            <a href={aula.sala_externa} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{s.externalRoom} ↗</a>
          </p>
        )}

        {/* Os controles de quem ensina. */}
        {conduzo && aula.status !== "cancelada" && aula.status !== "encerrada" && (
          <div className="space-y-3 border-2 border-ink bg-parchment-deep p-4 font-sans text-sm">
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.hostControls}</p>
            <div className="flex flex-wrap gap-2">
              {canal === "aberto" ? (
                <>
                  <button type="button" className={fonte === "camera" && local ? botao : claro} onClick={() => void ligar("camera")}>{s.camera}</button>
                  <button type="button" className={fonte === "tela" && local ? botao : claro} onClick={() => void ligar("tela")}>{s.screen}</button>
                  <button type="button" className={fonte === "audio" && local ? botao : claro} onClick={() => void ligar("audio")}>{s.audioOnly}</button>
                  {local && <button type="button" className={claro} onClick={alternarMudo}>{mudo ? s.unmute : s.mute}</button>}
                  {local && <button type="button" className={gravando ? vermelho : claro} onClick={gravar}>{gravando ? s.stopRecording : s.record}</button>}
                  {local && <button type="button" className={claro} onClick={desligar}>{s.turnOff}</button>}
                </>
              ) : (
                <p className="text-ink-soft">{canal === "sem" ? s.noChannel : t.common.loading}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
              {aula.status === "agendada" && <button type="button" className={vermelho} disabled={ocupado} onClick={() => void estado("ao_vivo")}>{s.startClass}</button>}
              {aula.status === "ao_vivo" && <button type="button" className={botao} disabled={ocupado} onClick={() => { if (window.confirm(s.confirmEnd)) void estado("encerrada"); }}>{s.endClass}</button>}
            </div>
            <p className="text-xs text-ink-soft">{s.recordHint}</p>
            {maos.length > 0 && (
              <p className="border-l-2 border-gold pl-3">
                ✋ {fill(s.handsRaised, { names: maos.map((p) => p.nome).join(", ") })}
              </p>
            )}
          </div>
        )}

        {!conduzo && aula.status === "ao_vivo" && canal === "aberto" && (
          <p>
            <button type="button" className={mao ? botao : claro} onClick={() => void levantarMao()} aria-pressed={mao}>{mao ? s.lowerHand : s.raiseHand}</button>
          </p>
        )}
        {aviso && <p role="alert" className="font-sans text-sm text-oxblood">{aviso}</p>}
      </div>

      <div className="space-y-4">
        <section className="border border-rule bg-parchment-deep p-3 font-sans text-xs">
          <p className="font-mono uppercase tracking-widest text-gold">{fill(s.inRoom, { n: presentes.length })}</p>
          <ul className="mt-2 space-y-1">
            {educadores.map((p) => <li key={p.chave}><strong>{p.nome}</strong> · {s.teacher}{p.mao && " ✋"}</li>)}
            {alunos.slice(0, 40).map((p) => <li key={p.chave}>{p.nome}{p.mao && " ✋"}</li>)}
            {alunos.length > 40 && <li className="text-ink-soft">+{alunos.length - 40}</li>}
            {presentes.length === 0 && <li className="text-ink-soft">{canal === "sem" ? s.noChannelShort : "…"}</li>}
          </ul>
        </section>
        <Conversa aula={aula} s={s} conduzo={conduzo} />
      </div>
    </div>
  );
}
