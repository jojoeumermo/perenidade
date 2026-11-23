// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O desafio do dia da Alumia (Prompt 4, item 121): GET /api/rede/desafio devolve os verbetes do glossário do Instituto (os mesmos dos
// jogos de treino do site, lib/jogos/verbetes.ts), só o termo e o resumo. O aparelho sorteia as cinco perguntas com a data como
// semente (todo mundo recebe as mesmas) e guarda a pontuação só nele. Esta rota não lê quem pede e não recebe resultado nenhum.
// Desligada ("alumia-p4-memoria-e-luta"), 404.
import { verbetesParaJogos } from "@/lib/jogos/verbetes";
import { responder } from "@/lib/externo";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";

export function GET() {
  if (!rotaNovaLigada("desafio")) return new Response("", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  const verbetes = verbetesParaJogos().map(({ termo, resumo }) => ({ termo, resumo }));
  return responder({ verbetes }, 3600);
}
