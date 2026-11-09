// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Responder a um post de FORA. Só no modo "fediverso-total" (desligado por padrão: 404). A resposta vira um post daqui (público, do
// perfil da pessoa) com resposta_a_remota = o post de fora; a função do banco (rede_fed_responder_remoto, contrato 3.2) roda COMO a
// pessoa (as regras de publicar, o teto e o bloqueio valem sem exceção) e põe o Create na fila para a instância do post e para os
// seguidores. Só-seguidores e mensagem direta NUNCA saem por aqui: a resposta é sempre um post público da pessoa.
import { after } from "next/server";
import { processarFila } from "@/lib/rede/fediverso/entrega";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { modoTotal, semFederacao } from "@/lib/rede/fediverso/servidor";
import { chamarComoPessoa, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });

export async function POST(pedido: Request) {
  if (!modoTotal()) return semFederacao();
  const barrado = conferirTeto(pedido, "responder", 30);
  if (barrado) return barrado;
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { post?: unknown; texto?: unknown; aviso?: unknown } | null;
  const post = typeof corpo?.post === "string" && /^https:\/\/[^\s<>"']{1,490}$/.test(corpo.post) ? corpo.post : null;
  if (!post) return resposta({ erro: "invalido:post" }, 400);
  const texto = typeof corpo?.texto === "string" ? corpo.texto.trim() : "";
  if (!texto || texto.length > 5000) return resposta({ erro: "invalido:texto" }, 400);
  const aviso = typeof corpo?.aviso === "string" ? corpo.aviso.trim().slice(0, 200) : "";
  const r = await chamarComoPessoa<{ id?: string }>(token, "rede_fed_responder_remoto", { p_post_remoto: post, p_texto: texto, p_aviso: aviso });
  if (!r.ok) return resposta({ erro: r.codigo }, statusDoCodigo(r.codigo));
  after(() => processarFila(10).then(() => undefined, () => undefined));
  return resposta({ ok: true, id: r.dado?.id ?? null });
}
