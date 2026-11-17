// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { TextosDoTexto } from "./textos";

/**
 * Um bloco de código: em letra fixa, sem quebrar as linhas (rola para o lado dentro do bloco, nunca a página), com o nome da
 * linguagem e o botão de copiar. Sem colorir por linguagem (nenhuma biblioteca a mais chega ao aparelho por isso).
 */
export function BlocoDeCodigo({ codigo, lingua, t }: { codigo: string; lingua: string; t: TextosDoTexto | null }) {
  const [copiou, setCopiou] = useState<"sim" | "nao" | null>(null);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiou("sim");
    } catch {
      setCopiou("nao");
    }
    setTimeout(() => setCopiou(null), 2500);
  }
  const rotulo = lingua || t?.codigo.rotulo || "Código";
  return (
    <figure className="txf-bloco-codigo">
      <figcaption className="txf-bloco-codigo-cabeca">
        <span className="txf-carimbo">{rotulo}</span>
        <button type="button" className="txf-copiar" onClick={copiar}>
          {copiou === "sim" ? (t?.codigo.copiado ?? "Copiado") : (t?.codigo.copiar ?? "Copiar")}
        </button>
        <span role="status" className="txf-so-leitor">
          {copiou === "sim" ? t?.codigo.copiado : copiou === "nao" ? t?.codigo.naoCopiou : ""}
        </span>
      </figcaption>
      {/* tabIndex: quem usa teclado consegue rolar o bloco para o lado. */}
      <pre tabIndex={0} aria-label={rotulo}>
        <code>{codigo}</code>
      </pre>
    </figure>
  );
}
