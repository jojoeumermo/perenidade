// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDosCargos, type TextosDosCargos } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDosCargos(lang: string): TextosDosCargos | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDosCargos } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDosCargos(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
