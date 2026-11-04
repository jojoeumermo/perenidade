// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDoPerfil, type TextosDoPerfil } from "@/lib/rede/textos-perfil";

/** Os textos do pacote perfil no idioma da página, carregados só quando a tela abre (um idioma, não seis). `null` enquanto chega. */
export function useTextosDoPerfil(lang: string): TextosDoPerfil | null {
  const [pronto, setPronto] = useState<{ lang: string; textos: TextosDoPerfil } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDoPerfil(lang).then((textos) => vivo && setPronto({ lang, textos }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.textos : null;
}
