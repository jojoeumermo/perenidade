// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { recarregarSePedacoPerdido } from "@/lib/pedaco-perdido";

/**
 * Ouve, em todo o site, o erro de "pedaço não encontrado" que aparece depois de publicar uma versão nova (o import dinâmico
 * que falha fora de uma tela de erro) e recarrega a página UMA vez (lib/pedaco-perdido.ts). Os rascunhos do Escrever ficam no
 * aparelho, e a página volta no mesmo endereço. Não desenha nada.
 */
export function RecarregarPorPedaco() {
  useEffect(() => {
    const noErro = (e: ErrorEvent) => {
      recarregarSePedacoPerdido(e.error ?? e.message);
    };
    const naPromessa = (e: PromiseRejectionEvent) => {
      recarregarSePedacoPerdido(e.reason);
    };
    window.addEventListener("error", noErro);
    window.addEventListener("unhandledrejection", naPromessa);
    return () => {
      window.removeEventListener("error", noErro);
      window.removeEventListener("unhandledrejection", naPromessa);
    };
  }, []);
  return null;
}
