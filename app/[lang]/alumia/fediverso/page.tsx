// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { ALUMIA_URL, urlDaAlumiaOk } from "@/lib/rede/alumia";
import { textosDaRede } from "@/lib/rede/textos";
import { ligado } from "@/lib/recursos";

/** Sem nada de ninguém nos metadados: a página é a mesma para todo mundo e não é indexada. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: `Fediverso · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

// A federação está ligada no servidor quando há endereço próprio em https e o segredo (lib/rede/fediverso/servidor.ts). Aqui só se
// confere a variável pública e a presença do segredo, sem importar o módulo do servidor (que traz node:crypto e node:https).
const federacaoNoServidor = () => /^https:\/\//.test(ALUMIA_URL) && urlDaAlumiaOk(ALUMIA_URL) && (process.env.ALUMIA_FEDIVERSO_SEGREDO ?? "").length >= 32;

/** A Alumia no Fediverso (/alumia/fediverso): ligar a federação do perfil, achar e seguir gente de fora. Com "rede-v2" desligado, 404. */
export default async function Pagina({ params }: { params: Promise<{ lang: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  const dominio = urlDaAlumiaOk(ALUMIA_URL) ? new URL(ALUMIA_URL).host : "";
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "fediverso", params: { federacao: federacaoNoServidor() ? "1" : "0", dominio } }} />
      </Suspense>
    </div>
  );
}
