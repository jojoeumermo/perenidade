// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaLei, PaginaDaLei } from "@/components/rede/lei/PaginaDaLei";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/privacidade">): Promise<Metadata> {
  return metadadosDaLei("privacidade", params);
}

/** A política de privacidade da Alumia (/alumia/privacidade). Frente 8B. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/privacidade">) {
  return <PaginaDaLei nome="privacidade" params={params} />;
}
