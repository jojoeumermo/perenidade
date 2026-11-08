// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";

// Lê o modo discreto da casca da Escola (components/escola/casca/ModoDiscreto.tsx, mesma chave e mesmo aviso): enquanto
// ligado, os links das telas da Formação trocam a página em vez de empilhar no histórico (como os da coluna e da barra).
// Só lê; quem liga e desliga é a casca.

const CHAVE = "lucia-escola-discreto";
const EVENTO = "lucia:escola-discreto";

function ler(): boolean {
  try {
    return sessionStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
}

export const useDiscreto = (): boolean => useSyncExternalStore(assinar, ler, () => true);
