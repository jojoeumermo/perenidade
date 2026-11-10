// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede, tituloDaTela } from "@/lib/rede/textos";
import { ligado } from "@/lib/recursos";

// A tela depende de quem a abre: nada é gerado de antemão.
export const dynamicParams = true;

/** Só a marca e `noindex`: nenhuma informação de perfil vai para o título ou a prévia. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: tituloDaTela(lang, "editarPerfil"), robots: { index: false, follow: false } };
}

/** Editar o perfil da Rede (/alumia/editar-perfil): @nome, rosto, capa, bio, quem acha, estudando agora, selos. Com "rede-v2" desligado a rota não existe (404). */
export default async function Pagina({ params }: { params: Promise<{ lang: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "editar-perfil" }} />
      </Suspense>
    </div>
  );
}
