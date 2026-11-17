// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos dos convites no navegador (lib/rede/convites/textos.ts): o idioma da página chega por import dinâmico.
import { useEffect, useState } from "react";
import { carregarTextosDosConvites, type TextosDosConvites } from "@/lib/rede/convites/textos";

export { dataCurta, preencher, type TextosDosConvites } from "@/lib/rede/convites/textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDosConvites(lang: string): TextosDosConvites | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDosConvites } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDosConvites(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
