// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// POST /api/rede/stories/conferir  {"id": "<uuid do story>"}, com a sessão no Authorization. Confere a mídia do story logo depois
// de publicar (P5, A16; lib/rede/stories/conferir-servidor.ts): tira o metadado que tiver sobrado e libera o arquivo para quem vê.
// Só a autora pede, só o story dela. Nenhum endereço de rede é lido ou guardado, nada vai para log.
import { conferirLigado, conferirStory, formasDeVerdade } from "@/lib/rede/stories/conferir-servidor";
import { tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function POST(pedido: Request) {
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  if (!conferirLigado()) return resposta({ erro: "sem_servico" }, 503);
  const corpo = (await pedido.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof corpo?.id === "string" && /^[0-9a-f-]{36}$/.test(corpo.id) ? corpo.id : null;
  if (!id) return resposta({ erro: "invalido:id" }, 400);
  const r = await conferirStory(token, id, formasDeVerdade);
  if (typeof r === "object") return resposta({ erro: r.erro }, r.status >= 400 && r.status < 600 ? r.status : 400);
  return resposta({ resultado: r }, r === "falhou" ? 502 : 200);
}
