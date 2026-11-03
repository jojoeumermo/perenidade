// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ReconhecimentoDeSaberes } from "@/components/escola/avaliacao/ReconhecimentoDeSaberes";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { trilhasDoCurso } from "@/lib/escola/avaliacao-servidor";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-cursos.css";
import "@/styles/escola-avaliacao.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/saberes">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaAvaliacao(lang).saberes;
  return paginaMeta(lang, "/escola/saberes", `${s.titulo} · ${textosDaBase(lang).meta.titulo}`, s.lead);
}

/**
 * O reconhecimento de saberes da Escola (E4-13, R1-48; docs/escola/avaliacao.md): provas de proficiência, roteiro de
 * avaliação prática nos cursos de alternância e o registro na caderneta. Registro da Escola, não certificação oficial;
 * para a certificação oficial de escolaridade, o caminho é o ENCCEJA.
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/saberes">) {
  const { lang } = await loadLang(params);
  const s = textosDaAvaliacao(lang).saberes;
  const cursos = carregarCursos().map((c) => ({
    slug: c.slug,
    titulo: c.titulo,
    alternancia: c.formato === "alternancia",
    trilhas: trilhasDoCurso(c),
    praticas: c.modulos.flatMap((m) => m.pratica ?? []),
  }));
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-pagina-saberes="">
      <PageHeading eyebrow={s.olho} title={s.titulo} voltar={{ href: localePath(lang, "/escola"), texto: textosDaBase(lang).nav.entrada }}>
        <span>{s.lead}</span>
      </PageHeading>

      <p className="aviso-honesto" data-aviso-honesto="">
        <strong>{s.naoEhCertificacao}</strong> {s.encceja}{" "}
        <Link href={localePath(lang, "/escola/calendario")} className="font-semibold underline hover:text-oxblood">
          {s.enccejaLink} →
        </Link>
      </p>

      <ReconhecimentoDeSaberes cursos={cursos} s={s} />
    </div>
  );
}
