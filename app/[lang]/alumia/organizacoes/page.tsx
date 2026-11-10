// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CascaSeLogado } from "@/components/rede/org/CascaSeLogado";
import { ConteudoParaOrganizacoes } from "@/components/rede/org/ParaOrganizacoes";
import { metadadosDaRotaNova } from "@/components/rede/onda5/PaginaNova";
import { loadLang } from "@/i18n";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaOrg } from "@/lib/rede/textos-org";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/organizacoes">): Promise<Metadata> {
  return metadadosDaRotaNova("organizacoes", params);
}

/**
 * "Traga sua organização" (/alumia/organizacoes), prancha traga-sua-organizacao. Frente F4. Página pública, igual para todo mundo
 * (sai pronta do servidor, sem casca, como na prancha); no navegador, quem tem sessão passa a vê-la dentro da casca. Atrás das flags "rede-v2" + "alumia-2" + "alumia-org": desligadas, 404.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/organizacoes">) {
  if (!rotaNovaLigada("organizacoes")) notFound();
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaOrg(lang);
  return (
    <CascaSeLogado lang={lang} s={textosDaRede(lang)} nome="organizacoes">
      <ConteudoParaOrganizacoes t={t} lang={lang} />
    </CascaSeLogado>
  );
}
