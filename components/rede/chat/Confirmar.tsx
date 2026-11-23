// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef } from "react";
import { botaoLeve, botaoPerigo } from "./comum";

/** O que a tela quer confirmar: a pergunta, o texto do botão que faz e o que fazer. */
export interface PedidoDeConfirmacao {
  pergunta: string;
  sim: string;
  fazer: () => void;
}

/**
 * A janela de confirmação do chat, no lugar do confirm() do navegador (que mostrava "JavaScript de alumia…" e o endereço, e não
 * seguia o visual nem o idioma). É um <dialog> modal: prende o foco, fecha com Esc e com toque fora, e o foco começa em "Cancelar"
 * (apagar e bloquear não acontecem com um Enter distraído). Ao fechar, o navegador devolve o foco ao botão que abriu.
 */
export function Confirmar({ pedido, nao, aoFechar }: { pedido: PedidoDeConfirmacao | null; nao: string; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const idPergunta = useId();
  const aberto = !!pedido;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      cancelar.current?.focus();
    }
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idPergunta}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-rule bg-parchment p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      {pedido && (
        <div className="space-y-5 p-5">
          <p id={idPergunta} className="text-base leading-relaxed">{pedido.pergunta}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button ref={cancelar} type="button" className={botaoLeve} onClick={() => ref.current?.close()}>{nao}</button>
            <button
              type="button"
              className={botaoPerigo}
              onClick={() => {
                const fazer = pedido.fazer;
                ref.current?.close();
                fazer();
              }}
            >
              {pedido.sim}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
