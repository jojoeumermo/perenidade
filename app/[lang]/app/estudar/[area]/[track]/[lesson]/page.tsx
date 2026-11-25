// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound, redirect } from "next/navigation";
import { L } from "@/components/I18n";
import { Markdown } from "@/components/Markdown";
import { Quiz } from "@/components/Quiz";
import { SourceList } from "@/components/Cards";
import { OuvirAula } from "@/components/aula/OuvirAula";
import { AntesDaAulaApp, BarraDaAula, GuardarAula } from "@/components/app/jornada";
import { FaixaDoCursoSobDemanda as FaixaDoCurso } from "@/components/escola/cursos/FaixaDoCursoSobDemanda";
import { textosDosCursos } from "@/i18n/escola/cursos";
import { textosDaAula } from "@/i18n/escola/aula";
import { cursosDaAula } from "@/lib/escola/cursos-vista";
import { questoesOficiaisDaAula } from "@/lib/enem-conteudo";
import { textosDoAppNovo } from "@/components/app/textos-app";
import { ExerciciosComExplicacaoSobDemanda as ExerciciosComExplicacao, IssoAjudouSobDemanda as IssoAjudou, RegistroDeConclusaoSobDemanda as RegistroDeConclusao } from "@/components/estudo/NaAula";
import { PraticaSobDemanda as Pratica } from "@/components/estudo/PraticaSobDemanda";
import { exerciciosDaAula } from "@/lib/exercicios-conteudo";
import { linguaDe } from "@/lib/pratica";
import { textosDoEstudo } from "@/lib/textos-estudo";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, fill, localePath } from "@/i18n/config";
import { getGlossary, getTrack, requisitosDaAula } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import { areaNaEscola } from "@/lib/escola/aulas-abertas";
import { ligado } from "@/lib/recursos";
import { lerLexico } from "@/lib/vozes/lexico";

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

/**
 * A aula no aplicativo: leitor próprio, sem a barra de abas (o que fica embaixo é a barra de concluir). O texto, o teste e
 * o ouvir são os mesmos componentes do site (o conteúdo não se reescreve); a moldura, a navegação e o fim da aula são do app.
 */
export default async function AulaDoApp({ params }: PageProps<"/[lang]/app/estudar/[area]/[track]/[lesson]">) {
  const { lang, t } = await loadLang(params);
  const { area, track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug, lang);
  const index = track?.lessons.findIndex((l) => l.slug === lessonSlug) ?? -1;
  if (!track || index < 0 || track.area !== area || areaNaEscola(track.area)) notFound();
  const caminho = (slug: string) => `/app/estudar/${area}/${track.slug}/${slug}`;
  const lesson = track.lessons[index];
  // Sem tradução do texto neste idioma: vai para a aula em português, como o site.
  if (lang !== defaultLocale && !lesson.translated) redirect(localePath(defaultLocale, caminho(lesson.slug)));
  const s = textosDoAppNovo(lang);
  const id = lessonId(track.slug, lesson.slug);
  const proxima = track.lessons[index + 1];
  const posicao = fill(t.lesson.position, { i: index + 1, n: track.lessons.length });
  const terms = lesson.translated ? getGlossary(lang).filter((g) => g.translated).map(({ slug, term, summary }) => ({ slug, term, summary })) : [];
  const estudo = textosDoEstudo(lang).s;
  const exercicios = ligado("exercicios") ? exerciciosDaAula(track.slug, lesson.slug) : [];
  const corrigir = `/contribuir?corrigir=${encodeURIComponent(`/app/estudar/${area}/${track.slug}/${lesson.slug}`)}`;
  const requisitos = requisitosDaAula(lang, track, lesson.slug).map((r) => ({ ...r, path: `/app/estudar/${r.area}/${r.id}` }));
  const oficiais = ligado("enem-curso") ? questoesOficiaisDaAula(track.slug, lesson.slug) : [];
  const sa = ligado("escola") ? textosDaAula(lang) : null;
  const cursosDestaAula = sa ? cursosDaAula(id) : [];
  const letraGrande = track.area === "alfabetizacao" && track.stage !== "superior";

  return (
    <article className="app-aula" data-posicao={posicao}>
      {(ligado("meu-estudo") || ligado("metas")) && <RegistroDeConclusao />}
      <GuardarAula path={`/app/estudar/${area}/${track.slug}/${lesson.slug}`} title={lesson.title} track={track.title} area={track.area} />
      <header className="app-aula-cabeca">
        <p className="app-aula-trilho">
          {track.title} · {posicao} · {fill(t.tracks.minutes, { n: lesson.minutes })}
        </p>
        <div {...originalLang(lesson.translated)}>
          <h1>{lesson.title}</h1>
          <p className="app-aula-resumo">{lesson.summary}</p>
        </div>
      </header>
      <AntesDaAulaApp aula={id} requisitos={requisitos} />
      <OuvirAula minutos={fill(t.tracks.minutes, { n: lesson.minutes })} lexico={lerLexico()} />
      <Untranslated lang={lang} t={t} show={!lesson.translated} />
      <div id="texto-da-aula" className="app-aula-texto" {...originalLang(lesson.translated)}>
        <Markdown lang={lang} terms={terms} tryCode={t.lesson.tryCode} sala={track.area} audio={letraGrande}>
          {lesson.body}
        </Markdown>
        {lesson.quiz.length > 0 && <Quiz key={id} questions={lesson.quiz} registro={id} guardarNoAparelho={ligado("meu-estudo")} audio={letraGrande} />}
        {exercicios.length > 0 && <ExerciciosComExplicacao exercicios={exercicios} aula={id} s={estudo.exercicios} corrigir={corrigir} praticar="/meu-estudo/praticar" />}
        {lesson.practice.length > 0 && (
          <Pratica key={`pratica-${id}`} id={id} exercicios={lesson.practice} lingua={linguaDe(track.area)} s={t.practice} semPlacar={ligado("pratica-sem-placar")} lead={ligado("pratica-sem-placar") ? estudo.praticaSemPlacar.lead : undefined} />
        )}
        {oficiais.length > 0 && (
          <section aria-labelledby="questoes-oficiais" className="app-aula-oficiais">
            <h2 id="questoes-oficiais">{estudo.enem.naAula.titulo}</h2>
            <p>{estudo.enem.naAula.lead}</p>
            <ul>
              {oficiais.slice(0, 30).map((q) => (
                <li key={q.id}>
                  <L href={`/enem/praticar?q=${q.id}`}>{fill(estudo.enem.naAula.item, { ano: q.ano, n: Number(q.id.split("-")[2]) })}</L>
                </li>
              ))}
            </ul>
            <L href={`/enem/praticar?q=${oficiais.map((q) => q.id).join(",")}`} className="app-link-forte">
              {estudo.enem.naAula.praticarTodas} →
            </L>
          </section>
        )}
        <SourceList sources={lesson.sources} title={t.lesson.sources} />
      </div>
      {ligado("ajudou") && <IssoAjudou aula={id} s={estudo.ajudou} sugerir={corrigir} />}
      {sa && cursosDestaAula.length > 0 && (
        <FaixaDoCurso aula={id} cursos={cursosDestaAula} proximaDaTrilha={proxima && { caminho: caminho(proxima.slug), titulo: proxima.title }} s={textosDosCursos(lang).faixa} sProximo={sa.proximo} />
      )}
      <footer className="app-aula-fim">
        {proxima ? (
          <L href={caminho(proxima.slug)} className="app-cartao app-cartao-tinta">
            <span className="app-cartao-rotulo">{s.proximaAula}</span>
            <span className="app-cartao-titulo">{proxima.title}</span>
          </L>
        ) : (
          <p className="app-aula-fim-texto">{s.trilhaConcluida}</p>
        )}
        <L href={`/app/estudar/${area}/${track.slug}`} className="app-link-forte">
          ← {s.voltarParaTrilha}
        </L>
      </footer>
      <BarraDaAula id={id} proxima={proxima && caminho(proxima.slug)} trilha={`/app/estudar/${area}/${track.slug}`} posicao={posicao} lang={lang} />
    </article>
  );
}
