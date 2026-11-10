// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BancaDosAtos } from "@/components/rede/atos/BancaDosAtos";
import { loadLang } from "@/i18n";
import { PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * A banca de conferência dos atos (/alumia/atos/previa): as peças que a F2 pendura nas telas da F1 (faixa PRÓXIMO ATO, cartão do
 * ato, chamado embutido no post, "Atos perto de você" e o tipo "Ato" do compositor), lado a lado com dados de exemplo, para
 * comparar com as pranchas. SÓ existe com NEXT_PUBLIC_ALUMIA_PREVIA=sim e as flags ligadas; em produção, 404.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/atos/previa">) {
  if (!PREVIA_DOS_ATOS || !rotaNovaLigada("atos")) notFound();
  const { lang } = await loadLang(params);
  return <BancaDosAtos lang={lang} />;
}
