// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Monitoria } from "@/components/escola/turma/Monitoria";
import { Orientacao } from "@/components/escola/turma/Orientacao";
import { Seminario } from "@/components/escola/turma/Seminario";
import {
  type AulaDaTurma,
  ContaDasTurmas,
  CronogramaDaTurma,
  EntrarNaTurma,
} from "@/components/escola/turma/TurmaDoCurso";
import { TurmasEmPausa } from "@/components/escola/turma/TurmasEmPausa";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import monitoria from "@/content/escola/monitoria.json";
import orientadores from "@/content/escola/orientadores.json";
import { loadLang } from "@/i18n";
import { fill, htmlLang, localePath } from "@/i18n/config";
import { textosDaTurma } from "@/i18n/escola/turma";
import { carregarCursos, cursoPorSlug } from "@/lib/escola/cursos-servidor";
import { verCurso } from "@/lib/escola/cursos-vista";
import { textosDaBase } from "@/lib/escola/textos";
import {
  type Monitor,
  monitoresDoMes,
  type Orientador,
  orientadoresComVaga,
  temTurma,
  turmaDoCurso,
  validarMonitoria,
  validarOrientadores,
} from "@/lib/escola/turma-do-curso";
import { recursoLigado } from "@/lib/recursos-vivos";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { mesesDaTurma } from "@/lib/turma-do-mes";
import "@/styles/escola-turma.css";

type Props = PageProps<"/[lang]/escola/turmas/[curso]">;

// Todos os cursos com turma saem na montagem; curso que não existe dá 404. A turma vira no dia 1: refaz a cada hora.
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return carregarCursos()
    .filter(temTurma)
    .map((c) => ({ curso: c.slug }));
}

/** As listas da coordenação só valem inteiras: com qualquer erro, a página não mostra ninguém (e o teste falha). */
function listas() {
  const slugs = new Set(carregarCursos().map((c) => c.slug));
  const m =
    validarMonitoria(monitoria, slugs).length === 0
      ? (monitoria as unknown as Monitor[])
      : [];
  const o =
    validarOrientadores(orientadores, slugs).length === 0
      ? (orientadores as unknown as Orientador[])
      : [];
  return { monitores: m, orientadores: o };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const curso = cursoPorSlug((await params).curso);
  if (!curso) return {};
  const s = textosDaTurma(lang);
  const meta = paginaMeta(
    lang,
    `/escola/turmas/${curso.slug}`,
    `${fill(s.meta.curso.titulo, { curso: curso.titulo })} · ${textosDaBase(lang).meta.titulo}`,
    fill(s.meta.curso.descricao, { curso: curso.titulo }),
  );
  // Em pausa (T08): o aviso não entra nos buscadores.
  return (await recursoLigado("turmas")) ? meta : { ...meta, robots: { index: false, follow: true } };
}

/**
 * A turma de um curso (E4-15): entrar ou sair (este mês e o próximo), o cronograma do mês com o progresso do aparelho,
 * a sala (só para quem entrou), o .ics dos encontros, a monitoria, o seminário e a orientação do projeto final.
 */
export default async function Page({ params }: Props) {
  const { lang } = await loadLang(params);
  const curso = cursoPorSlug((await params).curso);
  if (!curso || !temTurma(curso)) notFound();
  const s = textosDaTurma(lang);
  // T08: turmas em pausa (recurso "turmas", pelo painel). O endereço do curso continua vivo, com o aviso.
  if (!(await recursoLigado("turmas"))) return <TurmasEmPausa lang={lang} s={s.pausa} />;
  const idioma = htmlLang[lang];
  const [agora, seguinte] = mesesDaTurma();
  const desta = turmaDoCurso(curso, agora);
  const proxima = turmaDoCurso(curso, seguinte);
  const visto = verCurso(curso);
  const aulas: Record<string, AulaDaTurma> = {};
  for (const m of visto.modulos)
    for (const a of m.aulas)
      aulas[a.id] = { titulo: a.titulo, minutos: a.minutos };
  const { monitores, orientadores: todos } = listas();
  const sensivel = Boolean(curso.sensivel);
  const to = (p: string) => localePath(lang, p);
  const dataDoSeminario = desta
    ? new Intl.DateTimeFormat(idioma, {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${desta.seminario}T12:00:00Z`))
    : "";

  return (
    <div
      className="mx-auto max-w-4xl px-4 py-12"
      data-pagina-turma={curso.slug}
    >
      <PageHeading
        eyebrow={s.curso.olho}
        title={curso.titulo}
        voltar={{ href: to("/escola/turmas"), texto: s.curso.voltar }}
      >
        <span lang="pt">{curso.resumo}</span>
      </PageHeading>
      <p className="mt-3 font-sans">
        <Link
          href={to(`/cursos/${curso.slug}`)}
          className="underline hover:text-oxblood"
        >
          {s.curso.paginaDoCurso} →
        </Link>
      </p>
      {lang !== "pt" && (
        <p className="mt-2 font-sans text-sm text-ink-soft">
          {s.curso.conteudoEmPortugues}
        </p>
      )}

      <ContaDasTurmas>
        {desta && (
          <section
            className="turma-bloco"
            aria-labelledby="turma-agora"
            data-turma-mes={agora}
          >
            <p className="rotulo">{s.turma.agoraRotulo}</p>
            <h2 id="turma-agora" className="turma-bloco-titulo">
              {s.curso.cronogramaTitulo}
            </h2>
            <p className="turma-modulo">
              {fill(s.lista.modulo, { modulo: "" })}
              <span lang="pt">{desta.modulo.titulo}</span>
            </p>
            <EntrarNaTurma
              curso={curso.slug}
              titulo={curso.titulo}
              mes={agora}
              sensivel={sensivel}
              proxima={false}
              s={s.turma}
              lang={lang}
            />
            <CronogramaDaTurma
              turma={desta}
              aulas={aulas}
              tituloDoCurso={curso.titulo}
              endereco={`${site.url}${to(`/escola/turmas/${curso.slug}`)}`}
              s={s.turma}
              lang={lang}
              idioma={idioma}
            />
          </section>
        )}

        {proxima && (
          <section
            className="turma-bloco"
            aria-labelledby="turma-proxima"
            data-turma-mes={seguinte}
          >
            <p className="rotulo">{s.turma.proximaRotulo}</p>
            <h2 id="turma-proxima" className="turma-bloco-titulo">
              {s.lista.proxima}
            </h2>
            <p className="turma-modulo">
              {fill(s.lista.modulo, { modulo: "" })}
              <span lang="pt">{proxima.modulo.titulo}</span>
            </p>
            <EntrarNaTurma
              curso={curso.slug}
              titulo={curso.titulo}
              mes={seguinte}
              sensivel={sensivel}
              proxima
              s={s.turma}
              lang={lang}
            />
          </section>
        )}
      </ContaDasTurmas>

      <Monitoria
        monitores={monitoresDoMes(monitores, curso.slug, agora)}
        curso={curso.slug}
        tituloDoCurso={curso.titulo}
        s={s.monitoria}
        lang={lang}
      />
      {desta && <Seminario dia={dataDoSeminario} s={s.seminario} />}
      <Orientacao
        orientadores={orientadoresComVaga(todos, curso.slug)}
        tituloDoCurso={curso.titulo}
        s={s.orientacao}
        lang={lang}
      />
    </div>
  );
}
