// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaRotaNova, PaginaNova } from "@/components/rede/onda5/PaginaNova";

/** Só o nome da tela e o da rede; nunca indexada (depende de quem está vendo). Desligada, nada (a página dá 404). */
export function generateMetadata({ params }: PageProps<"/[lang]/alumia/pontes">): Promise<Metadata> {
  return metadadosDaRotaNova("pontes", params);
}

/**
 * As pontes da organização (/alumia/pontes): os robôs com rótulo e chave e o canal do Telegram. Frente 13E. Atrás das flags
 * (lib/rede/rotas-novas.ts, a rota "pontes" com "alumia-org"): desligadas, 404. A tela é a do registro
 * (components/rede/pontes/TelaDasPontes).
 */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/pontes">) {
  return <PaginaNova nome="pontes" params={params} />;
}
