// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 49: GET /api/rede/fediverso-tema?tag=<tema>, com a sessão no cabeçalho Authorization. As notas públicas do #tema nos
// servidores do Fediverso que a coordenação aprovou, buscadas por ESTE servidor (com cache de 10 minutos), nunca pelo aparelho de
// quem lê. O servidor de fora não sabe quem pediu. Sem a flag, sem a sessão ou com o lote desligado no banco: 404. Nada de quem pede
// é guardado; o freio conta só na memória, pela conta.
import { ligado } from "@/lib/recursos";
import { temaOk } from "@/lib/rede/descoberta-estudo/fediverso-tema";
import { notasDoTema } from "@/lib/rede/descoberta-estudo/servidor";
import { contaDoToken, criarFreio, deOutraOrigem, resposta } from "@/lib/rede/convites/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freio = criarFreio(60, 60 * 60_000);

export async function GET(pedido: Request) {
  if (!ligado("alumia-p4-descoberta-estudo") || deOutraOrigem(pedido)) return resposta({ erro: "nao_encontrado" }, 404);
  const tema = temaOk(new URL(pedido.url).searchParams.get("tag"));
  if (!tema) return resposta({ erro: "invalido:tag" }, 400);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ erro: "sem_conexao" }, 503);
  if (!conta) return resposta({ erro: "nao_encontrado" }, 404);
  if (!freio(conta.id)) return resposta({ erro: "muitos_pedidos" }, 429);
  const notas = await notasDoTema(tema);
  if (!notas) return resposta({ erro: "nao_encontrado" }, 404);
  return resposta({ tema, notas });
}
