// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDaLei, type TextosDaLei } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDaLei(lang: string): TextosDaLei | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDaLei } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaLei(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
