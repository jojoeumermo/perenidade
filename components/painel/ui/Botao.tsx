// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { LoaderCircle, type LucideIcon } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cx } from "./cx";
import { Dica } from "./Dica";
import { Kbd } from "./Kbd";

export type VarianteDoBotao = "principal" | "padrao" | "discreto";

export interface PropsDoBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "principal" é o único botão bordô da tela: um por tela, a ação mais importante. */
  variante?: VarianteDoBotao;
  /** Ação que desfaz ou apaga: texto no tom de erro (o fundo nunca muda de cor). */
  perigo?: boolean;
  pequeno?: boolean;
  /** Botão só com ícone: precisa de aria-label. */
  icone?: boolean;
  /** Ícone Lucide antes do texto (ou sozinho, com "icone"). */
  simbolo?: LucideIcon;
  /** Ícone Lucide depois do texto. */
  simboloFim?: LucideIcon;
  /** Mostra o círculo girando e marca aria-busy (o botão fica desligado enquanto isso). */
  carregando?: boolean;
  /** A tecla que faz o mesmo (aparece ao lado do texto). */
  atalho?: string;
  /** Envolve o botão numa Dica (bom para o botão só com ícone). */
  dica?: string;
}

/**
 * O botão do painel (no jeito do shadcn: estilo por classe e token, API pequena, ref encaminhada). Cores e cantos vêm do
 * tema (styles/painel-tema.css); nada de cor nem sombra aqui. Ao clicar, aperta um pouco; ao passar o mouse, não pula.
 */
export const Botao = forwardRef<HTMLButtonElement, PropsDoBotao>(function Botao(
  { variante = "padrao", perigo, pequeno, icone, simbolo: Simbolo, simboloFim: SimboloFim, carregando, atalho, dica, className = "", type = "button", disabled, children, ...resto },
  ref,
) {
  const classes = cx("pn-botao", variante === "principal" && "pn-botao-principal", variante === "discreto" && "pn-botao-discreto", perigo && "pn-botao-perigo", pequeno && "pn-botao-pequeno", icone && "pn-botao-icone", className);
  const botao = (
    <button ref={ref} type={type} className={classes} disabled={disabled || carregando} aria-busy={carregando || undefined} {...resto}>
      {carregando ? <LoaderCircle aria-hidden className="pn-girando" /> : Simbolo && <Simbolo aria-hidden />}
      {children}
      {SimboloFim && <SimboloFim aria-hidden />}
      {atalho && !icone && <Kbd>{atalho}</Kbd>}
    </button>
  );
  return dica ? (
    <Dica texto={dica} atalho={icone ? atalho : undefined}>
      {botao}
    </Dica>
  ) : (
    botao
  );
});
