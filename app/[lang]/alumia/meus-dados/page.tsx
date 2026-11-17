// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { carregarTextosDeMeusDados } from "@/lib/rede/meusdados/textos";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";

// Abre com a Alumia nova, como as páginas da lei (exportar e apagar os próprios dados é direito da pessoa, LGPD art. 18).
const ligada = (): boolean => alumia2Ligada();

/** A página é de cada pessoa: não é indexada e não leva nada da conta nos metadados. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/meus-dados">): Promise<Metadata> {
  if (!ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDeMeusDados(lang);
  return { title: `${t.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** Meus dados (/alumia/meus-dados): baixar uma cópia e apagar a conta. A tela é a do registro (nome "meus-dados"). */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/meus-dados">) {
  if (!ligada()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "meus-dados" }} />
      </Suspense>
    </div>
  );
}
