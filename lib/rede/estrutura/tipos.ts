// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos da estrutura das comunidades (onda 10, frente 10C), no formato que as funções de
// supabase/migracoes/20261116-alumia-o10-estrutura.sql devolvem. Nenhum deles traz pessoa: só lugares.
import type { HERANCAS, REPOSTS, RESPOSTAS } from "./regras";

export type Respostas = (typeof RESPOSTAS)[number];
export type Reposts = (typeof REPOSTS)[number];
export type Heranca = (typeof HERANCAS)[number];
export type TipoDeComunidade = "aberta" | "restrita" | "fechada";

/** Uma comunidade em forma curta. */
export interface ComunidadeCurta {
  slug: string;
  nome: string;
  descricao: string;
  tipo: TipoDeComunidade;
  categoria: "lutas" | "disciplinas" | "instituto";
  cor: string;
}

export interface Local {
  uf: string;
  municipio: string;
  bairro: string | null;
}

export interface OrgCurta {
  handle: string;
  codinome: string;
  selo: boolean;
}

/** alumia_estr_ver */
export interface Estrutura {
  comunidade: string;
  nome: string;
  modero: boolean;
  /** Modera por conta própria (não só pela herança da mãe): só assim ajusta a estrutura. Banco antigo, sem o campo: vale `modero`. */
  ajusto?: boolean;
  mae: ComunidadeCurta | null;
  /** Só para a moderação: o pedido à mãe ainda sem resposta. */
  mae_pedido: ComunidadeCurta | null;
  filhas: (ComunidadeCurta & { bairro: string | null; municipio: string | null })[];
  /** Só para a moderação: as comunidades que pediram para morar aqui. */
  pedidos_filhas: (ComunidadeCurta & { heranca: Heranca })[] | null;
  pode_ser_mae: boolean;
  pode_ser_filha: boolean;
  heranca: Heranca;
  so_leitura: boolean;
  respostas: Respostas;
  reposts: Reposts;
  local: Local | null;
  org: OrgCurta | null;
  org_pedido: OrgCurta | null;
  posso_abrir_post: boolean;
  posso_responder: boolean;
}

/** O que a moderação pode mudar (alumia_estr_salvar): só o que vier muda. */
export interface AjusteDaEstrutura {
  so_leitura?: boolean;
  respostas?: Respostas;
  reposts?: Reposts;
  heranca?: Heranca;
  uf?: string;
  municipio?: string;
  bairro?: string;
}

/** alumia_estr_espacos */
export interface Espacos {
  handle: string;
  codinome: string;
  selo: boolean;
  gerencio: boolean;
  comunidades: (ComunidadeCurta & { municipio: string | null; uf: string | null; bairro: string | null; posts_7d: number | null; filhas: ComunidadeCurta[] })[];
  nucleos: { id: string; nome: string; quando: string | null; cidade: string | null; uf: string | null }[];
  pedidos: ComunidadeCurta[] | null;
}

/** alumia_estr_cidades */
export interface CidadeComComunidades {
  uf: string;
  municipio: string;
  comunidades: number;
}

/** alumia_estr_da_cidade */
export interface ComunidadesDaCidade {
  uf: string;
  itens: (ComunidadeCurta & { municipio: string; bairro: string | null; situacao: "membro" | "pendente" | "banido" | null; posts_7d: number | null })[];
}

/** alumia_estr_origens */
export interface OrigemDoRepost {
  post: string;
  origem: ComunidadeCurta | null;
  restrita: boolean;
  perfil: boolean;
}

/** alumia_estr_proposta */
export interface EstruturaDaProposta {
  mae?: string;
  uf?: string;
  municipio?: string;
  bairro?: string;
}
