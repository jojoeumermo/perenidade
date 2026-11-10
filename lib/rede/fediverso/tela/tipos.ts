// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Gente de FORA na tela da Alumia: os formatos que as rotas app/api/fediverso/** devolvem (o cartão é o de
// interno.rede_fed_cartao, supabase/migracoes/20261109-fediverso-total.sql) e as regras puras que a tela usa. Sem estado e sem
// navegador, para os testes (scripts/testar-fediverso-tela.mjs) rodarem no Node. Sem "@/" de propósito.
//
// Privacidade: imagem de fora só pela rota-proxy daqui (midiaSegura); número só a partir de 3 (contagemVisivel); nenhuma lista
// de quem curtiu ou impulsionou existe nestes formatos.
import { MINIMO_DE_PESSOAS } from "../../publicar/alumia2";
import type { AutorDoPost, Post } from "../../tipos";

/** Uma imagem (ou vídeo, áudio) de um post de fora. `url` já é a da rota-proxy (/api/fediverso/midia?…), nunca a de fora. */
export interface MidiaDeFora {
  url: string;
  tipo: string;
  alt: string;
  largura: number | null;
  altura: number | null;
  blurhash: string | null;
}

export type VisibilidadeDeFora = "publico" | "nao_listado" | "seguidores";

/** Quem impulsionou (só na linha, quando o post chegou por impulso de alguém que a pessoa segue). */
export interface ImpulsoDeFora {
  ator: string;
  handle: string | null;
  nome: string | null;
  /** Pela rota-proxy ou nulo. A tela mostra o mosaico pelo handle, não a foto. */
  avatar: string | null;
  em: string;
}

/**
 * O post de fora, no MESMO formato de cartão dos posts daqui (as chaves de Post, neutras onde não se aplica), mais o que é
 * próprio de fora. `id` é o endereço (https) da nota: é ele que vai em interagir, responder e denunciar.
 */
export interface CartaoDeFora extends Omit<Post, "midia" | "autor"> {
  origem: "fediverso";
  /** O HTML já limpo no servidor. Só entra na tela por HtmlDeFora (lista permitida), nunca cru. */
  html: string | null;
  visibilidade: VisibilidadeDeFora;
  sensivel: boolean;
  autor: AutorDoPost & { remoto: true };
  /** O endereço (https) do ator: é ele que vai em seguir, bloquear e silenciar. */
  ator_remoto: string;
  /** "tiao@mastodon.social" (sem o @ da frente), ou nulo se a origem não disse. */
  handle_remoto: string | null;
  nome_remoto: string | null;
  /** Pela rota-proxy ou nulo. A tela mostra o mosaico pelo handle, não a foto. */
  avatar: string | null;
  /** "mastodon.social". */
  servidor: string;
  /** A página do post na origem ("abrir no original"). */
  url: string;
  curti: boolean;
  impulsionei: boolean;
  /** O post DAQUI a que a conversa pertence, quando há. */
  post_local: string | null;
  impulsionado_por: ImpulsoDeFora | null;
  midia: MidiaDeFora[];
  /** Só na linha: a chave do item (um mesmo post pode aparecer por mais de um impulso). */
  chave?: string;
  /** Só na linha: quando o post foi publicado (aí `criado_em` é o momento em que entrou na linha). */
  publicado_em?: string;
  /** O servidor leu agora na origem e o banco não guarda esta nota: curtir, impulsionar, responder e denunciar não valem. */
  ao_vivo?: boolean;
}

/** Um post DAQUI no meio de um fio de fora. `local` é o id dele; `post` vem quando o banco já o mandou junto. */
export interface PostDaquiNoFio {
  local: string;
  post?: Post;
}

/** O fio de uma nota de fora: o que vem acima (do mais antigo ao mais novo), a nota e as respostas (da mais antiga à mais nova). */
export interface FioDeFora {
  post: CartaoDeFora;
  acima: (CartaoDeFora | PostDaquiNoFio)[];
  respostas: (CartaoDeFora | PostDaquiNoFio)[];
}

export interface LinhaDeFora {
  itens: CartaoDeFora[];
  proximo: string | null;
}

/** Uma página das respostas de fora a um post DAQUI (GET /api/fediverso/remoto?respostas=<id do post>). */
export interface RespostasDeForaDoPost {
  itens: CartaoDeFora[];
  proximo: string | null;
  /** Quantas a pessoa pode ver ao todo. */
  total: number;
}

/** O que o banco sabe da relação entre a pessoa e a conta de fora (nulo se a Alumia ainda não conhece a conta). */
export interface RelacaoComQuemEDeFora {
  seguindo: "nao" | "pedido" | "sim";
  segue_voce: boolean;
  bloqueado: boolean;
  silenciado: boolean;
}

export interface PerfilDeFora {
  /** O endereço (https) do ator. */
  ator: string;
  /** "tiao@mastodon.social" (sem o @ da frente). */
  handle: string | null;
  nome: string | null;
  /** A bio, só texto. */
  resumo: string | null;
  /** A página do perfil na origem. */
  url: string | null;
  /** Pela rota-proxy ou nulo. A tela mostra o mosaico pelo handle, não a foto. */
  avatar: string | null;
  /** "Person", "Service", "Group"… */
  tipo: string;
  servidor: string;
  /** Os posts numa lista só, do mais novo ao mais antigo (os que o banco guarda e os lidos agora, com `ao_vivo`). */
  posts: CartaoDeFora[];
  local: RelacaoComQuemEDeFora | null;
}

/** A resposta de "perfil" e de "buscar" quando a conta é da própria Alumia: a tela leva ao perfil daqui. */
export interface ContaDaqui {
  local: true;
  handle: string;
}

/** O que a busca por endereço devolve (app/api/fediverso/buscar): os posts vêm só em texto. */
export interface AchadoNaBusca {
  ator: string;
  handle: string | null;
  nome: string | null;
  resumo: string | null;
  url: string | null;
  posts: { id: string; url: string | null; texto: string; aviso: string; publicado: string | null }[];
  seguindo: "nao" | "pedido" | "sim";
  ligado: boolean;
}

/** A situação da federação da própria pessoa (public.rede_fed_situacao). */
export interface SituacaoDeFora {
  logado: boolean;
  ligado: boolean;
  pode: boolean;
  motivo: string | null;
  handle?: string | null;
  desde?: string | null;
  seguidores?: number;
  seguindo?: number;
  versao: number;
  /** O modo "fediverso-total" está ligado no banco. */
  total: boolean;
  consentimento_versao?: number | null;
  /** A pessoa aparece em diretórios e buscas de fora. */
  descobrivel?: boolean;
  pedir_fediverso?: boolean;
}

export const CATEGORIAS_DE_DENUNCIA = ["menores", "ameaca", "exposicao", "violencia", "autolesao", "odio", "assedio", "golpe", "spam", "outro"] as const;
export type CategoriaDeDenuncia = (typeof CATEGORIAS_DE_DENUNCIA)[number];

// ── Regras puras ──

/** É um post de fora (o cartão do Fediverso), e não um post daqui? */
export function eDeFora(post: unknown): post is CartaoDeFora {
  return typeof post === "object" && post !== null && !Array.isArray(post) && (post as { origem?: unknown }).origem === "fediverso" && typeof (post as { id?: unknown }).id === "string";
}

/** É a resposta "esta conta é daqui"? */
export function eContaDaqui(v: unknown): v is ContaDaqui {
  return typeof v === "object" && v !== null && (v as { local?: unknown }).local === true && typeof (v as { handle?: unknown }).handle === "string";
}

/** É um post DAQUI embrulhado no meio de um fio de fora? */
export function eDaquiNoFio(v: unknown): v is PostDaquiNoFio {
  return typeof v === "object" && v !== null && typeof (v as { local?: unknown }).local === "string";
}

/**
 * O endereço de uma mídia de fora, só se for o da NOSSA rota-proxy: caminho relativo que começa com "/api/fediverso/midia?".
 * Qualquer outra coisa (https de fora, "//host", data:, javascript:, espaço, barra invertida) vira nulo: o navegador de quem lê
 * nunca busca nada direto em outro servidor.
 */
export function midiaSegura(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 4000) return null;
  return /^\/api\/fediverso\/midia\?[A-Za-z0-9%&=._~+-]+$/.test(url) ? url : null;
}

/** Lê "@nome@servidor" (ou "nome@servidor", "acct:nome@servidor"); nulo se não é um endereço do Fediverso. */
export function contaValida(texto: unknown): { nome: string; servidor: string } | null {
  if (typeof texto !== "string" || texto.length > 330) return null;
  const m = /^(?:acct:)?@?([A-Za-z0-9_](?:[A-Za-z0-9_.-]{0,62}[A-Za-z0-9_])?)@([A-Za-z0-9.-]{3,253})$/.exec(texto.trim());
  if (!m) return null;
  const servidor = m[2].toLowerCase();
  if (!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(servidor)) return null;
  return { nome: m[1], servidor };
}

/** "@nome@servidor" a partir do handle que as rotas mandam ("nome@servidor"); nulo se não é um endereço válido. */
export function contaDoHandle(handle: string | null | undefined): string | null {
  const c = contaValida(handle ?? "");
  return c ? `@${c.nome}@${c.servidor}` : null;
}

/** A página, na Alumia, do perfil de alguém de fora. `conta` é "@nome@servidor" (ou o endereço https do ator). */
export function enderecoDoPerfilRemoto(lang: string, conta: string): string {
  return `/${lang}/alumia/fediverso?conta=${encodeURIComponent(contaDoHandle(conta) ?? conta.trim())}`;
}

/** A página, na Alumia, do fio de uma nota de fora. `idDaNota` é o endereço https dela (o `id` do cartão). */
export function enderecoDoFioRemoto(lang: string, idDaNota: string): string {
  return `/${lang}/alumia/fediverso?nota=${encodeURIComponent(idDaNota)}`;
}

/** Um número pronto para aparecer: nulo abaixo de 3 (a tela não escreve número nenhum). */
export function contagemVisivel(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= MINIMO_DE_PESSOAS ? Math.floor(n) : null;
}
