// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { forwardRef, type HTMLAttributes, type KeyboardEvent, type ReactNode, useId } from "react";
import { cx } from "./cx";

export type VarianteDoCartao = "padrao" | "destaque" | "alerta" | "plano";

export interface PropsDoCartao extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: "section" | "div" | "article";
  /** Título do cartão (h2 em Garamond, ou h3 com nivelDoTitulo={3}). */
  titulo?: ReactNode;
  nivelDoTitulo?: 2 | 3;
  sobre?: ReactNode;
  /** Botões à direita do título. */
  acoes?: ReactNode;
  /** Faixa de baixo, num tom mais escuro (ações de rodapé, totais). */
  rodape?: ReactNode;
  variante?: VarianteDoCartao;
  /** O cartão inteiro é clicável (com foco e Enter): passe também onClick e um aria-label ou título. */
  interativo?: boolean;
}

/**
 * O cartão do painel: um tom mais claro que o papel, fio de 1 px e cantos de 10 px. Substitui painel-cartao, painel-quadro
 * e as caixas "border border-rule bg-parchment-deep p-4".
 */
export const Cartao = forwardRef<HTMLElement, PropsDoCartao>(function Cartao({ as = "section", titulo, nivelDoTitulo = 2, sobre, acoes, rodape, variante = "padrao", interativo, className, children, onClick, onKeyDown, ...resto }, ref) {
  const Elemento = as;
  const Titulo = nivelDoTitulo === 3 ? "h3" : "h2";
  const idTitulo = useId();
  const teclado = interativo
    ? (e: KeyboardEvent<HTMLElement>) => {
        onKeyDown?.(e);
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).click();
        }
      }
    : onKeyDown;
  return (
    <Elemento
      ref={ref as never}
      className={cx("pn-cartao", variante !== "padrao" && `pn-cartao-${variante}`, interativo && "pn-cartao-interativo", className)}
      aria-labelledby={titulo && as === "section" && !resto["aria-label"] ? idTitulo : undefined}
      role={interativo ? "button" : undefined}
      tabIndex={interativo ? 0 : undefined}
      onClick={onClick}
      onKeyDown={teclado}
      {...resto}
    >
      {(titulo || acoes) && (
        <div className="pn-cartao-cabeca">
          <div style={{ minWidth: 0 }}>
            {titulo && (
              <Titulo id={idTitulo} className="pn-cartao-titulo">
                {titulo}
              </Titulo>
            )}
            {sobre && <p className="pn-cartao-sobre">{sobre}</p>}
          </div>
          {acoes && <div className="pn-cabecalho-acoes">{acoes}</div>}
        </div>
      )}
      {!titulo && !acoes && sobre && <p className="pn-cartao-sobre">{sobre}</p>}
      {children}
      {rodape && <div className="pn-cartao-rodape">{rodape}</div>}
    </Elemento>
  );
});
