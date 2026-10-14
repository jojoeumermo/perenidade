// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o site e o painel compartilham sobre o podcast: os formatos que o banco devolve e as contas pequenas
// (duração, legendas, endereço do áudio). Sem "use client": serve também às páginas montadas no servidor.

export const TEMAS = ["historia", "economia", "luta-social", "enem", "filosofia", "cultura", "ciencia", "trabalho", "educacao", "internacional", "memoria", "atualidade"] as const;
export type Tema = (typeof TEMAS)[number];

export interface Capitulo {
  t: number;
  titulo: string;
}

export interface ObraCitada {
  id: string;
  titulo: string;
  autor: string;
  licenca: string;
  fonte: string;
}

export interface FonteCitada {
  titulo: string;
  autor?: string;
  url?: string;
  ano?: string;
}

/** Um episódio como o site recebe do banco (podcast_catalogo e podcast_episodio). */
export interface Episodio {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  capa: string;
  capa_mini: string;
  duracao: number;
  publicado_em: string;
  temporada: number | null;
  numero: number | null;
  temas: Tema[];
  disciplina: string | null;
  trilha: string | null;
  explicito: boolean;
  /** Caminho no depósito público; vazio quando o áudio saiu do depósito e toca pela cópia de fora. */
  audio: string;
  audio_bytes: number;
  audio_tipo: string;
  externo: string;
  serie: { slug: string; titulo: string } | null;
  plays: number;
  // Só na página do episódio:
  notas?: string;
  fontes?: FonteCitada[];
  obras?: ObraCitada[];
  capitulos?: Capitulo[];
  transcricao?: string;
  legendas?: string;
  picos?: number[];
  topico?: string | null;
  convidados?: { nome: string; minibio: string }[];
}

export interface Serie {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  capa: string;
  capa_mini: string;
}

export interface Links {
  spotify?: string;
  apple?: string;
  youtube?: string;
  deezer?: string;
  amazon?: string;
  archive?: string;
  instagram?: string;
  tiktok?: string;
}

export interface Catalogo {
  config: { nome: string; descricao: string; autor: string; capa: string; capa_mini: string; links: Links } | null;
  series: Serie[];
  episodios: Episodio[];
}

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

/** Endereço público de um arquivo do depósito do podcast (capa ou áudio). */
export const arquivoPublico = (caminho: string) => (caminho ? `${base}/storage/v1/object/public/podcast/${caminho.split("/").map(encodeURIComponent).join("/")}` : "");

/** O áudio que toca: o do depósito, enquanto está lá; depois, a cópia de fora. */
export const enderecoDoAudio = (e: Pick<Episodio, "audio" | "externo">) => (e.audio ? arquivoPublico(e.audio) : e.externo);

/** 3725 → "1:02:05"; 125 → "2:05". */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** "12:40" ou "1:02:05" → segundos. Devolve null se não for um tempo. */
export function lerRelogio(texto: string): number | null {
  const partes = texto.trim().split(":");
  if (partes.length < 2 || partes.length > 3 || partes.some((p) => !/^\d{1,2}$/.test(p))) return null;
  return partes.reduce((total, parte) => total * 60 + Number(parte), 0);
}

/** Duração para gente: "38 min", "1 h 12 min". */
export function minutos(segundos: number): string {
  const total = Math.max(1, Math.round((segundos || 0) / 60));
  return total >= 60 ? `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")} min` : `${total} min`;
}

export interface Trecho {
  inicio: number;
  fim: number;
  texto: string;
}

const tempoVtt = (t: string) => {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(t.trim());
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000 : null;
};

/** Lê legendas WebVTT ou SRT e devolve os trechos com tempo. */
export function lerLegendas(texto: string): Trecho[] {
  const trechos: Trecho[] = [];
  for (const bloco of texto.replace(/\r/g, "").split(/\n{2,}/)) {
    const linhas = bloco.split("\n").filter((linha) => linha.trim() !== "");
    const i = linhas.findIndex((linha) => linha.includes("-->"));
    if (i < 0) continue;
    const [de, ate] = linhas[i].split("-->").map((parte) => tempoVtt(parte.trim().split(/\s+/)[0]));
    const fala = linhas
      .slice(i + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (de !== null && ate !== null && fala) trechos.push({ inicio: de, fim: ate, texto: fala });
  }
  return trechos;
}

const vtt = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};

/** Trechos com tempo → WebVTT (é como as legendas ficam guardadas). */
export function escreverVtt(trechos: Trecho[]): string {
  return ["WEBVTT", "", ...trechos.map((t) => `${vtt(t.inicio)} --> ${vtt(t.fim)}\n${t.texto}\n`)].join("\n");
}

/** Capítulos a partir de linhas "00:00 Abertura" / "12:40 O cerco de Paris". */
export function lerCapitulos(texto: string): Capitulo[] {
  return texto
    .split("\n")
    .map((linha) => /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–—]?\s*(.+)$/.exec(linha))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ t: lerRelogio(m[1]) ?? 0, titulo: m[2].trim().slice(0, 120) }))
    .sort((a, b) => a.t - b.t);
}

export const escreverCapitulos = (lista: Capitulo[]) => lista.map((c) => `${relogio(c.t)} ${c.titulo}`).join("\n");
