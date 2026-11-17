// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as rotas do painel único da Alumia (app/api/alumia/admin/*) dividem: o token de quem pediu, a pergunta ao banco se é da
// coordenação com o segundo fator (public.alumia_admin_eu, chamada com o token da própria pessoa: o banco decide, não a rota), a
// faxina dos bloqueios vencidos na Cloudflare e o e-mail barrado. Só no servidor. Nada daqui escreve endereço, token ou e-mail
// em log.
import { rpcDeServico } from "../convites/servidor";
import { rpcComToken } from "../seguranca/servico-de-contas";
import { apagarRegra, type ConfigDaCloudflare } from "./cloudflare";
import { seloDoEmail } from "./email";

/** O token da sessão no cabeçalho Authorization, ou nulo. */
export function tokenDoPedido(pedido: Request): string | null {
  return /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? null;
}

/** A pessoa do token é da coordenação, com o segundo fator nesta sessão? Quem decide é o banco. */
export async function eCoordenacaoComFator(token: string): Promise<boolean> {
  const r = await rpcComToken<{ pode?: unknown }>("alumia_admin_eu", {}, token);
  return r.ok && r.dado?.pode === true;
}

/**
 * Apaga na Cloudflare as regras cujo prazo venceu e dá baixa no banco (chave de serviço). Devolve quantas saíram. A que a
 * Cloudflare não apagou agora fica para a próxima rodada.
 */
export async function varrerVencidas(cfg: ConfigDaCloudflare): Promise<number> {
  const lista = await rpcDeServico<{ id: string; regra: string }[]>("alumia_admin_borda_vencidas", {});
  if (!lista.ok || !Array.isArray(lista.dado)) return 0;
  let n = 0;
  for (const item of lista.dado) {
    if (await apagarRegra(String(item.regra), cfg)) {
      const baixa = await rpcDeServico("alumia_admin_borda_apagada", { p_id: item.id });
      if (baixa.ok) n += 1;
    }
  }
  return n;
}

/**
 * O e-mail está barrado por um banimento do painel único? Para a rota de criar conta conferir antes de a conta nascer. Sem o
 * segredo (ALUMIA_EMAIL_SEGREDO), ou sem resposta do banco, devolve falso: a porta segue com as outras barreiras.
 */
export async function emailBarrado(email: string): Promise<boolean> {
  const selo = seloDoEmail(email);
  if (!selo) return false;
  const r = await rpcDeServico<boolean>("alumia_admin_email_barrado", { p_selo: selo });
  return r.ok && r.dado === true;
}
