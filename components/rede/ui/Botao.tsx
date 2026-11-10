// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, Ref } from "react";
import Link from "@/components/Link";

/**
 * As variantes das pranchas:
 *  - primario: vermelho cheio ("Publicar", "Escrever", "Pedir o selo", "Eu vou");
 *  - claro: papel cheio com texto noite ("Você vai" já confirmado, "Entrar na sala", aba Perto ligada);
 *  - contorno: só a borda ("Conversa · 48", "Ver um perfil de exemplo", "Sair rápido");
 *  - dourado: o destaque do "próximo ato";
 *  - fantasma: só o texto (ações do cartão: Responder, Repostar, Acender, Salvar).
 */
export type VarianteDoBotao = "primario" | "claro" | "contorno" | "dourado" | "fantasma";
export type TamanhoDoBotao = "p" | "m" | "g";

/** As classes de um botão (servem para <button> e para link com cara de botão). */
export function classesDoBotao(variante: VarianteDoBotao = "primario", tamanho: TamanhoDoBotao = "m", extra = ""): string {
  return `al-botao al-botao-${variante} al-botao-${tamanho} ${extra}`.trim();
}

interface Comum {
  variante?: VarianteDoBotao;
  tamanho?: TamanhoDoBotao;
  /** Um ícone (SVG) antes do texto; fica escondido do leitor de tela. */
  icone?: ReactNode;
}

export interface PropsDoBotao extends Comum, ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  /** Botão que liga e desliga ("Você vai", "Seguir", "Salvar"): vira aria-pressed, e o leitor de tela anuncia o estado. */
  pressionado?: boolean;
}

/** O botão da Alumia nova. Sempre type="button" a não ser que se diga outro, alvo de toque de no mínimo 44 px (WCAG 2.5.5). */
export function Botao({ variante = "primario", tamanho = "m", icone, pressionado, className = "", type = "button", children, ref, ...resto }: PropsDoBotao) {
  return (
    <button ref={ref} type={type} aria-pressed={pressionado} className={classesDoBotao(variante, tamanho, className)} {...resto}>
      {icone ? <span aria-hidden className="al-botao-icone">{icone}</span> : null}
      {children}
    </button>
  );
}

export interface PropsDoLinkBotao extends Comum, Omit<ComponentProps<typeof Link>, "className"> {
  className?: string;
}

/** Um link com cara de botão (navega; não faz ação). */
export function LinkBotao({ variante = "contorno", tamanho = "m", icone, className = "", children, ...resto }: PropsDoLinkBotao) {
  return (
    <Link className={classesDoBotao(variante, tamanho, className)} {...resto}>
      {icone ? <span aria-hidden className="al-botao-icone">{icone}</span> : null}
      {children}
    </Link>
  );
}
