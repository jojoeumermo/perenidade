// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { carimbarCaminho } from "@/lib/escola/passaporte";

/**
 * O passaporte do campus (E4-09, R1-73): a cada página aberta, carimba a primeira visita ao prédio dela, só neste
 * aparelho ("lucia:escola:passaporte"). Com o modo seguro ligado, não grava. Não desenha nada e não manda nada para o
 * servidor. Montado uma vez no layout, só com a Escola ligada.
 */
export function RegistroDoPassaporte() {
  const caminho = usePathname();
  useEffect(() => {
    if (caminho) carimbarCaminho(caminho);
  }, [caminho]);
  return null;
}
