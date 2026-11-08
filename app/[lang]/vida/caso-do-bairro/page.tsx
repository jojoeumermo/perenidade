// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CasoDoBairro } from "@/components/escola/vida/CasoDoBairro";
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
  return paginaMeta(lang, "/vida/caso-do-bairro", `${s.meta.caso.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.caso.descricao);
}

/** Estudo de caso do bairro: 5 passos, rascunho privado no aparelho, resumo opcional na caderneta. */
export default async function Page({ params }: Props) {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  const cursos = carregarCursos()
    .filter((c) => c.casoDoBairro)
    .map((c) => ({ slug: c.slug, titulo: c.titulo }));
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-vida="caso">
      <PageHeading eyebrow={s.caso.olho} title={s.caso.titulo} voltar={{ href: localePath(lang, "/vida"), texto: s.comum.voltarVida }}>
        {s.caso.lead}
      </PageHeading>
      <p className="vida-nota">
        <span className="vida-selo">{s.comum.emRevisao}</span> {s.comum.soNoAparelho}
      </p>
      <CasoDoBairro cursos={cursos} s={s.caso} />
    </div>
  );
}