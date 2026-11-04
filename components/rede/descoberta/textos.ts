// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDescoberta, type TextosDaDescoberta } from "@/lib/rede/textos-descoberta";

/** Os textos do pacote descoberta, de UM idioma, carregados quando a tela abre (nulo enquanto não chegam: mostre o esqueleto). */
export function useTextosDescoberta(lang: string): TextosDaDescoberta | null {
  const [pronto, setPronto] = useState<{ lang: string; textos: TextosDaDescoberta } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDescoberta(lang)
      .then((textos) => vivo && setPronto({ lang, textos }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.textos : null;
}
