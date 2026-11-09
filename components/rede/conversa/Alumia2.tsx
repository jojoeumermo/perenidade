// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createContext, useContext } from "react";

// A decisão do servidor ("rede-v2" + "alumia-2", a mesma alumia2Ligada() do layout) chega às telas por contexto. Assim o primeiro
// desenho no navegador já é o certo: nada de mostrar a tela de hoje e trocar pela nova depois de hidratar (piscar e pedir os dados
// duas vezes). Sem o provedor (flag desligada), vale false e a rede de hoje não muda.
const Contexto = createContext(false);

export function ComAlumia2({ children }: { children: React.ReactNode }) {
  return <Contexto.Provider value>{children}</Contexto.Provider>;
}

/** A Alumia nova está ligada nesta página? Só o layout com as duas flags põe o provedor. */
export function useAlumia2(): boolean {
  return useContext(Contexto);
}
