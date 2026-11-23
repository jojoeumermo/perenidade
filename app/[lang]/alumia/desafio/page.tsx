// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada. Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/desafio">): Promise<Metadata> {
  return metadadosDaRotaNova("desafio", params);
}

/**
 * O desafio do dia (/alumia/desafio), Prompt 4, item 121: cinco perguntas do glossário, as mesmas para todo mundo no dia; a
 * pontuação fica só no aparelho, sem sequência nem ranking. Atrás de "alumia-p4-memoria-e-luta": desligada, 404.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/desafio">) {
  return <PaginaNova nome="desafio" params={params} />;
}
