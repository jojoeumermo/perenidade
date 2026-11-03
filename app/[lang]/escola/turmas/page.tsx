// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import {
  ContaDasTurmas,
  EntrarNaTurma,
} from "@/components/escola/turma/TurmaDoCurso";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { textosDaTurma } from "@/i18n/escola/turma";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { temTurma, turmaDoCurso } from "@/lib/escola/turma-do-curso";
import { paginaMeta } from "@/lib/seo";
import { mesesDaTurma } from "@/lib/turma-do-mes";
import "@/styles/escola-turma.css";

// A turma vira no dia 1 (como a Turma do mês): a página se refaz a cada hora para não ficar presa no mês que passou.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/escola/turmas">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaTurma(lang);
  return paginaMeta(
    lang,
    "/escola/turmas",
    `${s.meta.turmas.titulo} · ${textosDaBase(lang).meta.titulo}`,
    s.meta.turmas.descricao,
  );
}

/**
 * Turmas por curso (E4-15, D1-15; docs/escola/turma.md): os cursos com turma neste mês e no próximo, o módulo de cada
 * mês, o número de inscritos e "Entrar na turma" (com conta; no curso sensível, só com o "Concordo"). As ferramentas
 * de quem facilita (círculo, banca, cartaz) ficam no fim.
 */
export default async function Page({
  params,
}: PageProps<"/[lang]/escola/turmas">) {
  const { lang } = await loadLang(params);
  const s = textosDaTurma(lang);
  const base = textosDaBase(lang);
  const [agora, seguinte] = mesesDaTurma();
  const cursos = carregarCursos()
    .filter(temTurma)
    .map((curso) => ({
      curso,
      desta: turmaDoCurso(curso, agora),
      proxima: turmaDoCurso(curso, seguinte),
    }))
    .filter((c) => c.desta || c.proxima);
  const to = (p: string) => localePath(lang, p);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-pagina-turmas="">
      <PageHeading
        eyebrow={s.lista.olho}
        title={s.lista.titulo}
        voltar={{ href: to("/escola"), texto: base.nav.entrada }}
      >
        {s.lista.lead}
      </PageHeading>
      {lang !== "pt" && (
        <p className="mt-3 font-sans text-sm text-ink-soft">
          {s.curso.conteudoEmPortugues}
        </p>
      )}

      {cursos.length === 0 ? (
        <p className="turma-nota mt-8">{s.lista.semCursos}</p>
      ) : (
        <ContaDasTurmas>
          <ul className="turmas-lista">
            {cursos.map(({ curso, desta, proxima }) => (
              <li
                key={curso.slug}
                className="turmas-cartao"
                data-turma-curso={curso.slug}
              >
                <h2
                  className="font-serif text-2xl font-semibold leading-tight"
                  lang="pt"
                >
                  <Link
                    href={to(`/escola/turmas/${curso.slug}`)}
                    className="text-ink hover:text-prelo-texto"
                  >
                    {curso.titulo}
                  </Link>
                </h2>
                <div className="turmas-meses">
                  {desta && (
                    <div>
                      <p className="rotulo">{s.lista.agora}</p>
                      <p className="turma-modulo">
                        {fill(s.lista.modulo, { modulo: "" })}
                        <span lang="pt">{desta.modulo.titulo}</span>
                      </p>
                      <EntrarNaTurma
                        curso={curso.slug}
                        titulo={curso.titulo}
                        mes={agora}
                        sensivel={Boolean(curso.sensivel)}
                        proxima={false}
                        s={s.turma}
                        lang={lang}
                      />
                    </div>
                  )}
                  {proxima && (
                    <div>
                      <p className="rotulo">{s.lista.proxima}</p>
                      <p className="turma-modulo">
                        {fill(s.lista.modulo, { modulo: "" })}
                        <span lang="pt">{proxima.modulo.titulo}</span>
                      </p>
                      <EntrarNaTurma
                        curso={curso.slug}
                        titulo={curso.titulo}
                        mes={seguinte}
                        sensivel={Boolean(curso.sensivel)}
                        proxima
                        s={s.turma}
                        lang={lang}
                      />
                    </div>
                  )}
                </div>
                <p className="mt-4 font-sans">
                  <Link
                    href={to(`/escola/turmas/${curso.slug}`)}
                    className="font-semibold underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto"
                  >
                    {s.lista.verTurma} →
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </ContaDasTurmas>
      )}

      <section className="turma-bloco" aria-labelledby="turmas-como">
        <h2 id="turmas-como" className="turma-bloco-titulo">
          {s.lista.comoTitulo}
        </h2>
        <ol className="turma-roteiro">
          {s.lista.como.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p className="turma-nota">
          {s.lista.turmaDoMes}{" "}
          <Link href={to("/turmas")} className="underline hover:text-oxblood">
            {s.lista.turmaDoMesLink}
          </Link>
        </p>
      </section>

      <section className="mt-12" aria-labelledby="turmas-ferramentas">
        <h2 id="turmas-ferramentas" className="turma-bloco-titulo">
          {s.lista.ferramentasTitulo}
        </h2>
        <ul className="links-da-turma">
          {(
            [
              ["/escola/turmas/circulo", s.lista.circulo, s.lista.circuloTexto],
              ["/escola/turmas/banca", s.lista.banca, s.lista.bancaTexto],
              ["/escola/turmas/cartaz", s.lista.cartaz, s.lista.cartazTexto],
            ] as const
          ).map(([caminho, titulo, texto]) => (
            <li key={caminho}>
              <Link href={to(caminho)} className="link-da-turma">
                <span className="font-serif text-xl font-semibold">
                  {titulo}
                </span>
                <span className="mt-1 block text-sm text-ink-soft">
                  {texto}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
