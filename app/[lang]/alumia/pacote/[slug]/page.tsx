// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { slugDoPacoteOk } from "@/lib/rede/secoes-perfil";
import { textosDaRede } from "@/lib/rede/textos";

export const dynamicParams = true;

/** Só o rótulo do pacote, lido aqui no servidor (os textos da tela são do cliente: components/rede/perfil/secoes/textos.ts). */
async function rotuloDoPacote(lang: string): Promise<string> {
  const l = ["pt", "en", "es", "fr", "ru", "zh"].includes(lang) ? lang : "pt";
  try {
    return ((await import(`@/i18n/rede/perfil/secoes/${l}.json`)) as { default: { pacote: { rotulo: string } } }).default.pacote.rotulo;
  } catch {
    return ((await import("@/i18n/rede/perfil/secoes/pt.json")) as { default: { pacote: { rotulo: string } } }).default.pacote.rotulo;
  }
}

/** Quem está no pacote depende de quem olha (e de quem aceitou): a página não é indexada e os metadados não dizem ninguém. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/pacote/[slug]">): Promise<Metadata> {
  if (!alumia2Ligada()) return {};
  const { lang } = await loadLang(params);
  return { title: `${await rotuloDoPacote(lang)} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** Um pacote inicial (/alumia/pacote/[slug], onda 12, 12D): quem aceitou entrar nele, "Seguir todas", o link e o QR. Tela do registro "pacote-inicial". */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/pacote/[slug]">) {
  if (!alumia2Ligada()) notFound();
  const { slug } = await params;
  if (!slugDoPacoteOk(slug)) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "pacote-inicial", params: { slug } }} />
      </Suspense>
    </div>
  );
}
