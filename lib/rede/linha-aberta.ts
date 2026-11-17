// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A linha com regra aberta da Alumia ("Em roda"): os números da regra, o que fica guardado SÓ no aparelho (a escolha entre
// "Em roda" e "Ordem de chegada", as linhas que a pessoa monta e o marco da última visita) e a ordem das respostas de uma
// conversa. A regra em si mora no banco (supabase/migracoes/20261113-alumia-o7-linha.sql) e está escrita, por extenso, na tela
// "Como a linha é montada". Nada daqui vai ao servidor para ser guardado: o servidor não precisa saber como a pessoa lê
// (LGPD art. 6º, III), e a lista de linhas diria a opinião política dela (art. 5º, II, e art. 11).
// Sem os atalhos "@/" de propósito: `npm run testar:alumia-o7-linha` roda este arquivo direto no Node.

/** Os números da regra, iguais aos de interno.rede_o7_numeros() (o teste compara um com o outro). */
export const NUMEROS_DA_REGRA = {
  versao: 1,
  janela_dias: 7,
  maximo: 300,
  avisos: 2,
  atos: 3,
  perto_horas: 72,
  bloco_horas: 6,
  tela: 20,
  teto: 3,
  alta_horas: 48,
  alta_piso: 3,
  alta_maximo: 10,
  fora_destaques: 5,
  ajudou_piso: 3,
} as const;
export type NumerosDaRegra = { [K in keyof typeof NUMEROS_DA_REGRA]: number };

/** "roda" = a regra aberta; "chegada" = do mais novo para o mais velho, sem mais nada. */
export type ModoDaLinha = "roda" | "chegada";
export const MODOS: readonly ModoDaLinha[] = ["roda", "chegada"];

/** De onde a linha parte: tudo o que a pessoa pode ver, quem ela segue, as comunidades dela ou os #temas que ela segue. */
export type BaseDaLinha = "tudo" | "seguindo" | "comunidades" | "temas";
export const BASES: readonly BaseDaLinha[] = ["tudo", "seguindo", "comunidades", "temas"];

export const TIPOS_DE_POST = ["post", "discussao", "duvida", "chamado", "enquete", "aviso"] as const;
export type TipoNoFiltro = (typeof TIPOS_DE_POST)[number];

/** O filtro aberto de uma linha montada (as chaves valem juntas, com "e"). O mesmo que interno.rede_o7_filtro aceita. */
export interface FiltroDaLinha {
  tipos?: TipoNoFiltro[];
  tags?: string[];
  /** A cidade ESCRITA do chamado (texto). Nunca posição do aparelho. */
  cidade?: string;
  nucleos?: boolean;
  estudo?: boolean;
  comunidades?: string[];
}

/** Uma linha que a pessoa montou. Mora só no aparelho. */
export interface LinhaMontada {
  id: string;
  nome: string;
  base: BaseDaLinha;
  filtro: FiltroDaLinha;
  /** Aparece na barra do Início. */
  fixada: boolean;
}

export const MAXIMO_DE_LINHAS = 12;
export const MAXIMO_NA_BARRA = 4;
export const NOME_MAXIMO = 30;

/** O motivo de um post estar onde está (vem do banco em cada item). */
export type PorQue = "aviso" | "ato" | "ajudou" | "interesse" | "roda" | "chegada";

// ───── Guardar no aparelho ─────

/** O mínimo de um localStorage (os testes passam um de mentira). */
export interface Guarda {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

const CHAVE_MODO = "alumia:linha-modo:v1";
const CHAVE_LINHAS = "alumia:linhas:v1";
const CHAVE_VISITA = "alumia:ultima-visita:v1";
const CHAVE_FORA = "alumia:fora-desligado:v1";

function guarda(g?: Guarda | null): Guarda | null {
  if (g !== undefined) return g;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
function ler(chave: string, g?: Guarda | null): unknown {
  try {
    const bruto = guarda(g)?.getItem(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: unknown, g?: Guarda | null): void {
  try {
    const onde = guarda(g);
    if (!onde) return;
    if (valor === null || valor === undefined) onde.removeItem(chave);
    else onde.setItem(chave, JSON.stringify(valor));
  } catch {
    // aparelho sem espaço ou em modo privado: a escolha vale só enquanto a página estiver aberta
  }
}

/** A ordem que a pessoa escolheu (padrão: "Em roda"). */
export function lerModo(g?: Guarda | null): ModoDaLinha {
  const m = ler(CHAVE_MODO, g);
  return m === "chegada" ? "chegada" : "roda";
}
export function guardarModo(m: ModoDaLinha, g?: Guarda | null): void {
  gravar(CHAVE_MODO, m === "chegada" ? "chegada" : null, g);
}

// ───── As linhas montadas ─────

const SLUG = /^[a-z0-9-]{2,60}$/;

/** Tira o acento e o "#": "#Reforma Agrária" não é tema; "#ENEM" vira "enem". Nulo quando não serve. */
export function arrumarTema(texto: string): string | null {
  const t = texto.trim().replace(/^#/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /^[a-z0-9_]{2,40}$/.test(t) && /[a-z_]/.test(t) ? t : null;
}

/** O filtro só com o que o banco aceita (o resto cai fora em silêncio: veio de um aparelho antigo ou foi mexido à mão). */
export function arrumarFiltro(f: unknown): FiltroDaLinha {
  const x = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
  const saida: FiltroDaLinha = {};
  if (Array.isArray(x.tipos)) {
    const tipos = [...new Set(x.tipos.filter((t): t is TipoNoFiltro => (TIPOS_DE_POST as readonly unknown[]).includes(t)))];
    if (tipos.length) saida.tipos = tipos;
  }
  if (Array.isArray(x.tags)) {
    const tags = [...new Set(x.tags.map((t) => (typeof t === "string" ? arrumarTema(t) : null)).filter((t): t is string => !!t))].slice(0, 10);
    if (tags.length) saida.tags = tags;
  }
  if (typeof x.cidade === "string" && x.cidade.trim().length >= 2) saida.cidade = x.cidade.trim().replace(/\s+/g, " ").slice(0, 80);
  if (x.nucleos === true) saida.nucleos = true;
  if (x.estudo === true) saida.estudo = true;
  if (Array.isArray(x.comunidades)) {
    const cs = [...new Set(x.comunidades.filter((c): c is string => typeof c === "string" && SLUG.test(c)))].slice(0, 20);
    if (cs.length) saida.comunidades = cs;
  }
  return saida;
}

/** O filtro não tira nada? (Linha sem filtro e de base "tudo" seria a aba Tudo de novo.) */
export function filtroVazio(f: FiltroDaLinha): boolean {
  return Object.keys(arrumarFiltro(f)).length === 0;
}

function arrumarLinha(x: unknown): LinhaMontada | null {
  if (!x || typeof x !== "object") return null;
  const l = x as Record<string, unknown>;
  const nome = typeof l.nome === "string" ? l.nome.trim().replace(/\s+/g, " ").slice(0, NOME_MAXIMO) : "";
  if (typeof l.id !== "string" || !/^[a-z0-9-]{4,40}$/.test(l.id) || !nome) return null;
  const base = (BASES as readonly unknown[]).includes(l.base) ? (l.base as BaseDaLinha) : "tudo";
  return { id: l.id, nome, base, filtro: arrumarFiltro(l.filtro), fixada: l.fixada === true };
}

/** As linhas da pessoa, na ordem dela. O que estiver torto no aparelho é ignorado. */
export function lerLinhas(g?: Guarda | null): LinhaMontada[] {
  const bruto = ler(CHAVE_LINHAS, g);
  if (!Array.isArray(bruto)) return [];
  const vistas = new Set<string>();
  const saida: LinhaMontada[] = [];
  for (const x of bruto) {
    const l = arrumarLinha(x);
    if (!l || vistas.has(l.id)) continue;
    vistas.add(l.id);
    saida.push(l);
    if (saida.length >= MAXIMO_DE_LINHAS) break;
  }
  // No máximo quatro na barra: as que passam continuam existindo, só saem da barra.
  let naBarra = 0;
  return saida.map((l) => (l.fixada && ++naBarra > MAXIMO_NA_BARRA ? { ...l, fixada: false } : l));
}
export function guardarLinhas(linhas: LinhaMontada[], g?: Guarda | null): void {
  gravar(CHAVE_LINHAS, linhas.length ? linhas : null, g);
}

/** Um id novo para a linha (só serve dentro do aparelho). */
export function idNovo(): string {
  const a = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 13) : Math.random().toString(36).slice(2, 12);
  return `l-${a}`;
}

export type ErroDaLinha = "nome" | "muitas" | "vazia" | "repetida";

/** Acrescenta uma linha no fim. Devolve a lista nova ou o motivo de não caber. */
export function criarLinha(linhas: LinhaMontada[], nova: { nome: string; base: BaseDaLinha; filtro: FiltroDaLinha; fixada?: boolean }): LinhaMontada[] | ErroDaLinha {
  const nome = nova.nome.trim().replace(/\s+/g, " ");
  if (!nome || nome.length > NOME_MAXIMO) return "nome";
  if (linhas.length >= MAXIMO_DE_LINHAS) return "muitas";
  const filtro = arrumarFiltro(nova.filtro);
  if (nova.base === "tudo" && filtroVazio(filtro)) return "vazia";
  if (linhas.some((l) => l.nome.toLowerCase() === nome.toLowerCase())) return "repetida";
  const cabeNaBarra = linhas.filter((l) => l.fixada).length < MAXIMO_NA_BARRA;
  return [...linhas, { id: idNovo(), nome, base: nova.base, filtro, fixada: (nova.fixada ?? true) && cabeNaBarra }];
}

export function renomearLinha(linhas: LinhaMontada[], id: string, nome: string): LinhaMontada[] | ErroDaLinha {
  const novo = nome.trim().replace(/\s+/g, " ");
  if (!novo || novo.length > NOME_MAXIMO) return "nome";
  if (linhas.some((l) => l.id !== id && l.nome.toLowerCase() === novo.toLowerCase())) return "repetida";
  return linhas.map((l) => (l.id === id ? { ...l, nome: novo } : l));
}

/** Sobe (-1) ou desce (+1) uma linha na ordem da pessoa. */
export function moverLinha(linhas: LinhaMontada[], id: string, passo: -1 | 1): LinhaMontada[] {
  const i = linhas.findIndex((l) => l.id === id);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= linhas.length) return linhas;
  const nova = [...linhas];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

/** Põe na barra do Início ou tira de lá. Com a barra cheia, não põe ("muitas"). */
export function fixarLinha(linhas: LinhaMontada[], id: string, sim: boolean): LinhaMontada[] | ErroDaLinha {
  if (sim && linhas.filter((l) => l.fixada && l.id !== id).length >= MAXIMO_NA_BARRA) return "muitas";
  return linhas.map((l) => (l.id === id ? { ...l, fixada: sim } : l));
}

export function apagarLinha(linhas: LinhaMontada[], id: string): LinhaMontada[] {
  return linhas.filter((l) => l.id !== id);
}

// ───── A última visita ("Enquanto você esteve fora") ─────

/** De quanto tempo fora em diante a faixa aparece. */
export const FORA_MINIMO_MS = 8 * 3600 * 1000;

/** O instante (ISO) da última visita guardado neste aparelho, ou nulo. */
export function ultimaVisita(g?: Guarda | null): string | null {
  const v = ler(CHAVE_VISITA, g);
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;
}
export function marcarVisita(quando: Date = new Date(), g?: Guarda | null): void {
  gravar(CHAVE_VISITA, quando.toISOString(), g);
}
/** A pessoa esteve fora tempo bastante para a faixa aparecer? `minimo` vem do ritmo escolhido no questionário (lib/rede/interesses.ts). */
export function esteveFora(ultima: string | null, agora: number = Date.now(), minimo: number = FORA_MINIMO_MS): boolean {
  return !!ultima && agora - Date.parse(ultima) >= minimo;
}
/** A pessoa desligou a faixa "Enquanto você esteve fora" neste aparelho? */
export function foraDesligado(g?: Guarda | null): boolean {
  return ler(CHAVE_FORA, g) === true;
}
export function desligarFora(sim: boolean, g?: Guarda | null): void {
  gravar(CHAVE_FORA, sim ? true : null, g);
}

// ───── A ordem das respostas de uma conversa ─────

export type OrdemDoFio = "antigas" | "novas" | "uteis" | "sem_resposta";
export const ORDENS_DO_FIO: readonly OrdemDoFio[] = ["antigas", "novas", "uteis", "sem_resposta"];

/** O que o banco sabe ordenar; "úteis" e "sem resposta" partem das mais antigas e são arrumadas aqui, com a regra abaixo. */
export function ordemNoBanco(o: OrdemDoFio): "antigas" | "novas" {
  return o === "novas" ? "novas" : "antigas";
}

interface Ramo {
  post: { id: string; util?: number | null };
  filhos: readonly unknown[];
}

/**
 * Arruma as respostas de primeiro nível (cada uma leva junto as respostas a ela). A regra, a mesma escrita na tela:
 *   - "úteis": primeiro a que quem perguntou marcou como a que ajudou; depois as que 3 pessoas ou mais marcaram como úteis (a
 *     mais marcada primeiro); o resto na ordem em que chegou. Marca de 1 ou 2 pessoas não muda nada (número só a partir de 3);
 *   - "sem resposta": primeiro as que ninguém respondeu ainda, na ordem em que chegaram; depois as outras.
 * As outras ordens ficam como o banco mandou.
 */
export function ordenarRamos<T extends Ramo>(ramos: readonly T[], ordem: OrdemDoFio, ajudou: string | null = null): T[] {
  const lista = ramos.map((r, i) => ({ r, i }));
  if (ordem === "uteis") {
    const peso = (x: T) => (x.post.id === ajudou ? Number.MAX_SAFE_INTEGER : (x.post.util ?? 0) >= 3 ? (x.post.util ?? 0) : 0);
    lista.sort((a, b) => peso(b.r) - peso(a.r) || a.i - b.i);
  } else if (ordem === "sem_resposta") {
    lista.sort((a, b) => Number(a.r.filhos.length > 0) - Number(b.r.filhos.length > 0) || a.i - b.i);
  }
  return lista.map((x) => x.r);
}
