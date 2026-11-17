// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Banir uma conta e o que vem dela, pelo painel único da Alumia. A rota existe só para o e-mail: o resumo dele (HMAC com
// ALUMIA_EMAIL_SEGREDO, lib/rede/admin/email.ts) é calculado aqui, porque o segredo não pode morar no banco. O resto (a conta,
// as sessões, os convites, quem ela convidou de volta à triagem, a rede e o aparelho pela impressão) é a função do banco
// public.alumia_admin_banir, chamada com o token de quem pediu: o banco confere a coordenação e o segundo fator e registra.
//   POST {id, motivo, confirma, rede_dias?, rede_contas?} com a sessão no Authorization → a resposta do banco + {email_sem_segredo}
// Quem não é da coordenação com o segundo fator recebe 404, igual a um endereço que não existe. O e-mail não volta ao navegador.
import { seloDoEmail } from "@/lib/rede/admin/email";
import { eCoordenacaoComFator, tokenDoPedido } from "@/lib/rede/admin/servidor";
import { deOutraOrigem, resposta, rpcDeServico } from "@/lib/rede/convites/servidor";
import { rpcComToken } from "@/lib/rede/seguranca/servico-de-contas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const naoExiste = () => resposta(null, 404);

interface Corpo {
  id?: unknown;
  motivo?: unknown;
  confirma?: unknown;
  rede_dias?: unknown;
  rede_contas?: unknown;
}

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return naoExiste();
  const token = tokenDoPedido(pedido);
  if (!token || !(await eCoordenacaoComFator(token))) return naoExiste();
  const c = (await pedido.json().catch(() => null)) as Corpo | null;
  const id = typeof c?.id === "string" && UUID.test(c.id) ? c.id.toLowerCase() : "";
  if (!id) return resposta({ ok: false, codigo: "invalido:id" }, 400);
  const dias = Number.isInteger(c?.rede_dias) ? Number(c?.rede_dias) : 0;
  const contas = Number.isInteger(c?.rede_contas) ? Number(c?.rede_contas) : null;

  // O e-mail só existe aqui dentro, o tempo de virar o resumo.
  const email = await rpcDeServico<string | null>("alumia_admin_email_de", { p_id: id });
  const selo = email.ok ? seloDoEmail(email.dado) : null;

  const r = await rpcComToken<Record<string, unknown>>(
    "alumia_admin_banir",
    { p_id: id, p_motivo: typeof c?.motivo === "string" ? c.motivo : "", p_confirma: typeof c?.confirma === "string" ? c.confirma : "", p_selo_email: selo, p_rede_dias: dias, p_rede_contas: contas },
    token,
  );
  if (!r.ok) return resposta({ ok: false, codigo: r.codigo }, r.status >= 400 && r.status < 500 ? 400 : 502);
  return resposta({ ...r.dado, email_sem_segredo: !selo });
}
