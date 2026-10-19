// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lê de novo o que está guardado no aparelho sempre que algo de estudo muda (nesta aba, pelo evento "lucia:estudo",
 * ou em outra, pelo "storage"). Começa com `inicial` no servidor e na hidratação, para não haver diferença de HTML.
 */
export function useGuardado<T>(ler: () => T, inicial: T): [T, () => void] {
  const [valor, setValor] = useState<T>(inicial);
  const lerRef = useRef(ler);
  useEffect(() => {
    lerRef.current = ler;
  });
  useEffect(() => {
    const atualizar = () => setValor(lerRef.current());
    const id = window.setTimeout(atualizar, 0);
    window.addEventListener("lucia:estudo", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("lucia:estudo", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);
  return [valor, () => setValor(lerRef.current())];
}

/** Baixa um texto como arquivo, sem passar por servidor. */
export function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
