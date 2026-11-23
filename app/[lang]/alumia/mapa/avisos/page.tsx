// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (só membros logados veem os avisos). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/mapa/avisos">): Promise<Metadata> {
  return metadadosDaRotaNova("avisos-de-local", params);
}

/**
 * Os avisos de local no estilo do Waze (/alumia/mapa/avisos), Prompt 4, item 4. Atrás das flags (lib/rede/rotas-novas.ts, a rota
 * "avisos-de-local" com "alumia-p4-avisos-de-local"): desligadas, 404. A tela é a do registro
 * (components/rede/mapa/TelaDosAvisosDeLocal); o banco confere de novo o interruptor e a conta em cada chamada.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/mapa/avisos">) {
  return <PaginaNova nome="avisos-de-local" params={params} />;
}
