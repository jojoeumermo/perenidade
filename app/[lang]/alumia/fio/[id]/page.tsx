// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";
import { idDaPreviaOk, idOk } from "@/lib/rede/tipos";

export const dynamicParams = true;

/** Só o nome da tela e o da rede; nunca indexada. Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/fio/[id]">): Promise<Metadata> {
  return metadadosDaRotaNova("fio-texto", params);
}

/**
 * O leitor de fios (/alumia/fio/[id]), Prompt 4, item 133: o fio de uma autora como texto corrido. Atrás das flags
 * (lib/rede/rotas-novas.ts, a rota "fio-texto" com "alumia-p4-pontes"): desligadas, 404. O banco confere de novo o interruptor e
 * só junta o que quem lê vê.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/fio/[id]">) {
  const { id } = await params;
  if (!idOk(id) && !idDaPreviaOk(id)) notFound();
  return <PaginaNova nome="fio-texto" params={params} extras={{ id }} />;
}
