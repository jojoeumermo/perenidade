// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { anotar, armazemDoAparelho, gravarRegistro, lerRegistro, lidoAte } from "@/lib/rede/leitura-conversa";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDoForum } from "@/lib/rede/textos-forum-conversa";
import { semMovimento } from "../conversa/movimento";
import "./forum.css";

/**
 * "Até onde li" numa conversa (onda 10, 10A): devolve até onde a pessoa tinha lido NESTE aparelho antes de abrir agora (fica o mesmo
 * enquanto a conversa está aberta) e anota a resposta mais nova que apareceu. Nada vai ao servidor (lib/rede/leitura-conversa.ts).
 */
export function useAteOndeLi(raiz: string | null, maisNova: string | null): string | null {
  const [desde, setDesde] = useState<{ raiz: string; valor: string | null } | null>(null);
  useEffect(() => {
    if (!raiz) return;
    // Depois do desenho (a leitura do armazenamento não segura a tela).
    const id = window.setTimeout(() => {
      const armazem = armazemDoAparelho();
      const registro = lerRegistro(armazem);
      setDesde((d) => (d?.raiz === raiz ? d : { raiz, valor: lidoAte(registro, raiz) }));
      if (maisNova) gravarRegistro(armazem, anotar(registro, raiz, maisNova));
    }, 0);
    return () => window.clearTimeout(id);
  }, [raiz, maisNova]);
  return desde?.raiz === raiz ? desde.valor : null;
}

/** A barra "N respostas novas desde a sua última visita · Pular para a primeira nova", com a regra (só neste aparelho). */
export function BarraDasNovas({ n, tf, primeira }: { n: number; tf: TextosDoForum; primeira: string }) {
  if (n <= 0) return null;
  function pular() {
    const el = document.querySelector<HTMLElement>(`[data-flip="${CSS.escape(primeira)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: semMovimento() ? "auto" : "smooth", block: "center" });
    // O foco vai junto (teclado e leitor de tela chegam no mesmo lugar que os olhos).
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }
  return (
    <div className="f10 f10-novas-barra" role="status">
      <p className="f10-novas-texto">
        <span className="f10-novas-ponto" aria-hidden />
        {n === 1 ? tf.novas.uma : preencher(tf.novas.barra, { n })}
      </p>
      <button type="button" className="al-botao al-botao-dourado al-botao-p" onClick={pular}>
        {tf.novas.pular}
        <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </button>
      <p className="f10-nota f10-novas-regra">{tf.novas.regra}</p>
    </div>
  );
}

/** A régua "Novas daqui para baixo" logo antes da primeira resposta nova. */
export function ReguaDasNovas({ tf }: { tf: TextosDoForum }) {
  return (
    <p className="f10-regua">
      <span>{tf.novas.regua}</span>
    </p>
  );
}
