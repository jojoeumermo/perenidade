// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (depende de quem está vendo). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/trabalhadores">): Promise<Metadata> {
  return metadadosDaRotaNova("trabalhadores", params);
}

/**
 * O Mural dos Trabalhadores da Alumia (/alumia/trabalhadores): os chamados das organizações com selo. Frente 13E. Atrás das flags
 * (lib/rede/rotas-novas.ts, a rota "trabalhadores" com "alumia-org"): desligadas, 404. A tela é a do registro
 * (components/rede/pontes/TelaDosTrabalhadores).
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/trabalhadores">) {
  return <PaginaNova nome="trabalhadores" params={params} />;
}
