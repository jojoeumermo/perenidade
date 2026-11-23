// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A notícia do dia para o topo do Explorar da Alumia (Prompt 5, A19): a manchete mais recente do giro de notícias do site
// (lib/news.ts, os veículos de content/noticias.json). Só o título, o veículo, a data e o link para a fonte: nada de imagem nem
// de texto da matéria (direito autoral; decisão da coordenação). O navegador fala só com o site: quem lê os veículos é o
// servidor, de 15 em 15 minutos. Sem conta, sem cookie e sem registro de quem pediu.
import { escolherNoticiaDoDia, getNews, NEWS_REFRESH } from "@/lib/news";
import { responder } from "@/lib/externo";

export async function GET() {
  const { latest } = await getNews();
  return responder({ noticia: escolherNoticiaDoDia(latest) }, NEWS_REFRESH);
}
