// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras da cara nova da Alumia (Onda 5, F1: casca, linha, cartão e escrever; PLANO-ALUMIA §8). Tudo aqui é sem
// estado e sem navegador, para os testes (scripts/testar-alumia-f1.mjs) rodarem no Node. Sem os atalhos "@/" de propósito.
//
// Privacidade (PLANO-ALUMIA §6): número de PESSOAS só agregado e a partir de 3 (abaixo disso, "poucas pessoas"), arredondado
// quando passa de 100; nunca uma lista de quem. Opinião política é dado sensível (LGPD art. 5º, II, e art. 11): por isso nada
// aqui devolve quem reagiu, votou ou confirmou.

/** Os dados de exemplo só aparecem com NEXT_PUBLIC_ALUMIA_PREVIA=sim (para conferir as telas sem banco). Nunca em produção. */
export function previaLigada(valor: string | undefined = process.env.NEXT_PUBLIC_ALUMIA_PREVIA): boolean {
  return valor === "sim";
}

/** O menor número de pessoas que pode aparecer escrito (PLANO-ALUMIA §6.1; docs/rede/PRIVACIDADE.md §8). */
export const MINIMO_DE_PESSOAS = 3;

/**
 * Um número de pessoas pronto para aparecer: nulo abaixo de 3 (a tela escreve "poucas pessoas"); até 100, o número; até 1.000,
 * arredondado para baixo de 10 em 10; depois, de 100 em 100. `arredondado` diz se a tela deve escrever "mais de".
 */
export function contagemDePessoas(n: number | null | undefined): { n: number; arredondado: boolean } | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n < MINIMO_DE_PESSOAS) return null;
  const inteiro = Math.floor(n);
  if (inteiro <= 100) return { n: inteiro, arredondado: false };
  const passo = inteiro < 1000 ? 10 : 100;
  const baixo = Math.floor(inteiro / passo) * passo;
  return { n: baixo, arredondado: baixo !== inteiro };
}

/** As porcentagens de uma enquete (somam 100 com o maior resto). Sem total (ninguém votou ou o total é secreto): nulo. */
export function porcentagensDaEnquete(votos: readonly (number | null)[]): number[] | null {
  if (votos.some((v) => v === null)) return null;
  const lista = votos as number[];
  const total = lista.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  const brutas = lista.map((v) => (v * 100) / total);
  const base = brutas.map(Math.floor);
  let falta = 100 - base.reduce((s, v) => s + v, 0);
  const ordem = brutas.map((b, i) => ({ i, resto: b - Math.floor(b) })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of ordem) {
    if (falta <= 0) break;
    base[i] += 1;
    falta -= 1;
  }
  return base;
}

/**
 * O servidor de quem veio do Fediverso: "@tiao@mastodon.social" ou "tiao@mastodon.social" → "mastodon.social". Quem é da
 * Alumia (sem "@" no meio) não tem servidor à vista. Só aceita um domínio plausível (nada de texto solto no selo).
 */
export function servidorDoFediverso(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const partes = handle.replace(/^@/, "").split("@");
  if (partes.length !== 2 || !partes[0]) return null;
  const dominio = partes[1].toLowerCase();
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(dominio) ? dominio : null;
}

/** O nome de uma comunidade quando só se tem o slug: "passe-livre-sp" → "Passe livre sp" (o nome de verdade vem da lista). */
export function nomeDoSlug(slug: string): string {
  const texto = slug.replace(/[-_]+/g, " ").trim();
  return texto ? texto[0].toUpperCase() + texto.slice(1) : slug;
}

/** O endereço de quem está na Alumia, como o Fediverso o vê: @faisca@alumia.institutolucia.org. */
export function enderecoNoFediverso(handle: string, host = "alumia.institutolucia.org"): string {
  return `@${handle}@${host}`;
}

// ───── Desfazer envio ─────

/** Quanto tempo a pessoa tem para desfazer um envio (a prancha: "desfazer envio de 10 s"). */
export const SEGUNDOS_PARA_DESFAZER = 10;

/** Quantos segundos faltam, inteiros e arredondados para cima, nunca negativos. */
export function segundosQueFaltam(enviadoEm: number, agora: number, total = SEGUNDOS_PARA_DESFAZER): number {
  const ms = enviadoEm + total * 1000 - agora;
  return ms <= 0 ? 0 : Math.ceil(ms / 1000);
}

// ───── Rascunho no servidor ─────

/** Até 20 rascunhos por pessoa, apagados depois de 30 dias (PLANO-ALUMIA §5, F1). O banco confere de novo. */
export const LIMITE_DE_RASCUNHOS = 20;
export const DIAS_DO_RASCUNHO = 30;

/** O que vai no rascunho: só o texto e as escolhas, nunca arquivo (imagem e áudio ficam no aparelho até publicar). */
export interface RascunhoDoServidor {
  id: string | null;
  tipo: string;
  texto: string;
  titulo: string;
  corpo: string;
  comunidade: string | null;
  publico: string;
  responde_quem: string;
  atualizado_em?: string;
}

/** O rascunho tem algo escrito? (vazio não vai ao servidor; e o que existia é apagado). */
export function rascunhoTemTexto(r: Pick<RascunhoDoServidor, "texto" | "titulo" | "corpo">): boolean {
  return Boolean(r.texto.trim() || r.titulo.trim() || r.corpo.trim());
}

/** Os rascunhos ainda válidos, do mais novo ao mais antigo, no máximo 20 (o que o banco devolveria). */
export function rascunhosValidos<T extends { atualizado_em?: string }>(lista: readonly T[], agora: number): T[] {
  const limite = agora - DIAS_DO_RASCUNHO * 86_400_000;
  return lista
    .filter((r) => {
      const t = r.atualizado_em ? new Date(r.atualizado_em).getTime() : agora;
      return Number.isFinite(t) && t >= limite;
    })
    .sort((a, b) => (b.atualizado_em ?? "").localeCompare(a.atualizado_em ?? ""))
    .slice(0, LIMITE_DE_RASCUNHOS);
}

// ───── Tipos do compositor ─────

/** Os tipos das pranchas: Post, Ato (encaixe da F2), Enquete e Texto longo (discussão ou dúvida, como hoje). */
export type TipoDoCompositor = "post" | "ato" | "enquete" | "longo" | "aviso";

/** O tipo do banco (rede_posts.tipo) que cada aba do compositor publica. O "ato" é da F2 (o encaixe dá o tipo). */
export function tipoDoBanco(t: TipoDoCompositor, longoComo: "discussao" | "duvida" = "discussao"): "post" | "enquete" | "discussao" | "duvida" | "aviso" | null {
  if (t === "ato") return null;
  if (t === "longo") return longoComo;
  return t;
}
