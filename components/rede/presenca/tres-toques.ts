// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 9: três toques seguidos na marca da Alumia (o lampião com o nome, no alto da casca) acionam o Sair rápido. A marca
// continua um link para o Início: o primeiro e o segundo toque levam ao Início como sempre; o terceiro, dentro da janela de 1,2 s
// (lib/rede/saida.ts, tresToques), não navega e faz o Sair rápido. Atrás de "alumia-p4-presenca-print": desligado, a função devolve
// undefined e a marca fica como sempre. Nada vai ao servidor: os instantes dos toques moram só na memória da aba.
import type { MouseEvent } from "react";
import { presencaPrintLigada } from "@/lib/rede/cliente-presenca-print";
import { tresToques } from "@/lib/rede/saida";

const ligadoAgora = presencaPrintLigada();
/** Os instantes dos últimos toques. Fora do componente de propósito: cada tela monta a casca de novo, e o toque que levou ao Início
 * precisa contar junto com os seguintes. */
let instantes: number[] = [];

/** O onClick da marca (undefined com o grupo desligado). `sair` é o Sair rápido da casca. */
export function tresToquesNaMarca(sair: () => void): ((e: MouseEvent<HTMLElement>) => void) | undefined {
  if (!ligadoAgora) return undefined;
  return (e) => {
    const r = tresToques(instantes, performance.now());
    instantes = r.instantes;
    if (r.sair) {
      e.preventDefault();
      sair();
    }
  };
}
