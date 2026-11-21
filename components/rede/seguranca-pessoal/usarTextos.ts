// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDaSegurancaPessoal, type TextosDaSegurancaPessoal } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDaSegurancaPessoal(lang: string): TextosDaSegurancaPessoal | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDaSegurancaPessoal } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaSegurancaPessoal(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
