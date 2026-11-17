// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as rotas da porta de entrada (app/api/alumia/porta/*) dividem: falar com o banco pela chave de serviço, a impressão da
// rede de quem pediu (calculada na hora, nunca guardada: lib/rede/painel/impressao.ts), um freio na memória do processo para
// quando o banco não responde, e as respostas sem cache. Só no servidor.
// Nenhum endereço de rede é guardado, escrito em log ou mandado ao banco (decisão da coordenação de 13/11).
import { enderecoDoPedido, impressaoDaRede } from "../painel/impressao";

export const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const servico = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const semCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
export const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: semCache });

/** Pedido de outra origem não passa (o navegador manda Sec-Fetch-Site; quem chama de fora do navegador não ganha nada com isso). */
export function deOutraOrigem(pedido: Request): boolean {
  const lugar = pedido.headers.get("sec-fetch-site");
  return !!lugar && lugar !== "same-origin";
}

/** A impressão da rede de quem pediu (HMAC com o segredo do servidor), ou nula sem segredo ou sem endereço confiável. */
export function impressaoDoPedido(pedido: Request): string | null {
  return impressaoDaRede(enderecoDoPedido(pedido.headers), process.env.ALUMIA_IMPRESSAO_SEGREDO);
}

/**
 * Sem impressão (o site sem a borda na frente, o sinal da borda faltando ou o segredo da impressão ausente), todos os pedidos
 * dividem UM balde no freio por rede, em vez de o banco pular o freio: quem troca o endereço a cada pedido não escapa dele.
 */
export const IMPRESSAO_SEM_REDE = "0".repeat(64);
export const impressaoDoFreio = (impressao: string | null): string => impressao ?? IMPRESSAO_SEM_REDE;

/** Em produção, quem chega sem impressão recebe o desafio mais difícil (fora de produção, a cópia local não tem a borda). */
export const semImpressaoEmProducao = (impressao: string | null): boolean => !impressao && process.env.NODE_ENV === "production";

export type RespostaDoBanco<T> = { ok: true; dado: T } | { ok: false; status: number; codigo: string };

/** Chama uma função do banco com a chave de serviço. Sem banco configurado, `status` 0. */
export async function rpcDeServico<T>(funcao: string, args: Record<string, unknown>): Promise<RespostaDoBanco<T>> {
  const chave = servico();
  if (!SUPA || !chave) return { ok: false, status: 0, codigo: "sem_servico" };
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const corpo = (await r.json().catch(() => null)) as unknown;
    if (!r.ok) {
      const mensagem = String((corpo as { message?: unknown } | null)?.message ?? "");
      return { ok: false, status: r.status, codigo: /^[a-z_:]{3,40}$/.test(mensagem) ? mensagem : "banco" };
    }
    return { ok: true, dado: corpo as T };
  } catch {
    return { ok: false, status: 502, codigo: "sem_conexao" };
  }
}

/** A função ainda não existe no banco (a migração da onda 8 não rodou): o PostgREST responde 404. */
export const semAFuncao = (r: RespostaDoBanco<unknown>) => !r.ok && r.status === 404;

/**
 * Um freio na memória do processo, por chave (a impressão, ou "sem-rede"), para quando o banco não pode contar: no máximo
 * `maximo` usos a cada `janelaMs`. Some sozinho; nada vai a disco.
 */
export function criarFreio(maximo: number, janelaMs: number) {
  const usos = new Map<string, number[]>();
  return (chave: string): boolean => {
    const agora = Date.now();
    const recentes = (usos.get(chave) ?? []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= maximo) {
      usos.set(chave, recentes);
      return false;
    }
    recentes.push(agora);
    usos.set(chave, recentes);
    if (usos.size > 5000) for (const [k, v] of usos) if (v.every((t) => agora - t >= janelaMs)) usos.delete(k);
    return true;
  };
}

/** A conta do token (o serviço de contas confere a assinatura e se a sessão continua viva), com o e-mail confirmado ou não. */
export async function contaDoToken(pedido: Request): Promise<{ id: string; confirmada: boolean; email: string | null } | null | "sem_conexao"> {
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token || !SUPA || !ANON) return null;
  try {
    const r = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const u = (await r.json()) as { id?: string; email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
    const id = String(u?.id ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    return { id, confirmada: !!(u?.email_confirmed_at || u?.confirmed_at), email: typeof u?.email === "string" && u.email ? u.email : null };
  } catch {
    return "sem_conexao";
  }
}
