// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/leve">): Promise<Metadata> {
  return metadadosDaRotaNova("leve", params);
}

/** A versão leve, só texto (/alumia/leve). Frente F9. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/leve">) {
  return <PaginaNova nome="leve" params={params} />;
}
