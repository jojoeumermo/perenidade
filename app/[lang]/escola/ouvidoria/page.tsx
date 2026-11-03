// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { EmConstrucao, metaEmConstrucao } from "@/components/escola/EmConstrucao";

// Página provisória da Escola (E4-01). O pacote dono (lib/escola/rotas.ts) substitui este arquivo inteiro.
export async function generateMetadata({ params }: PageProps<"/[lang]/escola/ouvidoria">): Promise<Metadata> {
  return metaEmConstrucao(params, "ouvidoria");
}

export default async function Page({ params }: PageProps<"/[lang]/escola/ouvidoria">) {
  return <EmConstrucao params={params} chave="ouvidoria" />;
}
