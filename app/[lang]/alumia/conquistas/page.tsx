// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";
import { carregarTextosDasConquistas } from "@/components/rede/estudo/conquistas/textos";

/** A página é de cada pessoa: não é indexada e não leva nada da conta nos metadados. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/conquistas">): Promise<Metadata> {
  if (!alumia2Ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDasConquistas(lang);
  return { title: `${t.tela.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** As minhas conquistas (/alumia/conquistas, onda 11): medalhas, trilhas terminadas e a faixa de ajuda. A tela é a do registro ("conquistas"). */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/conquistas">) {
  if (!alumia2Ligada()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "conquistas" }} />
      </Suspense>
    </div>
  );
}
