// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/transparencia">): Promise<Metadata> {
  return metadadosDaRotaNova("transparencia", params);
}

/** O relatório de transparência (/alumia/transparencia). Frente F8. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/transparencia">) {
  return <PaginaNova nome="transparencia" params={params} />;
}
