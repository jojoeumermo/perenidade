// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { entradasDaBusca } from "@/lib/indice-de-busca";

// O índice da busca do alto: os mesmos itens do /indice.json, mas só com o começo do texto (o resumo vem primeiro),
// para os resultados aparecerem logo no primeiro toque. A busca completa, no texto inteiro, continua em /busca.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const corta = (texto: string, limite: number) => (texto.length > limite ? `${texto.slice(0, texto.lastIndexOf(" ", limite) > 0 ? texto.lastIndexOf(" ", limite) : limite)}…` : texto);

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/indice-leve.json">) {
  const { lang, t } = await loadLang(params);
  return Response.json(entradasDaBusca(lang, t).map((entrada) => ({ ...entrada, text: corta(entrada.text.replace(/\s+/g, " ").trim(), 220) })));
}
