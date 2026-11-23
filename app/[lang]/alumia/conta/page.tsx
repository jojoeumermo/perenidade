// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (só membros logados veem). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/conta">): Promise<Metadata> {
  return metadadosDaRotaNova("conta", params);
}

/**
 * Conta e convivência (/alumia/conta), Prompt 4, Parte H: os níveis de proteção, as menções, o checkup, o horário de atendimento, as
 * respostas rápidas, o que cuidar em cada comunidade, as mediações, o diário, o modo viagem e a mudança de servidor no Fediverso.
 * Atrás de "alumia-p4-conta" (lib/rede/rotas-novas.ts): desligada, 404. O banco confere de novo o interruptor e a conta em cada chamada.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/conta">) {
  return <PaginaNova nome="conta" params={params} />;
}
