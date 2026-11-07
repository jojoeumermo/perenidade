// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TextosDoAssistente } from "@/i18n/assistente";

// A janela (com o formulário, a leitura do estado e o Markdown) só é baixada no primeiro clique, ou quando o ponteiro
// passa por cima do botão. Antes disso, a página carrega só este botão: nenhum pedido sai dela.
const carregarPainel = () => import("./PainelDoAssistente").then((m) => m.PainelDoAssistente);
const PainelDoAssistente = dynamic(carregarPainel, { ssr: false });

/**
 * O assistente em todas as páginas (T03): um botão discreto no canto de baixo, à esquerda (o da direita é o da
 * acessibilidade), logo acima do "voltar ao topo". Fica fora do painel da equipe e da área infantil (OutsidePanel, no
 * layout): criança não manda texto a IA de empresa de fora (LGPD, art. 14: dado de criança só no melhor interesse dela).
 */
export function BotaoDoAssistente({ textos }: { textos: TextosDoAssistente }) {
  const [aberto, setAberto] = useState(false);
  const [usado, setUsado] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    botao.current?.focus();
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, fechar]);

  return (
    <div className="assistente-flutua no-print fixed bottom-[calc(8.25rem+var(--recuo-baixo,0px))] left-3 z-30 font-sans text-sm md:bottom-20 md:left-6">
      {usado && (
        <div hidden={!aberto}>
          <PainelDoAssistente textos={textos} aberto={aberto} fechar={fechar} />
        </div>
      )}
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls={usado ? "assistente-do-site" : undefined}
        aria-label={textos.botao}
        title={textos.botao}
        onPointerEnter={() => void carregarPainel()}
        onFocus={() => void carregarPainel()}
        onClick={() => {
          setUsado(true);
          setAberto((a) => !a);
        }}
        className="flex h-11 w-11 cursor-pointer items-center justify-center border-2 border-ink bg-parchment text-ink shadow-[3px_3px_0_var(--ink)] hover:border-oxblood hover:text-oxblood aria-expanded:bg-ink aria-expanded:text-parchment"
      >
        {/* Um balão de conversa com um ponto de interrogação: desenho próprio, sem biblioteca de ícones. */}
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v11H9l-5 4z" />
          <path d="M10 9.2a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4" />
          <path d="M12 14.2h.01" />
        </svg>
      </button>
    </div>
  );
}
