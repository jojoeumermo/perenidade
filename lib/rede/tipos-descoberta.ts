// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos do pacote descoberta da Rede v2 (supabase/migracoes/2026-11-rede-descoberta.sql, docs/rede/V2.md): primeira entrada
// guiada, pacotes de pessoas, linhas temáticas, ordenações, hashtag, Explorar e busca. Sem "@/" de propósito (roda no Node nos testes).
import type { Post } from "./tipos";

/** As ordenações, com a fórmula escrita em i18n/rede/descoberta (ordens). "relevancia" só existe na busca. */
export const ORDENS = ["novos", "uteis", "sem_resposta", "em_debate"] as const;
export type Ordem = (typeof ORDENS)[number];
export type OrdemDaBusca = "relevancia" | "novos";

/** Os passos da primeira entrada, na ordem. Só o guia pode ser pulado. */
export const PASSOS = ["regras", "consentimento", "idade", "codinome", "escolhas", "guia"] as const;
export type Passo = (typeof PASSOS)[number];

/** Onde a pessoa está, segundo o banco (os passos que dependem de gravação). */
export interface EstadoDaEntrada {
  passo: "entrar" | "suspensa" | "regras" | "codinome" | "escolhas" | "guia" | "pronto";
  regras_versao: number;
  codinome?: string | null;
  escolhas?: boolean;
  guia?: boolean;
  /** Deixou lutas, trilhas e guia para depois (T18; supabase/migracoes/20261106-t18-alumia-entrada.sql). */
  adiou?: boolean;
  aparece?: boolean;
  lutas?: string[];
  trilhas?: string[];
}

export interface LutaOpcao {
  slug: string;
  nome: string;
  descricao: string;
  cor: string;
}

/** Uma trilha do catálogo do site (a lista vem de /api/rede/trilhas/[lang]). */
export interface TrilhaOpcao {
  slug: string;
  titulo: string;
  area: string;
}

export interface PaginaOrdenada {
  itens: Post[];
  proximo: string | null;
  ordem: string;
  /** A lista chegou ao teto de 100 posts: acabou de propósito (nada de rolagem sem fim). */
  fim_por_teto: boolean;
}

export interface PaginaDaTag extends PaginaOrdenada {
  tag: string;
  linha: { slug: string; titulo: string; regra: string } | null;
}

export interface PessoaDaBusca {
  codinome: string;
  handle: string;
  equipe: boolean;
}

export interface ResultadoDaBusca extends PaginaOrdenada {
  q: string;
  curta?: boolean;
  so_comuns?: boolean;
  pessoas: PessoaDaBusca[];
  comunidades: { slug: string; nome: string; categoria: string; tipo: string }[];
}

export interface LinhaTematica {
  slug: string;
  titulo: string;
  regra: string;
}

export interface ResumoDoPacote {
  slug: string;
  titulo: string;
  descricao: string;
  pessoas: number;
}

export interface PacoteDePessoas {
  slug: string;
  titulo: string;
  descricao: string;
  pessoas: { codinome: string; handle: string; bio: string; equipe: boolean; sigo: boolean }[];
}

export interface Explorar {
  tags: { tag: string; posts: number }[];
  comunidades: { slug: string; nome: string; descricao: string; categoria: "lutas" | "disciplinas" | "instituto"; tipo: string; cor: string; membro: boolean }[];
  linhas: LinhaTematica[];
  pacotes: ResumoDoPacote[];
  ordens: Ordem[];
  eu: EstadoDaEntrada | null;
}

export interface FiltrosDaLinha {
  linha?: string;
  tag?: string;
  categoria?: "lutas" | "disciplinas" | "instituto";
  tipo?: string;
  comunidade?: string;
}

/** Os endereços do pacote (relativos ao idioma). */
export const enderecosDescoberta = {
  explorar: (lang: string, linha?: string) => `/${lang}/alumia/explorar${linha ? `?linha=${encodeURIComponent(linha)}` : ""}`,
  buscar: (lang: string, q?: string, ordem?: OrdemDaBusca) =>
    `/${lang}/alumia/buscar${q ? `?q=${encodeURIComponent(q)}${ordem && ordem !== "relevancia" ? `&ordem=${ordem}` : ""}` : ""}`,
  tag: (lang: string, tag: string) => `/${lang}/alumia/tag/${tag}`,
} as const;

/** Só o que o banco aceita como hashtag: letras minúsculas sem acento, números e "_", 2 a 40, com ao menos uma letra. */
export const tagOk = (s: string): boolean => /^[a-z0-9_]{2,40}$/.test(s) && /[a-z_]/.test(s);

/** Tira o "#" e o acento e põe em minúsculas, como o banco: o que sobra pode (ou não) ser tag. */
export const normalizarTag = (s: string): string =>
  s
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Parte um texto em pedaços de texto e hashtags (a mesma regra do banco: "#" depois de começo ou de espaço/pontuação, nunca no meio
 * de uma palavra, de um endereço ou de "&#"). Serve para o cartão do post virar link sem inventar tag que o banco não reconhece.
 */
export function partirComTags(texto: string): { tag?: string; texto: string }[] {
  const saida: { tag?: string; texto: string }[] = [];
  const re = /(^|[^\p{L}\p{N}_/&#])#([\p{L}\p{N}_]{2,40})(?![\p{L}\p{N}_])/gu;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    const inicio = (m.index ?? 0) + m[1].length;
    const tag = normalizarTag(m[2]);
    if (!tagOk(tag)) continue;
    if (inicio > ultimo) saida.push({ texto: texto.slice(ultimo, inicio) });
    saida.push({ tag, texto: `#${m[2]}` });
    ultimo = inicio + 1 + m[2].length;
  }
  if (ultimo < texto.length) saida.push({ texto: texto.slice(ultimo) });
  return saida;
}
