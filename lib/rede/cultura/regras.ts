// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras da cultura da Alumia (prompt 4, itens 38 a 42), a parte pura: as mesmas listas e conferências que o banco faz em
// supabase/migracoes/20261127-p4-cultura.sql, para a tela avisar antes de mandar. O banco confere de novo; aqui é só conforto.
// Sem os atalhos "@/" de propósito (roda no Node nos testes).

export const GENEROS = ["conto", "cordel", "poesia", "hq"] as const;
export type Genero = (typeof GENEROS)[number];

export const LINGUAGENS = ["desenho", "pintura", "fotografia", "gravura", "lambe", "grafite", "musica", "poesia", "danca", "teatro", "artesanato", "audiovisual", "outra"] as const;
export type Linguagem = (typeof LINGUAGENS)[number];

export const LOCAIS = ["praca", "biblioteca", "sindicato", "escola", "universidade", "associacao", "online", "outro"] as const;
export type Local = (typeof LOCAIS)[number];

export const SITUACOES_DO_LIVRO = ["lendo", "proximo", "lido"] as const;
export type SituacaoDoLivro = (typeof SITUACOES_DO_LIVRO)[number];

/** O começo do endereço da imagem que o proxy assinado do nosso servidor devolve. Nenhuma outra imagem entra na playlist. */
export const PREFIXO_DA_IMAGEM = "/api/rede/previa/imagem?";

/**
 * O link da playlist como o banco aceita: http ou https, sem usuário e senha na frente, com um domínio de verdade. Devolve o link
 * (sem espaços em volta) e o domínio em minúsculas, ou nulo.
 */
export function linkDaPlaylist(texto: string): { url: string; dominio: string } | null {
  const url = texto.trim();
  if (url.length < 10 || url.length > 500 || !/^https?:\/\/[^/@\s]+(\/\S*)?$/i.test(url)) return null;
  const dominio = (/^[A-Za-z]+:\/\/([^/:?#]+)/.exec(url)?.[1] ?? "").toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z0-9-]{2,}$/.test(dominio) || dominio.length > 120) return null;
  return { url, dominio };
}

/** A imagem da prévia só serve se vier do nosso proxy assinado (o aparelho nunca busca a imagem no serviço de fora). */
export function imagemDaPrevia(imagem: string | null | undefined): string | null {
  return typeof imagem === "string" && imagem.startsWith(PREFIXO_DA_IMAGEM) && imagem.length <= 1500 ? imagem : null;
}

/** O local de encontro é público? Rua, avenida e afins com número, ou CEP, o banco recusa (endereço de casa). */
export function localPublico(texto: string): boolean {
  return !/\b(rua|avenida|av\.?|travessa|alameda|estrada|rodovia)\b[^;]{0,60}\d/i.test(texto) && !/\d{5}-?\d{3}/.test(texto);
}

/** Um ano de filme aceitável (vazio vale: o ano é opcional). */
export function anoOk(texto: string): boolean {
  const t = texto.trim();
  if (!t) return true;
  if (!/^\d{4}$/.test(t)) return false;
  const n = Number(t);
  return n >= 1880 && n <= 2100;
}

/** O progresso de leitura em degraus de 10 (o que a tela oferece). */
export const DEGRAUS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

/** Os 128 bits de um id de post, no formato de sempre. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O id do post a partir do que a pessoa colou: o endereço do post na Alumia (/alumia/p/<id> ou /p/<id>, com ou sem o domínio) ou o
 * id sozinho. Qualquer outra coisa: nulo (o banco confere de novo que o post é dela, está no ar e não é cifrado).
 */
export function postDoEndereco(texto: string): string | null {
  const t = texto.trim();
  if (!t || t.length > 300) return null;
  if (UUID.test(t)) return t.toLowerCase();
  const m = /(?:^|\/)p\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(t);
  return m && UUID.test(m[1]) ? m[1].toLowerCase() : null;
}
