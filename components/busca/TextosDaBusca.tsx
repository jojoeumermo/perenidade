// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { TextosDaBusca } from "@/lib/escola/textos-da-busca";

// Os textos da busca viva, do "Por onde andei", dos três passos e do modo seguro (i18n/escola/busca), só no idioma da
// página. O layout escolhe no servidor e passa por aqui, para os componentes de cliente espalhados pelo site (a busca do
// alto, o Meu estudo, o Praticar, o caderno) não precisarem de props novas nem baixarem os 6 dicionários.

interface Valor {
  textos: TextosDaBusca;
  /** A primeira aula de content/comecar.json ("trilha/aula"), para o passo 2 dos três passos. */
  primeiraAula: string | null;
}

const Contexto = createContext<Valor | null>(null);

export function TextosDaBuscaProvider({ textos, primeiraAula, children }: Valor & { children: ReactNode }) {
  return <Contexto.Provider value={{ textos, primeiraAula }}>{children}</Contexto.Provider>;
}

/** Os textos da busca viva, ou null fora do layout do site (aí o componente não aparece). */
export function useTextosDaBusca(): Valor | null {
  return useContext(Contexto);
}
