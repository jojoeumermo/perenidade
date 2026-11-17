// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaLei, PaginaDaLei } from "@/components/rede/lei/PaginaDaLei";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/termos">): Promise<Metadata> {
  return metadadosDaLei("termos", params);
}

/** Os termos de uso da Alumia (/alumia/termos), com a versão no alto e o aceite. Frente 8B. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/termos">) {
  return <PaginaDaLei nome="termos" params={params} />;
}
