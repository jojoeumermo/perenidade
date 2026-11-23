// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (só membros logados veem). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/organizar">): Promise<Metadata> {
  return metadadosDaRotaNova("organizar", params);
}

/**
 * Organizar (/alumia/organizar), Prompt 4, itens 52 a 67 e 122: o quadro, as reuniões, a enquete de horário, o consenso, o
 * orçamento, a meta e o inventário da organização; o mural, o banco de tempo e os pontos de apoio da comunidade; o termômetro do
 * território; a rota do ato; o apoio direto e a ata assistida. Atrás de "alumia-p4-organizacao" (lib/rede/rotas-novas.ts):
 * desligada, 404. O banco confere de novo o interruptor e a conta em cada chamada.
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/organizar">) {
  return <PaginaNova nome="organizar" params={params} />;
}
