// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nivelamento, type TesteDeNivelamento } from "@/components/estudo/Nivelamento";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getTracks } from "@/lib/content";
import type { ExercicioNovo } from "@/lib/exercicios";
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
      // Uma pergunta por aula, na ordem em que as aulas são estudadas: a marcada para o nivelamento ou, se a aula não
      // tiver, a primeira pergunta do teste da própria aula (que já passou pela revisão). Assim o "Por onde começar?"
      // funciona em toda disciplina com aulas prontas, não só na matemática.
      const questoes = track.lessons.flatMap((l) => {
        const marcada = porAula.get(l.slug)?.[0];
        if (marcada) return [{ aula: `${track.slug}/${l.slug}`, ex: marcada }];
        const q = l.quiz[0];
        if (!q || q.options.length < 2) return [];
        const ex: ExercicioNovo = {
          tipo: "escolha",
          id: `quiz-${track.slug}-${l.slug}-0`,
          tema: l.title,
          dificuldade: 1,
          enunciado: q.question,
          explicacao: q.explanation ?? "",
          fonte: "Teste da aula",
          nivelamento: true,
          revisao: { status: "em-revisao" },
          autoria: l.authors.join(", "),
          alternativas: q.options.map((texto, i) => ({ texto, certa: i === q.answer })),
        };
        return [{ aula: `${track.slug}/${l.slug}`, ex }];
      });
      return { trilha: track.slug, titulo: track.title, roteiro: track.lessons.map((l) => ({ id: `${track.slug}/${l.slug}`, titulo: l.title })), questoes };
    })
    .filter((teste) => teste.questoes.length >= 3);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.nivelamento.olho} title={s.nivelamento.titulo}>
        {s.nivelamento.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      {/* O teste dos 12 eixos políticos mora ao lado (app/[lang]/nivelamento/eixos). */}
      <Link href={localePath(lang, "/nivelamento/eixos")} className="mt-8 block border-2 border-ink bg-ink p-5 text-parchment shadow-[5px_5px_0_var(--sombra)] transition-transform hover:-translate-y-0.5">
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-[#f0b323]">{t.eixos.card} →</span>
        <span className="mt-1.5 block font-serif text-xl leading-snug">{t.eixos.cardText}</span>
      </Link>
      <Nivelamento testes={testes} s={s.nivelamento} />
    </div>
  );
}
