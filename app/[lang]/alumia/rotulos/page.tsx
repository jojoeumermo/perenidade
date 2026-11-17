// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (depende de quem está vendo). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/rotulos">): Promise<Metadata> {
  return metadadosDaRotaNova("rotulos", params);
}

/**
 * Os rótulos e as listas de bloqueio assináveis (/alumia/rotulos). Frente 9E. Atrás das flags (lib/rede/rotas-novas.ts, a rota
 * "rotulos" com "alumia-proximas"): desligadas, 404. A tela é a do registro (components/rede/rotulos/TelaDosRotulos).
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/rotulos">) {
  return <PaginaNova nome="rotulos" params={params} />;
}
