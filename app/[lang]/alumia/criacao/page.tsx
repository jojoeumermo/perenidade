// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (depende de quem está vendo). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/criacao">): Promise<Metadata> {
  return metadadosDaRotaNova("criacao-coletiva", params);
}

/**
 * A criação coletiva (/alumia/criacao): rascunho coletivo, margem do acervo, estúdio de cartaz e zine (Prompt 4, itens 33, 34, 36 e
 * 37). Atrás das flags (lib/rede/rotas-novas.ts, a rota "criacao-coletiva" com "alumia-p4-criacao-coletiva"): desligadas, 404. A tela
 * é components/rede/criacao/TelaDaCriacaoColetiva.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/criacao">) {
  return <PaginaNova nome="criacao-coletiva" params={params} />;
}
