// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { registrarErroDaTela } from "@/lib/rede/beta/registrar";

/**
 * Escuta os erros que escapam das telas da Alumia (erro solto e promessa recusada sem tratamento) e manda só o resumo limpo para o
 * registro de erros (lib/rede/beta/registrar.ts): sem conta, sem endereço de rede, sem conteúdo. Não desenha nada. Os erros que a
 * tela de erro da Alumia pega (app/[lang]/alumia/error.tsx) vão por lá.
 */
export function OuvirErros() {
  useEffect(() => {
    const solto = (e: ErrorEvent) => void registrarErroDaTela(e.error ?? e.message);
    const recusada = (e: PromiseRejectionEvent) => void registrarErroDaTela(e.reason);
    window.addEventListener("error", solto);
    window.addEventListener("unhandledrejection", recusada);
    return () => {
      window.removeEventListener("error", solto);
      window.removeEventListener("unhandledrejection", recusada);
    };
  }, []);
  return null;
}
