// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A parte pesada do podcast ao vivo (T17): o vídeo direto do navegador de quem transmite para quem assiste, pelo WebRTC.
// Reaproveita a sala e a transmissão das aulas ao vivo (lib/tempo-real.ts, lib/aovivo.ts): presença assinada por quem
// transmite (quem assiste só aceita vídeo da chave registrada no banco), e o TURN da Cloudflare de /api/aovivo/rede quando
// está configurado, que faz o vídeo passar pelo servidor e esconde o endereço de rede de todo mundo. Só carrega quando a
// pessoa clica em "Assistir ao vivo" ou começa a transmitir (components/podcast/AoVivo.tsx o importa sob demanda).
import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import { conferirEducadores, Credencial, faixaPreta, provaDaPresenca, Transmissao } from "@/lib/aovivo";
import { BackendError, rpc } from "@/lib/backend";
import { LIMITE_DIRETO, naSalaDireta, PULSO_SEGUNDOS } from "@/lib/podcast-ao-vivo";
import { type Presente, Sala } from "@/lib/tempo-real";
import { useI18n } from "../I18n";
import type { TextosAoVivo } from "./AoVivo";

const chaveSorteada = () => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** O servidor de retransmissão, quando existe, antes de qualquer ligação sair. */
async function redeDaSala(sala: string): Promise<RTCConfiguration | null> {
  try {
    const r = await fetch(`/api/aovivo/rede?podcast=${encodeURIComponent(sala)}`, { cache: "no-store" });
    const d = r.ok ? ((await r.json()) as { iceServers?: RTCIceServer[] | null }) : null;
    return d?.iceServers?.length ? { iceServers: d.iceServers, iceTransportPolicy: "relay" } : null;
  } catch {
    return null;
  }
}

async function entrarComTentativas(sala: Sala, vivo: () => boolean): Promise<boolean> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (!vivo()) return false;
    if (await sala.entrar()) return true;
    await new Promise((ok) => window.setTimeout(ok, 1500 * (tentativa + 1)));
  }
  return false;
}

function Tela({ fluxo, mudo = false, espelho = false, rotulo }: { fluxo: MediaStream; mudo?: boolean; espelho?: boolean; rotulo: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== fluxo) ref.current.srcObject = fluxo;
  }, [fluxo]);
  return (
    <div className="relative aspect-video max-w-full overflow-hidden border-2 border-[#f4ecd8] bg-[#17130e]">
      <video ref={ref} autoPlay playsInline controls={!mudo} muted={mudo} aria-label={rotulo} className={`h-full w-full object-contain ${espelho ? "scale-x-[-1]" : ""}`} />
    </div>
  );
}

/** Quem assiste: entra na sala sem câmera nem microfone, confere a assinatura de quem transmite e recebe o vídeo. */
export function Assistir({ s, sala, chaves, reserva, aoSair }: { s: TextosAoVivo; sala: string; chaves: string[]; reserva: React.ReactNode; aoSair: () => void }) {
  const [fluxo, setFluxo] = useState<MediaStream | null>(null);
  const [fase, setFase] = useState<"ligando" | "esperando" | "sem" | "lotado">("ligando");
  const chavesRef = useRef(chaves);
  const transmissao = useRef<Transmissao | null>(null);
  const lista = useRef<Presente[]>([]);
  const comVideo = useRef(new Set<string>());

  useEffect(() => {
    let vivo = true;
    const eu: Presente = { chave: chaveSorteada(), nome: "", papel: "aluno" };
    let ultimoPedido = 0;
    // Confere quem diz transmitir e pede o vídeo a quem ainda não mandou (pedir de novo a quem já manda religaria a imagem).
    const reconferir = async () => {
      const transmissor = transmissao.current;
      if (!transmissor) return;
      const conferidos = await conferirEducadores(sala, lista.current, chavesRef.current);
      if (!vivo || transmissao.current !== transmissor) return;
      transmissor.educadores = conferidos;
      const visiveis = lista.current.map((p) => (p.papel === "educador" && !conferidos.has(p.chave) ? { ...p, papel: "aluno" as const } : p));
      await transmissor.aoPresenca(visiveis);
      const semVideo = visiveis.filter((p) => p.papel === "educador" && !comVideo.current.has(p.chave));
      if (semVideo.length && Date.now() - ultimoPedido > 4000) {
        ultimoPedido = Date.now();
        transmissor.pedir(semVideo);
      }
      setFase((f) => (f === "ligando" ? "esperando" : f));
    };
    const nova = new Sala(
      sala,
      eu,
      (de, dados, assinatura) => {
        // Quem transmite avisa quem ficou de fora da sala direta (passou de LIMITE_DIRETO pessoas).
        if (dados.t === "cheia") {
          if (transmissao.current?.educadores.has(de)) setFase("lotado");
          return;
        }
        void transmissao.current?.aoSinal(de, dados, assinatura);
      },
      (presentes) => {
        lista.current = presentes;
        void reconferir();
      },
    );
    const transmissor = new Transmissao(
      nova,
      eu,
      (de, f) => {
        if (f) comVideo.current.add(de);
        else comVideo.current.delete(de);
        if (vivo) setFluxo((antes) => (f ? f : antes && comVideo.current.size === 0 ? null : antes));
      },
      sala,
      true,
    );
    transmissao.current = transmissor;
    void (async () => {
      const rede = await redeDaSala(sala);
      if (rede) transmissor.rede = rede;
      if (!(await entrarComTentativas(nova, () => vivo))) {
        if (vivo) setFase("sem");
        return;
      }
    })();
    // Se o vídeo não chegou (ou caiu), pede de novo de tempos em tempos.
    const timer = window.setInterval(() => void reconferir(), 8000);
    return () => {
      vivo = false;
      window.clearInterval(timer);
      transmissor.fechar();
      transmissao.current = null;
      nova.sair();
    };
  }, [sala]);

  // A chave de quem transmite mudou (recarregou a página do estúdio): confere de novo.
  useEffect(() => {
    chavesRef.current = chaves;
  }, [chaves]);

  return (
    <div className="space-y-3">
      {fluxo ? (
        <Tela fluxo={fluxo} rotulo={s.titulo} />
      ) : (
        <div className="flex aspect-video max-w-full items-center justify-center border-2 border-[#f4ecd8] bg-[#17130e] p-6 text-center font-sans text-sm text-[#d9ccac]" role="status">
          {fase === "lotado" ? fill(s.lotado, { n: LIMITE_DIRETO }) : fase === "sem" ? s.semCanal : fase === "ligando" ? s.conectando : s.esperando}
        </div>
      )}
      {fase === "lotado" && reserva}
      <p className="font-sans text-xs text-[#d9ccac]">
        {s.avisoDireto}{" "}
        <button type="button" onClick={aoSair} className="cursor-pointer underline hover:text-[#f4ecd8]">
          {s.sair}
        </button>
      </p>
    </div>
  );
}

type Fonte = "camera" | "tela" | "audio";

/**
 * Quem transmite pelo navegador: gera a chave desta aba e a registra no banco, entra na sala assinando a presença, liga a
 * câmera e o microfone e manda o vídeo para até LIMITE_DIRETO pessoas. Dá sinal de vida ao banco a cada minuto (sem ele, a
 * transmissão sai do ar sozinha). Nada é gravado.
 */
export function Transmitir({ s, sala, aoEncerrar }: { s: TextosAoVivo; sala: string; aoEncerrar: () => void }) {
  const { t } = useI18n();
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [fonte, setFonte] = useState<Fonte>("camera");
  const [mudo, setMudo] = useState(false);
  const [assistindo, setAssistindo] = useState(0);
  const [aviso, setAviso] = useState("");
  const [saindo, setSaindo] = useState(false);
  const transmissao = useRef<Transmissao | null>(null);
  const salaRef = useRef<Sala | null>(null);
  const admitidos = useRef<Set<string>>(new Set());
  const avisados = useRef<Set<string>>(new Set());
  const presentes = useRef<Presente[]>([]);

  const distribuir = async () => {
    const transmissor = transmissao.current;
    const canal = salaRef.current;
    if (!transmissor || !canal) return;
    const r = naSalaDireta(presentes.current, admitidos.current);
    admitidos.current = r.admitidos;
    setAssistindo(r.admitidos.size);
    for (const p of r.fora) {
      if (avisados.current.has(p.chave)) continue;
      avisados.current.add(p.chave);
      canal.enviar(p.chave, { t: "cheia" });
    }
    await transmissor.aoPresenca(r.lista);
  };
  const distribuirRef = useRef(distribuir);
  useEffect(() => {
    distribuirRef.current = distribuir;
  });

  useEffect(() => {
    let vivo = true;
    let canal: Sala | null = null;
    let transmissor: Transmissao | null = null;
    void (async () => {
      try {
        const credencial = await Credencial.nova();
        await rpc("podcast_ao_vivo_chave", { p_sala: sala, p_publica: credencial.publica });
        const chave = chaveSorteada();
        const prova = await credencial.assinar(provaDaPresenca(sala, chave));
        if (!vivo) return;
        const eu: Presente = { chave, nome: s.titulo, papel: "educador", publica: credencial.publica, prova };
        canal = new Sala(
          sala,
          eu,
          (de, dados, assinatura) => {
            // Pedido de vídeo de quem ficou de fora da sala direta: não liga (é o que segura o teto).
            if (dados.t === "pedir" && !admitidos.current.has(de)) return;
            void transmissao.current?.aoSinal(de, dados, assinatura);
          },
          (lista) => {
            presentes.current = lista;
            void distribuirRef.current();
          },
        );
        transmissor = new Transmissao(canal, eu, () => undefined, sala, true);
        transmissor.credencial = credencial;
        salaRef.current = canal;
        transmissao.current = transmissor;
        const rede = await redeDaSala(sala);
        if (rede) transmissor.rede = rede;
        const microfone = (await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })).getAudioTracks()[0];
        const video = (await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } })).getVideoTracks()[0];
        if (!vivo) {
          microfone.stop();
          video.stop();
          return;
        }
        const fluxo = new MediaStream([microfone, video]);
        transmissor.local = fluxo;
        setLocal(fluxo);
        if (!(await entrarComTentativas(canal, () => vivo)) && vivo) setAviso(s.semCanal);
      } catch (e) {
        if (vivo) setAviso(e instanceof BackendError ? errorText(t, e.code) : s.falhaMidia);
      }
    })();
    // Sinal de vida para o banco: sem ele por três minutos, a transmissão sai do ar sozinha.
    const pulso = window.setInterval(() => void rpc("podcast_ao_vivo_pulso", { p_sala: sala }).catch(() => undefined), PULSO_SEGUNDOS * 1000);
    // Fechar a aba no meio da transmissão: o navegador pergunta antes.
    const antesDeSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", antesDeSair);
    return () => {
      vivo = false;
      window.clearInterval(pulso);
      window.removeEventListener("beforeunload", antesDeSair);
      transmissor?.fechar();
      canal?.sair();
      transmissao.current = null;
      salaRef.current = null;
    };
    // Os textos não mudam a sala: só a sala reinicia a transmissão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala]);

  async function trocar(nova: Fonte) {
    const transmissor = transmissao.current;
    if (!transmissor?.local) return;
    setAviso("");
    try {
      let video: MediaStreamTrack;
      if (nova === "camera") video = (await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } })).getVideoTracks()[0];
      else if (nova === "tela") video = (await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false })).getVideoTracks()[0];
      else video = faixaPreta();
      video.onended = () => void trocar("audio");
      await transmissor.trocarVideo(video);
      setLocal(new MediaStream(transmissor.local.getTracks()));
      setFonte(nova);
    } catch {
      setAviso(s.falhaMidia);
    }
  }

  function alternarMudo() {
    const trilho = local?.getAudioTracks()[0];
    if (!trilho) return;
    trilho.enabled = mudo;
    setMudo(!mudo);
  }

  async function encerrar() {
    setSaindo(true);
    try {
      await rpc("podcast_ao_vivo_encerrar");
    } catch (e) {
      setAviso(e instanceof BackendError ? errorText(t, e.code) : errorText(t, "falha"));
    }
    transmissao.current?.fechar();
    setLocal(null);
    setSaindo(false);
    aoEncerrar();
  }

  const botao = "min-h-11 cursor-pointer border-2 border-[#f4ecd8] px-3 py-1.5 font-sans text-sm font-semibold hover:bg-[#f4ecd8] hover:text-[#1f1a14] aria-pressed:bg-[#f4ecd8] aria-pressed:text-[#1f1a14]";
  return (
    <div className="space-y-3">
      {local ? <Tela fluxo={local} mudo espelho={fonte === "camera"} rotulo={s.voceTransmite} /> : <div className="flex aspect-video items-center justify-center border-2 border-[#f4ecd8] bg-[#17130e] font-sans text-sm text-[#d9ccac]" role="status">{s.conectando}</div>}
      <p className="font-sans text-sm font-semibold" role="status">
        <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#c21f16]" />
        {s.voceTransmite} · {fill(s.assistindo, { n: assistindo })}
      </p>
      <div className="flex flex-wrap gap-2">
        {(["camera", "tela", "audio"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={fonte === f} className={botao} disabled={!local} onClick={() => void trocar(f)}>
            {f === "camera" ? s.camera : f === "tela" ? s.tela : s.soAudio}
          </button>
        ))}
        <button type="button" aria-pressed={mudo} className={botao} disabled={!local} onClick={alternarMudo}>
          {mudo ? s.som : s.mudo}
        </button>
        <button type="button" className="min-h-11 cursor-pointer bg-[#c21f16] px-4 py-1.5 font-sans text-sm font-bold text-white hover:bg-[#a51810] disabled:opacity-50" disabled={saindo} onClick={() => void encerrar()}>
          {s.encerrar}
        </button>
      </div>
      {aviso && <p role="alert" className="font-sans text-sm text-[#e0837a]">{aviso}</p>}
    </div>
  );
}
