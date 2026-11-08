// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound } from "next/navigation";
import { ligado } from "@/lib/recursos";

/**
 * F7 da Escola (prancha Mapa): esta seção saiu da Escola (vida) e voltou ao site aberto, sem porta e sem pedir conta. Continua
 * presa ao recurso "escola" (lib/recursos.ts), como era dentro da Escola: desligado, a página não existe, e nada que a
 * coordenação ainda não liberou abre em produção por causa da mudança de endereço.
 */
export default function Layout({ children }: LayoutProps<"/[lang]/vida">) {
  if (!ligado("escola")) notFound();
  return children;
}
