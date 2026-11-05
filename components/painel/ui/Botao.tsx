// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ButtonHTMLAttributes } from "react";

export type VarianteDoBotao = "principal" | "padrao" | "discreto";

export interface PropsDoBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "principal" é o único botão bordô da tela: um por tela, a ação mais importante. */
  variante?: VarianteDoBotao;
  /** Ação que desfaz ou apaga: texto no tom de erro (o fundo nunca muda de cor). */
  perigo?: boolean;
  pequeno?: boolean;
  /** Botão só com ícone: precisa de aria-label. */
  icone?: boolean;
}

/** O botão do painel. Cores e cantos vêm do tema (styles/painel-tema.css); nada de cor nem sombra aqui. */
export function Botao({ variante = "padrao", perigo, pequeno, icone, className = "", type = "button", ...resto }: PropsDoBotao) {
  const classes = ["pn-botao", variante === "principal" && "pn-botao-principal", variante === "discreto" && "pn-botao-discreto", perigo && "pn-botao-perigo", pequeno && "pn-botao-pequeno", icone && "pn-botao-icone", className].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...resto} />;
}
