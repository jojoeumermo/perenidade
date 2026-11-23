// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (depende de quem está vendo). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/seguranca-pessoal">): Promise<Metadata> {
  return metadadosDaRotaNova("seguranca-pessoal", params);
}

/**
 * A segurança pessoal (/alumia/seguranca-pessoal): registro de abuso, plantão jurídico e interruptor de sumiço (Prompt 4, itens 10
 * a 12). Atrás das flags (lib/rede/rotas-novas.ts, a rota "seguranca-pessoal" com "alumia-p4-seguranca-pessoal"): desligadas, 404.
 * A tela é a do registro (components/rede/seguranca-pessoal/TelaDaSegurancaPessoal).
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/seguranca-pessoal">) {
  return <PaginaNova nome="seguranca-pessoal" params={params} />;
}
