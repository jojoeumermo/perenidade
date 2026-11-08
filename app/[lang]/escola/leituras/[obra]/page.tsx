// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeituraGuiada } from "@/components/escola/cursos/LeituraGuiada";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDosCursos } from "@/i18n/escola/cursos";
import { getBooks } from "@/lib/content";
import { leituraDe, leiturasGuiadas } from "@/lib/escola/cursos-vista";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-cursos.css";

type Props = PageProps<"/[lang]/escola/leituras/[obra]">;

// Só as obras com leitura guiada em content/escola/leituras; o resto dá 404 sem ler nada em tempo de execução.
export const dynamicParams = false;

export function generateStaticParams() {
  return leiturasGuiadas().map((l) => ({ obra: l.obra }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const leitura = leituraDe((await params).obra);
  if (!leitura) return {};
  const s = textosDosCursos(lang);
  return paginaMeta(lang, `/escola/leituras/${leitura.obra}`, `${s.meta.leituraTitulo}: ${leitura.titulo}`, s.leitura.lead);
}

/** A leitura guiada de uma obra do Acervo (E4-07, R1-44): perguntas por seção, respostas só no aparelho. */
export default async function PaginaDaLeitura({ params }: Props) {
  const { lang } = await loadLang(params);
  const leitura = leituraDe((await params).obra);
  if (!leitura) notFound();
  const s = textosDosCursos(lang);
  const livro = getBooks("pt").find((b) => b.id === leitura.obra);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-leitura-guiada={leitura.obra}>
      <PageHeading eyebrow={s.leitura.olho} title={leitura.titulo} voltar={{ href: localePath(lang, "/cursos"), texto: s.leitura.voltar }}>
        {s.leitura.lead}
      </PageHeading>
      {leitura.revisao === "em-revisao" && <p className="selo-em-revisao mt-6 inline-block">{s.leitura.emRevisao}</p>}
      {lang !== "pt" && <p className="mt-3 font-sans text-sm text-ink-soft">{s.leitura.emPortugues}</p>}
      <p className="mt-4" lang="pt">
        {leitura.apresentacao}
      </p>
      {livro && (
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-sans text-sm">
          <Link href={localePath(lang, `/acervo/${livro.id}`)} className="font-semibold underline hover:text-oxblood">
            {s.leitura.ficha}
          </Link>
          <a href={livro.url} rel="noopener noreferrer" target="_blank" className="underline hover:text-oxblood">
            {s.leitura.fonte} ({livro.source}) ↗
          </a>
        </p>
      )}
      <div className="mt-8">
        <LeituraGuiada leitura={leitura} s={s.leitura} />
      </div>
    </div>
  );
}
