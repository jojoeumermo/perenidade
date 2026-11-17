// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { carregarTextosDaB1 } from "@/lib/rede/textos-b1";
import { textosDaRede } from "@/lib/rede/textos";

/** A tela é de cada pessoa: sem indexação e sem nada dela nos metadados. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!alumia2Ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaB1(lang);
  return { title: `${t.temas.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** A linha dos #temas (/alumia/temas): os posts dos temas que a pessoa segue, do mais novo ao mais antigo. Só existe na Alumia nova ("rede-v2" + "alumia-2"); fora dela, 404. */
export default async function Pagina({ params }: { params: Promise<{ lang: string }> }) {
  if (!alumia2Ligada()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "temas" }} />
      </Suspense>
    </div>
  );
}
