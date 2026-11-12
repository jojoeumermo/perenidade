// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { paginaDeExemplo, previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { textosDaRede } from "@/lib/rede/textos";
import { slugOk } from "@/lib/rede/tipos";
import { comTextos } from "@/lib/rede/textos-comunidades";
import { ligado } from "@/lib/recursos";

export const dynamicParams = true;

/** Sem nenhum trecho da wiki nos metadados (a matriz de visibilidade vale também para a prévia), e a página não é indexada. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

/**
 * A wiki de uma comunidade (/alumia/c/[slug]/wiki): a mesma página da comunidade, aberta na aba Wiki (cartilha de direitos e
 * contatos). Quem decide se a pessoa pode ver é o banco (rede_alumia_wiki), com a sessão dela, no navegador.
 */
export default async function Pagina({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  const { slug } = await params;
  if (!slugOk(slug)) notFound();
  if (previaDaAlumiaLigada() && !paginaDeExemplo(slug)) notFound();
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={comTextos(lang)} tela={{ tipo: "comunidade", slug }} />
      </Suspense>
    </div>
  );
}
