// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aplica uma correção JÁ APROVADA (por outra pessoa que não quem propôs): lê o arquivo, troca o trecho exato (só se aparecer uma
// vez) e abre um PR. O banco decide se a correção está aprovada e se a pessoa é da curadoria (public.correcao_para_aplicar).
// Nunca junta o PR: a leitura final é humana. Detalhes: docs/backend-1.md.
import { abrirPR, caminhoValido, configDoServidor, ErroGitHub, lerArquivo, substituirTrecho } from "@/lib/conteudo-pr";
import { rpcNoBanco } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET() {
  return responder({ configurado: Boolean(configDoServidor()) });
}

export async function POST(pedido: Request) {
  const config = configDoServidor();
  if (!config) return responder({ erro: "A aplicação automática ainda não está ligada." }, 503);
  const token = /^Bearer\s+([\w.-]+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return responder({ erro: "Entre na sua conta de novo." }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { id?: unknown } | null;
  if (!corpo || typeof corpo.id !== "string" || !uuid.test(corpo.id)) return responder({ erro: "Pedido inválido." }, 400);
  const dados = await rpcNoBanco<{ id: string; caminho: string; trecho: string; troca: string; motivo: string }>("correcao_para_aplicar", { p_id: corpo.id }, token);
  if (!dados.ok) {
    const limite = dados.erro === "muitos_pedidos";
    return responder({ erro: dados.erro === "nao_aprovada" ? "Essa correção ainda não foi aprovada." : limite ? "Muitos pedidos seguidos: espere alguns minutos." : "Sem permissão para aplicar." }, limite ? 429 : 403);
  }
  const c = dados.dados;
  if (!caminhoValido(c.caminho)) return responder({ erro: "Esse arquivo não pode ser editado pelo painel." }, 400);
  try {
    const atual = await lerArquivo(config, c.caminho);
    const troca = substituirTrecho(atual.texto, c.trecho, c.troca);
    if (!troca.ok) return responder({ erro: troca.erro === "trecho_repetido" ? "O trecho aparece mais de uma vez no arquivo: proponha de novo com mais contexto." : "O trecho não está mais no arquivo (ele mudou): proponha de novo." }, 409);
    const pr = await abrirPR(config, { caminho: c.caminho, novoTexto: troca.texto, shaAtual: atual.sha, tipo: "correcao", resumo: c.motivo });
    const registro = await rpcNoBanco("correcao_aplicada", { p_id: c.id, p_numero: pr.numero, p_url: pr.url }, token);
    // O PR já existe; se o registro falhar, o endereço volta com um aviso para ninguém abrir um segundo PR.
    return responder({ ok: true, numero: pr.numero, url: pr.url, ...(registro.ok ? {} : { aviso: "O PR foi aberto, mas o painel não conseguiu registrá-lo. Não abra de novo: use o endereço." }) });
  } catch (e) {
    return responder({ erro: "O GitHub não aceitou o pedido agora. A correção continua aprovada; tente de novo." }, e instanceof ErroGitHub && e.status === 404 ? 404 : 502);
  }
}
