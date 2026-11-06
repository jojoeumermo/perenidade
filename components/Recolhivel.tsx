// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, type ReactNode } from "react";
import { setItem, useStored } from "@/lib/storage";

/**
 * Uma caixa que abre e fecha com um botão (aria-expanded + aria-controls), lembrando a escolha neste aparelho
 * (localStorage, chave "lucia:recolhe:<chave>"; nada sai do navegador). Começa fechada, salvo se `aberta` vier ligado:
 * no servidor e na primeira pintura vale o padrão, e a escolha guardada entra logo depois, sem erro de hidratação.
 * O conteúdo fechado sai do fluxo (atributo hidden), então o resto da página sobe junto, sem espaço morto.
 */
export function Recolhivel({ chave, abrir, fechar, aberta = false, children }: { chave: string; abrir: string; fechar: string; aberta?: boolean; children: ReactNode }) {
  const id = useId();
  const guardado = useStored(`lucia:recolhe:${chave}`);
  const aberto = guardado ? guardado === "aberto" : aberta;
  return (
    <div>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setItem(`lucia:recolhe:${chave}`, aberto ? "fechado" : "aberto")}
        className="inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-folha px-4 py-2 font-sans text-sm font-bold shadow-[3px_3px_0_var(--sombra)] hover:bg-parchment-deep"
      >
        <span aria-hidden className={`inline-block transition-transform motion-reduce:transition-none ${aberto ? "rotate-90" : ""}`}>▸</span>
        {aberto ? fechar : abrir}
      </button>
      <div id={id} hidden={!aberto} className="mt-5">
        {children}
      </div>
    </div>
  );
}
