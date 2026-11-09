// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";
import { ligado } from "@/lib/recursos";

// As denúncias e as decisões são de cada pessoa: nenhuma página aqui é gerada de antemão, e nenhuma é indexada.
export const dynamicParams = true;

/** Sem nenhum trecho do conteúdo: só a marca, e a página não é indexada. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

/** Denúncias e recursos (/alumia/denuncias): as denúncias que eu fiz, com protocolo e andamento, e o recurso de 30 dias. Com o recurso "rede-v2" desligado a rota não existe (404). */
export default async function Pagina({ params }: { params: Promise<{ lang: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "denuncias" }} />
      </Suspense>
    </div>
  );
}
