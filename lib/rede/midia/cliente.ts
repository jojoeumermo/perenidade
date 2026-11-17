// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da frente 12B (voz e vídeo) ao banco: uma por rpc, nos nomes e parâmetros de
// supabase/migracoes/20261118-alumia-o12-midia.sql, e os lotes que juntam os pedidos de vários cartões numa chamada só (como os
// detalhes do post). Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) responde um dublê com os posts de exemplo e não vai ao banco.
// Sem "@/" de propósito.
import { chamar, type Chamar } from "../cliente";

export interface VideoDoPost {
  id: string;
  tipo: "video/mp4" | "video/webm";
  duracao_ms: number;
  largura: number;
  altura: number;
  som: boolean;
  alt: string;
  meu: boolean;
}

export type OrigemDaTranscricao = "digitada" | "aparelho";

export interface TranscricaoDoPost {
  texto: string;
  origem: OrigemDaTranscricao;
}

export function criarClienteMidia(c: Chamar) {
  return {
    /** As transcrições aprovadas (até 50 posts): {post: {texto, origem}}. Post que a pessoa não pode ver não aparece. */
    transcricoes: (ids: string[]) => c<Record<string, TranscricaoDoPost>>("rede_transcricoes", { p_ids: ids.slice(0, 50) }),
    /** A autora aprova (ou troca) a transcrição do áudio do próprio post. */
    aprovar: (post: string, texto: string, origem: OrigemDaTranscricao) =>
      c<TranscricaoDoPost & { post: string; aprovada_em: string }>("rede_transcricao_aprovar", { p_post: post, p_texto: texto, p_origem: origem }),
    tirarTranscricao: (post: string) => c<{ tirada: boolean }>("rede_transcricao_tirar", { p_post: post }),
    /** Os vídeos (até 50 posts): {post: vídeo}. Com o interruptor desligado no banco, nenhum. */
    videos: (ids: string[]) => c<Record<string, VideoDoPost>>("rede_video_dos_posts", { p_ids: ids.slice(0, 50) }),
    caminhoDoVideo: (id: string) => c<{ bucket: string; caminho: string; tipo: string }>("rede_video_caminho", { p_id: id }),
    /** Liga o vídeo já enviado ao post que a autora acabou de publicar (até 15 minutos depois). */
    ligar: (post: string, video: string, alt: string) => c<VideoDoPost>("rede_video_ligar", { p_post: post, p_video: video, p_alt: alt }),
    tirarVideo: (post: string) => c<{ tirado: boolean }>("rede_video_tirar", { p_post: post }),
  };
}

export type ClienteMidia = ReturnType<typeof criarClienteMidia>;

// ── O dublê da prévia ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A resposta do Bruno na conversa de exemplo (lib/rede/conversa/exemplos.ts): tem áudio, com a transcrição aprovada. */
export const RESPOSTA_COM_AUDIO_DE_EXEMPLO = "00000000-0000-4000-8000-0000000000c2";
/** O post da ocupação no Início de exemplo (lib/rede/publicar/exemplos-alumia2.ts): tem vídeo. */
export const POST_COM_VIDEO_DE_EXEMPLO = "exemplo-ocupacao";

const VIDEOS_DE_EXEMPLO: Record<string, VideoDoPost> = {
  [POST_COM_VIDEO_DE_EXEMPLO]: {
    id: "exemplo-video-ocupacao",
    tipo: "video/mp4",
    duracao_ms: 42_000,
    largura: 1280,
    altura: 720,
    som: true,
    alt: "A porta da ocupação Esperança de manhã cedo: moradores com faixas e a Defensoria conversando com o oficial de justiça.",
    meu: false,
  },
};

const TRANSCRICOES_DE_EXEMPLO: Record<string, TranscricaoDoPost> = {
  [RESPOSTA_COM_AUDIO_DE_EXEMPLO]: {
    texto:
      "Fiz a conta com as corridas de outubro. O cliente pagou mil oitocentos e quarenta reais e eu recebi mil cento e dois. O app ficou com quarenta por cento. Mandei a planilha no núcleo, quem quiser é só pedir.",
    origem: "aparelho",
  },
};

/** O áudio de exemplo (a duração em segundos), como os detalhes do post trariam. */
export function audioDeExemplo(post: string): { id: string; duracao: number } | null {
  return post === RESPOSTA_COM_AUDIO_DE_EXEMPLO ? { id: "exemplo-audio-bruno", duracao: 38 } : null;
}

export function criarDubleMidia(): ClienteMidia {
  const escolher = <T>(fonte: Record<string, T>, ids: string[]) => Object.fromEntries(ids.filter((id) => id in fonte).map((id) => [id, fonte[id]]));
  const transcricoes = { ...TRANSCRICOES_DE_EXEMPLO };
  return {
    transcricoes: async (ids) => escolher(transcricoes, ids),
    aprovar: async (post, texto, origem) => {
      transcricoes[post] = { texto, origem };
      return { post, texto, origem, aprovada_em: new Date().toISOString() };
    },
    tirarTranscricao: async (post) => {
      const tinha = post in transcricoes;
      delete transcricoes[post];
      return { tirada: tinha };
    },
    videos: async (ids) => escolher(VIDEOS_DE_EXEMPLO, ids),
    caminhoDoVideo: async () => {
      throw new Error("nao_encontrado");
    },
    ligar: async () => {
      throw new Error("desligado");
    },
    tirarVideo: async () => ({ tirado: false }),
  };
}

const previa = () => process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

let instancia: ClienteMidia | null = null;
/** O cliente de verdade, ou o dublê na prévia. */
export function midia(): ClienteMidia {
  instancia ??= previa() ? criarDubleMidia() : criarClienteMidia(chamar);
  return instancia;
}

// ── Lotes: vários cartões, uma chamada ────────────────────────────────────────────────────────────────────────────────────

/**
 * Junta os pedidos de um instante (30 ms) numa chamada de até 50 ids e guarda a resposta por id. Falha da chamada = nulo para
 * todos daquele lote (o cartão segue sem o anexo). Pura o bastante para o teste (recebe a função que busca).
 */
export function criarLote<T>(buscar: (ids: string[]) => Promise<Record<string, T>>, espera = 30) {
  const guardados = new Map<string, Promise<T | null>>();
  let fila: { id: string; resolver: (v: T | null) => void }[] = [];
  let marcado = false;
  const enviar = async () => {
    marcado = false;
    const agora = fila;
    fila = [];
    for (let i = 0; i < agora.length; i += 50) {
      const parte = agora.slice(i, i + 50);
      let r: Record<string, T> = {};
      try {
        r = await buscar([...new Set(parte.map((x) => x.id))]);
      } catch {
        // sem resposta: nulo para o lote, e o próximo pedido tenta de novo
        parte.forEach((x) => guardados.delete(x.id));
      }
      parte.forEach((x) => x.resolver(r[x.id] ?? null));
    }
  };
  const pedir = (id: string): Promise<T | null> => {
    const feito = guardados.get(id);
    if (feito) return feito;
    const p = new Promise<T | null>((resolver) => {
      fila.push({ id, resolver });
      if (!marcado) {
        marcado = true;
        setTimeout(() => void enviar(), espera);
      }
    });
    guardados.set(id, p);
    return p;
  };
  return { pedir, esquecer: (id: string) => void guardados.delete(id) };
}

let loteDeVideos: ReturnType<typeof criarLote<VideoDoPost>> | null = null;
let loteDeTranscricoes: ReturnType<typeof criarLote<TranscricaoDoPost>> | null = null;

export const videoDoPost = (id: string) => (loteDeVideos ??= criarLote((ids) => midia().videos(ids))).pedir(id);
export const esquecerVideo = (id: string) => loteDeVideos?.esquecer(id);
export const transcricaoDoPost = (id: string) => (loteDeTranscricoes ??= criarLote((ids) => midia().transcricoes(ids))).pedir(id);
export const esquecerTranscricao = (id: string) => loteDeTranscricoes?.esquecer(id);
