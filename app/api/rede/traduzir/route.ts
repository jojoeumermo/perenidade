// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Traduzir um post (frente 13E, atrás de "alumia-traducao"). Só quando a pessoa toca em "Traduzir":
//   1. COMO a pessoa (alumia_pontes_traduzir_texto): o banco só entrega o texto de um post que ela já pode ver, com o recurso
//      ligado no painel e no máximo 60 por hora;
//   2. o servidor do site manda o texto ao NOSSO servidor de tradução (ALUMIA_TRADUCAO_URL, lib/rede/pontes/traducao.ts);
//   3. devolve a tradução. Nada é guardado nem escrito em log.
// GET diz só se a tradução existe nesta montagem (para o botão aparecer ou não). Sem o recurso ou sem o endereço, 404.
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";
import { traducaoLigada } from "@/lib/rede/pontes/ligado";
import { configDaTraducao, idiomaDestino, traduzir } from "@/lib/rede/pontes/traducao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function GET() {
  return resposta({ disponivel: traducaoLigada() && configDaTraducao() !== null });
}

export async function POST(pedido: Request) {
  const config = configDaTraducao();
  if (!traducaoLigada() || !config) return resposta({ erro: "nao_encontrado" }, 404);
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const cru = await lerCorpoLimitado(pedido, 512);
  if (!cru) return resposta({ erro: "grande" }, 413);
  let post = "";
  let destino: string | null = null;
  try {
    const json = JSON.parse(new TextDecoder().decode(cru)) as { post?: unknown; lang?: unknown };
    post = typeof json.post === "string" ? json.post : "";
    destino = idiomaDestino(json.lang);
  } catch {
    return resposta({ erro: "invalido:pedido" }, 400);
  }
  if (!UUID.test(post) || !destino) return resposta({ erro: "invalido:pedido" }, 400);

  const original = await chamarComoPessoa<{ titulo: string | null; texto: string }>(token, "alumia_pontes_traduzir_texto", { p_post: post });
  if (!original.ok) return resposta({ erro: original.codigo }, statusDoCodigo(original.codigo));

  const texto = await traduzir(original.dado.texto ?? "", destino, config);
  if (!texto.ok) return resposta({ erro: texto.erro }, texto.erro === "invalido" ? 400 : 502);
  let titulo: string | null = null;
  if (original.dado.titulo?.trim()) {
    const t = await traduzir(original.dado.titulo, destino, config);
    titulo = t.ok ? t.texto : null;
  }
  return resposta({ titulo, texto: texto.texto, origem: texto.origem, destino });
}
