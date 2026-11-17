// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaLei, PaginaDaLei } from "@/components/rede/lei/PaginaDaLei";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/regras">): Promise<Metadata> {
  return metadadosDaLei("regras", params);
}

/** As regras da Alumia (/alumia/regras): regras, prazos, o caminho do recurso, menores e a denúncia de conteúdo ilegal. Frente 8B. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/regras">) {
  return <PaginaDaLei nome="regras" params={params} />;
}
