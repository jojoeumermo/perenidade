// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A sala de vídeo do painel pelo LiveKit Cloud (Prompt 4, item 141, atrás de "sala-livekit"; quem escolhe entre esta e a do Jitsi é
// components/SalaDeVideo.tsx). As mesmas propriedades da JitsiSala, para os lugares que usam a sala trocarem sem mudar nada em volta.
//   - a entrada: o servidor do site dá um token curto para AQUELA sala, conferindo as regras de hoje (app/api/sala/entrada); o
//     token não leva nome nem e-mail: o nome que o painel já usa é posto aqui, depois de entrar;
//   - quem conduz entra com microfone e câmera; quem assiste (e o estudo em grupo e as turmas) entra calada e sem câmera; na chamada
//     de canal, todo mundo entra falando, com a câmera só se for de vídeo (igual ao Jitsi);
//   - sem gravação, sem transmissão para fora; sem cifra de ponta a ponta do LiveKit nesta entrega (o serviço tem acesso técnico ao
//     áudio e ao vídeo, e a tela diz isso);
//   - serviço fora do ar: o erro e o botão de abrir no Jitsi (enquanto o Jitsi existir).
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getClient, hasSession } from "@/lib/backend";
import { fill } from "@/i18n/config";
import { carregarTextosDaSala, type TextosDaSala } from "@/lib/sala/textos";
import type { LocalParticipant, Participant, Room, Track, TrackPublication } from "livekit-client";
import { Captcha, captchaEnabled, useCaptcha } from "./Captcha";

/** Onde a sala foi aberta: a reunião (e a chamada de canal), o estudo em grupo sem conta, ou a turma do mês e a do curso. */
export type EntradaDaSala = { origem: "reuniao" } | { origem: "estudo" } | { origem: "turma-mes"; mes: string } | { origem: "turma-curso"; mes: string; curso: string };

export interface PropsDaSala {
  sala: string;
  /** Só a JitsiSala usa (o servidor do Jitsi daquela sala). */
  servidor?: string;
  nome: string;
  conduzo: boolean;
  lang: string;
  assunto?: string;
  aoSair?: () => void;
  aoEntrar?: () => void;
  /** Chamada de canal: todo mundo entra falando, com a câmera ligada só se for de vídeo. */
  video?: boolean;
}

type Papel = "conduz" | "assiste" | "canal" | "estudo";
type Fase = { fase: "texto" } | { fase: "desafio" } | { fase: "entrando" } | { fase: "dentro" } | { fase: "erro"; codigo: string };

const SALA_DO_ESTUDO = /^instituto-lucia-estudo-/;

async function sessaoDoPainel(): Promise<string | null> {
  if (!hasSession()) return null;
  try {
    const { data } = await (await getClient()).auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** A faixa de vídeo a mostrar de uma pessoa (a tela compartilhada antes da câmera), se houver e não estiver calada. */
async function faixaDeVideo(p: Participant): Promise<Track | null> {
  const { Track: T } = await import("livekit-client");
  const pubs = [...p.trackPublications.values()];
  const achar = (fonte: string) => pubs.find((x: TrackPublication) => x.source === fonte && x.track && !x.isMuted)?.track ?? null;
  return achar(T.Source.ScreenShare) ?? achar(T.Source.Camera);
}

function Midia({ faixa, tipo, rotulo }: { faixa: Track | null; tipo: "video" | "audio"; rotulo?: string }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !faixa) return;
    faixa.attach(el);
    return () => void faixa.detach(el);
  }, [faixa]);
  if (tipo === "audio") return <audio ref={ref} autoPlay />;
  return <video ref={ref} autoPlay playsInline muted aria-label={rotulo} className="h-full w-full object-contain" />;
}

function Quadro({ p, nome, versao, eu = false }: { p: Participant; nome: string; versao: number; eu?: boolean }) {
  const [video, setVideo] = useState<Track | null>(null);
  const [audio, setAudio] = useState<Track | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const v = await faixaDeVideo(p);
      const { Track: T } = await import("livekit-client");
      const a = eu ? null : ([...p.trackPublications.values()].find((x) => x.source === T.Source.Microphone && x.track)?.track ?? null);
      if (vivo) {
        setVideo(v);
        setAudio(a);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [p, versao, eu]);
  return (
    <figure className={`relative m-0 flex aspect-video min-w-0 items-center justify-center overflow-hidden bg-[#17130e] text-parchment ${p.isSpeaking ? "outline outline-4 outline-oxblood" : ""}`} data-lk-quadro={eu ? "eu" : "outro"}>
      {video ? <Midia faixa={video} tipo="video" rotulo={nome} /> : <span className="px-3 text-center font-sans text-lg font-semibold">{nome}</span>}
      {audio && <Midia faixa={audio} tipo="audio" />}
      <figcaption className="absolute bottom-1 left-1 max-w-[90%] truncate bg-[#17130e]/80 px-2 py-0.5 font-sans text-xs">{nome}</figcaption>
    </figure>
  );
}

const botao = "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 border-2 border-ink px-3 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";

export function LivekitSala({ sala, nome, conduzo, lang, aoSair, aoEntrar, video, entrada, aoFalhar }: PropsDaSala & { entrada?: EntradaDaSala; aoFalhar?: () => void }) {
  const [t, setT] = useState<TextosDaSala | null>(null);
  const [fase, setFase] = useState<Fase>({ fase: "texto" });
  const [versao, setVersao] = useState(0);
  const [local, setLocal] = useState<LocalParticipant | null>(null);
  const [outros, setOutros] = useState<Participant[]>([]);
  const sala_ = useRef<Room | null>(null);
  /** Cada tentativa de entrar tem a sua vez: uma entrada atrasada (sala trocada, componente desmontado) sai sozinha. */
  const vez = useRef(0);
  const desafio = useCaptcha();
  const avisos = useRef({ aoSair, aoEntrar });
  const dados = useRef({ nome, conduzo, video });
  const origem: EntradaDaSala = entrada ?? (SALA_DO_ESTUDO.test(sala) ? { origem: "estudo" } : { origem: "reuniao" });
  const comDesafio = origem.origem === "estudo" && captchaEnabled;
  const origemTexto = JSON.stringify(origem);

  useEffect(() => {
    avisos.current = { aoSair, aoEntrar };
    dados.current = { nome, conduzo, video };
  }, [aoSair, aoEntrar, nome, conduzo, video]);

  useEffect(() => {
    let vivo = true;
    carregarTextosDaSala(lang).then((x) => vivo && setT(x), () => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);

  const entrar = useCallback(async (resposta: string) => {
    const minha = ++vez.current;
    setFase({ fase: "entrando" });
    try {
      const sessao = await sessaoDoPainel();
      const r = await fetch("/api/sala/entrada", {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(sessao ? { Authorization: `Bearer ${sessao}` } : {}) },
        body: JSON.stringify({ ...JSON.parse(origemTexto), sala, ...(resposta ? { desafio: resposta } : {}) }),
      });
      const corpo = (await r.json().catch(() => null)) as { url?: string; token?: string; papel?: Papel; video?: boolean | null; erro?: string } | null;
      if (!r.ok || !corpo?.url || !corpo.token) {
        setFase({ fase: "erro", codigo: corpo?.erro ?? (r.status === 404 ? "nao_encontrado" : "conexao") });
        return;
      }
      const { Room, RoomEvent } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
      sala_.current = room;
      const mudou = () => {
        setOutros([...room.remoteParticipants.values()]);
        setVersao((v) => v + 1);
      };
      for (const e of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ActiveSpeakersChanged, RoomEvent.ParticipantNameChanged]) room.on(e, mudou);
      room.on(RoomEvent.Disconnected, () => {
        if (sala_.current === room) {
          sala_.current = null;
          avisos.current.aoSair?.();
        }
      });
      await room.connect(corpo.url, corpo.token);
      if (minha !== vez.current) {
        if (sala_.current === room) sala_.current = null;
        await room.disconnect(true);
        return;
      }
      await room.localParticipant.setName(dados.current.nome.slice(0, 80)).catch(() => undefined);
      const papel = corpo.papel ?? "assiste";
      const comVideo = papel === "canal" ? (corpo.video ?? dados.current.video ?? false) : false;
      const falar = papel === "conduz" || papel === "canal";
      const camera = papel === "conduz" || comVideo;
      try {
        if (falar) await room.localParticipant.setMicrophoneEnabled(true);
        if (camera) await room.localParticipant.setCameraEnabled(true);
      } catch {
        // microfone ou câmera negados: a pessoa fica na sala, ouvindo; os botões tentam de novo
      }
      setLocal(room.localParticipant);
      mudou();
      setFase({ fase: "dentro" });
      avisos.current.aoEntrar?.();
    } catch (e) {
      setFase({ fase: "erro", codigo: (e as Error)?.name === "NotAllowedError" ? "NotAllowedError" : "conexao" });
    }
  }, [sala, origemTexto]);

  // Entra sozinha ao abrir (a não ser no estudo em grupo com o desafio ligado: aí, depois do desafio).
  useEffect(() => {
    if (comDesafio) {
      void Promise.resolve().then(() => setFase({ fase: "desafio" }));
      return;
    }
    void Promise.resolve().then(() => entrar(""));
  }, [comDesafio, entrar]);

  // Sair da página ou trocar de sala: desconecta (o microfone e a câmera desligam).
  useEffect(() => () => {
    vez.current++;
    const r = sala_.current;
    sala_.current = null;
    void r?.disconnect(true);
  }, [sala]);

  const sair = () => {
    const r = sala_.current;
    sala_.current = null;
    void r?.disconnect(true);
    avisos.current.aoSair?.();
  };

  if (!t) return <div className="aspect-video w-full min-h-[22rem] border-4 border-ink bg-[#17130e]" aria-busy="true" />;
  const rodape = <p className="mt-2 font-sans text-xs text-ink-soft" data-lk-privacidade="">{t.privacidade}</p>;

  if (fase.fase === "erro") {
    return (
      <div data-lk-erro={fase.codigo}>
        <p role="alert" className="border-2 border-oxblood p-4 font-sans text-sm text-oxblood">{(t.erros as Record<string, string>)[fase.codigo] ?? t.erros.outro}</p>
        {aoFalhar && (
          <button type="button" className={`${botao} mt-2`} onClick={aoFalhar}>{t.acoes.abrirNoJitsi}</button>
        )}
        {rodape}
      </div>
    );
  }
  if (fase.fase === "desafio") {
    return (
      <div className="space-y-3 border-4 border-ink p-4 font-sans text-sm" data-lk-desafio="">
        <p>{t.desafio}</p>
        <Captcha action="sala" lang={lang as Locale} round={desafio.round} onToken={desafio.receive} onFalha={desafio.fail} />
        <button type="button" className={botao} disabled={desafio.waiting} onClick={() => { const r = desafio.token; desafio.spend(); void entrar(r); }}>{t.entrar}</button>
        {rodape}
      </div>
    );
  }
  if (fase.fase !== "dentro" || !local) {
    return (
      <div>
        <div className="flex aspect-video w-full min-h-[22rem] items-center justify-center border-4 border-ink bg-[#17130e] font-sans text-parchment" role="status">{t.entrando}</div>
        {rodape}
      </div>
    );
  }
  const todos = 1 + outros.length;
  return (
    <div data-lk-sala="">
      <div className={`grid w-full gap-1 border-4 border-ink bg-[#17130e] p-1 ${todos <= 1 ? "grid-cols-1" : todos <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}`}>
        <Quadro p={local} nome={t.voce} versao={versao} eu />
        {outros.map((p) => (
          <Quadro key={p.identity} p={p} nome={p.name || t.sem_nome} versao={versao} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2" data-lk-controles="">
        <button type="button" className={botao} aria-pressed={local.isMicrophoneEnabled} onClick={() => void local.setMicrophoneEnabled(!local.isMicrophoneEnabled).then(() => setVersao((v) => v + 1), () => setFase({ fase: "erro", codigo: "NotAllowedError" }))}>
          {local.isMicrophoneEnabled ? t.acoes.micDesligar : t.acoes.micLigar}
        </button>
        <button type="button" className={botao} aria-pressed={local.isCameraEnabled} onClick={() => void local.setCameraEnabled(!local.isCameraEnabled).then(() => setVersao((v) => v + 1), () => setFase({ fase: "erro", codigo: "NotAllowedError" }))}>
          {local.isCameraEnabled ? t.acoes.camDesligar : t.acoes.camLigar}
        </button>
        {typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && (
          <button type="button" className={botao} aria-pressed={local.isScreenShareEnabled} onClick={() => void local.setScreenShareEnabled(!local.isScreenShareEnabled).then(() => setVersao((v) => v + 1), () => undefined)}>
            {local.isScreenShareEnabled ? t.acoes.telaDesligar : t.acoes.telaLigar}
          </button>
        )}
        <button type="button" className={`${botao} border-oxblood text-oxblood`} onClick={sair}>{t.acoes.sair}</button>
        <span className="font-sans text-xs text-ink-soft" role="status">{todos > 1 ? fill(t.na_sala, { n: todos }) : t.ninguem}</span>
      </div>
      {rodape}
    </div>
  );
}
