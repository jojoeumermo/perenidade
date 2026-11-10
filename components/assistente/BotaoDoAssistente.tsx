// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TextosDoAssistente } from "@/i18n/assistente";
import type { PerguntaFrequente } from "@/lib/perguntas-frequentes";

// O código da janela só é baixado no primeiro clique, ou quando o ponteiro passa por cima do botão. As perguntas e as
// respostas já vêm com a página (do servidor, só as do idioma dela): abrir a janela e filtrar não pedem nada a ninguém.
const carregarPainel = () => import("./PainelDoAssistente").then((m) => m.PainelDoAssistente);
const PainelDoAssistente = dynamic(carregarPainel, { ssr: false });

/**
 * O botão "?" em todas as páginas: um botão discreto no canto de baixo, à esquerda (o da direita é o da acessibilidade),
 * logo acima do "voltar ao topo". Desde 08/11/2026 abre as PERGUNTAS FREQUENTES, com respostas prontas escritas à mão
 * (content/perguntas-frequentes.json): sem IA e sem rede. Antes chamava a rota de IA do assistente aberto; ela continua para
 * o reforço e as ferramentas de estudo, mas este botão não a usa mais. Fica fora do painel da equipe e da área infantil
 * (OutsidePanel, no layout).
 */
/** Pede para abrir (ou fechar) as perguntas frequentes de outro lugar da tela (o menu da conta da Alumia, onde o "?" não flutua). */
export const ALTERNAR_ASSISTENTE = "lucia:alternar-assistente";
export const alternarAssistente = () => window.dispatchEvent(new Event(ALTERNAR_ASSISTENTE));

export function BotaoDoAssistente({ textos, perguntas, email }: { textos: TextosDoAssistente; perguntas: PerguntaFrequente[]; email: string }) {
  const [aberto, setAberto] = useState(false);
  const [usado, setUsado] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  // Quem abriu de fora (o item do menu da Alumia): ao fechar, o foco volta para ele, e não para o "?" escondido.
  const origem = useRef<HTMLElement | null>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    const o = origem.current;
    origem.current = null;
    if (o && o.isConnected && o.getClientRects().length > 0) o.focus();
    else botao.current?.focus();
  }, []);

  useEffect(() => {
    const alternar = () => {
      origem.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      void carregarPainel();
      setUsado(true);
      setAberto((a) => !a);
    };
    window.addEventListener(ALTERNAR_ASSISTENTE, alternar);
    return () => window.removeEventListener(ALTERNAR_ASSISTENTE, alternar);
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
    <div className={`assistente-flutua no-print fixed bottom-[calc(8.25rem+var(--recuo-baixo,0px))] left-3 ${aberto ? "z-50" : "z-30"} font-sans text-sm md:bottom-20 md:left-6`}>
      {usado && (
        <div hidden={!aberto}>
          <PainelDoAssistente textos={textos} perguntas={perguntas} email={email} aberto={aberto} fechar={fechar} />
        </div>
      )}
      <button
        ref={botao}
        type="button"
        aria-haspopup="dialog"
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
        className="assistente-gatilho flex h-11 w-11 cursor-pointer items-center justify-center border-2 border-ink bg-parchment text-ink shadow-[3px_3px_0_var(--ink)] hover:border-oxblood hover:text-oxblood aria-expanded:bg-ink aria-expanded:text-parchment"
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
