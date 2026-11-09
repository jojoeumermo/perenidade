// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Contas extras da Alumia (PLANO-ALUMIA §5 F0 e §6.6): uma IDENTIDADE a mais da mesma pessoa (F6) ou a CONTA DE UMA ORGANIZAÇÃO
// (F4) é outro usuário em auth.users, sem senha, criado aqui, no servidor, com a chave de serviço. O vínculo dono → conta fica SÓ
// em interno.rede_identidades (função rede_identidade_ligar, que só a chave de serviço chama).
//
// O que NUNCA vai para auth.users (que o painel do Supabase mostra e que um vazamento expõe primeiro):
//   - o dono (nem id, nem e-mail, nem codinome) — nada em user_metadata nem em app_metadata;
//   - o tipo da conta (identidade ou organização);
//   - um e-mail de verdade: o endereço é aleatório no domínio reservado ".invalid" (RFC 2606), que não entrega correio a ninguém.
// Só vai o codinome público da conta nova (o gatilho lucia_conta_nova usa "apelido" para criar o perfil).
//
// LGPD (Lei 13.709/2018) art. 11: filiação a organização política é dado sensível; art. 46: medidas de segurança. Risco que
// fica (documentar na tela, F4/F6): o horário de criação em auth.users pode ser cruzado com a atividade do dono.
//
// Só no servidor (rota de API ou ação do servidor): a chave de serviço vem de SUPABASE_SERVICE_ROLE_KEY, que nunca tem o
// prefixo NEXT_PUBLIC_ e por isso nunca chega ao navegador. Sem "@/" de propósito (os testes chamam com um fetch falso).

export type TipoDeContaExtra = "identidade" | "org";

export interface ConfigDoServico {
  /** O endereço do Supabase (NEXT_PUBLIC_SUPABASE_URL), sem a barra do fim. */
  url: string;
  /** A chave de serviço (SUPABASE_SERVICE_ROLE_KEY). */
  chave: string;
  /** O fetch a usar (os testes passam um falso). */
  buscar?: typeof fetch;
}

export interface PedidoDeContaExtra {
  /** Quem pede (o usuário que entrou; quem chama confere a sessão antes). */
  dono: string;
  tipo: TipoDeContaExtra;
  /** O codinome público da conta nova (2 a 40 caracteres, sem e-mail nem telefone). */
  codinome: string;
}

export type ResultadoDaContaExtra = { ok: true; id: string } | { ok: false; erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A configuração lida do ambiente do servidor; nula se faltar alguma coisa (aí a função nem tenta). */
export function configDoAmbiente(): ConfigDoServico | null {
  if (typeof window !== "undefined") return null;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return url && chave ? { url, chave } : null;
}

/** Um e-mail que não existe e não diz nada: 32 letras aleatórias em contas.alumia.invalid. */
export function emailAleatorio(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}@contas.alumia.invalid`;
}

/** O codinome serve? 2 a 40 caracteres, sem "@", sem sequência longa de números (telefone, CPF) e sem quebra de linha. */
export function codinomeOk(codinome: string): boolean {
  const c = codinome.trim();
  return c.length >= 2 && c.length <= 40 && !/[@\n\r]/.test(c) && !/\d{6,}/.test(c.replace(/[\s.\-()]/g, ""));
}

/**
 * O corpo do pedido à API de administração do Supabase (POST /auth/v1/admin/users). Exportado para o teste provar que nada do
 * dono vai junto: só o e-mail aleatório, a confirmação e o codinome. Sem senha: a conta não entra por senha.
 */
export function corpoDoUsuario(codinome: string, email: string = emailAleatorio()): Record<string, unknown> {
  return { email, email_confirm: true, user_metadata: { apelido: codinome.trim() } };
}

/**
 * Cria a conta extra e liga ao dono. Se a ligação falhar, apaga a conta criada (não fica conta solta sem dono). Devolve só o id
 * da conta nova; erros vêm como código curto, sem detalhe do servidor.
 */
export async function criarContaExtra(pedido: PedidoDeContaExtra, config: ConfigDoServico | null = configDoAmbiente()): Promise<ResultadoDaContaExtra> {
  if (!config) return { ok: false, erro: "sem_servico" };
  if (!UUID.test(pedido.dono)) return { ok: false, erro: "entre_primeiro" };
  if (pedido.tipo !== "identidade" && pedido.tipo !== "org") return { ok: false, erro: "falha" };
  if (!codinomeOk(pedido.codinome)) return { ok: false, erro: "confirme_codinome" };
  const buscar = config.buscar ?? fetch;
  const cabecalhos = { apikey: config.chave, Authorization: `Bearer ${config.chave}`, "Content-Type": "application/json" };

  let id = "";
  try {
    const r = await buscar(`${config.url}/auth/v1/admin/users`, { method: "POST", headers: cabecalhos, body: JSON.stringify(corpoDoUsuario(pedido.codinome)) });
    if (!r.ok) return { ok: false, erro: r.status === 422 ? "falha" : "sem_servico" };
    id = String(((await r.json()) as { id?: unknown }).id ?? "");
    if (!UUID.test(id)) return { ok: false, erro: "falha" };
  } catch {
    return { ok: false, erro: "sem_conexao" };
  }

  try {
    const r = await buscar(`${config.url}/rest/v1/rpc/rede_identidade_ligar`, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ p_dono: pedido.dono, p_identidade: id, p_tipo: pedido.tipo }),
    });
    if (r.ok) return { ok: true, id };
  } catch {
    // cai no desfazer abaixo
  }
  // A ligação falhou: desfaz a conta criada.
  try {
    await buscar(`${config.url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: cabecalhos });
  } catch {
    // sem conexão para desfazer: a conta fica sem dono e sem senha (ninguém entra nela); a faxina da F6 apaga
  }
  return { ok: false, erro: "falha" };
}
