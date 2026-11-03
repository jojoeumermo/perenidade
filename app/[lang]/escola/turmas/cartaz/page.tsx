// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CartazDaTurma } from "@/components/escola/turma/CartazDaTurma";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaTurma } from "@/i18n/escola/turma";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import "@/styles/escola-turma.css";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/escola/turmas/cartaz">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaTurma(lang);
  return paginaMeta(
    lang,
    "/escola/turmas/cartaz",
    `${s.meta.cartaz.titulo} · ${textosDaBase(lang).meta.titulo}`,
    s.meta.cartaz.descricao,
  );
}

/** Cartaz da turma (E4-15, R1-68): o arquivo vivo de quem se forma, montado no aparelho; nada é publicado sozinho. */
export default async function Page({
  params,
}: PageProps<"/[lang]/escola/turmas/cartaz">) {
  const { lang } = await loadLang(params);
  const t = textosDaTurma(lang);
  const cursos = carregarCursos().map((c) => ({
    slug: c.slug,
    titulo: c.titulo,
  }));
  const marca = `${site.name} · ${textosDaBase(lang).meta.titulo} · ${site.url.replace(/^https?:\/\//, "")}`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-cartaz="">
      <div className="no-print">
        <PageHeading
          eyebrow={t.cartaz.olho}
          title={t.cartaz.titulo}
          voltar={{
            href: localePath(lang, "/escola/turmas"),
            texto: t.curso.voltar,
          }}
        >
          {t.cartaz.lead}
        </PageHeading>
      </div>
      <CartazDaTurma cursos={cursos} s={t.cartaz} lang={lang} marca={marca} />
    </div>
  );
}
