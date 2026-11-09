// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";
import { ligado } from "@/lib/recursos";
import { normalizarTag, tagOk } from "@/lib/rede/tipos-descoberta";

/** Sem nenhum trecho do conteúdo (a matriz de visibilidade vale também para prévia) e sem indexação: a busca e a hashtag mostram só o que cada pessoa pode ver. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

// Nenhuma hashtag é gerada de antemão: o que ela mostra depende de quem lê.
export const dynamicParams = true;

/** A página de uma hashtag (/alumia/tag/[tag]). Com o recurso "rede-v2" desligado a rota não existe (404). */
export default async function Pagina({ params }: { params: Promise<{ lang: string; tag: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  let bruta = (await params).tag;
  try {
    bruta = decodeURIComponent(bruta);
  } catch {
    notFound(); // "%" malformado: 404, não erro 500
  }
  const tag = normalizarTag(bruta);
  if (!tagOk(tag)) notFound();
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "tag", params: { tag } }} />
      </Suspense>
    </div>
  );
}
