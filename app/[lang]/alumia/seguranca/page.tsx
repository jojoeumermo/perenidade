// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/seguranca">): Promise<Metadata> {
  return metadadosDaRotaNova("seguranca", params);
}

/** Segurança pessoal (/alumia/seguranca): modo ato, Fui detido, Estou bem. Frente F6. Atrás das flags (lib/rede/rotas-novas.ts): desligadas, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/seguranca">) {
  return <PaginaNova nome="seguranca" params={params} />;
}
