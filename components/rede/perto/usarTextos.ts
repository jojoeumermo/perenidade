// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDoPerto, type TextosDoPerto } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDoPerto(lang: string): TextosDoPerto | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDoPerto } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDoPerto(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
