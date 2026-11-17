// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os formatos que as funções do acervo devolvem (supabase/migracoes/20261116-alumia-o10-acervo.sql). Nenhum traz lista de pessoas.
import type { Post } from "@/lib/rede/tipos";

export interface ColecaoResumo {
  id: string;
  titulo: string;
  descricao: string;
  mudou_em: string;
  /** Quantos posts esta pessoa vê na coleção (posts, nunca pessoas). */
  posts: number;
  /** Sugestões esperando (só para quem cuida; nulo para os outros). */
  sugestoes: number | null;
}

export interface ListaDeColecoes {
  itens: ColecaoResumo[];
  pode_criar: boolean;
  pode_sugerir: boolean;
}

export type DonoDaColecao = { tipo: "comunidade"; slug: string; nome: string; cor: string } | { tipo: "pessoa"; handle: string; nome: string };

export interface Colecao {
  id: string;
  titulo: string;
  descricao: string;
  mudou_em: string;
  dono: DonoDaColecao;
  pode_editar: boolean;
  itens: { post: Post; nota: string; meu: boolean }[];
  sugestoes: Post[] | null;
}

export interface DocResumo {
  id: string;
  titulo: string;
  versao: number;
  editado_em: string;
  tamanho: number;
}

export interface Doc {
  id: string;
  nucleo: string;
  titulo: string;
  corpo: string;
  versao: number;
  atual: number;
  editado_em: string;
  resumo?: string;
  editou?: string | null;
  media: boolean;
}

export interface VersaoDoDoc {
  versao: number;
  criado_em: string;
  resumo: string;
  tamanho: number;
  editou: string | null;
}

export interface ArquivoDoNucleo {
  id: string;
  nome: string;
  ext: "pdf" | "jpg" | "png" | "webp";
  tamanho: number;
  criado_em: string;
  caminho: string;
}

export interface ListaDeArquivos {
  itens: ArquivoDoNucleo[];
  usado: number;
  cota: number;
  por_arquivo: number;
  media: boolean;
}

export interface MesDoArquivo {
  mes: string;
  /** Nulo abaixo de 3 ("poucos posts"), como a contagem da semana. */
  posts: number | null;
}

export type QuemEditaAWiki = "membros" | "experientes" | "moderacao";

export interface RegrasDaWiki {
  quem: QuemEditaAWiki;
  modera: boolean;
  pode_desfazer: boolean;
}
