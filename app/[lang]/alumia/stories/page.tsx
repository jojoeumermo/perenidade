// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/stories">): Promise<Metadata> {
  return metadadosDaRotaNova("stories", params);
}

/** Os stories de 24 h (/alumia/stories). Frente F5. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/stories">) {
  return <PaginaNova nome="stories" params={params} />;
}
