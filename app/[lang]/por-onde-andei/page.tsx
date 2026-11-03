// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PorOndeAndei } from "@/components/PorOndeAndei";
import { loadLang } from "@/i18n";
import { textosDaBusca } from "@/lib/escola/textos-da-busca";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/por-onde-andei">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const h = textosDaBusca(lang).historico;
  // Página pessoal (mostra o que está no aparelho de cada um): não entra na busca.
  return { ...paginaMeta(lang, "/por-onde-andei", h.titulo, h.descricao), robots: { index: false, follow: true } };
}

/**
 * Por onde andei (Etapa 4, R1-21): as páginas que a pessoa viu nesta semana, lidas só do aparelho dela. Começa desligado;
 * a lista só existe depois que a pessoa aceita o convite. Sem a Escola ligada, a página não existe.
 */
export default async function Page({ params }: PageProps<"/[lang]/por-onde-andei">) {
  if (!ligado("escola")) notFound();
  const { lang } = await loadLang(params);
  const h = textosDaBusca(lang).historico;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={h.olho} title={h.titulo}>
        {h.lead}
      </PageHeading>
      <PorOndeAndei lang={lang} />
    </div>
  );
}
