// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";
import { comTextos } from "@/lib/rede/textos-comunidades";
import { ligado } from "@/lib/recursos";

export const dynamicParams = true;

/** Só a marca, e a página não é indexada. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

/** A lista de comunidades da Rede (/comunidade/comunidades): Lutas, Disciplinas e Instituto, com entrar em cada uma. Com o recurso "rede-v2" desligado a rota não existe (404). */
export default async function Pagina({ params }: { params: Promise<{ lang: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={comTextos(lang)} tela={{ tipo: "pacote", nome: "comunidades" }} />
      </Suspense>
    </div>
  );
}
