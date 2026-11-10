// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";
import { idDaPreviaOk, idOk } from "@/lib/rede/tipos";

export const dynamicParams = true;

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/ato/[id]">): Promise<Metadata> {
  return metadadosDaRotaNova("ato", params);
}

/** A página de um ato (/alumia/ato/[id]), prancha celular-modo-atos. Frente F2. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/ato/[id]">) {
  const { id } = await params;
  if (!idOk(id) && !idDaPreviaOk(id)) notFound();
  return <PaginaNova nome="ato" params={params} extras={{ id }} />;
}
