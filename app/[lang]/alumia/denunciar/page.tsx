// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaLei, PaginaDaLei } from "@/components/rede/lei/PaginaDaLei";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/denunciar">): Promise<Metadata> {
  return metadadosDaLei("denunciar", params);
}

/** Denunciar na Alumia (/alumia/denunciar): a página de denúncia da própria Alumia, que abre sem conta (P5, A5). */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/denunciar">) {
  return <PaginaDaLei nome="denunciar" params={params} />;
}
