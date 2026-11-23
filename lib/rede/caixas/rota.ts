// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as rotas anônimas das caixas dividem (app/api/alumia/caixa/*, pedido, diretorio, passes/chave). Só no servidor do site.
//   - recusam qualquer pedido com cookie de sessão ("sb-…") ou com um Authorization que não seja um passe (PrivateToken): um erro do
//     aparelho nunca liga uma conta a uma caixa;
//   - respondem sem cache, sem log do corpo nem do endereço;
//   - leem o corpo com teto de tamanho;
//   - juntam os depósitos e as criações em LOTES de até 2 s ou 64 itens (public.rede_caixa_lote grava cada lote numa transação só, em
//     ordem sorteada: o mesmo xmin para todos, e a posição no disco não diz quem chegou antes).
import { rpcDeServico } from "../convites/servidor";
import { diaUtc } from "./base";

const semCache = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };

/** A resposta de toda rota anônima (sem cache). */
export const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: semCache });

/**
 * O pedido traz algo de conta? Cookie de sessão do Supabase ("sb-…") ou Authorization que não é um passe. Nesse caso a rota recusa
 * ("sem_sessao_aqui") sem olhar o resto.
 */
export function trazSessao(pedido: Request): boolean {
  const cookie = pedido.headers.get("cookie") ?? "";
  if (/(^|;\s*)sb-[^=]*=/.test(cookie)) return true;
  const autorizacao = (pedido.headers.get("authorization") ?? "").trim();
  return autorizacao !== "" && !/^PrivateToken\s/.test(autorizacao);
}

/** Lê o corpo JSON com teto de bytes; nulo se passar do teto ou não for JSON de objeto. */
export async function lerCorpo(pedido: Request, teto: number): Promise<Record<string, unknown> | null> {
  const declarado = Number(pedido.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > teto) return null;
  let texto: string;
  try {
    texto = await pedido.text();
  } catch {
    return null;
  }
  if (texto.length > teto) return null;
  try {
    const v = JSON.parse(texto) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** A recusa padrão de quem chegou com sessão. */
export const recusaDeSessao = () => responder({ ok: false, erro: "sem_sessao_aqui" }, 400);

// ── O lote ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Um item do lote, como o banco recebe (base64 padrão nos bytes). */
export type ItemDoLote =
  | { acao: "criar"; id_h: string; pd_h: string; pl_h: string; multi: boolean; gastos: [string] }
  | { acao: "depositar"; id_h: string; pd: string; envelope: string; franquia?: string | null; marca?: string | null; unico?: boolean }
  | { acao: "pedido"; codinome: string; envelope: string; marca?: string | null; gastos: [string, string] };

export type ResultadoDoItem = { ok: true } | { ok: false; erro: string };

/** Quem grava o lote (o banco, pela chave de serviço; nos testes, um falso). */
export type GravarLote = (itens: ItemDoLote[], dia: string) => Promise<ResultadoDoItem[] | null>;

const gravarNoBanco: GravarLote = async (itens, dia) => {
  const r = await rpcDeServico<{ resultados: ResultadoDoItem[] }>("rede_caixa_lote", { p_itens: itens, p_dia: dia });
  return r.ok && Array.isArray(r.dado?.resultados) && r.dado.resultados.length === itens.length ? r.dado.resultados : null;
};

export const ESPERA_DO_LOTE_MS = 2000;
export const MAXIMO_DO_LOTE = 64;

/**
 * O juntador de lotes: cada rota entrega o item e recebe a promessa do resultado. O lote sai quando junta 64 itens, quando passam 2 s
 * do primeiro, ou quando o dia (UTC) muda. Um lote que o banco não grava responde "rede" a todos os itens dele.
 */
export function criarJuntador(gravar: GravarLote = gravarNoBanco, espera = ESPERA_DO_LOTE_MS, maximo = MAXIMO_DO_LOTE, hoje: () => string = diaUtc) {
  let fila: { item: ItemDoLote; resolver: (r: ResultadoDoItem) => void }[] = [];
  let diaDaFila = "";
  let relogio: ReturnType<typeof setTimeout> | null = null;

  const soltar = () => {
    if (relogio) clearTimeout(relogio);
    relogio = null;
    const lote = fila;
    const dia = diaDaFila;
    fila = [];
    if (!lote.length) return;
    gravar(lote.map((x) => x.item), dia)
      .catch(() => null)
      .then((resultados) => lote.forEach((x, i) => x.resolver(resultados?.[i] ?? { ok: false, erro: "rede" })));
  };

  return {
    /** Põe um item no lote; devolve o dia (o que vai no pacote e na marca) e a promessa do resultado. */
    juntar(item: ItemDoLote | ((dia: string) => ItemDoLote)): { dia: string; resultado: Promise<ResultadoDoItem> } {
      const dia = hoje();
      if (fila.length && dia !== diaDaFila) soltar();
      diaDaFila = dia;
      const resultado = new Promise<ResultadoDoItem>((resolver) => fila.push({ item: typeof item === "function" ? item(dia) : item, resolver }));
      if (fila.length >= maximo) soltar();
      else relogio ??= setTimeout(soltar, espera);
      return { dia, resultado };
    },
    /** Quantos itens esperam (para os testes). */
    get esperando() {
      return fila.length;
    },
  };
}

/** O juntador do processo (um por servidor do site). */
let juntadorDoProcesso: ReturnType<typeof criarJuntador> | null = null;
export const juntador = () => (juntadorDoProcesso ??= criarJuntador());
