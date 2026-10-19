// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type ExercicioComOrigem, Praticar } from "@/components/estudo/Praticar";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { getTracks } from "@/lib/content";
import { todosOsExercicios } from "@/lib/exercicios-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/meu-estudo/praticar">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return { ...paginaMeta(lang, "/meu-estudo/praticar", s.praticar.titulo, s.praticar.lead), robots: { index: false, follow: true } };
}

/** Praticar (recurso "exercicios"): todos os exercícios com explicação, com filtros e a revisão dos erros. */
export default async function Page({ params }: PageProps<"/[lang]/meu-estudo/praticar">) {
  if (!ligado("exercicios")) notFound();
  const { lang, t } = await loadLang(params);
  const { s, traduzido } = textosDoEstudo(lang);
  const trilhas = new Map(getTracks(lang).map((track) => [track.slug, track]));
  // Na ordem das trilhas e do roteiro de cada uma: é a ordem em que as aulas são estudadas.
  const ordem = (x: ExercicioComOrigem) => trilhas.get(x.trilha)?.lessons.findIndex((l) => `${x.trilha}/${l.slug}` === x.aula) ?? -1;
  const todos: ExercicioComOrigem[] = todosOsExercicios()
    .flatMap((grupo) => {
      const trilha = trilhas.get(grupo.trilha);
      const aula = trilha?.lessons.find((l) => l.slug === grupo.aula);
      if (!trilha || !aula) return [];
      return grupo.exercicios.map((ex) => ({ ex, aula: `${grupo.trilha}/${grupo.aula}`, tituloDaAula: aula.title, trilha: grupo.trilha, tituloDaTrilha: trilha.title }));
    })
    .sort((a, b) => a.trilha.localeCompare(b.trilha) || ordem(a) - ordem(b));
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.meuEstudo.titulo} title={s.praticar.titulo}>
        {s.praticar.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <Praticar todos={todos} s={s.praticar} sEx={s.exercicios} />
    </div>
  );
}
