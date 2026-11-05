// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import { TraduzirPainel } from "../Idioma";
import { AvisosDoPainel, DialogosDoPainel } from "../ui";

/**
 * As camadas do painel: tudo o que é fixo, vai por portal ou não desenha nada no lugar (a tradução, o tutorial, a paleta,
 * as confirmações, os avisos da Sonner, o quadro de avisos, o termo, o glossário, os atalhos). Ficam DEPOIS da casca, num
 * bloco só: mesmo que uma peça desenhe algo no fluxo (a Sonner desenha um <section>), ela não desloca o menu nem o
 * conteúdo. Foi esse o defeito do grid antigo (docs/PAINEL-REDESENHO.md, seção 1).
 */
export function Camadas({ children }: { children?: ReactNode }) {
  return (
    <div className="pn-camadas">
      <TraduzirPainel />
      {children}
      <DialogosDoPainel />
      <AvisosDoPainel />
    </div>
  );
}
