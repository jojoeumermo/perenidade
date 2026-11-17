// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { carregarTextosDosConvites } from "@/lib/rede/convites/textos";
import { textosDaRede } from "@/lib/rede/textos";

const ligada = () => ligado("alumia-convites");

export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/convite">): Promise<Metadata> {
  if (!ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDosConvites(lang);
  return { title: `${t.meus.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/**
 * Os convites de quem já está dentro (/alumia/convite): atrás da entrada (conta aprovada e segundo fator) e da flag. A tela é a do
 * registro (nome "convite", components/rede/convites/TelaDosConvites.tsx), dentro da casca da Alumia.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/convite">) {
  if (!ligada()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "convite" }} />
      </Suspense>
    </div>
  );
}
