// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (só membros logados veem). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/descobrir">): Promise<Metadata> {
  return metadadosDaRotaNova("descobrir", params);
}

/**
 * Descobrir (/alumia/descobrir), Prompt 4, Parte E: assuntos em movimento (45), "Você está em dia" (46), #temas do Fediverso de
 * servidores aprovados (49), RSS e Atom por comunidade e por #tema (50) e linhas compartilháveis (51). Atrás das flags
 * (lib/rede/rotas-novas.ts, a rota "descobrir" com "alumia-p4-descoberta-estudo"): desligadas, 404. A tela é a do registro
 * (components/rede/descoberta-estudo/TelaDeDescobrir); o banco confere de novo o interruptor e a conta em cada chamada.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/descobrir">) {
  return <PaginaNova nome="descobrir" params={params} />;
}
