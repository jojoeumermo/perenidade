// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (só membros logados veem). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/memoria-da-luta">): Promise<Metadata> {
  return metadadosDaRotaNova("memoria-da-luta", params);
}

/**
 * A memória da luta (/alumia/memoria-da-luta), Prompt 4, itens 44, 115, 116 e 119: vitórias, campanhas, arquivo vivo e podcasts.
 * Atrás das flags (lib/rede/rotas-novas.ts, a rota "memoria-da-luta" com "alumia-p4-memoria-e-luta"): desligadas, 404. A tela é a
 * do registro (components/rede/memoria/TelaDaMemoria); o banco confere de novo o interruptor e a conta em cada chamada.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/memoria-da-luta">) {
  return <PaginaNova nome="memoria-da-luta" params={params} />;
}
