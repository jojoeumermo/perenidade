// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras fixas da ponte com a Escola (frente 11E), iguais às do banco (supabase/migracoes/20261117-alumia-o11-escola.sql):
// o nível de cada medalha, as faixas de reputação e os limites do mural. Puro e sem os atalhos "@/" de propósito: o teste
// (scripts/testar-alumia-o11-escola.mjs) importa daqui e confere que o banco diz o mesmo.

export const MEDALHAS = ["trilha", "redacao", "monitoria"] as const;
export type Medalha = (typeof MEDALHAS)[number];

/** A partir de quantos feitos cada nível vale (1, 2 e 3). A trilha é sempre nível 1. */
export const NIVEIS: Record<Exclude<Medalha, "trilha">, readonly [number, number, number]> = {
  redacao: [1, 10, 30],
  monitoria: [1, 5, 20],
};

/** O nível de uma medalha pelo progresso: 0 (ainda não ganhou) a 3. */
export function nivelDa(medalha: string, progresso: number): 0 | 1 | 2 | 3 {
  if (medalha === "trilha") return 1;
  const n = NIVEIS[medalha as keyof typeof NIVEIS];
  if (!n) return 0;
  return progresso >= n[2] ? 3 : progresso >= n[1] ? 2 : progresso >= n[0] ? 1 : 0;
}

/** Quantos feitos faltam para o próximo nível (nulo no nível 3 e na trilha). */
export function faltamPara(medalha: string, progresso: number): number | null {
  const n = NIVEIS[medalha as keyof typeof NIVEIS];
  if (!n) return null;
  const proximo = n.find((x) => progresso < x);
  return proximo === undefined ? null : proximo - progresso;
}

export const FAIXAS = ["semente", "apoio", "referencia"] as const;
export type Faixa = (typeof FAIXAS)[number];

/** A partir de quantas conversas cada faixa vale. A primeira começa em 3: número só a partir de 3. */
export const LIMIARES_DAS_FAIXAS: Record<Faixa, number> = { semente: 3, apoio: 10, referencia: 30 };

/** A faixa pelo número de conversas em que a pessoa ajudou (a mesma conta de interno.alumia_o11_faixa). */
export function faixaDe(n: number): Faixa | null {
  return n >= LIMIARES_DAS_FAIXAS.referencia ? "referencia" : n >= LIMIARES_DAS_FAIXAS.apoio ? "apoio" : n >= LIMIARES_DAS_FAIXAS.semente ? "semente" : null;
}

/** Os limites do mural (os mesmos do banco). */
export const LIMITES_DO_MURAL = { codinome: [2, 40], curso: [2, 80], instituicao: [2, 80], recado: [2, 140] } as const;

/** O endereço de uma trilha é um slug do site? */
export const trilhaOk = (s: string): boolean => /^[a-z0-9-]{2,80}$/.test(s);

/** O nome legível de um slug ("introducao-ao-marxismo" vira "introducao ao marxismo"; a tela põe a primeira em maiúscula). */
export const nomeDoSlug = (s: string): string => s.replace(/-/g, " ");

/**
 * As trilhas com alguma aula concluída NESTE aparelho (a lista "lucia:concluidas" do estudo guarda 'trilha/aula'). Servem só
 * de sugestão para a pessoa marcar a medalha: nada disto vai ao banco sem ela tocar.
 */
export function trilhasDoAparelho(concluidas: readonly string[]): string[] {
  const vistas = new Set<string>();
  for (const id of concluidas) {
    const trilha = typeof id === "string" ? id.split("/")[0] : "";
    if (trilhaOk(trilha)) vistas.add(trilha);
  }
  return [...vistas].sort();
}

/** "2026-11" vira a data do mês, para a tela escrever "nov. de 2026" no idioma. Nulo se o texto não serve. */
export function mesDoMural(mes: string): Date | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)) : null;
}

export interface MinhaMedalha {
  medalha: Medalha;
  alvo: string;
  progresso: number;
  nivel: number;
  mostrar: boolean;
}
export interface MinhasConquistas {
  medalhas: MinhaMedalha[];
  faixa: { mostrar: boolean; faixa: Faixa | null };
}
export interface MedalhaMostrada {
  medalha: Medalha;
  alvo: string;
  nivel: number;
}
export interface ConquistasDoPerfil {
  medalhas: MedalhaMostrada[];
  faixa: Faixa | null;
  meu: boolean;
}
export interface Inscricao {
  id: string;
  nome: string;
  handle: string | null;
  como: "perfil" | "codinome";
  curso: string | null;
  instituicao: string | null;
  recado: string | null;
  mes: string;
  minha: boolean;
}
export interface MinhaInscricao {
  como: "perfil" | "codinome";
  codinome: string | null;
  curso: string | null;
  instituicao: string | null;
  recado: string | null;
  mes: string;
}
export interface TopicoDaAula {
  id: string | null;
  titulo: string | null;
  comunidade: string;
}
