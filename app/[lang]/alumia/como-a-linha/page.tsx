// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { metadadosDaLinha, PaginaDaLinha } from "@/components/rede/linha/PaginaDaLinha";

export function generateMetadata({ params }: PageProps<"/[lang]/alumia/como-a-linha">): Promise<Metadata> {
  return metadadosDaLinha("como-a-linha", params);
}

/** "Como a linha é montada" (/alumia/como-a-linha): a regra da linha por extenso, com os números que o banco usa. Atrás do interruptor "alumia-linha-aberta": desligado, 404. */
export default function Pagina({ params }: PageProps<"/[lang]/alumia/como-a-linha">) {
  return <PaginaDaLinha tela="como-a-linha" params={params} />;
}
