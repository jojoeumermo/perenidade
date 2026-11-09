// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConteudoParaOrganizacoes } from "@/components/rede/org/ParaOrganizacoes";
import { metadadosDaRotaNova } from "@/components/rede/onda5/PaginaNova";
import { loadLang } from "@/i18n";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { carregarTextosDaOrg } from "@/lib/rede/textos-org";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/organizacoes">): Promise<Metadata> {
  return metadadosDaRotaNova("organizacoes", params);
}

/**
 * "Traga sua organização" (/alumia/organizacoes), prancha traga-sua-organizacao. Frente F4. Página pública, igual para todo mundo
 * (sai pronta do servidor, sem casca, como na prancha). Atrás das flags "rede-v2" + "alumia-2" + "alumia-org": desligadas, 404.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/organizacoes">) {
  if (!rotaNovaLigada("organizacoes")) notFound();
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaOrg(lang);
  return <ConteudoParaOrganizacoes t={t} lang={lang} />;
}
