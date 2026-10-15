// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Busca nas checagens publicadas por agências (Lupa, Aos Fatos e outras) pelo Google Fact Check Tools.
// Precisa da chave gratuita na variável GOOGLE_FACTCHECK_KEY do servidor (Vercel → Settings → Environment
// Variables). Sem ela, responde { ativo: false } e a página esconde a busca. A chave nunca vai para o navegador.
import { buscarJson, responder, termo } from "@/lib/externo";

interface Resposta {
  claims?: {
    text?: string;
    claimant?: string;
    claimDate?: string;
    claimReview?: { publisher?: { name?: string; site?: string }; url?: string; title?: string; reviewDate?: string; textualRating?: string; languageCode?: string }[];
  }[];
}

export async function GET(pedido: Request) {
  const chave = process.env.GOOGLE_FACTCHECK_KEY ?? "";
  if (!chave) return responder({ ativo: false, checagens: [] }, 300);
  const busca = termo(new URL(pedido.url).searchParams.get("q"), 3, 100);
  if (!busca) return responder({ ativo: true, checagens: [] }, 3600);
  const dados = await buscarJson<Resposta>(
    `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(busca)}&languageCode=pt-BR&pageSize=10&key=${encodeURIComponent(chave)}`,
    { guardar: 21600 },
  );
  if (dados === null) return responder({ ativo: true, checagens: [], erro: "indisponivel" }, 0);
  const checagens = (dados.claims ?? [])
    .map((alegacao) => ({
      alegacao: (alegacao.text ?? "").slice(0, 500),
      autor: (alegacao.claimant ?? "").slice(0, 120),
      data: alegacao.claimDate ?? "",
      avaliacoes: (alegacao.claimReview ?? [])
        .filter((item) => item.url?.startsWith("https://") || item.url?.startsWith("http://"))
        .slice(0, 4)
        .map((item) => ({ agencia: (item.publisher?.name ?? item.publisher?.site ?? "").slice(0, 80), veredito: (item.textualRating ?? "").slice(0, 120), titulo: (item.title ?? "").slice(0, 300), link: item.url!, data: item.reviewDate ?? "" })),
    }))
    .filter((alegacao) => alegacao.alegacao && alegacao.avaliacoes.length > 0);
  return responder({ ativo: true, checagens }, 21600);
}
