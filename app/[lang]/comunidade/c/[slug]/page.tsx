// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";
import { slugOk } from "@/lib/rede/tipos";
import { comTextos } from "@/lib/rede/textos-comunidades";
import { ligado } from "@/lib/recursos";

// Conteúdo da Rede muda a cada minuto e depende de quem lê: nenhuma página aqui é gerada de antemão.
export const dynamicParams = true;

/**
 * Sem nenhum trecho do conteúdo: o título e a prévia de uma página da Rede nunca levam o texto de um post, de um perfil ou de uma
 * comunidade (a matriz de visibilidade vale também para prévia), e a página não é indexada.
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

/** Uma comunidade da Rede (/comunidade/c/[slug]): cabeçalho, regras e posts. Com o recurso "rede-v2" desligado a rota não existe (404): a Rede de hoje fica como está. */
export default async function Pagina({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  const { slug } = await params;
  if (!slugOk(slug)) notFound();
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={comTextos(lang)} tela={{ tipo: "comunidade", slug }} />
      </Suspense>
    </div>
  );
}
