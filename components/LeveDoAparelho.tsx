// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 5 (E7): o modo leve liga sozinho no site do instituto (aparelho fraco ou economia de dados) e nunca sozinho na Alumia. O
// script inline (lib/prefs-script.ts) decide na primeira pintura; esta peça decide de novo a cada troca de endereço sem recarregar
// (do site para /alumia e de volta, quando a Alumia mora no mesmo endereço do site). Não desenha nada.
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { applyPrefs, readPrefs } from "@/lib/prefs";

export function LeveDoAparelho() {
  const caminho = usePathname();
  useEffect(() => {
    applyPrefs(readPrefs());
  }, [caminho]);
  return null;
}
