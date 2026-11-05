// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";
import { Kbd } from "./Kbd";

/** O provedor das dicas (atraso de 300 ms). A casca monta um na raiz; cada Dica também se vira sem ele. */
function Provedor({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
      {children}
    </Tooltip.Provider>
  );
}

/**
 * A dica de um botão (Radix Tooltip): aparece ao passar o mouse e com o foco do teclado. Nunca guarda informação que só
 * existe ali: o botão já tem nome próprio (texto ou aria-label). "children" é um elemento focável só.
 */
export function Dica({ texto, atalho, lado = "top", children }: { texto: string; atalho?: string; lado?: "top" | "right" | "bottom" | "left"; children: ReactElement }) {
  return (
    <Provedor>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side={lado} sideOffset={6} collisionPadding={8} className="pn-dica pn-portal">
            <span>{texto}</span>
            {atalho && <Kbd>{atalho}</Kbd>}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Provedor>
  );
}

Dica.Provider = Provedor;
