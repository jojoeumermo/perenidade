// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (os acertos ficam no aparelho de cada pessoa). Desligada, a página dá 404. */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/questoes">): Promise<Metadata> {
  return metadadosDaRotaNova("questoes", params);
}

/**
 * O banco de questões (/alumia/questoes). Frente 11A. Atrás das flags (lib/rede/rotas-novas.ts, a rota "questoes", com
 * "alumia-estudo"): desligada, 404. A tela é a do registro (components/rede/estudo/questoes/TelaDasQuestoes).
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/questoes">) {
  return <PaginaNova nome="questoes" params={params} />;
}
