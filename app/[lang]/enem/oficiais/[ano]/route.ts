// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { anosClassificados, camadaDoAno } from "@/lib/enem-camada";
import { ligado } from "@/lib/recursos";

// A camada do instituto sobre uma prova oficial (classificação, resolução comentada e enganos), um arquivo estático por
// ano. A tela das provas e a prática juntam isto às questões de public/questoes/enem-<ano>.json. Nenhum dado de quem
// estuda passa aqui.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => anosClassificados().map(({ ano }) => ({ lang, ano: String(ano) })));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/enem/oficiais/[ano]">) {
  if (!ligado("enem-curso")) return new Response(null, { status: 404 });
  const { lang } = await loadLang(params);
  const ano = Number((await params).ano);
  return Response.json({ ano, questoes: camadaDoAno(ano, lang) }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
