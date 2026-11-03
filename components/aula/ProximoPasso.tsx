// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaAula } from "@/i18n/escola/aula";
import { L } from "../I18n";

export interface Destino {
  caminho: string;
  titulo: string;
}

/**
 * O próximo passo sempre à vista (Etapa 4, R1-13): quando a leitura passa de 85% do texto, uma barra compacta com
 * "Próxima" aparece no pé da tela (acima da barra do celular); some ao voltar para cima e quando o fim da aula, com o
 * botão grande, já está na tela. `proxima` é a próxima aula da trilha ou, num curso (E4-07), a próxima do curso.
 */
export function ProximoPasso({ proxima, s }: { proxima?: Destino; s: TextosDaAula["proximo"] }) {
  const [passou, setPassou] = useState(false);
  const [noFim, setNoFim] = useState(false);
  const [escondida, setEscondida] = useState(false);

  useEffect(() => {
    if (!proxima || typeof IntersectionObserver === "undefined") return;
    const blocos = [...document.querySelectorAll<HTMLElement>("#texto-da-aula [data-p]")];
    const alvo = blocos[Math.floor(blocos.length * 0.85)] ?? document.getElementById("texto-da-aula");
    const fim = document.querySelector(".concluir-da-aula");
    // O bloco a 85% do texto (no último terço): passou dele (está na tela ou acima dela), a barra aparece.
    const vigia = new IntersectionObserver((itens) => {
      for (const item of itens) {
        if (item.target === alvo) setPassou(item.isIntersecting || item.boundingClientRect.top < 0);
        else setNoFim(item.isIntersecting);
      }
    });
    if (alvo) vigia.observe(alvo);
    if (fim) vigia.observe(fim);
    return () => vigia.disconnect();
  }, [proxima]);

  if (!proxima || !passou || noFim || escondida) return null;
  return (
    <div className="proximo-passo no-print no-leitor" role="region" aria-label={s.barra}>
      <L href={proxima.caminho} className="proximo-passo-ir" aria-label={fill(s.barraRotulo, { titulo: proxima.titulo })}>
        <span className="proximo-passo-rotulo">{s.barra}</span>
        <span className="proximo-passo-titulo">{proxima.titulo}</span>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      </L>
      <button type="button" className="proximo-passo-fechar" aria-label={s.esconder} title={s.esconder} onClick={() => setEscondida(true)}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
