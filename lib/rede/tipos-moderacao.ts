// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos do pacote de moderação da Rede v2 (supabase/migracoes/2026-11-rede-moderacao.sql, contrato em docs/rede/V2.md).
// Sem os atalhos "@/" de propósito (roda no Node nos testes). Quem denunciou nunca aparece em nenhum tipo daqui.

/** As categorias de denúncia. As cinco primeiras são prioridade 1 e entram na frente da fila. */
export const CATEGORIAS_DE_DENUNCIA = ["menores", "ameaca", "exposicao", "violencia", "autolesao", "odio", "assedio", "golpe", "spam", "outro"] as const;
export type CategoriaDeDenuncia = (typeof CATEGORIAS_DE_DENUNCIA)[number];

/** Prioridade da fila (a mesma de interno.rede2_prioridade): 1 primeiro. */
export const prioridadeDaCategoria = (c: CategoriaDeDenuncia): 1 | 2 | 3 =>
  c === "menores" || c === "ameaca" || c === "exposicao" || c === "violencia" || c === "autolesao" ? 1 : c === "odio" || c === "assedio" || c === "golpe" ? 2 : 3;

export type AlvoDeDenuncia = "post" | "perfil" | "comunidade";
export type SituacaoDaDenuncia = "aberta" | "em_analise" | "resolvida" | "descartada";
export type AcaoDeModeracao = "remover" | "restaurar" | "reter" | "travar" | "destravar" | "avisar" | "banir" | "desbanir";

/** Uma linha das regras dos níveis (rede_niveis): públicas. */
export interface RegraDeNivel {
  nivel: 0 | 1 | 2 | 3 | 4;
  nome: string;
  automatico: boolean;
  dias: number;
  participacoes: number;
  posts: number;
  sem_procedente: number;
  links: number;
  imagens: number;
  posts_dia: number;
}

export interface MeuNivel {
  nivel: number;
  nome: string;
  lider: boolean;
  dados: { dias: number; participacoes: number; posts: number };
  procedentes_90: number;
  atual: RegraDeNivel;
  proximo: RegraDeNivel | null;
  proximo_sem_procedente: boolean | null;
}

export interface EscopoDeModeracao {
  cuida: boolean;
  coord: boolean;
  comunidades: string[];
  nucleos: { id: string; nome: string }[];
}

export interface ResultadoDeDenuncia {
  protocolo: string;
  prioridade: 1 | 2 | 3;
  retido: boolean;
  ja: boolean;
}

export interface MinhaDenuncia {
  protocolo: string;
  alvo_tipo: AlvoDeDenuncia;
  categoria: CategoriaDeDenuncia;
  situacao: SituacaoDaDenuncia;
  criado_em: string;
  acao: string | null;
  regra: string | null;
}

/** Uma denúncia na fila. Sem quem denunciou; sem trecho quando o post é de núcleo (só abrindo). */
export interface ItemDaFila {
  id: string;
  protocolo: string;
  alvo_tipo: AlvoDeDenuncia;
  alvo: string;
  categoria: CategoriaDeDenuncia;
  prioridade: 1 | 2 | 3;
  situacao: SituacaoDaDenuncia;
  criado_em: string;
  texto: string;
  comunidade: string | null;
  titulo: string | null;
  trecho: string | null;
  nucleo: boolean;
  mesmas: number;
}

export interface AlvoAberto {
  id?: string;
  tipo?: string;
  titulo?: string | null;
  texto?: string;
  corpo?: string | null;
  comunidade?: string | null;
  publico?: string;
  criado_em?: string;
  oculto?: boolean;
  retido?: boolean;
  travado?: boolean;
  motivo?: string;
  autor?: string;
  autor_nivel?: number;
  autor_procedentes_90?: number;
  codinome?: string;
  handle?: string;
  bio?: string;
  nivel?: number;
  procedentes_90?: number;
  rotulo?: { checagem: string; veredito: string; titulo: string; criado_em: string } | null;
}

export interface DenunciaAberta {
  denuncia: ItemDaFila;
  alvo: AlvoAberto | null;
  historico: { id: string; acao: string; regra: string; motivo: string; criado_em: string; por: string | null }[];
}

export interface PostRetido {
  id: string;
  titulo: string | null;
  trecho: string;
  comunidade: string | null;
  motivo: string;
  criado_em: string;
  autor: string;
  autor_nivel: number;
}

export interface Decisao {
  id: string;
  acao: string;
  alvo_tipo: string;
  alvo: string | null;
  regra: string;
  motivo: string;
  criado_em: string;
  prazo: string;
  recurso: { situacao: "aberto" | "mantido" | "revertido"; criado_em: string; decidido_em: string | null } | null;
  pode_recorrer: boolean;
}

export interface RecursoDaFila {
  id: string;
  texto: string;
  criado_em: string;
  situacao: string;
  acao: { id: string; acao: string; alvo_tipo: string; alvo: string; regra: string; motivo: string; criado_em: string };
  /** A decisão contestada foi desta pessoa: outra pessoa precisa rever. */
  minha: boolean;
}

export type TipoDeSilencio = "pessoa" | "conversa" | "comunidade" | "palavra";
export interface Silenciado {
  id: string;
  tipo: TipoDeSilencio;
  rotulo: string;
  ate: string | null;
  criado_em: string;
}

export interface ItemDeLista {
  id: string;
  tipo: "palavra" | "pessoa";
  palavra: string | null;
  pessoa: string | null;
  motivo: string;
  criado_em: string;
}

export interface RotuloDeChecagem {
  checagem: string;
  veredito: string;
  titulo: string;
}

/** Uma checagem que o servidor entrega à tela de moderação (de content/checagens): slug, título, veredito. */
export interface ChecagemDisponivel {
  slug: string;
  titulo: string;
  veredito: string;
}

/** Os códigos de erro que este pacote acrescenta (a tela traduz por erros.<código> em i18n/rede/moderacao). */
export const ERROS_DA_MODERACAO = ["modo_lento", "nivel_links", "nivel_imagens", "limite_diario", "lista_bloqueio", "outra_pessoa", "prazo_vencido", "recurso_ja_feito", "muitos_silenciados", "lista_cheia"] as const;

/** Endereços das telas do pacote (relativos ao idioma). */
export const enderecosModeracao = {
  moderacao: (lang: string) => `/${lang}/alumia/moderacao`,
  denuncias: (lang: string) => `/${lang}/alumia/denuncias`,
  silenciados: (lang: string) => `/${lang}/alumia/silenciados`,
  cuidado: (lang: string) => `/${lang}/alumia/cuidado`,
  checagem: (lang: string, slug: string) => `/${lang}/checagens#${slug}`,
} as const;
