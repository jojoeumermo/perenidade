// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { celularNoNavegador, isApp } from "@/lib/prefs";

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
    if (celularNoNavegador()) raiz.setAttribute("data-app", "");
    else raiz.removeAttribute("data-app");
  }, [caminho]);
  return null;
}
