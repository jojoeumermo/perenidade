// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import * as Tabs from "@radix-ui/react-tabs";
import * as m from "motion/react-m";
import { type ReactNode, useId } from "react";
import { mola } from "./movimento";
import { Contador } from "./Selo";

export interface OpcaoDeAba<T extends string> {
  id: T;
  nome: string;
  /** Quantas coisas esperam nesta aba (some se for zero). */
  conta?: number;
}

/**
 * Abas com setas do teclado e papéis de leitor de tela (Radix só como estrutura). O sublinhado bordô desliza de uma aba a
 * outra (com mola; parado com "menos movimento"). O conteúdo vem em "painel": uma função que recebe o id da aba de agora,
 * para montar só o que está à vista.
 */
export function Abas<T extends string>({ opcoes, valor, aoMudar, rotulo, painel }: { opcoes: OpcaoDeAba<T>[]; valor: T; aoMudar: (id: T) => void; rotulo: string; painel?: (id: T) => ReactNode }) {
  const grupo = useId();
  return (
    <Tabs.Root value={valor} onValueChange={(v) => aoMudar(v as T)}>
      <Tabs.List aria-label={rotulo} className="pn-abas">
        {opcoes.map((o) => (
          <Tabs.Trigger key={o.id} value={o.id} className="pn-aba">
            {o.nome}
            <Contador n={o.conta} />
            {o.id === valor && <m.span aria-hidden layoutId={`pn-aba-${grupo}`} className="pn-aba-indicador" transition={mola.rapida} />}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {painel && (
        <Tabs.Content value={valor} style={{ paddingTop: "1rem" }}>
          {painel(valor)}
        </Tabs.Content>
      )}
    </Tabs.Root>
  );
}
