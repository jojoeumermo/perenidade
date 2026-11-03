// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { BancaPopular } from "@/components/escola/turma/BancaPopular";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaTurma } from "@/i18n/escola/turma";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-turma.css";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/escola/turmas/banca">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaTurma(lang);
  return paginaMeta(
    lang,
    "/escola/turmas/banca",
    `${s.meta.banca.titulo} · ${textosDaBase(lang).meta.titulo}`,
    s.meta.banca.descricao,
  );
}

/** Banca popular online (E4-15, R1-39): o roteiro de 30 minutos e a ficha de devolutiva, sem nota, no aparelho. */
export default async function Page({
  params,
}: PageProps<"/[lang]/escola/turmas/banca">) {
  const { lang } = await loadLang(params);
  const s = textosDaTurma(lang).banca;
  const voltar = textosDaTurma(lang).curso.voltar;
  const cursos = carregarCursos().map((c) => ({
    slug: c.slug,
    titulo: c.titulo,
  }));
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-banca="">
      <PageHeading
        eyebrow={s.olho}
        title={s.titulo}
        voltar={{ href: localePath(lang, "/escola/turmas"), texto: voltar }}
      >
        {s.lead}
      </PageHeading>
      <section className="turma-bloco no-print" aria-labelledby="banca-quem">
        <h2 id="banca-quem" className="turma-bloco-titulo">
          {s.quemTitulo}
        </h2>
        <ul className="turma-roteiro">
          {s.quem.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <h2 className="turma-bloco-titulo mt-8">{s.roteiroTitulo}</h2>
        <ol className="banca-roteiro">
          {s.roteiro.map(([tempo, texto]) => (
            <li key={tempo}>
              <span className="banca-tempo">{tempo}</span>
              <span>{texto}</span>
            </li>
          ))}
        </ol>
        <p className="turma-nota">{s.sala}</p>
      </section>
      <BancaPopular cursos={cursos} s={s} lang={lang} />
    </div>
  );
}
