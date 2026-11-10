// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/atos">): Promise<Metadata> {
  return metadadosDaRotaNova("atos", params);
}

/** Os atos (/alumia/atos): Perto (pela cidade escrita, nunca GPS) e Seguindo. Frente F2. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/atos">) {
  return <PaginaNova nome="atos" params={params} />;
}
