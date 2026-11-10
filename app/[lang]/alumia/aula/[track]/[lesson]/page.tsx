// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";
import { comTextos } from "@/lib/rede/textos-comunidades";
import { aulaOk } from "@/lib/rede/tipos-comunidades";
import { slugOk } from "@/lib/rede/tipos";
import { ligado } from "@/lib/recursos";

export const dynamicParams = true;

/** Sem o título nem o conteúdo da aula ou dos posts: só a marca, e a página não é indexada. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

/**
 * "Discutir esta aula" (/alumia/aula/[trilha]/[aula]?c=<comunidade>): a comunidade da disciplina filtrada por uma aula. A página
 * não lê a aula do disco (o botão da aula já traz a comunidade na consulta). Com o recurso "rede-v2" desligado a rota não existe (404).
 */
export default async function Pagina({ params, searchParams }: { params: Promise<{ lang: string; track: string; lesson: string }>; searchParams: Promise<{ c?: string | string[] }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  const { track, lesson } = await params;
  const consulta = await searchParams;
  const c = Array.isArray(consulta.c) ? consulta.c[0] : consulta.c;
  if (!aulaOk(`${track}/${lesson}`) || !c || !slugOk(c)) notFound();
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={comTextos(lang)} tela={{ tipo: "pacote", nome: "aula", params: { track, lesson, c } }} />
      </Suspense>
    </div>
  );
}
