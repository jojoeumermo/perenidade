// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A linha de Início com gente de FORA no meio, sem aba à parte: junta por data os posts daqui (rede_linha) e os cartões de fora
// (GET /api/fediverso/remoto?linha=1). São duas listas com cursor próprio; para a ordem nunca pular, um cartão de fora só é
// solto quando é mais novo que o post mais antigo da página daqui que já está na tela (o resto fica na espera).
// Puro e sem navegador (os testes rodam no Node: scripts/testar-fediverso-tela.mjs). Sem "@/" de propósito.
import { ligado } from "../../../recursos";
import { previaLigada } from "../../publicar/alumia2";
import type { Resultado } from "./cliente";
import { linhaDeExemplo } from "./exemplos";
import { eDeFora, type CartaoDeFora, type LinhaDeFora } from "./tipos";

/** O mínimo que a mistura lê de um item (post daqui ou cartão de fora). */
export interface ItemDaLinha {
  id: string;
  criado_em: string;
}

const instante = (iso: unknown): number => {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
};

/** A chave de um item na lista da tela (o `key` do React): a `chave` da linha de fora (um impulso tem a dele), senão o id. */
export function chaveDoItem(item: ItemDaLinha & { chave?: unknown }): string {
  return typeof item.chave === "string" && item.chave ? item.chave : item.id;
}

/**
 * Junta os posts daqui e os cartões de fora numa lista só, do mais novo ao mais antigo (`criado_em`; no impulso é a hora do
 * impulso). Estável: com a mesma data, vale a ordem de entrada, e os daqui vêm antes. Uma nota de fora que chegou mais de uma
 * vez (a original e um ou mais impulsos, ou a mesma em duas páginas) aparece uma vez só, na ocorrência mais recente. Um post
 * daqui repetido também aparece uma vez (a primeira). Não mexe nas listas recebidas.
 */
export function misturarDeFora<L extends ItemDaLinha>(locais: readonly L[], deFora: readonly CartaoDeFora[]): (L | CartaoDeFora)[] {
  const todos: { item: L | CartaoDeFora; t: number; n: number; nota: string }[] = [];
  let n = 0;
  for (const item of locais) if (item && typeof item.id === "string") todos.push({ item, t: instante(item.criado_em), n: n++, nota: `l:${item.id}` });
  for (const item of deFora) if (eDeFora(item)) todos.push({ item, t: instante(item.criado_em), n: n++, nota: `f:${item.id}` });
  todos.sort((a, b) => (a.t === b.t ? a.n - b.n : a.t > b.t ? -1 : 1));
  const vistos = new Set<string>();
  const saida: (L | CartaoDeFora)[] = [];
  for (const x of todos) {
    if (vistos.has(x.nota)) continue;
    vistos.add(x.nota);
    saida.push(x.item);
  }
  return saida;
}

/** O que a linha guarda da parte de fora entre uma página e outra (objeto simples: cabe na memória da linha). */
export interface EstadoDeFora {
  /** O `proximo` da última página de fora que veio. */
  cursor: string | null;
  /** Não há mais página de fora para pedir. */
  esgotado: boolean;
  /** Cartões que já vieram mas ainda são mais antigos que a página daqui: esperam a próxima. */
  espera: CartaoDeFora[];
}

export const estadoInicialDeFora = (): EstadoDeFora => ({ cursor: null, esgotado: false, espera: [] });

export interface PedidoDeMaisDeFora {
  /**
   * O `criado_em` do post mais antigo daqui que já está na tela, quando a linha daqui ainda tem página (limiteDaPagina). Nulo:
   * a linha daqui acabou, e o que vier de fora pode entrar até o fim.
   */
  ate: string | null;
  /** A pessoa entrou? Sem sessão nada é pedido. */
  logado: boolean;
  limite?: number;
  /** Quantas páginas de fora, no máximo, uma chamada pede (para uma página daqui que cobre muito tempo não virar uma rajada). */
  maximoDePedidos?: number;
  /** Só para os testes: troca a rota, a flag e a prévia. */
  pedir?: (cursor: string | null, limite: number) => Promise<Resultado<LinhaDeFora>>;
  ligado?: boolean;
  previa?: boolean;
}

export interface MaisDeFora {
  /** Os cartões soltos agora (para somar aos que a tela já tem e passar por misturarDeFora). */
  itens: CartaoDeFora[];
  /** O estado novo, para a próxima chamada (o recebido não é alterado). */
  estado: EstadoDeFora;
  /** Ainda há o que mostrar de fora (na espera ou por pedir): a linha não chegou ao fim. */
  temMais: boolean;
  /** O código do erro, se um pedido falhou (o estado fica como estava antes dele: dá para tentar de novo). */
  erro: string | null;
}

/**
 * Gente de fora aparece na tela? Uma regra só para todas as peças: na prévia (com os dados de exemplo, sem rota e sem banco) ou
 * com "fediverso-total" ligado. Quem chama ainda confere que está dentro da casca nova.
 */
export function deForaVale(previa: boolean = previaLigada(), recurso: boolean = ligado("fediverso-total")): boolean {
  return previa || recurso;
}

/** A linha de fora pode ser pedida? Só com "fediverso-total" ligado, com sessão e fora da prévia. */
export function podePedirDeFora(logado: boolean, recurso: boolean = ligado("fediverso-total"), previa: boolean = previaLigada()): boolean {
  return logado && recurso && !previa;
}

/** O limite de tempo de uma página daqui: o `criado_em` do último post, ou nulo se a linha daqui não tem mais página. */
export function limiteDaPagina(itens: readonly ItemDaLinha[], proximo: string | null | undefined): string | null {
  return proximo && itens.length ? itens[itens.length - 1].criado_em : null;
}

/** A linha de fora pela rota, com o token da sessão (o cliente só é baixado quando há o que pedir). */
async function pedirPelaRota(cursor: string | null, limite: number): Promise<Resultado<LinhaDeFora>> {
  const { deFora } = await import("./cliente");
  return deFora.linha(cursor, limite);
}

/**
 * Traz o que falta de fora para acompanhar a página daqui que acabou de chegar. Só pede a próxima página de fora quando a espera
 * não alcança o limite `ate` (ou está vazia, com a linha daqui no fim); solta o que é mais novo que o limite e guarda o resto.
 * Com a flag desligada ou sem sessão não pede nada e devolve vazio. Na prévia também não pede: devolve, uma vez só, o post de
 * exemplo da arte (linhaDeExemplo). Nunca lança.
 */
export async function maisDeFora(estado: EstadoDeFora, pedido: PedidoDeMaisDeFora): Promise<MaisDeFora> {
  const previa = pedido.previa ?? previaLigada();
  if (previa) {
    if (estado.esgotado) return { itens: [], estado, temMais: false, erro: null };
    return { itens: linhaDeExemplo().itens, estado: { cursor: null, esgotado: true, espera: [] }, temMais: false, erro: null };
  }
  const pode = podePedirDeFora(pedido.logado, pedido.ligado ?? ligado("fediverso-total"), false);
  if (!pode) return { itens: [], estado, temMais: false, erro: null };
  const limite = Math.min(Math.max(Math.floor(pedido.limite ?? 20), 1), 50);
  const maximo = Math.max(1, Math.floor(pedido.maximoDePedidos ?? 3));
  const pedir = pedido.pedir ?? pedirPelaRota;
  const ate = pedido.ate === null ? null : instante(pedido.ate);
  let { cursor, esgotado } = estado;
  let espera = estado.espera.slice();
  let erro: string | null = null;
  // Falta pedir enquanto nada na espera é mais antigo que o limite (aí pode haver, na página seguinte, algo mais novo que ele).
  const falta = () => !esgotado && (ate === null ? espera.length === 0 : !espera.some((c) => instante(c.criado_em) < ate));
  for (let i = 0; i < maximo && falta(); i++) {
    let r: Resultado<LinhaDeFora>;
    try {
      r = await pedir(cursor, limite);
    } catch {
      r = { ok: false, erro: "falha" };
    }
    if (!r.ok) {
      erro = r.erro;
      break;
    }
    const itens = Array.isArray(r.dado?.itens) ? r.dado.itens.filter(eDeFora) : [];
    const proximo = typeof r.dado?.proximo === "string" && r.dado.proximo ? r.dado.proximo : null;
    espera = espera.concat(itens);
    // Cursor que não anda (ou página vazia com cursor) encerra: nunca um laço pedindo a mesma página.
    esgotado = !proximo || proximo === cursor;
    cursor = proximo ?? cursor;
  }
  const soltos = ate === null ? espera : espera.filter((c) => instante(c.criado_em) >= ate);
  const guardados = ate === null ? [] : espera.filter((c) => instante(c.criado_em) < ate);
  return { itens: soltos, estado: { cursor, esgotado, espera: guardados }, temMais: !esgotado || guardados.length > 0, erro };
}
