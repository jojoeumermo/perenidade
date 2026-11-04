// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createContext, useContext, type ReactNode } from "react";
import pt from "@/i18n/rede/consertos/pt.json";

export type TextosDosConsertos = typeof pt;

const Contexto = createContext<TextosDosConsertos>(pt);

/** Entrega os textos do pacote consertos (de um idioma só, vindos do servidor) à Rede de hoje sem passar prop por prop. */
export function ConsertosProvider({ textos, children }: { textos?: TextosDosConsertos; children: ReactNode }) {
  return <Contexto.Provider value={textos ?? pt}>{children}</Contexto.Provider>;
}

export const useConsertos = () => useContext(Contexto);

/** Troca {nome} pelo valor. */
export const preencher = (texto: string, valores: Record<string, string | number>): string =>
  texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
