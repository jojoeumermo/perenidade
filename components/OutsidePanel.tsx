// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

/** O painel da equipe é um ambiente à parte: lá dentro não aparecem cabeçalho, rodapé, rádio nem menu do site. */
export const inPanel = (pathname: string | null) => /^\/[a-z]{2}\/painel(\/|$)/.test(pathname ?? "");

/**
 * A área infantil (menos a página para os adultos) também é à parte: sem os links do site, que levariam a criança para
 * fora sem passar pelo portão de adulto. O botão de acessibilidade continua (veja "mostrarNasCriancas").
 */
export const naAreaInfantil = (pathname: string | null) => /^\/[a-z]{2}\/criancas(\/(?!adultos)|$)/.test(pathname ?? "");

/** Aberta dentro de outra página do próprio site (um laboratório na caixa da aula): sem cabeçalho, rodapé nem rádio. */
const embutida = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export function OutsidePanel({ children, mostrarNasCriancas = false }: { children: React.ReactNode; mostrarNasCriancas?: boolean }) {
  const pathname = usePathname();
  const dentroDeOutra = useSyncExternalStore(() => () => undefined, embutida, () => false);
  return inPanel(pathname) || dentroDeOutra || (naAreaInfantil(pathname) && !mostrarNasCriancas) ? null : children;
}
