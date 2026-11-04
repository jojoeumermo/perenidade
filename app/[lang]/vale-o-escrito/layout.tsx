// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ligado } from "@/lib/recursos";

/**
 * A moldura de todas as páginas do Vale o Escrito (/vale-o-escrito e abaixo). Desligado (recurso "vale-o-escrito", que
 * só liga pelo nome), nenhuma página daqui existe: a rota responde 404, como a Escola. Este layout NÃO lê disco e não
 * importa lib/vale-o-escrito/dados.ts: quem lê é a página, para o layout raiz continuar leve.
 * O visual neon e pesado (D3, MapLibre) é do pacote "visual": carrega só na página do observatório, sob demanda.
 */
export default function ValeOEscritoLayout({ children }: { children: ReactNode }) {
  if (!ligado("vale-o-escrito")) notFound();
  return <div data-vale-o-escrito="">{children}</div>;
}
