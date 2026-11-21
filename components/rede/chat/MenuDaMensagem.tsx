// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface ItemDoMenu {
  rotulo: string;
  fazer: () => void;
  perigo?: boolean;
}

/**
 * O menu de uma mensagem ("…"): editar, apagar só para mim, apagar para todos, lembrar. Abre com toque ou teclado, as setas andam
 * pelos itens, Esc fecha e devolve o foco ao botão, e um toque fora fecha. Os itens que não cabem à mensagem nem aparecem.
 */
export function MenuDaMensagem({ rotulo, montar, clara }: { rotulo: string; montar: () => ItemDoMenu[]; clara: boolean }) {
  // Os itens são montados ao abrir (no toque), não a cada desenho da conversa.
  const [itens, setItens] = useState<ItemDoMenu[] | null>(null);
  const aberto = itens !== null;
  const setAberto = (abrir: boolean) => setItens(abrir ? montar() : null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const fora = (e: PointerEvent) => {
      if (!lista.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) setItens(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  const fechar = (devolverFoco: boolean) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };

  return (
    <span className="relative inline-flex">
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        aria-label={rotulo}
        title={rotulo}
        onClick={() => setAberto(!aberto)}
        className="-my-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-black/10"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {itens && (
        <div
          ref={lista}
          id={id}
          role="menu"
          aria-label={rotulo}
          onKeyDown={(e) => {
            const botoes = [...(lista.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
            const i = botoes.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "Escape") {
              e.preventDefault();
              fechar(true);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const n = botoes.length;
              botoes[(i + (e.key === "ArrowDown" ? 1 : n - 1)) % n]?.focus();
            } else if (e.key === "Tab") setAberto(false);
          }}
          className={`absolute bottom-full z-20 mb-1 min-w-[12.5rem] overflow-hidden rounded-xl border border-rule bg-parchment py-1 text-left text-sm text-ink shadow-lg ${clara ? "right-0" : "left-0"}`}
        >
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              onClick={() => {
                fechar(false);
                item.fazer();
              }}
              className={`flex min-h-11 w-full items-center px-4 text-left font-semibold hover:bg-parchment-deep focus:bg-parchment-deep focus:outline-none ${item.perigo ? "text-oxblood" : ""}`}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
