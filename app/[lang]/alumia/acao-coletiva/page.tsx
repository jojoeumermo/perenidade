// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (só membros logados veem). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/acao-coletiva">): Promise<Metadata> {
  return metadadosDaRotaNova("acao-coletiva", params);
}

/**
 * A ação coletiva (/alumia/acao-coletiva), Prompt 4, Parte F (itens 89 a 100 e 122 a 126). Atrás das flags (lib/rede/rotas-novas.ts,
 * a rota "acao-coletiva" com "alumia-p4-coletiva"): desligadas, 404. A tela é a do registro (components/rede/coletiva/TelaDaColetiva);
 * o banco confere de novo o interruptor, a conta, a comunidade e a organização em cada chamada.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/acao-coletiva">) {
  return <PaginaNova nome="acao-coletiva" params={params} />;
}
