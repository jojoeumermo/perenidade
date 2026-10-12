// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";

/** O painel da equipe é um ambiente à parte: lá dentro não aparecem cabeçalho, rodapé, rádio nem menu do site. */
export const inPanel = (pathname: string | null) => /^\/[a-z]{2}\/painel(\/|$)/.test(pathname ?? "");

export function OutsidePanel({ children }: { children: React.ReactNode }) {
  return inPanel(usePathname()) ? null : children;
}
