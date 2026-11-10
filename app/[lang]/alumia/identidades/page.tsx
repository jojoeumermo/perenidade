// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/identidades">): Promise<Metadata> {
  return metadadosDaRotaNova("identidades", params);
}

/** As identidades da conta (/alumia/identidades). Frente F6. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/identidades">) {
  return <PaginaNova nome="identidades" params={params} />;
}
