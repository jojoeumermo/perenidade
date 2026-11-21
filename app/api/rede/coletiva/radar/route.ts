// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O radar de projetos de lei da Alumia (Prompt 4, item 90): GET /api/rede/coletiva/radar?p=camara:PL:1234:2024 devolve a situação do
// projeto pelos dados abertos da Câmara ou do Senado. Só o servidor fala com eles (lib/externo, lista fechada de destinos), e a
// resposta fica guardada na borda por uma hora (o mesmo projeto, a mesma entrada para todo mundo). A rota não lê quem pede, não
// recebe a lista do que a pessoa segue (ela fica só no aparelho) e não guarda nada. Desligada ("alumia-p4-coletiva"), 404.
import { buscarJson, responder } from "@/lib/externo";
import { idNaCamara, projetoDaChave, situacaoDaCamara, situacaoDoSenado, urlDaBuscaNaCamara, urlDaBuscaNoSenado, urlDoDetalheNaCamara } from "@/lib/rede/coletiva/regras";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";

const nada = (status: number) => new Response("", { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function GET(pedido: Request) {
  if (!rotaNovaLigada("acao-coletiva")) return nada(404);
  const p = projetoDaChave(new URL(pedido.url).searchParams.get("p") ?? "");
  if (!p) return nada(400);
  if (p.casa === "camara") {
    const id = idNaCamara(await buscarJson(urlDaBuscaNaCamara(p), { cabecalhos: { Accept: "application/json" } }));
    if (id === null) return responder({ situacao: null }, 600);
    const s = situacaoDaCamara(p, await buscarJson(urlDoDetalheNaCamara(id), { cabecalhos: { Accept: "application/json" } }));
    return responder({ situacao: s }, s ? 3600 : 300);
  }
  const s = situacaoDoSenado(p, await buscarJson(urlDaBuscaNoSenado(p), { cabecalhos: { Accept: "application/json" } }));
  return responder({ situacao: s }, s ? 3600 : 300);
}
