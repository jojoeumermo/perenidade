// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos e as contas puras do pacote "conversa" da Rede v2 (itens 24 a 28 do R4): a árvore de respostas, as menções (@handle),
// a síntese fixada e a citação. Contrato das funções: supabase/migracoes/2026-11-rede-conversa.sql e docs/rede/V2.md.
// Sem os atalhos "@/" de propósito (roda no Node nos testes).
import type { Post } from "./tipos";

/** As três ordens das respostas. A fórmula de cada uma está escrita nos textos (i18n/rede/conversa/*.json, ordem.formula*). */
export type OrdemDasRespostas = "uteis" | "antigas" | "novas";
export const ORDENS: readonly OrdemDasRespostas[] = ["uteis", "antigas", "novas"];

/** Com o post aberto contado como nível 1, a página mostra até o 6º nível; dali em diante, "continuar a conversa" em página própria. */
export const NIVEIS_NA_PAGINA = 6;
/** Mais do que isto é só recuo no papel: no celular o recuo para de crescer aqui. */
export const NIVEIS_COM_RECUO = 4;

/** Um post dentro da árvore: `silenciada` vem quando a pessoa silenciou o autor (o texto vem vazio). */
export interface PostDaArvore extends Post {
  silenciada?: boolean;
  /**
   * Onda 5 (F3 + F-FED): a resposta veio do Fediverso; este é o servidor de quem escreveu ("mastodon.social"). Só o nome do
   * servidor, que já é público no @ da pessoa; nada de IP nem de endereço de caixa. Ausente nas respostas daqui.
   */
  servidor?: string | null;
}

/** A síntese em vigor no alto da conversa. `versoes` é quantas já foram escritas (a atual e o histórico). */
export interface SinteseDaConversa {
  id: string;
  texto: string;
  autor: string;
  criado_em: string;
  versoes: number;
}

export interface VersaoDaSintese {
  id: string;
  texto: string;
  autor: string;
  criado_em: string;
  atual: boolean;
}

/** O que `rede_conv_arvore` devolve: o post, o que ele responde, as respostas já na ordem de leitura e o que a pessoa pode fazer. */
export interface Arvore {
  post: PostDaArvore;
  acima: Post[];
  respostas: PostDaArvore[];
  sintese: SinteseDaConversa | null;
  ordem: OrdemDasRespostas;
  /** O post que abriu a conversa (a síntese e a resposta que resolveu pertencem a ele). */
  raiz: string;
  pode_aceitar: boolean;
  pode_sintese: boolean;
  /** A lista foi cortada em 400: o resto se abre numa resposta mais abaixo. */
  mais: boolean;
  /**
   * Onda 5 (F3): os pronomes que quem abriu a conversa escreveu no perfil ("ela/dela"), só para o selo "ajudou a autora" não
   * errar o gênero de ninguém. Sem pronomes, o selo diz "ajudou quem perguntou". Ausente antes do back-end da F3/F4.
   */
  pronomes_da_raiz?: string | null;
  /**
   * Onda 5 (F3, rede_alumia_conversa): a resposta que ajudou quem abriu a conversa (só ela marca), ou nulo. Ausente na árvore de
   * hoje (rede_conv_arvore): aí vale o `aceita` da dúvida.
   */
  ajudou?: string | null;
  /** Quem lê é quem abriu a conversa (e é membro): só essa pessoa marca "ajudou". */
  pode_ajudou?: boolean;
}

/** Uma reação com emoji como o banco devolve: o total (nulo abaixo de 3) e se é minha. Nunca quem reagiu. */
export interface ReacaoDoPost {
  emoji: string;
  total: number | null;
  minha: boolean;
}

export interface SugestaoDeMencao {
  handle: string;
  codinome: string;
  equipe: boolean;
}

/** O pedido de citação: o mesmo de `rede_publicar`, mais o post citado. */
export interface PedidoDeCitacao {
  texto: string;
  citar: string;
  publico?: "membros" | "internet" | "comunidade";
  comunidade?: string | null;
}

export interface NoDaArvore {
  post: PostDaArvore;
  /** Nível dentro da página: 1 = resposta direta ao post aberto. */
  nivel: number;
  filhos: NoDaArvore[];
}

/**
 * Monta os nós a partir da lista plana que o banco entrega (cada resposta logo depois do que ela responde, irmãs na ordem
 * pedida). Quem responde a algo que não veio (por exemplo, o pai foi removido) fica sem lugar e não entra: o banco já poda
 * a conversa abaixo de um post que a pessoa não pode ver.
 */
export function montarArvore(raizId: string, lista: readonly PostDaArvore[]): NoDaArvore[] {
  const porId = new Map<string, NoDaArvore>();
  const topo: NoDaArvore[] = [];
  for (const post of lista) {
    const pai = post.resposta_a === raizId ? null : porId.get(post.resposta_a ?? "");
    if (post.resposta_a !== raizId && !pai) continue;
    const no: NoDaArvore = { post, nivel: pai ? pai.nivel + 1 : 1, filhos: [] };
    porId.set(post.id, no);
    (pai ? pai.filhos : topo).push(no);
  }
  return topo;
}

/** Quantas respostas (visíveis) há em um nó e abaixo dele. */
export function contarNos(nos: readonly NoDaArvore[]): number {
  return nos.reduce((n, no) => n + 1 + contarNos(no.filhos), 0);
}

/** Este nó está no último nível da página e tem respostas que não coube mostrar: vira "continuar a conversa". */
export const continuaEmOutraPagina = (no: NoDaArvore): boolean => no.nivel >= NIVEIS_NA_PAGINA - 1 && no.post.respostas > 0 && no.filhos.length === 0;

/** O recuo (em níveis) de uma resposta, com teto: no celular a conversa não vira uma escada que sai da tela. */
export const recuoDoNivel = (nivel: number): number => Math.max(0, Math.min(nivel - 1, NIVEIS_COM_RECUO));

// ── Menções ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A mesma forma que o banco usa para achar uma menção: @ com 3 a 20 letras minúsculas, números ou _, que não grudam em outra palavra. */
const MENCAO = /(^|[^a-z0-9_@])@([a-z0-9_]{3,20})(?![a-z0-9_])/gi;

export type TrechoDoTexto = { tipo: "texto"; valor: string } | { tipo: "mencao"; valor: string; handle: string };

/** Separa um texto em trechos comuns e menções (a tela faz link das menções para o perfil). Nunca perde nem troca uma letra. */
export function trechosComMencoes(texto: string): TrechoDoTexto[] {
  const saida: TrechoDoTexto[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(MENCAO)) {
    const inicio = (m.index ?? 0) + m[1].length;
    if (inicio > ultimo) saida.push({ tipo: "texto", valor: texto.slice(ultimo, inicio) });
    saida.push({ tipo: "mencao", valor: `@${m[2]}`, handle: m[2].toLowerCase() });
    ultimo = inicio + 1 + m[2].length;
  }
  if (ultimo < texto.length) saida.push({ tipo: "texto", valor: texto.slice(ultimo) });
  return saida;
}

/** O @ que a pessoa está digitando agora (o cursor está colado nele)? Devolve onde ele começa e o que já foi digitado; senão, nulo. */
export function mencaoEmDigitacao(texto: string, cursor: number): { inicio: number; prefixo: string } | null {
  const antes = texto.slice(0, Math.max(0, Math.min(cursor, texto.length)));
  const m = /(^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{0,20})$/.exec(antes);
  if (!m) return null;
  return { inicio: antes.length - m[2].length - 1, prefixo: m[2].toLowerCase() };
}

/** Troca o @ que estava sendo digitado pela menção escolhida (com um espaço depois, se ainda não houver) e diz onde fica o cursor. */
export function inserirMencao(texto: string, cursor: number, handle: string): { texto: string; cursor: number } | null {
  const aberta = mencaoEmDigitacao(texto, cursor);
  if (!aberta) return null;
  const resto = texto.slice(cursor).replace(/^[a-zA-Z0-9_]*/, "");
  const espaco = /^\s/.test(resto) ? "" : " ";
  const inserido = `@${handle}${espaco}`;
  const novoCursor = aberta.inicio + inserido.length + (espaco === "" ? 1 : 0);
  return { texto: texto.slice(0, aberta.inicio) + inserido + resto, cursor: novoCursor };
}

// ── Onda 5 (PLANO-ALUMIA F3): contas puras das telas novas ────────────────────────────────────────────────────────────────

/**
 * A partir de quantas pessoas um total aparece (PLANO-ALUMIA §6.1, docs/rede/PRIVACIDADE.md §8): abaixo disso, "poucas". Vale
 * para reações e para qualquer contagem nova; opinião política é dado sensível (LGPD art. 5º, II, e art. 11).
 */
export const MINIMO_AGREGADO = 3;

/** O total que pode aparecer na tela: nulo (= "poucas") quando veio nulo, não é número inteiro ou fica abaixo de 3. */
export function totalVisivel(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isInteger(n) && n >= MINIMO_AGREGADO ? n : null;
}

/**
 * As reações com emoji (PLANO-ALUMIA §6.3): um conjunto FECHADO, sem emoji livre que vire xingamento. O banco tem a mesma lista
 * no check da tabela (a migração da F3); a tela só mostra o que estiver aqui. Total por emoji é público; quem reagiu, nunca.
 */
export const REACOES = [
  { emoji: "✊", nome: "punho" },
  { emoji: "❤️", nome: "coracao" },
  { emoji: "🔥", nome: "fogo" },
  { emoji: "👏", nome: "palmas" },
  { emoji: "🤔", nome: "pensando" },
  { emoji: "😢", nome: "triste" },
  { emoji: "😡", nome: "raiva" },
  { emoji: "📚", nome: "livro" },
] as const;
export type NomeDaReacao = (typeof REACOES)[number]["nome"];
export const reacaoOk = (emoji: string): boolean => REACOES.some((r) => r.emoji === emoji);

/** As reações de um post como a tela mostra: só as da lista fechada, na ordem da lista, com o total já passado pelo mínimo. */
export function reacoesParaMostrar(
  reacoes: readonly { emoji: string; total: number | null; minha: boolean }[] | undefined,
): { emoji: string; nome: NomeDaReacao; total: number | null; minha: boolean }[] {
  if (!reacoes) return [];
  return REACOES.flatMap((r) => {
    const achada = reacoes.find((x) => x.emoji === r.emoji);
    if (!achada || (!achada.minha && achada.total === 0)) return [];
    return [{ emoji: r.emoji, nome: r.nome, total: totalVisivel(achada.total), minha: achada.minha }];
  });
}

/** Qual selo vai na resposta que ajudou: pelo pronome que a pessoa escreveu, nunca por palpite ("quem perguntou" sem pronome). */
export function generoDoAjudou(pronomes: string | null | undefined): "a" | "o" | "quem" {
  const p = (pronomes ?? "").trim().toLowerCase();
  if (/^(ela|she|elle|ella)\b/.test(p)) return "a";
  if (/^(ele|he|il|él)\b/.test(p)) return "o";
  return "quem";
}

/**
 * O servidor de quem respondeu do Fediverso: o que veio do banco, ou o que está depois do segundo @ do @nome
 * ("@porto@mastodon.social" → "mastodon.social"). Nulo para quem é daqui.
 */
export function servidorDaResposta(post: Pick<PostDaArvore, "servidor"> & { autor: { handle: string | null } }): string | null {
  if (post.servidor) return post.servidor;
  const m = /^@?[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(post.autor.handle ?? "");
  return m ? m[1].toLowerCase() : null;
}

/** "20 min", "1 h", "3 dias": o tempo curto das pranchas, no idioma da página; depois de 30 dias, a data. */
export function tempoCurto(iso: string, lang: string, agora: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const seg = Math.max(0, Math.round((agora - t) / 1000));
  try {
    const em = (n: number, unit: "minute" | "hour" | "day") => new Intl.NumberFormat(lang, { style: "unit", unit, unitDisplay: "short" }).format(n);
    if (seg < 3600) return em(Math.max(1, Math.round(seg / 60)), "minute");
    if (seg < 86400) return em(Math.round(seg / 3600), "hour");
    if (seg < 86400 * 30) return em(Math.round(seg / 86400), "day");
    return new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(t);
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

/** O nome bonito de uma trilha a partir do caminho da aula ("marxismo/mais-valia" → "Marxismo"). */
export function trilhaDoCaminho(caminho: string): string {
  // O caminho gravado é "/trilhas/<trilha>/<aula>" (2026-11-rede-consertos.sql); os antigos vinham sem o "/trilhas/".
  const trilha = caminho.replace(/^\/+/, "").replace(/^trilhas\//, "").split("/")[0] ?? "";
  const nome = trilha.replace(/-/g, " ").trim();
  return nome ? nome.charAt(0).toLocaleUpperCase("pt-BR") + nome.slice(1) : "";
}
