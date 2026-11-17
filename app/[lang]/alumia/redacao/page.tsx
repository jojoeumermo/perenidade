// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (depende de quem está vendo). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/redacao">): Promise<Metadata> {
  return metadadosDaRotaNova("redacao", params);
}

/**
 * A roda de redação entre pares (/alumia/redacao). Frente 11D. Atrás das flags (lib/rede/rotas-novas.ts, a rota "redacao"): sem a
 * rota lá, ou desligada, 404. A tela é a do registro (components/rede/estudo/redacao/TelaDaRedacao).
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/redacao">) {
  return <PaginaNova nome="redacao" params={params} />;
}
