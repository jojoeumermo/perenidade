// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaLei, PaginaDaLei } from "@/components/rede/lei/PaginaDaLei";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/ajuda">): Promise<Metadata> {
  return metadadosDaLei("ajuda", params);
}

/** A ajuda da Alumia (/alumia/ajuda): as perguntas que mais chegam. Frente 8B. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/ajuda">) {
  return <PaginaDaLei nome="ajuda" params={params} />;
}
