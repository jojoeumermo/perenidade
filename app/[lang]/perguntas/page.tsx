// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { defaultLocale, htmlLang, localePath } from "@/i18n/config";
import { getQuestions, questionThemes } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/perguntas">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/perguntas", t.questions.title, t.questions.lead);
}

/** "Aula: Mais-valia" vira a etiqueta "Aula" e o nome; link sem tipo ("Guia de fontes") fica só com o nome. */
function partesDoLink(titulo: string): [string | null, string] {
  const achado = /^(Aula|Obra|Ferramenta|Lista de leitura): (.+)$/.exec(titulo);
  return achado ? [achado[1], achado[2]] : [null, titulo];
}

/**
 * A teoria começa pela vida real: as perguntas do dia a dia, em balões de fala, agrupadas por assunto, cada uma com a
 * resposta curta e as etiquetas do que estudar (aula, obra, ferramenta). As âncoras #p1, #p2... seguem a ordem do arquivo,
 * porque a busca do site leva direto a elas.
 */
export default async function Perguntas({ params }: PageProps<"/[lang]/perguntas">) {
  const { lang, t } = await loadLang(params);
  const s = t.questions;
  const temas = s.themes as Record<string, string>;
  const perguntas = getQuestions().map((question, i) => ({ ...question, id: `p${i + 1}` }));
  const grupos = [...questionThemes.map((tema) => ({ tema, itens: perguntas.filter((q) => q.tema === tema) })), { tema: "", itens: perguntas.filter((q) => !q.tema) }].filter((g) => g.itens.length > 0);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <PageHeading eyebrow={s.eyebrow} title={s.title}>
          {s.lead}
        </PageHeading>
        <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
        <nav aria-label={s.jump} className="no-print mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-y-2 border-ink py-3 font-sans text-sm">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">{s.jump}</span>
          {grupos
            .filter((g) => g.tema)
            .map((g) => (
              <a key={g.tema} href={`#assunto-${g.tema}`} className="font-semibold underline decoration-rule underline-offset-4 hover:decoration-[#c21f16]">
                {temas[g.tema]} <span className="font-mono text-xs font-normal text-ink-soft">{g.itens.length}</span>
              </a>
            ))}
        </nav>
      </div>

      <div>
        {grupos.map((g) => (
          <section key={g.tema || "outras"} id={g.tema ? `assunto-${g.tema}` : undefined} aria-labelledby={`titulo-${g.tema || "outras"}`} className="mt-14 scroll-mt-24">
            <h2 id={`titulo-${g.tema || "outras"}`} className="border-b-[3px] border-double border-ink pb-2 font-serif text-[1.9rem] font-semibold leading-tight">
              {g.tema ? temas[g.tema] : s.title}
            </h2>
            <div className="mt-7 grid gap-x-8 gap-y-10 md:grid-cols-2">
              {g.itens.map((question) => (
                <article key={question.id} id={question.id} className="pergunta scroll-mt-24" lang="pt-BR">
                  <h3 className="pergunta-balao">{question.pergunta}</h3>
                  <p className="mt-6 text-lg leading-relaxed">{question.resposta}</p>
                  <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-soft" lang={htmlLang[lang]}>{s.whereToStudy}</p>
                  <ul className="mt-2 flex flex-wrap gap-2 font-sans text-sm">
                    {question.links.map((link) => {
                      const [tipo, nome] = partesDoLink(link.titulo);
                      return (
                        <li key={link.href}>
                          <Link href={localePath(lang, link.href)} className="pergunta-link">
                            {tipo && <span className="pergunta-tipo">{tipo}</span>}
                            {nome}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
