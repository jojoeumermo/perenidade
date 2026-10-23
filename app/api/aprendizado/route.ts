// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import pt from "@/i18n/pt.json";
import { getTracks } from "@/lib/content";

// O mapa das disciplinas para o aprendizado interno do painel: cada trilha com o roteiro (aulas prontas e as que
// ainda faltam escrever), sem o texto das aulas. Gerado na publicação.
export const dynamic = "force-static";

export function GET() {
  const nomes = pt.areas as Record<string, string[]>;
  const etapas = pt.stages as Record<string, string>;
  const porArea = new Map<string, { area: string; nome: string; trilhas: { slug: string; titulo: string; etapa: string; aulas: { slug: string; titulo: string; pronta: boolean }[] }[] }>();
  for (const track of getTracks("pt")) {
    const item = porArea.get(track.area) ?? { area: track.area, nome: nomes[track.area]?.[0] ?? track.area, trilhas: [] };
    item.trilhas.push({ slug: track.slug, titulo: track.title, etapa: etapas[track.stage] ?? track.stage, aulas: track.plan.map((p) => ({ slug: p.slug, titulo: p.title, pronta: p.ready })) });
    porArea.set(track.area, item);
  }
  const disciplinas = [...porArea.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  return Response.json({ disciplinas });
}
