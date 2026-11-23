// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Sala de voz cifrada de ponta a ponta para núcleos e comunidades fechadas (sala de estudo, conversa de voz). Documento:
// docs/rede/VOZ.md.
//
// Como funciona, sem servidor de mídia no meio:
//   - Cada pessoa liga direto para cada outra (até 8 na sala). O áudio vai por WebRTC, que já é cifrado ponto a ponto (DTLS-SRTP):
//     ninguém no caminho ouve.
//   - O áudio passa SEMPRE por um servidor de retransmissão (TURN, `iceTransportPolicy: "relay"`): os participantes não veem o
//     endereço de rede uns dos outros, e o servidor de retransmissão só vê pacotes cifrados.
//   - A combinação da chamada (as ofertas com a "impressão digital" DTLS de cada aparelho) vai cifrada com uma chave tirada do MLS
//     do grupo (lib/rede/grupos/chaveiro.ts, chaveDeVoz). Quem não é do grupo não consegue se meter no meio da ligação (trocar a
//     impressão digital), nem ver quem está na sala; o canal de combinação (Realtime) só vê blocos cifrados.
//
// O transporte da combinação e a fábrica de conexões são injetados: no navegador, o Realtime do serviço e RTCPeerConnection; nos
// testes, uma memória. Sem "@/".

/** O que a sala manda pelo canal (já cifrado). */
interface Recado {
  de: string;
  /** null: para todos. */
  para: string | null;
  tipo: "ola" | "oferta" | "resposta" | "ice" | "tchau" | "sala";
  sdp?: string;
  /** "sala": um recado dos modos da sala (Prompt 4, itens 23 a 25: lib/rede/voz/modos.ts), conferido por quem recebe. */
  modo?: unknown;
  candidato?: RTCIceCandidateInit;
  quando: number;
}

export interface CanalDaSala {
  enviar(bloco: { epoca: number; iv: string; ct: string }): Promise<void>;
  aoReceber(fazer: (bloco: { epoca: number; iv: string; ct: string }) => void): void;
  sair(): Promise<void>;
}

export interface ChaveDaSala {
  /** A chave da época atual (para mandar) e a de uma época qualquer (para abrir o que chegou). */
  atual(): Promise<{ epoca: number; chave: CryptoKey } | null>;
  daEpoca(epoca: number): Promise<CryptoKey | null>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const paraB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
/** Recado mais velho que isto é descartado (alguém regravando uma combinação antiga). */
const VALIDADE_MS = 60_000;
export const MAXIMO_NA_SALA = 8;
/**
 * Prompt 4, item 140: a câmera só vai enquanto a sala tiver até 4 pessoas (cada aparelho manda o vídeo para cada outro; acima disso o
 * celular não aguenta). Com mais gente, a sala segue só com voz: a câmera de cada um é desligada no próprio aparelho.
 */
export const MAXIMO_COM_VIDEO = 4;
/** Cabe vídeo numa sala com `pessoas` pessoas (contando quem pergunta)? */
export const cabeVideo = (pessoas: number) => pessoas <= MAXIMO_COM_VIDEO;

/** Cifra um recado da sala (AES-256-GCM com a chave da sala, amarrado à sala). */
export async function selarRecado(chave: CryptoKey, epoca: number, sala: string, recado: Recado) {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(`alumia-voz:${sala}:e${epoca}`) }, chave, encoder.encode(JSON.stringify(recado))));
  return { epoca, iv: paraB64(iv), ct: paraB64(ct) };
}

/** Abre um recado da sala. null em qualquer dúvida (chave errada, mexido, velho demais, fora do formato). */
export async function abrirRecado(chave: CryptoKey, sala: string, bloco: { epoca: number; iv: string; ct: string }, agora = Date.now()): Promise<Recado | null> {
  try {
    const aberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(bloco.iv), additionalData: encoder.encode(`alumia-voz:${sala}:e${bloco.epoca}`) }, chave, deB64(bloco.ct));
    const r = JSON.parse(decoder.decode(aberto)) as Recado;
    if (typeof r?.de !== "string" || !["ola", "oferta", "resposta", "ice", "tchau", "sala"].includes(r.tipo) || typeof r.quando !== "number") return null;
    if (Math.abs(agora - r.quando) > VALIDADE_MS) return null;
    return r;
  } catch {
    return null;
  }
}

export interface Participante {
  usuario: string;
  conexao: RTCPeerConnection;
  /** O que chega dessa pessoa: o áudio e, numa chamada de vídeo (Prompt 4, item 140), também a faixa da câmera. */
  audio: MediaStream | null;
}

/**
 * Abre a sala. `entrar(microfone)` liga para quem já está; `sair()` desliga tudo. `aoMudar` recebe a lista de participantes a
 * cada mudança. Sem servidor de retransmissão (`iceServers` vazio), a sala não abre ("voz_sem_retransmissao"): sem ele, o endereço
 * de rede de cada pessoa apareceria para as outras.
 */
export function criarSalaDeVoz(opcoes: {
  eu: string;
  sala: string;
  chave: ChaveDaSala;
  canal: CanalDaSala;
  iceServers: RTCIceServer[];
  novaConexao?: (config: RTCConfiguration) => RTCPeerConnection;
  aoMudar?: (participantes: Participante[]) => void;
  /**
   * Prompt 4, itens 139 e 140 (a chamada da conversa a dois): o teto de pessoas desta sala (padrão 8; a chamada a dois usa 2) e se
   * ela leva vídeo (cada conexão já nasce pronta para receber a câmera, mesmo de quem entrou sem a sua).
   */
  maximo?: number;
  comVideo?: boolean;
  /**
   * Os modos da sala (Prompt 4, itens 23 a 25; lib/rede/voz/modos.ts). `aoOla`: alguém mandou "olá" (a anfitriã manda o estado a
   * quem chega e anota quem bate na espera). `podeLigar`: a sala de espera decide se este aparelho liga para essa pessoa (não: ninguém
   * liga para quem espera). `aoModo`: um recado "sala" que chegou.
   */
  modos?: {
    podeLigar(usuario: string): boolean;
    aoOla?(usuario: string): void;
    aoModo(de: string, modo: unknown): void;
  };
}) {
  const { eu, sala, chave, canal } = opcoes;
  if (!opcoes.iceServers.length) throw new Error("voz_sem_retransmissao");
  const fabrica = opcoes.novaConexao ?? ((c: RTCConfiguration) => new RTCPeerConnection(c));
  const config: RTCConfiguration = { iceServers: opcoes.iceServers, iceTransportPolicy: "relay", bundlePolicy: "max-bundle" };
  const pares = new Map<string, Participante>();
  const maximo = Math.max(2, Math.min(MAXIMO_NA_SALA, opcoes.maximo ?? MAXIMO_NA_SALA));
  let microfone: MediaStream | null = null;
  let camera: MediaStream | null = null;
  let cameraLigada = true;
  let aberta = false;
  /** Item 140: acima de 4 pessoas, a câmera deste aparelho é desligada (só voz); volta sozinha quando a sala cabe de novo. */
  const ajustarCamera = () => {
    const pode = cameraLigada && cabeVideo(pares.size + 1);
    for (const faixa of camera?.getVideoTracks() ?? []) faixa.enabled = pode;
  };
  const mudou = () => {
    ajustarCamera();
    opcoes.aoMudar?.([...pares.values()]);
  };

  async function mandar(recado: Omit<Recado, "de" | "quando">) {
    const k = await chave.atual();
    if (!k) throw new Error("sem_chave");
    await canal.enviar(await selarRecado(k.chave, k.epoca, sala, { ...recado, de: eu, quando: Date.now() }));
  }

  function par(usuario: string): Participante {
    const ja = pares.get(usuario);
    if (ja) return ja;
    if (pares.size >= maximo - 1) throw new Error("voz_cheia");
    const conexao = fabrica(config);
    const p: Participante = { usuario, conexao, audio: null };
    if (microfone) for (const faixa of microfone.getAudioTracks()) conexao.addTrack(faixa, microfone);
    // Estudo em silêncio (Prompt 4, item 24): sem microfone, a conexão ainda ouve quem fala.
    if (!microfone?.getAudioTracks().length) conexao.addTransceiver?.("audio", { direction: "recvonly" });
    // Item 140: a câmera vai só se a sala, com esta pessoa, cabe vídeo; numa sala com vídeo, a conexão sempre fica pronta para receber.
    const mandaVideo = !!camera?.getVideoTracks().length && cabeVideo(pares.size + 2);
    if (mandaVideo && camera) for (const faixa of camera.getVideoTracks()) conexao.addTrack(faixa, camera);
    else if (opcoes.comVideo) conexao.addTransceiver?.("video", { direction: "recvonly" });
    conexao.onicecandidate = (e) => {
      if (e.candidate) void mandar({ para: usuario, tipo: "ice", candidato: e.candidate.toJSON() }).catch(() => undefined);
    };
    conexao.ontrack = (e) => {
      // Um fluxo só por pessoa, com o áudio e (item 140) a câmera: um fluxo novo a cada faixa, para a tela perceber a troca.
      const faixas = [...(p.audio?.getTracks() ?? []).filter((f) => f.id !== e.track.id), e.track];
      p.audio = new MediaStream(faixas);
      mudou();
    };
    conexao.onconnectionstatechange = () => {
      if (conexao.connectionState === "failed" || conexao.connectionState === "closed") desligar(usuario);
      else mudou();
    };
    pares.set(usuario, p);
    mudou();
    return p;
  }

  function desligar(usuario: string) {
    const p = pares.get(usuario);
    if (!p) return;
    pares.delete(usuario);
    try {
      p.conexao.close();
    } catch {
      // já fechada
    }
    mudou();
  }

  async function aoChegar(bloco: { epoca: number; iv: string; ct: string }) {
    if (!aberta) return;
    const k = await chave.daEpoca(bloco.epoca);
    if (!k) return;
    const r = await abrirRecado(k, sala, bloco);
    if (!r || r.de === eu || (r.para !== null && r.para !== eu)) return;
    try {
      if (r.tipo === "tchau") return desligar(r.de);
      if (r.tipo === "sala") return opcoes.modos?.aoModo(r.de, r.modo);
      // Sala de espera (Prompt 4, item 25): quem não foi aprovada não liga nem é ligada; a anfitriã fica sabendo que bateu.
      if (r.tipo === "ola") opcoes.modos?.aoOla?.(r.de);
      if ((r.tipo === "ola" || r.tipo === "oferta") && opcoes.modos && !opcoes.modos.podeLigar(r.de)) return;
      if (r.tipo === "ola") {
        // Quem tem o id menor liga (assim os dois não ligam ao mesmo tempo); o outro responde com "ola" para ser chamado.
        if (eu < r.de) {
          const p = par(r.de);
          const oferta = await p.conexao.createOffer();
          await p.conexao.setLocalDescription(oferta);
          await mandar({ para: r.de, tipo: "oferta", sdp: oferta.sdp });
        } else if (!pares.has(r.de)) {
          await mandar({ para: r.de, tipo: "ola" });
        }
        return;
      }
      if (r.tipo === "oferta" && r.sdp) {
        const p = par(r.de);
        await p.conexao.setRemoteDescription({ type: "offer", sdp: r.sdp });
        const resposta = await p.conexao.createAnswer();
        await p.conexao.setLocalDescription(resposta);
        await mandar({ para: r.de, tipo: "resposta", sdp: resposta.sdp });
        return;
      }
      if (r.tipo === "resposta" && r.sdp) {
        const p = pares.get(r.de);
        if (p && p.conexao.signalingState === "have-local-offer") await p.conexao.setRemoteDescription({ type: "answer", sdp: r.sdp });
        return;
      }
      if (r.tipo === "ice" && r.candidato) {
        const p = pares.get(r.de);
        // Só candidato de retransmissão: um candidato com o endereço da pessoa nunca é usado.
        if (p && /\btyp relay\b/.test(r.candidato.candidate ?? "")) await p.conexao.addIceCandidate(r.candidato);
      }
    } catch {
      // recado que não deu para usar: segue
    }
  }

  canal.aoReceber((bloco) => void aoChegar(bloco));

  return {
    /**
     * Entra na sala. `audio` null: sem microfone (estudo em silêncio, item 24), só ouvindo. `video` (item 140): a câmera, só numa sala
     * com vídeo.
     */
    async entrar(audio: MediaStream | null, video: MediaStream | null = null) {
      microfone = audio;
      camera = video;
      ajustarCamera();
      aberta = true;
      await mandar({ para: null, tipo: "ola" });
    },
    /** Liga e desliga o próprio microfone sem sair da sala. */
    mudo(sim: boolean) {
      for (const faixa of microfone?.getAudioTracks() ?? []) faixa.enabled = !sim;
    },
    /** Item 140: liga e desliga a própria câmera sem sair (acima de 4 pessoas ela fica desligada de qualquer jeito). */
    camera(sim: boolean) {
      cameraLigada = sim;
      ajustarCamera();
    },
    /** Item 140: a sala passou de 4 pessoas e segue só com voz? */
    soVoz: () => !cabeVideo(pares.size + 1),
    async sair() {
      if (aberta) await mandar({ para: null, tipo: "tchau" }).catch(() => undefined);
      aberta = false;
      for (const u of [...pares.keys()]) desligar(u);
      for (const faixa of microfone?.getTracks() ?? []) faixa.stop();
      for (const faixa of camera?.getTracks() ?? []) faixa.stop();
      microfone = null;
      camera = null;
      await canal.sair();
    },
    participantes: () => [...pares.values()],
    /** Manda um recado dos modos (lib/rede/voz/modos.ts) a todos (`para` null) ou a uma pessoa, cifrado como os outros. */
    async mandarModo(modo: unknown, para: string | null = null) {
      if (aberta) await mandar({ para, tipo: "sala", modo });
    },
    /** Manda "olá" de novo (quem esperava e foi aprovada; ou quando a espera desliga): quem já está liga de volta. */
    async religar() {
      if (aberta) await mandar({ para: null, tipo: "ola" });
    },
    /** Desliga de alguém que a sala de espera tirou (a anfitriã recusou). */
    desligarDe: (usuario: string) => desligar(usuario),
  };
}

export type SalaDeVoz = ReturnType<typeof criarSalaDeVoz>;
