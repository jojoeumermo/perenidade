// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A porta de "entrar" e de "aviso" (reenviar a confirmação, pedir a senha nova), da onda 9: o que as rotas app/api/alumia/porta/
// {entrar,aviso} dividem. A prova de trabalho do aparelho (lib/rede/convites/prova-servidor.ts), a rede barrada pelo painel e o
// freio da rede nesta hora (public.alumia_porta_passar, supabase/migracoes/20261115-alumia-o9-resto8.sql). Sem teto da casa: num
// ataque, quem já tem conta continua entrando. Com o banco ainda sem a função, o freio fica na memória do processo.
// E a chamada ao serviço de contas com a chave de serviço, que nunca sai do servidor. Só no servidor.
import { chaveDoFreio, conferirDesafio } from "./prova-servidor";
import { criarFreio, impressaoDoPedido, rpcDeServico, semAFuncao, servico, SUPA } from "./servidor";

const freioNaMemoria = { entrar: criarFreio(20, 60 * 60_000), aviso: criarFreio(6, 60 * 60_000) };
const gastosNaMemoria = new Map<string, number>();

/** O desafio que já valeu, na memória (só quando o banco não pode guardar). */
function gastarNaMemoria(selo: string, vence: number): boolean {
  const agora = Date.now();
  if (gastosNaMemoria.size > 20_000) for (const [k, v] of gastosNaMemoria) if (v < agora) gastosNaMemoria.delete(k);
  if (gastosNaMemoria.has(selo)) return false;
  gastosNaMemoria.set(selo, vence);
  return true;
}

export type PortaSemTeto = { ok: true } | { ok: false; motivo: string; status: number };

/** Confere a prova e o freio de "entrar" ou "aviso". */
export async function passarSemTeto(pedido: Request, momento: "entrar" | "aviso", desafio: unknown, resposta: unknown): Promise<PortaSemTeto> {
  const prova = conferirDesafio(desafio, resposta, momento);
  if (!prova.ok) return { ok: false, motivo: prova.motivo, status: 400 };
  const impressao = impressaoDoPedido(pedido);
  const r = await rpcDeServico<{ ok: boolean; motivo?: string }>("alumia_porta_passar", {
    p_momento: momento, p_chave: chaveDoFreio(impressao, momento), p_selo: prova.selo, p_vence: new Date(prova.vence).toISOString(), p_impressao: impressao,
  });
  if (r.ok) return r.dado.ok ? { ok: true } : { ok: false, motivo: r.dado.motivo ?? "muitos_pedidos", status: 429 };
  if (!semAFuncao(r)) return { ok: false, motivo: "sem_servico", status: 503 };
  if (!gastarNaMemoria(prova.selo, prova.vence)) return { ok: false, motivo: "desafio_usado", status: 429 };
  if (impressao && !freioNaMemoria[momento](impressao)) return { ok: false, motivo: "muitos_pedidos", status: 429 };
  return { ok: true };
}

export interface RespostaDasContas {
  status: number;
  dado: Record<string, unknown> | null;
}

/**
 * Chama o serviço de contas (Supabase Auth) com a chave de serviço. `caminho` começa com "/". Lança só se não houver conexão.
 * A chave de serviço também dispensa o desafio de terceiros no serviço de contas, enquanto ele ainda estiver ligado lá.
 */
export async function servicoDeContas(caminho: string, corpo: unknown, metodo = "POST"): Promise<RespostaDasContas> {
  const chave = servico();
  const r = await fetch(`${SUPA}/auth/v1${caminho}`, {
    method: metodo,
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return { status: r.status, dado: (await r.json().catch(() => null)) as Record<string, unknown> | null };
}

/** O endereço de volta do e-mail só vale na mesma origem de quem pediu. */
export function voltaDaMesmaOrigem(pedido: Request, volta: unknown): string | null {
  const origem = pedido.headers.get("origin");
  if (!origem || typeof volta !== "string" || volta.length > 300) return null;
  try {
    const url = new URL(volta);
    return url.origin === origem ? url.toString() : null;
  } catch {
    return null;
  }
}

export const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
