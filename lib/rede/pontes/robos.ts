// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conta de um robô, criada pelo SERVIDOR do site com a chave de serviço (como as contas extras de lib/rede/contas-extra.ts):
// outro usuário em auth.users, sem senha, com e-mail aleatório em ".invalid" e só o nome do robô. Em auth.users não vai nada de
// quem pediu nem da organização; o vínculo robô → organização fica só em interno.rede_pontes_robos (rede_pontes_robo_ligar, que
// só a chave de serviço chama). Se a ligação falhar, a conta criada é apagada. Sem "@/" de propósito (o teste usa um fetch falso).
import { codinomeOk, configDoAmbiente, corpoDoUsuario, type ConfigDoServico } from "../contas-extra";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoDoRobo = { ok: true; robo: unknown } | { ok: false; erro: string };

/** Chama uma função do banco com a chave de serviço. */
export async function chamarComoServico<T>(config: ConfigDoServico, funcao: string, argumentos: Record<string, unknown>): Promise<{ ok: true; dado: T } | { ok: false; codigo: string }> {
  const buscar = config.buscar ?? fetch;
  try {
    const r = await buscar(`${config.url}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: config.chave, Authorization: `Bearer ${config.chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const corpo = (await r.json().catch(() => null)) as unknown;
    if (r.ok) return { ok: true, dado: corpo as T };
    const m = typeof corpo === "object" && corpo !== null && "message" in corpo ? String((corpo as { message: unknown }).message) : "";
    return { ok: false, codigo: /^[a-z_]+(:[a-z_]+)?$/.test(m) ? m : "falha" };
  } catch {
    return { ok: false, codigo: "sem_conexao" };
  }
}

/** Cria a conta do robô do pedido `robo` (já aceito pelo banco como a pessoa) e liga ao pedido. */
export async function criarContaDoRobo(robo: string, nome: string, config: ConfigDoServico | null = configDoAmbiente()): Promise<ResultadoDoRobo> {
  if (!config) return { ok: false, erro: "sem_servico" };
  if (!UUID.test(robo) || !codinomeOk(nome)) return { ok: false, erro: "invalido:nome" };
  const buscar = config.buscar ?? fetch;
  const cabecalhos = { apikey: config.chave, Authorization: `Bearer ${config.chave}`, "Content-Type": "application/json" };
  let id = "";
  try {
    const r = await buscar(`${config.url}/auth/v1/admin/users`, { method: "POST", headers: cabecalhos, body: JSON.stringify(corpoDoUsuario(nome)) });
    if (r.ok) id = String(((await r.json()) as { id?: unknown }).id ?? "");
  } catch {
    // cai no desfazer abaixo
  }
  if (!UUID.test(id)) {
    await chamarComoServico(config, "rede_pontes_robo_desfazer", { p_robo: robo });
    return { ok: false, erro: "sem_servico" };
  }
  const ligado = await chamarComoServico<unknown>(config, "rede_pontes_robo_ligar", { p_robo: robo, p_perfil: id });
  if (ligado.ok) return { ok: true, robo: ligado.dado };
  try {
    await buscar(`${config.url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: cabecalhos });
  } catch {
    // sem conexão para desfazer: a conta fica sem senha e sem robô (ninguém entra nela)
  }
  await chamarComoServico(config, "rede_pontes_robo_desfazer", { p_robo: robo });
  return { ok: false, erro: "falha" };
}
