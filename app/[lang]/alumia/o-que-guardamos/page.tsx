// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/o-que-guardamos">): Promise<Metadata> {
  return metadadosDaRotaNova("o-que-guardamos", params);
}

/** O que a Alumia guarda (/alumia/o-que-guardamos). Frente F6. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/o-que-guardamos">) {
  return <PaginaNova nome="o-que-guardamos" params={params} />;
}
