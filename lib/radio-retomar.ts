// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A rádio que continua depois de recarregar (Etapa 4, pacote E4-06, ideia D1-3; docs/escola/som.md). Aqui só a parte
// pura, que os testes rodam no Node (npm run testar:som): a forma do que fica guardado em "lucia:radio-retomar", a
// conferência ao ler e a montagem a partir da faixa. Quem grava e lê o armazenamento é lib/radio.ts.
//
// O que fica guardado é só o que já é público: o endereço da transmissão ou do episódio, o título, o nome da emissora,
// a posição e a hora. Nada sobre a pessoa. A posição de cada faixa continua morando em "lucia:radio" (positions, em
// lib/radio.ts), que é quem de fato faz o som voltar ao ponto certo; a posição daqui só serve para o texto do aviso
// ("Continuar: <título> · 12:30"). Assim as duas nunca disputam: retomar é tocar de novo a faixa, e a faixa volta
// pelo positions, como sempre voltou.
// Sem os atalhos "@/" de propósito.

/** A chave no aparelho. Já está na lista "só apagar" de lib/estudo.ts (fica fora da cópia e sai no "apagar meus dados"). */
export const CHAVE_RETOMAR = "lucia:radio-retomar";
/** Depois de 24 horas o aviso não aparece mais. */
export const PRAZO_RETOMAR = 24 * 60 * 60 * 1000;
/** Relógio do aparelho um pouco adiantado não invalida a gravação; muito no futuro, sim. */
const FOLGA_DO_RELOGIO = 5 * 60 * 1000;
const MAX_TEXTO = 200;

export interface Retomada {
  /** A emissora (transmissão ao vivo ou faixa de canal da rádio). */
  canal?: string;
  /** O episódio de podcast. */
  episodio?: string;
  /** O identificador da faixa (o mesmo de positions). */
  faixa: string;
  /** Em segundos. Na transmissão ao vivo é sempre 0. */
  posicao: number;
  titulo: string;
  artista: string;
  /** O endereço público do som (https, ou um caminho do próprio site). */
  url: string;
  aoVivo: boolean;
  /** Quando foi gravado (milissegundos desde 1970). */
  em: number;
  /** Só para episódio de podcast: o que o tocador precisa para mostrar a capa e o link (tudo público). */
  podcast?: { capa: string; href: string; duracao: number };
}

/** A faixa como o tocador conhece (o mesmo formato de Track, em lib/radio.ts, sem importar o arquivo do navegador). */
export interface FaixaParaRetomar {
  id: string;
  titulo: string;
  artista: string;
  url: string;
  live?: boolean;
  podcast?: { episodio: string; capa: string; href: string; duracao: number };
}

const texto = (v: unknown, max = MAX_TEXTO): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const textoOpcional = (v: unknown, max = MAX_TEXTO) => v === undefined || (typeof v === "string" && v.length <= max);

/** Só endereço https ou caminho do próprio site ("/..."), nunca "//outro-site", "javascript:" ou "data:". */
export function enderecoPublico(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 2000) return false;
  if (url.startsWith("/")) return !url.startsWith("//") && !url.includes("\\");
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Caminho do próprio site (o link do episódio). */
const caminhoDoSite = (v: unknown): v is string => typeof v === "string" && v.length <= 300 && /^\/(?!\/)[\w\-./~%]*$/.test(v);
/** Caminho do arquivo da capa no depósito público do podcast (só letras, números e - _ . /), ou vazio. */
const caminhoDaCapa = (v: unknown): v is string => typeof v === "string" && v.length <= 300 && /^[\w\-./]*$/.test(v) && !v.includes("..");

/**
 * Lê o que estava guardado. Devolve null se não há nada, se a forma está errada (JSON quebrado, campo faltando, tipo
 * trocado, endereço que não é público) ou se passou do prazo de 24 horas.
 */
export function lerRetomada(bruto: string | null | undefined, agora: number): Retomada | null {
  if (!bruto) return null;
  let dado: unknown;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (!dado || typeof dado !== "object" || Array.isArray(dado)) return null;
  const d = dado as Record<string, unknown>;
  if (!texto(d.faixa) || !texto(d.titulo) || !enderecoPublico(d.url)) return null;
  if (typeof d.artista !== "string" || d.artista.length > MAX_TEXTO) return null;
  if (typeof d.posicao !== "number" || !Number.isFinite(d.posicao) || d.posicao < 0) return null;
  if (typeof d.em !== "number" || !Number.isFinite(d.em)) return null;
  if (typeof d.aoVivo !== "boolean") return null;
  if (!textoOpcional(d.canal) || !textoOpcional(d.episodio)) return null;
  // Uma das duas origens, nunca as duas nem nenhuma.
  if (Boolean(d.canal) === Boolean(d.episodio)) return null;
  if (agora - d.em > PRAZO_RETOMAR || d.em - agora > FOLGA_DO_RELOGIO) return null;
  let podcast: Retomada["podcast"];
  if (d.podcast !== undefined) {
    const p = d.podcast as Record<string, unknown> | null;
    if (!p || typeof p !== "object" || !caminhoDaCapa(p.capa) || !caminhoDoSite(p.href) || typeof p.duracao !== "number" || !Number.isFinite(p.duracao) || p.duracao < 0) return null;
    podcast = { capa: p.capa, href: p.href, duracao: Math.floor(p.duracao) };
  }
  if (d.episodio && !podcast) return null;
  return {
    ...(d.canal ? { canal: d.canal as string } : {}),
    ...(d.episodio ? { episodio: d.episodio as string } : {}),
    faixa: d.faixa,
    posicao: d.aoVivo ? 0 : Math.floor(d.posicao),
    titulo: d.titulo,
    artista: d.artista,
    url: d.url,
    aoVivo: d.aoVivo,
    em: d.em,
    ...(podcast ? { podcast } : {}),
  };
}

/** Monta o que vai ser guardado a partir da faixa que está tocando. Null se a faixa não tem endereço público. */
export function montarRetomada(faixa: FaixaParaRetomar, posicao: number, agora: number): Retomada | null {
  if (!enderecoPublico(faixa.url) || !texto(faixa.id) || !texto(faixa.titulo)) return null;
  const aoVivo = Boolean(faixa.live);
  const ep = faixa.podcast;
  if (ep && (!texto(ep.episodio) || !caminhoDaCapa(ep.capa) || !caminhoDoSite(ep.href))) return null;
  return {
    ...(ep ? { episodio: ep.episodio } : { canal: faixa.id }),
    faixa: faixa.id,
    posicao: aoVivo || !Number.isFinite(posicao) ? 0 : Math.max(0, Math.floor(posicao)),
    titulo: faixa.titulo.slice(0, MAX_TEXTO),
    artista: (faixa.artista ?? "").slice(0, MAX_TEXTO),
    url: faixa.url,
    aoVivo,
    em: agora,
    ...(ep ? { podcast: { capa: ep.capa, href: ep.href, duracao: Math.max(0, Math.floor(ep.duracao || 0)) } } : {}),
  };
}

/** A faixa de volta, no formato do tocador (o episódio volta sem a forma da onda e sem os capítulos, que não são guardados). */
export function faixaDaRetomada(r: Retomada): FaixaParaRetomar & { podcast?: FaixaParaRetomar["podcast"] & { picos: number[]; capitulos: [] } } {
  return {
    id: r.faixa,
    titulo: r.titulo,
    artista: r.artista,
    url: r.url,
    ...(r.aoVivo ? { live: true } : {}),
    ...(r.podcast && r.episodio ? { podcast: { episodio: r.episodio, capa: r.podcast.capa, href: r.podcast.href, duracao: r.podcast.duracao, picos: [], capitulos: [] as [] } } : {}),
  };
}
