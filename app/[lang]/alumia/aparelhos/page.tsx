// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/aparelhos">): Promise<Metadata> {
  return metadadosDaRotaNova("aparelhos", params);
}

/** Os aparelhos conectados (/alumia/aparelhos), sem endereço de rede. Frente F6. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/aparelhos">) {
  return <PaginaNova nome="aparelhos" params={params} />;
}
