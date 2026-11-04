// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";
import { ligado } from "@/lib/recursos";

/** Sem nenhum trecho do conteúdo (a matriz de visibilidade vale também para prévia) e sem indexação: a busca e a hashtag mostram só o que cada pessoa pode ver. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

/** Explorar (/comunidade/explorar): comunidades, linhas temáticas, pacotes de pessoas e hashtags da semana. Com o recurso "rede-v2" desligado a rota não existe (404): a Rede de hoje fica como está. */
export default async function Pagina({ params }: { params: Promise<{ lang: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "explorar" }} />
      </Suspense>
    </div>
  );
}
