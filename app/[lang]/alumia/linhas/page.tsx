// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaLinha, PaginaDaLinha } from "@/components/rede/linha/PaginaDaLinha";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/linhas">): Promise<Metadata> {
  return metadadosDaLinha("linhas", params);
}

/** "Minhas linhas" (/alumia/linhas): as linhas que a pessoa monta com filtro aberto, os #temas seguidos e os assuntos em alta. Atrás do interruptor "alumia-linha-aberta": desligado, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/linhas">) {
  return <PaginaDaLinha tela="linhas" params={params} />;
}
