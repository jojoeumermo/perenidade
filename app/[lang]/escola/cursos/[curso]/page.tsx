// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BibliotecaDoCurso } from "@/components/escola/cursos/BibliotecaDoCurso";
import { Ementa } from "@/components/escola/cursos/Ementa";
import { EntrarNoCurso } from "@/components/escola/cursos/EntrarNoCurso";
import { GradeDoCurso } from "@/components/escola/cursos/GradeDoCurso";
import { HorasDoCurso } from "@/components/escola/cursos/HorasDoCurso";
import { Patrono } from "@/components/escola/cursos/Patrono";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { fill, htmlLang, localePath } from "@/i18n/config";
import { textosDosCursos } from "@/i18n/escola/cursos";
import { aulasDoCurso } from "@/lib/escola/cursos";
import { carregarCursos, cursoPorSlug } from "@/lib/escola/cursos-servidor";
import { bibliografiaDo, bibliotecaDo, patronoDo, verCurso } from "@/lib/escola/cursos-vista";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-cursos.css";

type Props = PageProps<"/[lang]/escola/cursos/[curso]">;

// Todos os cursos em todos os idiomas saem na montagem; curso que não existe dá 404 sem ler nada em tempo de execução.
export const dynamicParams = false;

export function generateStaticParams() {
  return carregarCursos().map((c) => ({ curso: c.slug }));
}

/** Páginas com link próprio na página do curso (o curso aponta para elas em vez de repetir o que já existe). */
const PAGINAS_DO_CURSO: Record<string, string> = { enem: "/enem" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const curso = cursoPorSlug((await params).curso);
  if (!curso) return {};
  const s = textosDosCursos(lang);
  return paginaMeta(lang, `/escola/cursos/${curso.slug}`, `${curso.titulo} · ${s.catalogo.olho}`, curso.resumo);
}

/** A página de um curso: o que é, entrar, horas, grade, tarefa e projeto, patrono, biblioteca, ementa, zine e turma. */
export default async function PaginaDoCurso({ params }: Props) {
  const { lang } = await loadLang(params);
  const curso = cursoPorSlug((await params).curso);
  if (!curso) notFound();
  const s = textosDosCursos(lang);
  const visto = verCurso(curso);
  const patrono = patronoDo(curso);
  const biblioteca = bibliotecaDo(curso);
  const todos = carregarCursos();
  const requisitos = curso.requisitos.map((r) => todos.find((c) => c.slug === r)).filter((c) => c !== undefined);
  const fmt = new Intl.NumberFormat(htmlLang[lang], { maximumFractionDigits: 1 });
  const horas = fmt.format(visto.horas);
  const aulas = aulasDoCurso(curso);
  const titulos = visto.modulos.flatMap((m) => m.aulas.map((a) => a.titulo));
  const minutos = visto.modulos.flatMap((m) => m.aulas.map((a) => a.minutos));
  const outra = PAGINAS_DO_CURSO[curso.slug];
  const temAprender = curso.slug !== "aprender-a-estudar" && visto.nAulas >= 20 && todos.some((c) => c.slug === "aprender-a-estudar");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-curso={curso.slug}>
      <PageHeading eyebrow={`${s.curso.olho} · ${s.ciclos[curso.ciclo].titulo}`} title={curso.titulo} voltar={{ href: localePath(lang, "/escola/cursos"), texto: s.curso.voltar }}>
        <span lang="pt">{curso.resumo}</span>
      </PageHeading>

      <ul className="dados-do-curso">
        <li>{fill(s.curso.horasESemanas, { h: horas, s: curso.semanas })}</li>
        <li>{fill(s.catalogo.aulas, { n: visto.nAulas })}</li>
        <li title={s.formatosTexto[curso.formato]}>
          {s.curso.formato}: {s.formatos[curso.formato]}
        </li>
        <li className="selo-aulas-prontas">{s.catalogo.selo}</li>
      </ul>
      {lang !== "pt" && <p className="mt-3 font-sans text-sm text-ink-soft">{s.curso.conteudoEmPortugues}</p>}
      {curso.sensivel && (
        <p className="aviso-sensivel" data-aviso-sensivel="">
          {s.curso.sensivel}
        </p>
      )}

      <div className="curso-topo">
        <EntrarNoCurso slug={curso.slug} sensivel={Boolean(curso.sensivel)} aulas={aulas} titulos={titulos} idioma={htmlLang[lang]} s={s.entrar} />
        <HorasDoCurso slug={curso.slug} aulas={aulas} minutos={minutos} total={visto.horas} idioma={htmlLang[lang]} s={s.horas} />
      </div>

      {outra && (
        <p className="aviso-pagina-do-curso">
          {s.curso.enem}{" "}
          <Link href={localePath(lang, outra)} className="font-semibold underline hover:text-oxblood">
            {s.curso.enemLink} →
          </Link>
        </p>
      )}

      <section className="mt-10" aria-labelledby="objetivo-do-curso">
        <h2 id="objetivo-do-curso" className="rotulo">
          {s.ementa.objetivo}
        </h2>
        <p className="mt-2 font-serif text-xl" lang="pt">
          {curso.objetivo}
        </p>
        <h2 className="rotulo mt-6">{s.curso.requisitosTitulo}</h2>
        {requisitos.length ? (
          <ul className="mt-2 font-sans">
            {requisitos.map((r) => (
              <li key={r.slug}>
                <Link href={localePath(lang, `/escola/cursos/${r.slug}`)} className="font-semibold underline hover:text-oxblood" lang="pt">
                  {r.titulo}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 font-sans">{s.curso.semRequisitos}</p>
        )}
        {temAprender && (
          <p className="mt-2 font-sans text-sm">
            <Link href={localePath(lang, "/escola/cursos/aprender-a-estudar")} className="underline hover:text-oxblood">
              {s.curso.recomendado}
            </Link>
          </p>
        )}
      </section>

      <div className="mt-10">
        <GradeDoCurso
          slug={curso.slug}
          alternancia={curso.formato === "alternancia"}
          emRevisao={s.curso.emRevisao}
          s={s.grade}
          modulos={visto.modulos.map((m) => ({ titulo: m.titulo, aulas: m.aulas.map(({ id, titulo, trilha, caminho, minutos }) => ({ id, titulo, trilha, caminho, minutos })), ...(m.pratica ? { pratica: m.pratica } : {}) }))}
        />
      </div>

      {curso.emConstrucao && curso.emConstrucao.length > 0 && (
        <section className="em-construcao-do-curso" aria-labelledby="em-construcao-do-curso">
          <h2 id="em-construcao-do-curso" className="font-serif text-2xl font-semibold">
            {s.curso.emConstrucaoTitulo}
          </h2>
          <p className="mt-1 font-sans text-sm text-ink-soft">{s.curso.emConstrucaoTexto}</p>
          <ul className="mt-3 space-y-1 font-sans">
            {curso.emConstrucao.map((e) => (
              <li key={e.titulo} data-em-construcao-item="">
                <span lang="pt">{e.titulo}</span> <span className="selo-em-construcao">{s.curso.emConstrucao}</span>{" "}
                <span className="text-sm text-ink-soft" lang="pt">
                  ({e.motivo})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tarefa-e-projeto" aria-label={`${s.curso.tarefaNoMundo} · ${s.curso.projetoFinal}`}>
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            {s.curso.tarefaNoMundo} <span className="selo-em-revisao">{s.curso.emRevisao}</span>
          </h2>
          <p className="mt-2" lang="pt">
            {curso.tarefaNoMundo}
          </p>
        </div>
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            {s.curso.projetoFinal} <span className="selo-em-revisao">{s.curso.emRevisao}</span>
          </h2>
          <p className="mt-2" lang="pt">
            {curso.projetoFinal}
          </p>
          {curso.casoDoBairro && <p className="mt-2 font-sans text-sm text-ink-soft">{s.curso.casoDoBairro}</p>}
        </div>
      </section>

      {patrono && (
        <div className="mt-10">
          <Patrono lang={lang} patrono={patrono} s={s.patrono} />
        </div>
      )}

      <div className="mt-10">
        <BibliotecaDoCurso lang={lang} obras={biblioteca} s={s.biblioteca} />
      </div>

      <div className="mt-10">
        <Ementa visto={visto} bibliografia={bibliografiaDo(curso)} biblioteca={biblioteca} requisitos={requisitos.map((r) => r.titulo)} horas={horas} s={s.ementa} />
      </div>

      <ul className="links-do-curso no-print">
        <li>
          <Link href={localePath("pt", `/escola/cursos/${curso.slug}/zine`)} className="link-do-curso" data-link-zine="">
            <span className="font-serif text-xl font-semibold">{s.curso.zine}</span>
            <span className="mt-1 block text-sm text-ink-soft">{s.curso.zineTexto}</span>
          </Link>
        </li>
        <li>
          <Link href={localePath(lang, "/escola/turmas")} className="link-do-curso">
            <span className="font-serif text-xl font-semibold">{s.curso.turmas}</span>
            <span className="mt-1 block text-sm text-ink-soft">{s.curso.turmasTexto}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
