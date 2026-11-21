// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (depende de quem está vendo). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/perto">): Promise<Metadata> {
  return metadadosDaRotaNova("perto", params);
}

/**
 * O Perto (/alumia/perto): localização compartilhada só cifrada com o círculo de confiança, pedido de ajuda e volta para casa
 * (Prompt 4, itens 2, 7 e 8). Atrás das flags (lib/rede/rotas-novas.ts, a rota "perto" com "alumia-p4-perto"): desligadas, 404.
 * A tela é components/rede/perto/TelaDoPerto.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/perto">) {
  return <PaginaNova nome="perto" params={params} />;
}
