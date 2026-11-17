// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { carregarTextosDoModoAto } from "@/lib/rede/modoato/textos";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";

// Abre com a Alumia nova e o modo ato ("rede-v2" + "alumia-2" + "alumia-modo-ato"); desligado, 404.
const ligada = (): boolean => alumia2Ligada() && ligado("alumia-modo-ato");

/** A página é de cada pessoa: não é indexada e não leva nada da conta nos metadados. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/modo-ato">): Promise<Metadata> {
  if (!ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDoModoAto(lang);
  return { title: `${t.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** O modo ato (/alumia/modo-ato). Frente 9C. A tela é a do registro (nome "modo-ato", components/rede/modoato/TelaDoModoAto.tsx). */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/modo-ato">) {
  if (!ligada()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "modo-ato" }} />
      </Suspense>
    </div>
  );
}
