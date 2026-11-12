// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos do pacote publicar (Rede v2, R4 15 a 23): o que as funções rede_pub_* devolvem e o que o `rede_publicar` ampliado
// aceita (supabase/migracoes/2026-11-rede-publicar.sql). Sem "@/" de propósito (roda no Node nos testes).
import type { PedidoDePost } from "./tipos";
import type { Repeticao } from "./tipos-b1";

export type RespondeQuem = "todos" | "seguindo" | "mencionados" | "ninguem";

/** Quem pode citar (repostar com comentário) um post. Padrão dos posts novos: ninguém (B1, 20261110-alumia-b1-casca.sql). */
export type CitarQuem = "ninguem" | "seguindo" | "todos";

export interface OpcaoDaEnquete {
  id: string;
  texto: string;
  /** Só aparece para quem votou, para quem fez a enquete ou depois do prazo; para os outros vem nulo. */
  votos: number | null;
}

/** A enquete como esta pessoa pode ver. Voto secreto: nunca há "quem votou em quê", só totais. */
export interface EnqueteDoPost {
  prazo: string;
  multipla: boolean;
  encerrada: boolean;
  votei: string[];
  opcoes: OpcaoDaEnquete[];
  total: number | null;
  /** B1: o resultado só aparece depois do prazo, para todo mundo (nem quem fez vê a parcial). */
  so_no_fim?: boolean;
  /** B1: as opções vêm numa ordem própria desta pessoa. */
  embaralhada?: boolean;
}

export interface PreviaDoPost {
  url: string;
  dominio: string;
  titulo: string;
  descricao: string;
  /** Endereço do proxy assinado do servidor (nunca o do site de fora). */
  imagem?: string;
}

/** O que um post tem a mais além do que a linha traz (rede_pub_detalhes). */
export interface DetalhesDoPost {
  audio?: { id: string; duracao: number; tipo: string };
  enquete?: EnqueteDoPost;
  previa?: PreviaDoPost;
  responde_quem: RespondeQuem;
  fio: boolean;
  editado: boolean;
  /** Há texto anterior guardado (edição depois dos 15 minutos). */
  historico: boolean;
  /** O autor ainda está na janela de 15 minutos: editar sem marca. */
  janela_livre?: boolean;
  /** B1: esta pessoa pode citar o post (só com conta; resposta não tem). */
  citar?: boolean;
  /** B1: a escolha de quem pode citar (só para o autor). */
  citar_quem?: CitarQuem;
}

export interface MidiaEnviada {
  caminho: string;
  alt: string;
  largura: number | null;
  altura: number | null;
}

export interface AudioEnviado {
  caminho: string;
  duracao: number;
}

export interface PedidoEnquete {
  opcoes: string[];
  /** Prazo em horas, de 1 a 168 (7 dias). */
  horas: number;
  multipla?: boolean;
  /** B1: resultado só no fim. */
  so_no_fim?: boolean;
  /** B1: ordem embaralhada por pessoa. */
  embaralhar?: boolean;
}

/** O pedido de publicar com os campos do pacote. */
export interface PedidoPublicar extends PedidoDePost {
  enquete?: PedidoEnquete;
  midia?: MidiaEnviada[];
  audio?: AudioEnviado;
  previa?: Omit<PreviaDoPost, "dominio"> & { dominio?: string };
  fio?: boolean;
  responde_quem?: RespondeQuem;
  /** B1 (rede_pub_publicar_mais): quem pode citar. */
  citar_quem?: CitarQuem;
}

export interface Agendado {
  id: string;
  quando: string;
  estado: "pendente" | "publicado" | "falhou";
  erro: string;
  post: string | null;
  texto: string;
  /** B1: a repetição (toda semana, a cada 15 dias, todo mês), em que vez está e de quantas (nulo: série sem total, até a data final). */
  repetir?: Repeticao | null;
  vezes?: number;
  repetir_vezes?: number | null;
  repetir_ate?: string | null;
  /** B1: o número da série (o mesmo das séries da comunidade, rede_alumia_series). */
  serie?: string | null;
  /** B1: sai quando o ato terminar. */
  apos_ato?: boolean;
}

/** B1: as opções de agendar (rede_pub_agendar_mais). */
export interface OpcoesDeAgendar {
  repetir?: Repeticao;
  vezes?: number;
  apos_ato?: string;
}

/** B1: um ato que a própria pessoa chamou e ainda não acabou (para "quando o ato terminar"). */
export interface MeuAto {
  id: string;
  nome: string;
  fim: string;
}

/** B1: o que se corrige depois de publicar (rede_pub_corrigir). */
export interface CorrecaoDoPost {
  aviso?: string;
  alts?: { id: string; alt: string }[];
  tirar?: string[];
  citar_quem?: CitarQuem;
}

export interface EdicaoAnterior {
  texto: string;
  quando: string;
}

/** Limites de uma imagem e de um áudio no cliente (o servidor e o banco conferem de novo). */
export const LIMITES_PUBLICAR = { imagens: 4, opcoesMin: 2, opcoesMax: 4, opcaoTexto: 80, audioSegundos: 60, textoAlt: 1000, horasMax: 168, janelaEdicaoMin: 15 } as const;
