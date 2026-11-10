// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PedirOSelo } from "@/components/rede/org/PedirOSelo";
import { loadLang } from "@/i18n";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { carregarTextosDaOrg } from "@/lib/rede/textos-org";

export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/organizacoes/selo">): Promise<Metadata> {
  if (!rotaNovaLigada("organizacoes")) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaOrg(lang);
  return { title: `${t.pedir.titulo} · ${t.marca.alumia}`, robots: { index: false, follow: false } };
}

/** Pedir o selo de organização verificada (formulário; só logado). Frente F4, flag "alumia-org": desligada, 404. */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/organizacoes/selo">) {
  if (!rotaNovaLigada("organizacoes")) notFound();
  const { lang } = await loadLang(params);
  return <PedirOSelo lang={lang} />;
}
