// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Pedido do selo com conta nova de organização (Alumia F4; PLANO-ALUMIA §5 F4 e §6.6). Ordem:
//   1. o banco confere o pedido COMO a própria pessoa (rede_org_pedir_selo: membro da Rede, 18+, @ livre, limite de uso) e diz se
//      precisa de conta nova; o id do dono vem dessa resposta, que sai da sessão, nunca do corpo do pedido;
//   2. lib/rede/contas-extra.ts cria a conta sem senha (e-mail aleatório em .invalid, nada do dono em auth.users) e liga ao dono em
//      interno.rede_identidades;
//   3. rede_org_criar (só a chave de serviço) transforma a conta em organização, põe o dono como gestor e o pedido na fila.
// Se o passo 3 falha, a conta criada é apagada (não fica conta solta). Atrás das flags: com "alumia-org" desligada a rota responde
// 404, como se não existisse. LGPD art. 11 (filiação é dado sensível) e art. 46 (segurança): a chave de serviço só existe aqui.
import { ligado } from "@/lib/recursos";
import { configDoAmbiente, criarContaExtra } from "@/lib/rede/contas-extra";
import { conferirPedido } from "@/lib/rede/org/pedido";
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import type { PedidoDeSelo } from "@/lib/rede/tipos-org";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/** Só os campos do pedido, com os tipos certos (o resto do corpo é ignorado). */
function lerPedido(cru: unknown): PedidoDeSelo | null {
  const p = typeof cru === "object" && cru !== null && "p" in cru ? (cru as { p: unknown }).p : null;
  if (typeof p !== "object" || p === null) return null;
  const x = p as Record<string, unknown>;
  const texto = (k: string) => (typeof x[k] === "string" ? (x[k] as string) : "");
  const pedido = {
    codinome: texto("codinome").trim(),
    handle: texto("handle").trim(),
    tipo: texto("tipo") as PedidoDeSelo["tipo"],
    cidade: texto("cidade").trim(),
    documentoTipo: texto("documentoTipo").trim(),
    documento: texto("documento").trim(),
    sobre: texto("sobre").trim(),
    maior: x.maior === true,
  };
  return conferirPedido(pedido) ? null : pedido;
}

/** Chama uma função do banco com a chave de serviço (só aqui, no servidor). */
async function chamarComoServico<T>(url: string, chave: string, funcao: string, argumentos: Record<string, unknown>): Promise<{ ok: true; dado: T } | { ok: false; codigo: string }> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
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

export async function POST(pedido: Request) {
  if (!alumia2Ligada() || !ligado("alumia-org")) return resposta({ erro: "nao_encontrado" }, 404);
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const cru = await lerCorpoLimitado(pedido, 8 * 1024);
  if (!cru) return resposta({ erro: "grande" }, 413);
  let json: unknown = null;
  try {
    json = JSON.parse(new TextDecoder().decode(cru));
  } catch {
    return resposta({ erro: "invalido:pedido" }, 400);
  }
  const p = lerPedido(json);
  if (!p) return resposta({ erro: "invalido:pedido" }, 400);

  // 1. Como a pessoa: confere tudo e diz se precisa de conta nova.
  const r = await chamarComoPessoa<{ id: string; situacao: "esperando" } | { criar: true; dono: string }>(token, "rede_org_pedir_selo", { p });
  if (!r.ok) return resposta({ erro: r.codigo }, statusDoCodigo(r.codigo));
  if (!("criar" in r.dado)) return resposta(r.dado);

  // 2. A conta sem senha, ligada ao dono só em interno.rede_identidades.
  const config = configDoAmbiente();
  if (!config) return resposta({ erro: "sem_servico" }, 503);
  const conta = await criarContaExtra({ dono: r.dado.dono, tipo: "org", codinome: p.codinome }, config);
  if (!conta.ok) return resposta({ erro: conta.erro }, conta.erro === "limite_identidades" ? 403 : conta.erro === "confirme_codinome" ? 400 : 503);

  // 3. A conta vira organização e o pedido entra na fila. Se falhar, a conta criada é apagada.
  const feito = await chamarComoServico<{ id: string; situacao: "esperando" }>(config.url, config.chave, "rede_org_criar", { p_dono: r.dado.dono, p_org: conta.id, p });
  if (feito.ok) return resposta(feito.dado);
  try {
    await fetch(`${config.url}/auth/v1/admin/users/${conta.id}`, { method: "DELETE", headers: { apikey: config.chave, Authorization: `Bearer ${config.chave}` }, signal: AbortSignal.timeout(10_000) });
  } catch {
    // sem conexão para desfazer: a conta fica sem senha e sem organização (ninguém entra nela)
  }
  return resposta({ erro: feito.codigo }, statusDoCodigo(feito.codigo));
}
