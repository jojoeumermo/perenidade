// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o servidor do site pede ao serviço de contas (Supabase Auth) pela conta segura da Alumia (app/api/alumia/conta), em vez de
// o banco apagar direto nas tabelas auth.* (no projeto hospedado, o papel do banco pode não ter permissão nelas;
// supabase/migracoes/20261120-alumia-o14-conta.sql):
//   - sair dos outros aparelhos e sair de todos: o "logout" do serviço de contas, com o token da própria pessoa (é o mesmo pedido que
//     auth.admin.signOut faz; escopo "others" ou "global"). O serviço apaga as sessões e os tokens de renovação delas;
//   - tirar o aplicativo autenticador depois do código de recuperação: a administração dos fatores, com a chave de serviço.
// Só no servidor. Nada daqui registra token, conta ou endereço.
import { ANON, servico, SUPA } from "../convites/servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A conta e a sessão escritas no token, SEM conferir a assinatura. Só para um token que o próprio serviço de contas acabou de
 * entregar, ou que o servidor já conferiu com ele (contaDoToken).
 */
export function lerToken(token: string): { conta: string; sessao: string | null } | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const corpo = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")) as { sub?: unknown; session_id?: unknown } | null;
    const conta = typeof corpo?.sub === "string" && UUID.test(corpo.sub) ? corpo.sub.toLowerCase() : null;
    if (!conta) return null;
    const sessao = typeof corpo?.session_id === "string" && UUID.test(corpo.session_id) ? corpo.session_id.toLowerCase() : null;
    return { conta, sessao };
  } catch {
    return null;
  }
}

/**
 * Encerra no serviço de contas as sessões da pessoa dona do token: "others" (todas menos a do token) ou "global" (todas). Devolve se
 * o serviço confirmou. A sessão que já não existe (o banco apagou antes) conta como feito.
 */
export async function sairPeloServicoDeContas(token: string, escopo: "others" | "global"): Promise<boolean> {
  const chave = servico() || ANON;
  if (!SUPA || !chave) return false;
  try {
    const r = await fetch(`${SUPA}/auth/v1/logout?scope=${escopo}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) return true;
    const corpo = (await r.json().catch(() => null)) as { error_code?: unknown; code?: unknown } | null;
    return String(corpo?.error_code ?? corpo?.code ?? "") === "session_not_found";
  } catch {
    return false;
  }
}

/** Tira todos os fatores (o aplicativo autenticador) da conta, pela administração do serviço de contas. Devolve se conseguiu. */
export async function tirarFatoresPeloServicoDeContas(conta: string): Promise<boolean> {
  const chave = servico();
  if (!SUPA || !chave || !UUID.test(conta)) return false;
  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` };
  try {
    const lista = await fetch(`${SUPA}/auth/v1/admin/users/${conta}/factors`, { headers: cabecalhos, cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!lista.ok) return false;
    const fatores = (await lista.json().catch(() => null)) as { id?: unknown }[] | { factors?: { id?: unknown }[] } | null;
    const ids = (Array.isArray(fatores) ? fatores : (fatores?.factors ?? [])).map((f) => String(f?.id ?? "")).filter((id) => UUID.test(id));
    for (const id of ids) {
      const r = await fetch(`${SUPA}/auth/v1/admin/users/${conta}/factors/${id}`, { method: "DELETE", headers: cabecalhos, cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!r.ok && r.status !== 404) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export type RespostaComToken<T> = { ok: true; dado: T } | { ok: false; status: number; codigo: string };

/** Chama uma função do banco como a própria pessoa (o token dela), para a porta e as regras do banco valerem. */
export async function rpcComToken<T>(funcao: string, args: Record<string, unknown>, token: string, cabecalhos: Record<string, string> = {}): Promise<RespostaComToken<T>> {
  if (!SUPA || !ANON) return { ok: false, status: 0, codigo: "sem_servico" };
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...cabecalhos },
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
