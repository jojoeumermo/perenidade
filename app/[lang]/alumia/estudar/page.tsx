// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (só membros logados veem). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/estudar">): Promise<Metadata> {
  return metadadosDaRotaNova("estudar", params);
}

/**
 * Estudar (/alumia/estudar), Prompt 4, Parte G e o ritmo da Parte E: ritmo de estudo (48), baralhos de revisão (70), simulado da
 * turma (69), mentoria entre pares (71), estante de fontes (72), trilha de segurança digital (73), calendário de inscrições (101),
 * mural de editais e bolsas (102), glossário (103) e a correção de referência da redação (68). Atrás das flags (a rota "estudar" com
 * "alumia-p4-descoberta-estudo"): desligadas, 404. A tela é a do registro (components/rede/descoberta-estudo/TelaDeEstudar).
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/estudar">) {
  return <PaginaNova nome="estudar" params={params} />;
}
