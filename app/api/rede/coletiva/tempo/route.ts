// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A previsão do tempo do ato (Prompt 4, item 97): GET /api/rede/coletiva/tempo?cidade=Recife&dia=2026-11-28 devolve a previsão do dia
// na cidade, pelo Open-Meteo (serviço aberto, sem chave), buscada SÓ pelo servidor (lib/externo, lista fechada de destinos) e
// guardada na borda por uma hora: a cidade e o dia são públicos (os do chamado), e nada de quem pede é lido ou guardado. A busca é
// pela cidade, nunca pela posição de ninguém. Desligada ("alumia-p4-coletiva"), 404.
import { buscarJson, canonica, responder, termo } from "@/lib/externo";
import { diaPrevisivel, lerCidade, lerPrevisao, urlDaCidade, urlDaPrevisao } from "@/lib/rede/coletiva/regras";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";

const nada = (status: number) => new Response("", { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function GET(pedido: Request) {
  if (!rotaNovaLigada("acao-coletiva")) return nada(404);
  const busca = new URL(pedido.url).searchParams;
  const cidade = termo(busca.get("cidade"), 2, 80);
  // "Recife", "recife" e "recife " são uma entrada só na borda.
  const volta = canonica(pedido, "cidade", cidade);
  if (volta) return volta;
  const dia = busca.get("dia") ?? "";
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (!cidade || !diaPrevisivel(dia, hoje)) return responder({ previsao: null, motivo: "fora" }, 600);
  const lugar = lerCidade(await buscarJson(urlDaCidade(cidade)));
  if (!lugar) return responder({ previsao: null, motivo: "cidade" }, 3600);
  const previsao = lerPrevisao(await buscarJson(urlDaPrevisao(lugar.lat, lugar.lon, dia)), dia);
  return responder({ previsao, cidade: lugar.nome, fonte: "https://open-meteo.com/" }, previsao ? 3600 : 300);
}
