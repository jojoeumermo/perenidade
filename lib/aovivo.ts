// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { Presente, Sala } from "./tempo-real";

/** Uma aula ao vivo, como o banco a devolve. */
export interface Aula {
  id: string;
  titulo: string;
  descricao: string;
  disciplina: string;
  trilha: string | null;
  inicio: string;
  duracao: number;
  status: "agendada" | "ao_vivo" | "encerrada" | "cancelada";
  iniciada_em: string | null;
  encerrada_em: string | null;
  gravacao: string;
  sala_externa: string;
  /** A transmissão pelo canal do instituto no YouTube (supabase/functions/youtube), quando quem conduz a criou. */
  youtube?: string | null;
  educador: { id: string; nome: string };
  co_educadores: { id: string; nome: string }[];
  inscritos: number;
  inscrito: boolean;
  conduzo: boolean;
  mensagens?: number | null;
}

export interface Fala {
  id: string;
  autor: string | null;
  nome: string;
  corpo: string;
  tipo: "fala" | "pergunta" | "sistema";
  oculta: boolean;
  /** Espera a leitura da mediação: só quem escreveu (e quem conduz) vê. */
  retido?: boolean;
  criado_em: string;
}

/** Servidores STUN públicos: só dizem a cada navegador qual é o endereço dele na internet. Nenhum vídeo passa por eles. */
const STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

/** Um vídeo preto, para quem transmite só o som continuar com uma faixa de vídeo (trocar para a câmera depois não exige renegociar). */
export function faixaPreta(): MediaStreamTrack {
  const tela = document.createElement("canvas");
  tela.width = 320;
  tela.height = 180;
  const pena = tela.getContext("2d");
  if (pena) {
    pena.fillStyle = "#17130e";
    pena.fillRect(0, 0, tela.width, tela.height);
  }
  const fluxo = tela.captureStream(2);
  return fluxo.getVideoTracks()[0];
}

/** Arquivo .ics para pôr a aula no calendário do aparelho. */
export function calendario(aula: Aula, endereco: string): string {
  const quando = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const fim = new Date(new Date(aula.inicio).getTime() + aula.duracao * 60_000).toISOString();
  const limpo = (texto: string) => texto.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Instituto Lucia//Aulas ao vivo//PT", "BEGIN:VEVENT", `UID:${aula.id}@institutolucia.org`, `DTSTAMP:${quando(new Date().toISOString())}`, `DTSTART:${quando(aula.inicio)}`, `DTEND:${quando(fim)}`, `SUMMARY:${limpo(aula.titulo)}`, `DESCRIPTION:${limpo(`${aula.descricao}\n${endereco}`)}`, `URL:${endereco}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

/**
 * O vídeo da aula vai direto de quem ensina para cada navegador na sala (WebRTC, um a um), sem servidor no meio:
 * é o que dá para fazer de graça. Quem dá a aula manda a câmera (ou a tela) e o microfone para cada pessoa que entra;
 * quem assiste só recebe. Entre dois educadores a ligação vai nos dois sentidos. Os sinais para fechar cada ligação
 * passam pelo canal de tempo real da sala; o vídeo em si, não. Turma grande demais para o envio de quem ensina?
 * Para isso existe a sala de fora (Jitsi, Meet), indicada ao marcar a aula.
 */
export class Transmissao {
  private pcs = new Map<string, RTCPeerConnection>();
  private esperando = new Map<string, RTCIceCandidateInit[]>();
  /** O meu fluxo (câmera ou tela + microfone), quando ensino. */
  local: MediaStream | null = null;

  constructor(
    private readonly sala: Sala,
    private readonly eu: Presente,
    private readonly aoFluxo: (de: string, fluxo: MediaStream | null) => void,
  ) {}

  private criar(chave: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: STUN });
    pc.onicecandidate = (e) => {
      if (e.candidate) this.sala.enviar(chave, { t: "ice", c: e.candidate.toJSON() as unknown as Record<string, unknown> });
    };
    pc.ontrack = (e) => {
      const fluxo = e.streams[0] ?? new MediaStream([e.track]);
      this.aoFluxo(chave, fluxo);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.aoFluxo(chave, null);
        this.pcs.delete(chave);
        pc.close();
      }
    };
    this.pcs.set(chave, pc);
    return pc;
  }

  private porMeusTrilhos(pc: RTCPeerConnection) {
    if (!this.local || this.eu.papel !== "educador") return;
    const ja = new Set(pc.getSenders().map((s) => s.track));
    for (const trilho of this.local.getTracks()) if (!ja.has(trilho)) pc.addTrack(trilho, this.local);
  }

  private async oferecer(chave: string) {
    const pc = this.pcs.get(chave) ?? this.criar(chave);
    this.porMeusTrilhos(pc);
    try {
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      this.sala.enviar(chave, { t: "oferta", sdp: oferta.sdp ?? "" });
    } catch {
      // a ligação com esta pessoa falhou; ela pode pedir de novo
    }
  }

  /** Quem está na sala mudou: fecha quem saiu e, se eu ensino, oferece o vídeo a quem chegou. */
  async aoPresenca(presentes: Presente[]) {
    const ids = new Set(presentes.map((p) => p.chave));
    for (const [chave, pc] of this.pcs) {
      if (!ids.has(chave)) {
        pc.close();
        this.pcs.delete(chave);
        this.aoFluxo(chave, null);
      }
    }
    if (this.eu.papel !== "educador" || !this.local) return;
    for (const p of presentes) {
      // Entre dois educadores, quem tem a chave menor oferece (senão os dois ofereceriam ao mesmo tempo).
      if (p.chave === this.eu.chave || this.pcs.has(p.chave) || (p.papel === "educador" && this.eu.chave > p.chave)) continue;
      await this.oferecer(p.chave);
    }
  }

  /** Um sinal chegou de outro navegador: oferta, resposta, candidato de rede ou pedido para (re)ligar. */
  async aoSinal(de: string, dados: Record<string, unknown>) {
    const t = dados.t;
    try {
      if (t === "oferta" && typeof dados.sdp === "string") {
        const pc = this.pcs.get(de) ?? this.criar(de);
        this.porMeusTrilhos(pc);
        await pc.setRemoteDescription({ type: "offer", sdp: dados.sdp });
        for (const c of this.esperando.get(de) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
        this.esperando.delete(de);
        const resposta = await pc.createAnswer();
        await pc.setLocalDescription(resposta);
        this.sala.enviar(de, { t: "resposta", sdp: resposta.sdp ?? "" });
      } else if (t === "resposta" && typeof dados.sdp === "string") {
        const pc = this.pcs.get(de);
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription({ type: "answer", sdp: dados.sdp });
          for (const c of this.esperando.get(de) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
          this.esperando.delete(de);
        }
      } else if (t === "ice" && dados.c && typeof dados.c === "object") {
        const pc = this.pcs.get(de);
        const c = dados.c as RTCIceCandidateInit;
        if (pc?.remoteDescription) await pc.addIceCandidate(c).catch(() => undefined);
        else this.esperando.set(de, [...(this.esperando.get(de) ?? []), c]);
      } else if (t === "pedir" && this.eu.papel === "educador" && this.local) {
        this.pcs.get(de)?.close();
        this.pcs.delete(de);
        await this.oferecer(de);
      }
    } catch {
      // sinal fora de ordem: a próxima rodada de presença refaz a ligação
    }
  }

  /** Quem assiste pede o vídeo a todo mundo que ensina (ao entrar, ou quando a imagem cai). */
  pedir(educadores: Presente[]) {
    for (const p of educadores) if (p.chave !== this.eu.chave) this.sala.enviar(p.chave, { t: "pedir" });
  }

  /** Troca a câmera pela tela (ou o contrário) sem refazer as ligações. */
  async trocarVideo(trilho: MediaStreamTrack) {
    if (!this.local) return;
    for (const antigo of this.local.getVideoTracks()) {
      this.local.removeTrack(antigo);
      antigo.stop();
    }
    this.local.addTrack(trilho);
    for (const pc of this.pcs.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video" || (s.track === null && pc.getTransceivers().some((tr) => tr.sender === s && tr.receiver.track.kind === "video")));
      if (sender) await sender.replaceTrack(trilho).catch(() => undefined);
    }
  }

  fechar() {
    for (const pc of this.pcs.values()) pc.close();
    this.pcs.clear();
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
  }
}
