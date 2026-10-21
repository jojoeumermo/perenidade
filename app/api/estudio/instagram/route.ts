// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O estúdio de design publica no Instagram por aqui: GET diz se a conta está ligada; POST publica agora ou agenda.
// Quem chama manda o token da própria sessão; o banco confere se a pessoa pode publicar (coordenação ou marketing)
// e registra a publicação. A chave do Instagram fica só no servidor.
import { agendaConfigurada, instagramConfigurado, publicarNoInstagram, rpcNoBanco, urlDePublicacao } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function GET() {
  return responder({ configurado: instagramConfigurado(), agenda: instagramConfigurado() && agendaConfigurada() });
}

interface Pedido {
  urls?: unknown;
  legenda?: unknown;
  quando?: unknown;
  design?: unknown;
  titulo?: unknown;
}

export async function POST(pedido: Request) {
  const token = /^Bearer\s+([\w.-]+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return responder({ erro: "Entre na sua conta de novo." }, 401);
  const corpo = (await pedido.json().catch(() => null)) as Pedido | null;
  const urls = Array.isArray(corpo?.urls) ? corpo.urls.filter((u): u is string => typeof u === "string") : [];
  const legenda = typeof corpo?.legenda === "string" ? corpo.legenda.slice(0, 2200) : "";
  const quando = typeof corpo?.quando === "string" && corpo.quando ? corpo.quando : null;
  if (!urls.length || urls.length > 10 || !urls.every(urlDePublicacao)) return responder({ erro: "Imagens inválidas." }, 400);
  if (!legenda.trim()) return responder({ erro: "A legenda está vazia." }, 400);
  const pode = await rpcNoBanco<boolean>("design_pode_publicar", {}, token);
  if (!pode.ok || pode.dados !== true) return responder({ erro: "Publicar no perfil do instituto é com a coordenação e o marketing." }, 403);
  const registro = { urls, legenda, design: typeof corpo?.design === "string" ? corpo.design : null, titulo: typeof corpo?.titulo === "string" ? corpo.titulo.slice(0, 120) : "" };
  if (quando) {
    if (!agendaConfigurada()) return responder({ erro: "O agendamento ainda não está ligado." }, 503);
    const r = await rpcNoBanco("design_publicacao_registrar", { p: { ...registro, quando, status: "agendada" } }, token);
    if (!r.ok) return responder({ erro: r.erro === "invalido:quando" ? "Escolha um horário entre 5 minutos e 90 dias a partir de agora." : "O banco não aceitou o agendamento." }, 400);
    return responder({ ok: true, agendada: true });
  }
  if (!instagramConfigurado()) return responder({ erro: "A conta do Instagram ainda não está ligada ao site." }, 503);
  try {
    const media = await publicarNoInstagram(urls, legenda);
    await rpcNoBanco("design_publicacao_registrar", { p: { ...registro, status: "publicada", media_id: media } }, token);
    return responder({ ok: true, media });
  } catch (erro) {
    return responder({ erro: `O Instagram recusou: ${erro instanceof Error ? erro.message : "erro desconhecido"}` }, 502);
  }
}
