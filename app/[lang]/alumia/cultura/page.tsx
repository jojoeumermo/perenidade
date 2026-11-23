// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (só membros logados veem). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/cultura">): Promise<Metadata> {
  return metadadosDaRotaNova("cultura", params);
}

/**
 * A cultura (/alumia/cultura), Prompt 4, itens 38 a 42: obra seriada, mural de arte, cineclube, clube de leitura e playlist coletiva.
 * Atrás das flags (lib/rede/rotas-novas.ts, a rota "cultura" com "alumia-p4-cultura"): desligadas, 404. A tela é a do registro
 * (components/rede/cultura/TelaDaCultura); o banco confere de novo o interruptor e a conta em cada chamada.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/cultura">) {
  return <PaginaNova nome="cultura" params={params} />;
}
