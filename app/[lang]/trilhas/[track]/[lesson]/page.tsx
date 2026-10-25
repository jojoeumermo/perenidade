// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import GithubSlugger from "github-slugger";
import type { Metadata } from "next";
import { ExerciciosDaAula } from "@/components/ExerciciosDaAula";
import Link from "@/components/Link";
import { DadosEstruturados } from "@/components/DadosEstruturados";
import { migalhas, recursoDeAula } from "@/lib/dados-estruturados";
import { notFound } from "next/navigation";
import { AntesDaAula } from "@/components/AntesDaAula";
import { BarraDaAula } from "@/components/aula/BarraDaAula";
import { MargemDaAula } from "@/components/aula/MargemDaAula";
import { areaLabs, areaTools, universalTools } from "@/lib/areas";
import { CaixaDaAula } from "@/components/CaixaDaAula";
import { CartaoDoEducador, EducadoresDaDisciplina } from "@/components/Educadores";
import { PhetLista } from "@/components/labs/Phet";
import sims from "@/content/phet.json";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { PraticaSobDemanda as Pratica } from "@/components/estudo/PraticaSobDemanda";
import { CiteButton, CompleteButton, LessonList, RememberLesson } from "@/components/Progress";
import { Quiz } from "@/components/Quiz";
import { ReadingChrome } from "@/components/ReadingChrome";
import { StudyTools } from "@/components/StudyTools";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, fill, htmlLang, localePath, plural } from "@/i18n/config";
import { getGlossary, getTrack, getTracks, requisitosDaAula, tambemEmOutras, idiomasDe } from "@/lib/content";
import { fileHistory } from "@/lib/history";
import { lessonId } from "@/lib/ids";
import { withLangs } from "@/lib/params";
import { linguaDe } from "@/lib/pratica";
import { ogDe, paginaMeta } from "@/lib/seo";
import { Compartilhar } from "@/components/Compartilhar";
import { aulaEmUmMinuto } from "@/lib/compartilhar";
import { site } from "@/lib/site";
import { ExerciciosComExplicacaoSobDemanda as ExerciciosComExplicacao, IssoAjudouSobDemanda as IssoAjudou, RegistroDeConclusaoSobDemanda as RegistroDeConclusao } from "@/components/estudo/NaAula";
import { exerciciosDaAula } from "@/lib/exercicios-conteudo";
import { ligado } from "@/lib/recursos";
import { textosDoEstudo } from "@/lib/textos-estudo";
import { creditosDeRevisao, EtiquetaDeRevisao } from "@/components/estudo/EtiquetaDeRevisao";
import { revisoesDaAula } from "@/lib/revisoes-conteudo";
import { HabilidadesDaAula } from "@/components/estudo/Habilidades";
import { mapaDaAula } from "@/lib/curriculo-conteudo";

type Props = PageProps<"/[lang]/trilhas/[track]/[lesson]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(
    getTracks(defaultLocale).flatMap((track) => track.lessons.map((lesson) => ({ track: track.slug, lesson: lesson.slug }))),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug, lang);
  const lesson = track?.lessons.find((l) => l.slug === lessonSlug);
  return track && lesson ? paginaMeta(lang, `/trilhas/${track.slug}/${lesson.slug}`, `${lesson.title} · ${track.title}`, lesson.summary, { titulo: lesson.title, subtitulo: `${track.title} · ${t.areas[track.area][0]}`, kicker: t.nav.disciplines }, { idiomas: idiomasDe(lesson.file) }) : {};
}

/** Subtítulos (##) da aula, com as mesmas âncoras que o texto recebe. */
function sections(body: string): { id: string; title: string }[] {
  const slugger = new GithubSlugger();
  return body
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .flatMap((line) => {
      const match = /^(#{2,3}) (.+)$/.exec(line);
      if (!match) return [];
      const title = match[2].replace(/[*_`]/g, "").trim();
      const id = slugger.slug(title);
      return match[1] === "##" ? [{ id, title }] : [];
    });
}

export default async function LessonPage({ params }: Props) {
  const { lang, t } = await loadLang(params);
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug, lang);
  const index = track?.lessons.findIndex((l) => l.slug === lessonSlug) ?? -1;
  if (!track || index < 0) notFound();

  const to = (path: string) => localePath(lang, path);
  const path = (slug: string) => `/trilhas/${track.slug}/${slug}`;
  const lesson = track.lessons[index];
  const prev = track.lessons[index - 1];
  const next = track.lessons[index + 1];
  const id = lessonId(track.slug, lesson.slug);
  const history = fileHistory(lesson.file);
  const toc = sections(lesson.body);
  const updated = history.updated && new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC" }).format(new Date(history.updated));
  // O glossário só é ligado ao texto quando os dois estão no mesmo idioma.
  const terms = lesson.translated ? getGlossary(lang).filter((term) => term.translated).map(({ slug, term, summary }) => ({ slug, term, summary })) : [];
  // No aplicativo, "anterior" e "próxima" viram dois botões largos, a próxima em cima: é o que o polegar mais aperta.
  const vizinha = "app:max-md:rounded-[0.875rem] app:max-md:border app:max-md:border-rule app:max-md:bg-parchment-deep app:max-md:px-4 app:max-md:py-3.5 app:max-md:text-base";
  const fix = `${to("/contribuir")}?corrigir=${encodeURIComponent(path(lesson.slug))}`;
  // Recursos novos (lib/recursos.ts): desligados, nada disto aparece e a aula fica como era.
  const estudo = textosDoEstudo(lang).s;
  const exercicios = ligado("exercicios") ? exerciciosDaAula(track.slug, lesson.slug) : [];
  const revisoes = ligado("revisoes") ? revisoesDaAula(lesson.file) : [];
  const habilidades = ligado("mapa-curricular") ? mapaDaAula(track.slug, lesson.slug) : null;
  // O que é bom ter visto antes e as aulas parecidas em outras disciplinas ("também em Química").
  const requisitos = requisitosDaAula(lang, track, lesson.slug);
  const outras = tambemEmOutras(lang, track, lesson.slug);
  // A palavra do glossário da margem: a primeira que a própria aula define ou, senão, a primeira do glossário que aparece no texto.
  const corpo = lesson.body.toLowerCase();
  const termo =
    (lesson.terms[0] && { slug: getGlossary(lang).find((g) => g.term.toLowerCase() === lesson.terms[0].term.toLowerCase())?.slug ?? "", term: lesson.terms[0].term, summary: lesson.terms[0].summary }) ||
    terms.find((g) => new RegExp(`(?<![\\p{L}])${g.term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(corpo));
  // O cartão preto do laboratório: o da disciplina ou, sem laboratório, a primeira ferramenta da caixa.
  const labDaArea = (areaLabs[track.area] ?? [])[0];
  const ferramenta = [...lesson.tools, ...((areaTools[track.area] ?? []) as string[]), ...universalTools][0];
  const laboratorio = labDaArea
    ? { id: `lab:${labDaArea}`, nome: (t.labs as unknown as Record<string, string>)[labDaArea] ?? labDaArea }
    : ferramenta
      ? { id: ferramenta, nome: (t.toolNames as Record<string, string[]>)[ferramenta]?.[0] ?? ferramenta }
      : undefined;

  return (
    <div className="pagina-da-aula pont">
      {/* A faixa preta da aula: a trilha, a posição, quanto já foi lido e os botões de ouvir, anotar, alargar e focar. */}
      <BarraDaAula voltar={to(`/trilhas/${track.slug}`)} trilha={track.title} posicao={fill(t.lesson.position, { i: index + 1, n: track.lessons.length })} minutos={fill(t.tracks.minutes, { n: lesson.minutes })} aula={id} ferramentas={t.tools.box.open} />
    <div className="grade-da-aula mx-auto grid max-w-[86rem] gap-10 px-4 py-12 app:max-md:gap-8 app:max-md:px-5 app:max-md:pt-4! sm:px-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:px-8 xl:grid-cols-[14rem_minmax(0,1fr)_15rem]">
      <DadosEstruturados dados={[recursoDeAula(lang, track, lesson), migalhas(lang, [[t.nav.disciplines, "/trilhas"], [track.title, `/trilhas/${track.slug}`], [lesson.title, `/trilhas/${track.slug}/${lesson.slug}`]])]} />
      <ReadingChrome />
      <RememberLesson path={path(lesson.slug)} title={lesson.title} track={track.title} />
      {(ligado("meu-estudo") || ligado("metas")) && <RegistroDeConclusao />}

      {/* No aplicativo o texto vem primeiro, como em um leitor de livros; a lista das aulas da disciplina fica depois dele. */}
      <aside className="indice-da-trilha no-print no-focus font-sans text-sm app:max-md:order-2 app:max-md:border-t app:max-md:border-rule app:max-md:pt-6 md:sticky md:top-6 md:self-start">
        <Link href={to(`/estantes/${track.area}`)} className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft hover:text-prelo-texto">← {t.areas[track.area][0]}</Link>
        <h2 className="mt-3 font-serif text-xl font-semibold" {...originalLang(track.translated)}>
          <Link href={to(`/trilhas/${track.slug}`)} className="hover:text-oxblood">{track.title}</Link>
        </h2>
        <div className="mt-4" {...originalLang(track.translated)}>
          <LessonList
            currentId={id}
            lessons={track.plan.map((item) => ({ id: lessonId(track.slug, item.slug), path: path(item.slug), title: item.title, ready: item.ready }))}
          />
        </div>
        {toc.length > 1 && (
          <nav aria-label={t.lesson.inThisLesson} className="mt-8 hidden md:block" {...originalLang(lesson.translated)}>
            <p className="rotulo">{t.lesson.inThisLesson}</p>
            <ul className="mt-3 space-y-2 text-ink-soft">
              {toc.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="block border-l-4 border-transparent pl-2.5 hover:border-[#c21f16] hover:text-ink">{section.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </aside>

      <article className="folha-da-aula min-w-0 justify-self-center">
        <p className="rotulo">
          {t.areas[track.area][0]} · {t.stages[track.stage]} · {fill(t.lesson.position, { i: index + 1, n: track.lessons.length })}
        </p>
        <div {...originalLang(lesson.translated)}>
          <h1 className="mt-2.5 text-[2.5rem] font-semibold leading-[1.05] text-balance app:max-md:text-[2rem] app:max-md:leading-[1.15] sm:text-[3.4rem]">{lesson.title}</h1>
          <p className="mt-3 text-[1.4rem] italic leading-snug text-ink-soft app:max-md:text-lg">{lesson.summary}</p>
        </div>

        <Untranslated lang={lang} t={t} show={!lesson.translated} />
        <AntesDaAula aula={id} requisitos={requisitos} />
        {ligado("revisoes") && <EtiquetaDeRevisao revisoes={revisoes} aprovada={lesson.reviewed} lang={lang} s={estudo.revisao} corrigir={fix} como={ligado("guia-contribuir") ? to("/contribuir/guia#revisar") : undefined} />}
        {!ligado("revisoes") && !lesson.reviewed && (
          <p className="no-print mt-6 border-l-2 border-gold pl-4 font-sans text-sm text-ink-soft">
            {t.lesson.awaitingReview} <Link href={fix} className="underline hover:text-oxblood">{t.lesson.suggestOne}</Link>.
          </p>
        )}

        <div {...originalLang(lesson.translated)}>
          <div id="texto-da-aula" className="mt-8">
            <Markdown lang={lang} terms={terms} tryCode={t.lesson.tryCode} sala={track.area}>{lesson.body}</Markdown>
          </div>
          {lesson.quiz.length > 0 && <Quiz key={id} questions={lesson.quiz} registro={id} guardarNoAparelho={ligado("meu-estudo")} />}
          {exercicios.length > 0 && <ExerciciosComExplicacao exercicios={exercicios} aula={id} s={estudo.exercicios} corrigir={`/contribuir?corrigir=${encodeURIComponent(path(lesson.slug))}`} praticar="/meu-estudo/praticar" />}
          {lesson.practice.length > 0 && <Pratica key={`pratica-${id}`} id={id} exercicios={lesson.practice} lingua={linguaDe(track.area)} s={t.practice} semPlacar={ligado("pratica-sem-placar")} lead={ligado("pratica-sem-placar") ? estudo.praticaSemPlacar.lead : undefined} />}
          <SourceList sources={lesson.sources} title={t.lesson.sources} />
          {outras.length > 0 && (
            <aside aria-label={t.lesson.alsoInTitle} className="no-print mt-10 border-t-4 border-[#c21f16] bg-parchment-deep p-4 font-sans text-sm">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-oxblood">{t.lesson.alsoInTitle}</p>
              <ul className="mt-2 space-y-2">
                {outras.map((o) => (
                  <li key={o.id}>
                    <span className="mr-2 inline-block border border-ink/40 px-1.5 font-mono text-[0.65rem] uppercase tracking-wider">{t.areas[o.area][0]}</span>
                    <Link href={to(o.path)} className="font-semibold underline hover:text-oxblood">{o.title}</Link>
                    <span className="text-ink-soft"> · {o.track}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
          {habilidades && <HabilidadesDaAula mapa={habilidades} s={estudo.mapa} />}
        </div>

        <CompleteButton id={id} next={next && { path: path(next.slug), title: next.title }} />
        {ligado("ajudou") && <IssoAjudou aula={id} s={estudo.ajudou} sugerir={`/contribuir?corrigir=${encodeURIComponent(path(lesson.slug))}`} />}
        <Compartilhar
          url={`${site.url}${to(path(lesson.slug))}`}
          texto={`${t.compartilhar.aula} ${lesson.title}`}
          imagem={ogDe(lang, lesson.title, `${track.title} · ${t.areas[track.area][0]}`, t.nav.disciplines)[0].url}
          mensagem={aulaEmUmMinuto({ titulo: lesson.title, trilha: `${track.title} · ${t.areas[track.area][0]}`, resumo: lesson.summary, termos: lesson.terms, pergunta: lesson.quiz[0]?.question, url: `${site.url}${to(path(lesson.slug))}`, s: t.compartilhar })}
          s={t.compartilhar}
        />

        <nav aria-label={t.lesson.neighbors} className="no-print mt-12 flex justify-between gap-6 border-t border-rule pt-6 font-sans text-sm app:max-md:flex-col app:max-md:gap-3">
          {prev ? <Link href={to(path(prev.slug))} data-prev className={`hover:text-oxblood ${vizinha}`}>← {prev.title}</Link> : <span />}
          {next ? <Link href={to(path(next.slug))} data-next className={`text-right hover:text-oxblood app:max-md:order-first ${vizinha}`}>{next.title} →</Link> : <span />}
        </nav>

        <StudyTools id={id} path={path(lesson.slug)} s={t.study} titulo={lesson.title} sala={track.area} />

        <ExerciciosDaAula aula={path(lesson.slug)} s={t.practiceStudio.exercises} />

        {sims.some((sim) => sim.areas.includes(track.area)) && (
          <section className="no-print mt-10">
            <h2 className="font-serif text-2xl font-semibold">{t.labs.simulacoes}</h2>
            <PhetLista area={track.area} compacto />
          </section>
        )}
        <div className="xl:hidden">
          <EducadoresDaDisciplina area={track.area} lang={lang} nomes={t.areas as Record<string, string[]>} />
        </div>

        <footer className="mt-8 space-y-2 font-mono text-xs text-ink-soft">
          <p>
            {lesson.authors.length > 0 && <>{fill(t.lesson.by, { names: lesson.authors.join(", ") })} · </>}
            {revisoes.length > 0 && <>{creditosDeRevisao(revisoes, estudo.revisao)} · </>}
            {updated
              ? `${fill(t.lesson.lastChange, { date: updated })} · ${plural(lang, history.revisions, t.lesson.saved)}`
              : t.lesson.noHistory}{" "}
            · {t.lesson.license}
          </p>
          <p className="no-print flex flex-wrap gap-x-5 gap-y-1">
            <Link href={fix} className="underline hover:text-oxblood">{t.common.suggestFix}</Link>
            <Link href={`${to("/comunidade")}?nova=1&alvo=${encodeURIComponent(path(lesson.slug))}&titulo=${encodeURIComponent(lesson.title)}&sala=${track.area}`} className="underline hover:text-oxblood">{t.common.askCommunity}</Link>{" · "}
            <Link href={`${to("/caderno")}?abrir=${encodeURIComponent(path(lesson.slug))}&titulo=${encodeURIComponent(lesson.title)}`} className="underline hover:text-oxblood">{t.lesson.studyInNotebook}</Link>
            <a href={to(`${path(lesson.slug)}/texto`)} className="underline hover:text-oxblood">{t.lesson.plainText}</a>
            <CiteButton citation={`${lesson.authors.join(", ") || site.name}. “${lesson.title}”. ${track.title}. ${site.name}.`} />
            <Link href={to(`/denunciar?item=${encodeURIComponent(path(lesson.slug))}`)} className="underline hover:text-oxblood">
              {t.common.report}
            </Link>
          </p>
          <p className="no-print hidden md:block">{t.lesson.keys}</p>
        </footer>
      </article>
      {/* A margem: anotação, palavra do glossário, laboratório e quem ensina. No celular e no texto largo, vem depois da aula. */}
      <div className="coluna-da-margem min-w-0 xl:self-start xl:pt-40 max-xl:md:col-start-2">
        <MargemDaAula aula={id} termo={termo} laboratorio={laboratorio}>
          <div className="hidden xl:block">
            <CartaoDoEducador area={track.area} lang={lang} nomes={t.areas as Record<string, string[]>} />
          </div>
        </MargemDaAula>
      </div>
      <CaixaDaAula t={t} lang={lang} area={track.area} sugeridas={lesson.tools} />
    </div>
    </div>
  );
}
