// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";
import { comTextos } from "@/lib/rede/textos-comunidades";
import { idOk } from "@/lib/rede/tipos";
import { ligado } from "@/lib/recursos";

export const dynamicParams = true;

/** Sem nenhum trecho do conteúdo (o núcleo é fechado): só a marca, e a página não é indexada. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

/** A página de um núcleo (/comunidade/nucleos/[id]): só para quem é dele; o banco responde "não encontrado" para os outros. Com o recurso "rede-v2" desligado a rota não existe (404). */
export default async function Pagina({ params }: { params: Promise<{ lang: string; id: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  const { id } = await params;
  if (!idOk(id)) notFound();
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={comTextos(lang)} tela={{ tipo: "pacote", nome: "nucleos", params: { id } }} />
      </Suspense>
    </div>
  );
}
