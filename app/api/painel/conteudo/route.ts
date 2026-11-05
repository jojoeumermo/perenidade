// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Editar conteúdo em arquivo pelo painel. GET: diz se está ligado e, com ?caminho=, devolve o texto atual. POST: abre um PR no
// GitHub com o texto novo (nunca junta). Quem chama manda o token da própria sessão; o banco confere o papel e segura o ritmo
// (public.conteudo_pode_editar). O token do GitHub (GITHUB_CONTEUDO_TOKEN) fica só no servidor. Detalhes: docs/backend-1.md.
import { abrirPR, caminhoValido, configDoServidor, ErroGitHub, LIMITE_DO_ARQUIVO, lerArquivo, manterFimDeLinha } from "@/lib/conteudo-pr";
import { rpcNoBanco } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const tokenDe = (pedido: Request) => /^Bearer\s+([\w.-]+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1];

async function conferirPessoa(token: string) {
  const r = await rpcNoBanco<boolean>("conteudo_pode_editar", {}, token);
  if (r.ok) return null;
  return r.erro === "muitos_pedidos" ? responder({ erro: "Muitos pedidos seguidos: espere alguns minutos." }, 429) : responder({ erro: "Editar conteúdo é com a coordenação, a curadoria ou o desenvolvimento." }, 403);
}

export async function GET(pedido: Request) {
  const config = configDoServidor();
  const caminho = new URL(pedido.url).searchParams.get("caminho");
  if (!caminho) return responder({ configurado: Boolean(config) });
  if (!config) return responder({ erro: "A edição de conteúdo ainda não está ligada." }, 503);
  const token = tokenDe(pedido);
  if (!token) return responder({ erro: "Entre na sua conta de novo." }, 401);
  if (!caminhoValido(caminho)) return responder({ erro: "Esse arquivo não pode ser editado pelo painel." }, 400);
  const negado = await conferirPessoa(token);
  if (negado) return negado;
  try {
    const { texto } = await lerArquivo(config, caminho);
    return responder({ caminho, texto });
  } catch (e) {
    const naoAchou = e instanceof ErroGitHub && e.status === 404;
    return responder({ erro: naoAchou ? "Arquivo não encontrado." : "O GitHub não respondeu agora." }, naoAchou ? 404 : 502);
  }
}

export async function POST(pedido: Request) {
  const config = configDoServidor();
  if (!config) return responder({ erro: "A edição de conteúdo ainda não está ligada." }, 503);
  const token = tokenDe(pedido);
  if (!token) return responder({ erro: "Entre na sua conta de novo." }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { caminho?: unknown; texto?: unknown; resumo?: unknown } | null;
  if (!corpo || !caminhoValido(corpo.caminho) || typeof corpo.texto !== "string" || corpo.texto.length > LIMITE_DO_ARQUIVO) return responder({ erro: "Pedido inválido." }, 400);
  const resumo = typeof corpo.resumo === "string" ? corpo.resumo : "";
  const negado = await conferirPessoa(token);
  if (negado) return negado;
  try {
    const atual = await lerArquivo(config, corpo.caminho);
    const novo = manterFimDeLinha(atual.texto, corpo.texto);
    if (novo === atual.texto) return responder({ erro: "Nada mudou no texto." }, 400);
    const pr = await abrirPR(config, { caminho: corpo.caminho, novoTexto: novo, shaAtual: atual.sha, tipo: "edicao", resumo });
    // O registro no banco é do painel; se falhar, o PR já existe e o endereço volta do mesmo jeito.
    await rpcNoBanco("conteudo_pr_registrar", { p_caminho: corpo.caminho, p_numero: pr.numero, p_url: pr.url, p_tipo: "edicao" }, token);
    return responder({ ok: true, numero: pr.numero, url: pr.url });
  } catch (e) {
    return responder({ erro: "O GitHub não aceitou o pedido agora. Nada foi alterado." }, e instanceof ErroGitHub && e.status === 404 ? 404 : 502);
  }
}
