// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras de cargos e chegada que a tela e o teste leem (as mesmas de supabase/migracoes/20261116-alumia-o10-cargos.sql):
// a lista FECHADA de permissões, os limites dos campos, os prazos do fixado e as contas pequenas da tela. Puro: sem React e
// sem chamada ao banco (scripts/testar-alumia-o10-cargos.mjs importa daqui e confere com o SQL).

/** A lista fechada do que um cargo pode marcar. Cargo nenhum remove post, bane, nomeia moderação ou cria cargo. */
export const PERMISSOES = ["pedidos", "regras", "boas_vindas", "etiquetas", "fixar"] as const;
export type Permissao = (typeof PERMISSOES)[number];

export const LIMITES = {
  cargos: 12,
  cargoNomeMin: 2,
  cargoNome: 40,
  cargoDescricao: 240,
  etiquetas: 12,
  etiquetaMin: 2,
  etiqueta: 30,
  boasVindas: 1200,
  interesses: 8,
  interesseNomeMin: 2,
  interesseNome: 40,
  interesseTexto: 300,
} as const;

/** Os prazos que a tela oferece ao fixado, em dias (nulo = sem prazo). O banco aceita de 1 hora a 180 dias. */
export const PRAZOS_DO_FIXADO: readonly (number | null)[] = [null, 1, 3, 7, 14, 30];
export const PRAZO_MAXIMO_DIAS = 180;

export type QuemDa = "pessoa" | "moderacao";

export interface Cargo {
  id: string;
  nome: string;
  descricao: string;
  permissoes: Permissao[];
  /** Quantas pessoas têm o cargo, só a partir de 3 (abaixo, nulo). */
  pessoas: number | null;
}

export interface MeuCargo {
  id: string;
  nome: string;
  permissoes: Permissao[];
  situacao: "convidado" | "ativo";
}

export interface EtiquetaDePessoa {
  id: string;
  nome: string;
  quem_da: QuemDa;
}

export interface Interesse {
  chave: string;
  nome: string;
  texto: string;
}

export interface Chegada {
  boas_vindas: string;
  interesses: Interesse[];
  regras_antes: boolean;
  regras_em: string | null;
}

export interface PessoaDoCargo {
  cargo: string;
  usuario: string;
  codinome: string;
  handle: string | null;
  situacao: "convidado" | "ativo";
}

export interface FixadoComPrazo {
  post: string;
  trecho: string;
  ate: string | null;
}

export interface PainelDosCargos {
  comunidade: string;
  nome: string;
  tipo: "aberta" | "restrita" | "fechada";
  situacao: "membro" | "pendente" | "banido" | null;
  modero: boolean;
  permissoes: Permissao[];
  cargos: Cargo[];
  meus_cargos: MeuCargo[];
  etiquetas: EtiquetaDePessoa[];
  minha_etiqueta: { id: string; nome: string } | null;
  ofertas: { id: string; nome: string }[];
  chegada: Chegada;
  regras: { numero: number; titulo: string; texto: string }[];
  regras_lidas_em: string | null;
  precisa_ler: boolean;
  gestao: { pessoas?: PessoaDoCargo[]; fixados?: FixadoComPrazo[]; pedidos?: number };
}

/** Tem esta permissão aqui? */
export function pode(painel: Pick<PainelDosCargos, "permissoes"> | null | undefined, p: Permissao): boolean {
  return Boolean(painel?.permissoes.includes(p));
}

/** Cuida de alguma coisa aqui (moderação ou algum cargo aceito)? */
export function cuidaDeAlgo(painel: Pick<PainelDosCargos, "modero" | "permissoes"> | null | undefined): boolean {
  return Boolean(painel && (painel.modero || painel.permissoes.length > 0));
}

/** O @nome limpo como o banco procura (sem arroba, sem espaço, minúsculo); vazio se não sobrar nada. */
export function limparHandle(h: string): string {
  return h.trim().replace(/^@+/, "").trim().toLowerCase();
}

/** A data do fim do prazo, a partir de agora, em dias (nulo = sem prazo). */
export function fimDoPrazo(dias: number | null, agora = Date.now()): string | null {
  if (dias === null) return null;
  const d = Math.min(Math.max(dias, 1), PRAZO_MAXIMO_DIAS);
  return new Date(agora + d * 86_400_000).toISOString();
}

/** Quantos dias faltam (arredondado para cima; 0 se já passou). */
export function diasAte(iso: string | null | undefined, agora = Date.now()): number | null {
  if (!iso) return null;
  const falta = new Date(iso).getTime() - agora;
  return falta <= 0 ? 0 : Math.ceil(falta / 86_400_000);
}

/** As chaves dos interesses escolhidos que ainda existem (a comunidade pode ter tirado algum). */
export function escolhidosQueExistem(escolhidos: readonly string[], interesses: readonly Interesse[]): string[] {
  const existem = new Set(interesses.map((i) => i.chave));
  return [...new Set(escolhidos)].filter((c) => existem.has(c));
}

/** A chave do aparelho onde ficam os interesses escolhidos (o prefixo da Alumia: o Sair rápido apaga junto). */
export function chaveDosInteresses(slug: string): string {
  return `lucia:rede:interesses:${slug}`;
}
