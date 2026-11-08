// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { TarefaNoMundo, ContadorDeTarefas } from "@/components/escola/vida/TarefaNoMundo";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaVida } from "@/i18n/escola/vida";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-vida.css";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  return paginaMeta(lang, "/vida/tarefas", `${s.meta.tarefas.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.tarefas.descricao);
}

/** Todas as tarefas no mundo dos cursos, com o estado de cada uma (a marca é lida do aparelho depois de montar). */
export default async function Page({ params }: Props) {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  const cursos = carregarCursos().filter((c) => c.tarefaNoMundo);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-pagina-vida="tarefas">
      <PageHeading eyebrow={s.tarefas.olho} title={s.tarefas.titulo} voltar={{ href: localePath(lang, "/vida"), texto: s.comum.voltarVida }}>
        {s.tarefas.lead}
      </PageHeading>
      <ContadorDeTarefas total={cursos.length} texto={s.tarefas.contador} />
      <p className="vida-nota">
        <span className="vida-selo">{s.comum.emRevisao}</span> {s.comum.soNoAparelho}
      </p>
      {cursos.map((c) => (
        <section key={c.slug} className="vida-bloco" aria-labelledby={`tarefa-${c.slug}`}>
          <h2 id={`tarefa-${c.slug}`} className="vida-titulo">
            {c.titulo}
          </h2>
          <p className="vida-texto" lang="pt">
            {c.tarefaNoMundo}
          </p>
          <p className="vida-nota">
            <Link href={localePath(lang, `/cursos/${c.slug}`)} className="underline hover:text-oxblood">
              {s.tarefas.abrirCurso}
            </Link>
          </p>
          <TarefaNoMundo curso={c.slug} tituloDoCurso={c.titulo} s={s.tarefas.cartao} lang={lang} />
        </section>
      ))}
    </div>
  );
}