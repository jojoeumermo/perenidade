// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { fichasDoAcervo, lacunas, saudeDoAcervo } from "@/lib/lacunas";

// O resultado do verificador do acervo, refeito a cada publicação: as lacunas que viram tarefas no painel e os números da
// saúde do acervo. A rotina de publicação lê este arquivo e o leva ao banco. Só português (a língua do painel).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ lang: defaultLocale }];
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/lacunas.json">) {
  await loadLang(params);
  const todas = lacunas();
  return Response.json({ gerado_em: new Date().toISOString(), saude: saudeDoAcervo(fichasDoAcervo(), todas), lacunas: todas });
}
