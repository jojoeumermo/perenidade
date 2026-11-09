// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Ref } from "react";

/** A situação de um ato (a mesma do banco: rede_chamados.situacao, PLANO-ALUMIA §5 F2). */
export type SituacaoDoAto = "confirmado" | "adiado" | "cancelado";

const PADRAO: Record<SituacaoDoAto, string> = { confirmado: "Confirmado", adiado: "Adiado", cancelado: "Cancelado" };

export interface PropsDoCarimbo {
  situacao: SituacaoDoAto;
  /** O texto no idioma da tela (a frente passa o seu; o padrão é o português). */
  texto?: string;
  tamanho?: "p" | "m" | "g";
  ref?: Ref<HTMLSpanElement>;
  className?: string;
}

/**
 * O carimbo do ato (pranchas: CONFIRMADO em vermelho, ADIADO em dourado, CANCELADO em cinza e riscado). A função dele é dizer a
 * situação do ato em uma palavra que não se confunde: por isso o texto é sempre escrito (a cor é só reforço, WCAG 1.4.1) e o
 * cancelado também vem riscado. "Ninguém é pego de surpresa" (Traga sua organização).
 */
export function Carimbo({ situacao, texto, tamanho = "m", ref, className = "" }: PropsDoCarimbo) {
  const escrito = texto ?? PADRAO[situacao];
  return (
    <span ref={ref} data-situacao={situacao} className={`al-carimbo al-cond al-carimbo-${situacao} al-carimbo-${tamanho} ${className}`.trim()}>
      <span className={situacao === "cancelado" ? "al-riscado" : undefined}>{escrito}</span>
    </span>
  );
}
