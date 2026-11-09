// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/organizacoes">): Promise<Metadata> {
  return metadadosDaRotaNova("organizacoes", params);
}

/** A página para organizações (/alumia/organizacoes), prancha traga-sua-organizacao. Frente F4. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/organizacoes">) {
  return <PaginaNova nome="organizacoes" params={params} />;
}
