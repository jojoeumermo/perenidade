// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { gravarEsconderSemDescricao, lerEsconderSemDescricao } from "@/lib/rede/publicar/p4-compositor";
import type { ContextoDoEncaixe } from "../../encaixes";
import { useTextosDoP4 } from "./textos";

/** O armazenamento do aparelho, ou nulo (sem janela, ou bloqueado). */
function armazem(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Nos Ajustes (encaixe secoesDeAjustes, prompt 4, item 28): "Esconder da linha os posts com imagem sem descrição". A escolha fica SÓ
 * neste aparelho (lucia:rede:…, que o Sair rápido apaga): o servidor não sabe quem ligou, e não há o que guardar sobre quem lê.
 */
export default function FiltroSemDescricao({ lang }: ContextoDoEncaixe) {
  const t = useTextosDoP4(lang);
  const id = useId();
  const [ligado, setLigado] = useState(() => lerEsconderSemDescricao(armazem()));
  if (!t) return null;
  return (
    <div className="space-y-2" data-p4c="filtro">
      <label className="al2-opcao-b1">
        <input
          type="checkbox"
          role="switch"
          className="al2-caixinha"
          checked={ligado}
          aria-describedby={`${id}-explica`}
          onChange={(e) => {
            gravarEsconderSemDescricao(armazem(), e.target.checked);
            setLigado(lerEsconderSemDescricao(armazem()));
          }}
        />
        <span className="min-w-0">
          <span className="block font-bold">{t.filtro.rotulo}</span>
          <span id={`${id}-explica`} className="block text-xs text-[var(--al-texto-3)]">{t.filtro.explica}</span>
        </span>
      </label>
      <p role="status" className="text-xs text-[var(--al-texto-3)]">{ligado ? t.filtro.ligado : t.filtro.desligado}</p>
    </div>
  );
}
