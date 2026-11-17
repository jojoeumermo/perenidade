// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDosRotulos, type TextosDosRotulos } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDosRotulos(lang: string): TextosDosRotulos | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDosRotulos } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDosRotulos(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
