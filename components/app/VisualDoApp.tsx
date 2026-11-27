// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { celularNoNavegador, isApp, naAlumia } from "@/lib/prefs";

/**
 * No celular em navegador comum o <html data-app> vale em todas as páginas, MENOS na Alumia (o interior dela não muda). O
 * script inline (lib/prefs-script.ts) decide na primeira pintura; este componente refaz a conta a cada troca de página sem
 * recarregar (entrar na Alumia tira o visual do app; voltar para o instituto devolve). No app instalado nada muda.
 */
export function VisualDoApp() {
  const caminho = usePathname();
  useLayoutEffect(() => {
    if (isApp()) return;
    const raiz = document.documentElement;
    const refazer = () => {
      // Liga onde vale; desliga na Alumia e quando o aparelho deixa de ser um celular (janela de computador, tela grande).
      if (naAlumia() || !celularNoNavegador()) raiz.removeAttribute("data-app");
      else raiz.setAttribute("data-app", "");
    };
    refazer();
    window.addEventListener("resize", refazer);
    return () => window.removeEventListener("resize", refazer);
  }, [caminho]);
  return null;
}
