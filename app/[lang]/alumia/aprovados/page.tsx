// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";
import { carregarTextosDasConquistas } from "@/components/rede/estudo/conquistas/textos";

/** Só para conta aprovada (a porta do banco): não é indexada e não leva nome de ninguém nos metadados. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/aprovados">): Promise<Metadata> {
  if (!alumia2Ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDasConquistas(lang);
  return { title: `${t.mural.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** O mural de aprovados (/alumia/aprovados, onda 11): quem passou e quis contar. A tela é a do registro ("aprovados"). */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/aprovados">) {
  if (!alumia2Ligada()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "aprovados" }} />
      </Suspense>
    </div>
  );
}
