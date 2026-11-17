// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras da frente 12B (voz e vídeo) que a tela e o banco dividem: os limites (os mesmos números de
// supabase/migracoes/20261118-alumia-o12-midia.sql, conferidos pelo teste), a taxa do vídeo regravado e as contas pequenas da
// tela. Tudo puro (os testes rodam no Node). Sem "@/" de propósito.

export const LIMITES_DA_MIDIA = {
  /** Vídeo curto no post: até 60 s (o banco aceita até 60,5 s por causa do arredondamento do gravador). */
  videoMs: 60_000,
  videoMinMs: 500,
  /** Até 16 MB por vídeo (o depósito "rede-video" barra acima disso). */
  videoBytes: 16 * 1024 * 1024,
  /** A medida do vídeo regravado: o lado longo até 1280, o curto até 720 (720p). */
  ladoLongo: 1280,
  ladoCurto: 720,
  /** O arquivo escolhido no aparelho pode ser grande (a regravação encolhe): até 500 MB. */
  originalBytes: 500 * 1024 * 1024,
  /** Reservas abertas por pessoa (vídeo enviado e ainda sem post). */
  reservasAbertas: 3,
  /** Minutos depois de publicar em que o vídeo ainda entra no post. */
  janelaDeLigarMin: 15,
  /** A descrição do vídeo (texto alternativo). */
  alt: 1000,
  /** A transcrição aprovada do áudio. */
  transcricao: 4000,
} as const;

const TETO_DA_TAXA = 2_200_000;
const PISO_DA_TAXA = 500_000;
export const TAXA_DO_AUDIO_DO_VIDEO = 96_000;

/**
 * A taxa do vídeo (bits/s) para o arquivo caber em 16 MB com folga (80%), descontado o áudio; nunca acima de 2,2 Mb/s (720p não
 * precisa de mais) nem abaixo de 0,5 Mb/s. Pura.
 */
export function taxaDoVideoDoPost(duracaoMs: number, som: boolean): number {
  const s = Math.max(1, Math.min(LIMITES_DA_MIDIA.videoMs, Number.isFinite(duracaoMs) ? duracaoMs : LIMITES_DA_MIDIA.videoMs) / 1000);
  const orcamento = Math.floor((LIMITES_DA_MIDIA.videoBytes * 8 * 0.8) / s) - (som ? TAXA_DO_AUDIO_DO_VIDEO : 0);
  return Math.max(PISO_DA_TAXA, Math.min(TETO_DA_TAXA, orcamento));
}

/** A medida em até 720p sem esticar e sem deitar o vídeo em pé (o lado longo até 1280, o curto até 720), sempre par. Pura. */
export function medidaDoVideoDoPost(largura: number, altura: number): { largura: number; altura: number } {
  if (!(largura > 0 && altura > 0)) return { largura: 0, altura: 0 };
  const longo = Math.max(largura, altura);
  const curto = Math.min(largura, altura);
  const escala = Math.min(1, LIMITES_DA_MIDIA.ladoLongo / longo, LIMITES_DA_MIDIA.ladoCurto / curto);
  const par = (n: number) => Math.max(2, Math.round((n * escala) / 2) * 2);
  return { largura: par(largura), altura: par(altura) };
}

/** O trecho escolhido, em ms: dentro do vídeo, com pelo menos 1 s (se o vídeo tiver) e no máximo 60 s. Puro. */
export function trechoDoVideo(inicio: number, total: number): { inicio: number; fim: number } {
  const t = Math.max(0, Number.isFinite(total) ? total : 0);
  const max = Math.min(LIMITES_DA_MIDIA.videoMs, t);
  const i = Math.min(Math.max(0, Number.isFinite(inicio) ? inicio : 0), Math.max(0, t - Math.min(1000, t)));
  const fim = Math.min(t, i + max);
  return { inicio: Math.round(Math.max(0, fim - max)), fim: Math.round(fim) };
}

/** "0:07", "1:00". */
export function relogioDoVideo(ms: number): string {
  const s = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** O formato do gravador do navegador vira a extensão e o tipo que o banco aceita (o que vem depois do ";" não conta). */
export function formatoDoVideo(mime: string): { ext: "mp4" | "webm"; tipo: "video/mp4" | "video/webm" } | null {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  if (base === "video/mp4") return { ext: "mp4", tipo: "video/mp4" };
  if (base === "video/webm") return { ext: "webm", tipo: "video/webm" };
  return null;
}

/** O formato do gravador: MP4 (H.264 e AAC, toca em todo aparelho) quando o navegador grava; senão WEBM. Nulo = sem gravador. */
export function escolherGravacao(suporta: (tipo: string) => boolean): string | null {
  for (const o of ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) {
    try {
      if (suporta(o)) return o;
    } catch {
      /* navegador que joga erro em vez de dizer "não" */
    }
  }
  return null;
}

/**
 * O vídeo cabe neste post? Um tipo de mídia por post (fotos, áudio ou vídeo) e só no post de primeiro nível. Devolve o motivo
 * (chave dos textos) ou nulo quando cabe. Pura.
 */
export function motivoSemVideo(p: { resposta: boolean; imagens: number; audio: boolean }): "resposta" | "umTipo" | null {
  if (p.resposta) return "resposta";
  if (p.imagens > 0 || p.audio) return "umTipo";
  return null;
}

/** A transcrição limpa como o banco guarda: sem espaço nas pontas e sem linhas vazias repetidas; nulo se ficou vazia ou longa. */
export function transcricaoLimpa(texto: string): string | null {
  const t = (texto ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!t || t.length > LIMITES_DA_MIDIA.transcricao) return null;
  return t;
}
