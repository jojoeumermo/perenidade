// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nivelamento, type TesteDeNivelamento } from "@/components/estudo/Nivelamento";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { getTracks } from "@/lib/content";
import { exerciciosDaTrilha } from "@/lib/exercicios-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/nivelamento">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/nivelamento", s.nivelamento.titulo, s.nivelamento.descricao);
}

/**
 * Nivelamento (recurso "nivelamento"): para cada trilha que tem perguntas marcadas para isso, poucas perguntas, uma por
 * aula, na ordem do roteiro. Só sugere por onde começar. Desligado, a página não existe.
 */
export default async function Page({ params }: PageProps<"/[lang]/nivelamento">) {
  if (!ligado("nivelamento")) notFound();
  const { lang, t } = await loadLang(params);
  const { s, traduzido } = textosDoEstudo(lang);
  const testes: TesteDeNivelamento[] = getTracks(lang)
    .map((track) => {
      const porAula = new Map(exerciciosDaTrilha(track.slug).map((g) => [g.aula, g.exercicios.filter((ex) => ex.nivelamento)]));
      // Uma pergunta por aula (a primeira marcada), na ordem em que as aulas são estudadas.
      const questoes = track.lessons.flatMap((l) => (porAula.get(l.slug)?.[0] ? [{ aula: `${track.slug}/${l.slug}`, ex: porAula.get(l.slug)![0] }] : []));
      return { trilha: track.slug, titulo: track.title, roteiro: track.lessons.map((l) => ({ id: `${track.slug}/${l.slug}`, titulo: l.title })), questoes };
    })
    .filter((teste) => teste.questoes.length > 0);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.nivelamento.olho} title={s.nivelamento.titulo}>
        {s.nivelamento.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <Nivelamento testes={testes} s={s.nivelamento} />
    </div>
  );
}
