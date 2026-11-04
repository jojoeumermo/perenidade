// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos do pacote publicar (Rede v2, R4 15 a 23): o que as funções rede_pub_* devolvem e o que o `rede_publicar` ampliado
// aceita (supabase/migracoes/2026-11-rede-publicar.sql). Sem "@/" de propósito (roda no Node nos testes).
import type { PedidoDePost } from "./tipos";

export type RespondeQuem = "todos" | "seguindo" | "mencionados" | "ninguem";

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
}

/** O pedido de publicar com os campos do pacote. */
export interface PedidoPublicar extends PedidoDePost {
  enquete?: PedidoEnquete;
  midia?: MidiaEnviada[];
  audio?: AudioEnviado;
  previa?: Omit<PreviaDoPost, "dominio"> & { dominio?: string };
  fio?: boolean;
  responde_quem?: RespondeQuem;
}

export interface Agendado {
  id: string;
  quando: string;
  estado: "pendente" | "publicado" | "falhou";
  erro: string;
  post: string | null;
  texto: string;
}

export interface EdicaoAnterior {
  texto: string;
  quando: string;
}

/** Limites de uma imagem e de um áudio no cliente (o servidor e o banco conferem de novo). */
export const LIMITES_PUBLICAR = { imagens: 4, opcoesMin: 2, opcoesMax: 4, opcaoTexto: 80, audioSegundos: 60, textoAlt: 1000, horasMax: 168, janelaEdicaoMin: 15 } as const;
