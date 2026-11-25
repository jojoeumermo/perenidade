// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound } from "next/navigation";
import { CartaoDaTrilha, ContinuarEstudo, type AulaDaJornada } from "@/components/app/jornada";
import { textosDoAppNovo } from "@/components/app/textos-app";
import { loadLang } from "@/i18n";
import { getTracks } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import { areaNaEscola } from "@/lib/escola/aulas-abertas";

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

/** A tela de uma disciplina no aplicativo: o botão de continuar e as trilhas dela, cada uma com seu progresso. */
export default async function DisciplinaDoApp({ params }: PageProps<"/[lang]/app/estudar/[area]">) {
  const { lang, t } = await loadLang(params);
  const { area } = await params;
  const s = textosDoAppNovo(lang);
  const nome = (t.areas as Record<string, string[]>)[area];
  if (!nome || areaNaEscola(area as never)) notFound();
  const trilhas = getTracks(lang).filter((tr) => tr.area === area);
  const aulas: AulaDaJornada[] = trilhas.flatMap((tr) =>
    tr.plan.map((item) => ({ id: lessonId(tr.slug, item.slug), href: `/app/estudar/${area}/${tr.slug}/${item.slug}`, title: item.title, ready: item.ready !== false })),
  );
  return (
    <div className="app-hub">
      <header className="app-hub-cabeca">
        <h1>{nome[0]}</h1>
        <p>{nome[1]}</p>
      </header>
      <ContinuarEstudo aulas={aulas} />
      <section className="app-secao" aria-label={s.trilhas}>
        <h2 className="app-titulo-secao">{s.trilhas}</h2>
        {trilhas.length === 0 ? (
          <p className="app-vazio">{s.semAulasAinda}</p>
        ) : (
          <ul className="app-lista">
            {trilhas.map((tr) => (
              <li key={tr.slug}>
                <CartaoDaTrilha href={`/app/estudar/${area}/${tr.slug}`} title={tr.title} resumo={tr.summary} aulas={tr.plan.filter((i) => i.ready !== false).map((i) => lessonId(tr.slug, i.slug))} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
