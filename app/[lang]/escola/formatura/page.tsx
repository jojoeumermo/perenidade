// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { EmConstrucao, metaEmConstrucao } from "@/components/escola/EmConstrucao";

// Página provisória da Escola (E4-01). O pacote dono (lib/escola/rotas.ts) substitui este arquivo inteiro.
export async function generateMetadata({ params }: PageProps<"/[lang]/escola/formatura">): Promise<Metadata> {
  return metaEmConstrucao(params, "formatura");
}

export default async function Page({ params }: PageProps<"/[lang]/escola/formatura">) {
  return <EmConstrucao params={params} chave="formatura" />;
}
