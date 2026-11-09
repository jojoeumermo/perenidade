// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/calendario">): Promise<Metadata> {
  return metadadosDaRotaNova("calendario", params);
}

/** O calendário de comunidade e núcleo (/alumia/calendario). Frente F2. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/calendario">) {
  return <PaginaNova nome="calendario" params={params} />;
}
