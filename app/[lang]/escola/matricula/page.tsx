// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { EmConstrucao, metaEmConstrucao } from "@/components/escola/EmConstrucao";

// Página provisória da Escola (E4-01). O pacote dono (lib/escola/rotas.ts) substitui este arquivo inteiro.
export async function generateMetadata({ params }: PageProps<"/[lang]/escola/matricula">): Promise<Metadata> {
  return metaEmConstrucao(params, "matricula");
}

export default async function Page({ params }: PageProps<"/[lang]/escola/matricula">) {
  return <EmConstrucao params={params} chave="matricula" />;
}
