// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Publicar agora", em Disciplinas e trilhas: pede ao GitHub a rotina de publicação fora de hora, para a mudança no
// currículo (e o que mais estiver aprovado) ir ao ar em minutos, sem esperar a rodada da hora. Quem chama manda o
// token da própria sessão; o banco confere se a pessoa decide o currículo e segura o ritmo (até 6 por hora). O token
// do GitHub (só "Actions: escrita" neste repositório) fica só no servidor; sem ele, o botão nem aparece.
import { rpcNoBanco } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const configurado = () => Boolean(process.env.GITHUB_PUBLICAR_TOKEN);

export async function GET() {
  return responder({ configurado: configurado() });
}

export async function POST(pedido: Request) {
  if (!configurado()) return responder({ erro: "A publicação fora de hora ainda não está ligada." }, 503);
  const token = /^Bearer\s+([\w.-]+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return responder({ erro: "Entre na sua conta de novo." }, 401);
  const pode = await rpcNoBanco<boolean>("curriculo_publicar_agora", {}, token);
  if (!pode.ok) return responder({ erro: pode.erro === "muitos_pedidos" ? "Muitos pedidos seguidos: espere alguns minutos." : "Publicar fora de hora é com a coordenação." }, pode.erro === "muitos_pedidos" ? 429 : 403);
  const repositorio = process.env.GITHUB_PUBLICAR_REPO || "jojoeumermo/perenidade";
  const resposta = await fetch(`https://api.github.com/repos/${repositorio}/actions/workflows/publicar.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GITHUB_PUBLICAR_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "master" }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!resposta || resposta.status !== 204) return responder({ erro: "O GitHub não aceitou o pedido agora. A rodada da hora publica do mesmo jeito." }, 502);
  return responder({ ok: true });
}
