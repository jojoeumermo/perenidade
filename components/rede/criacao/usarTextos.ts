// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDaCriacao, type TextosDaCriacao } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDaCriacao(lang: string): TextosDaCriacao | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDaCriacao } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaCriacao(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
