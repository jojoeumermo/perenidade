// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const VISTO = "lucia:tutorial-painel";
const ABRIR = "lucia:abrir-tutorial";

/** Abre o tutorial de novo (o botão "Tutorial" do alto do painel e o quadro da Mesa). */
export const abrirTutorial = () => window.dispatchEvent(new Event(ABRIR));

interface Passo {
  /** Onde apontar (atributo data-tour). Sem alvo, o quadro aparece no meio da tela. */
  alvo?: string;
  titulo: string;
  texto: string;
}

// O caminho de quem chega: do menu ao trabalho do dia, em poucos passos e sem jargão.
const PASSOS: Passo[] = [
  { titulo: "Bem-vindo ao painel", texto: "Este é o lugar de trabalho da equipe do Instituto Lúcia. Em um minuto, este passeio mostra onde fica cada coisa. Dá para pular quando quiser e rever depois pelo botão Tutorial, no alto." },
  { alvo: "menu", titulo: "O menu", texto: "Aqui ficam as seções do painel, separadas por área (Produção, Atendimento, Pessoas…). Cada pessoa vê só as seções da função que recebeu. O número vermelho ao lado é o que está esperando por você." },
  { alvo: "recolher", titulo: "Menu recolhido", texto: "Este botão recolhe o menu num trilho fino, só com os ícones, para sobrar mais espaço na tela. Clique de novo para ver os nomes." },
  { alvo: "ir-para", titulo: "Ir para…", texto: "Procure qualquer seção pelo nome (fila, horas, rádio). O atalho é Ctrl+K, ou a tecla / fora de um campo de texto." },
  { alvo: "mesa", titulo: "A Mesa", texto: "A primeira tela: o que pede a sua atenção hoje. A manchete é o mais urgente; embaixo, o resto da lista. Clique numa linha para ir direto ao trabalho." },
  { alvo: "escrever", titulo: "Escrever", texto: "Aulas, matérias, verbetes e tudo o que vai para o site começam aqui. O texto passa pela revisão antes de ir ao ar, e o rascunho fica guardado sozinho." },
  { alvo: "conta", titulo: "Você", texto: "Seu nome, sua função e a sua conta (nome, senha, foto e a proteção com o código do celular). Aqui também ficam o tema claro ou escuro e a saída." },
  { titulo: "Pronto", texto: "É isso. As conversas da equipe ficam em Conversas e reuniões, e as tarefas rápidas em Tarefas. Na dúvida, chame a coordenação pelas conversas." },
];

/**
 * O tutorial guiado do painel: na primeira vez que a pessoa abre o painel neste aparelho, um passeio aponta cada parte
 * (com um recorte em volta e o quadro de explicação ao lado). Esc fecha, as setas andam. O botão "Tutorial" reabre.
 */
export function TutorialDoPainel({ pronto = true }: { pronto?: boolean }) {
  const [passo, setPasso] = useState<number | null>(null);
  const [caixa, setCaixa] = useState<DOMRect | null>(null);

  useEffect(() => {
    const abrir = () => setPasso(0);
    window.addEventListener(ABRIR, abrir);
    return () => window.removeEventListener(ABRIR, abrir);
  }, []);

  // Abre sozinho só na primeira vez, e só quando nada mais está por cima (o termo de voluntário, por exemplo).
  useEffect(() => {
    if (!pronto) return;
    let visto = "1";
    try {
      visto = localStorage.getItem(VISTO) ?? "";
    } catch {
      // sem armazenamento: não abre sozinho para não aparecer em toda página
    }
    if (visto) return;
    const primeira = window.setTimeout(() => setPasso(0), 900);
    return () => window.clearTimeout(primeira);
  }, [pronto]);

  const atual = passo === null ? null : PASSOS[passo];

  const medir = useCallback(() => {
    if (!atual?.alvo) return setCaixa(null);
    // O menu do celular fica escondido: aponta o primeiro alvo visível com esse nome.
    const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${atual.alvo}"]`)].find((x) => x.offsetParent !== null || x.getClientRects().length > 0);
    if (!el) return setCaixa(null);
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    setCaixa(el.getBoundingClientRect());
  }, [atual]);

  useLayoutEffect(() => {
    if (passo === null) return;
    const quadro = window.requestAnimationFrame(medir);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.cancelAnimationFrame(quadro);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [passo, medir]);

  const fechar = useCallback(() => {
    setPasso(null);
    try {
      localStorage.setItem(VISTO, String(Date.now()));
    } catch {
      // sem armazenamento
    }
  }, []);

  useEffect(() => {
    if (passo === null) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      else if (e.key === "ArrowRight") setPasso((p) => (p === null ? p : Math.min(p + 1, PASSOS.length - 1)));
      else if (e.key === "ArrowLeft") setPasso((p) => (p === null ? p : Math.max(p - 1, 0)));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [passo, fechar]);

  if (passo === null || !atual) return null;
  const ultimo = passo === PASSOS.length - 1;
  const margem = 8;
  // O quadro fica à direita do alvo quando cabe; senão embaixo; sem alvo, no meio.
  const largura = Math.min(360, window.innerWidth - 32);
  let estilo: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: largura };
  if (caixa) {
    const direita = caixa.right + 16 + largura < window.innerWidth;
    const top = Math.max(16, Math.min(caixa.top, window.innerHeight - 260));
    estilo = direita
      ? { left: caixa.right + 16, top, width: largura }
      : { left: Math.max(16, Math.min(caixa.left, window.innerWidth - largura - 16)), top: Math.min(caixa.bottom + 14, window.innerHeight - 240), width: largura };
  }

  return (
    <div className="tutorial no-print fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo">
      {/* O véu escuro com o recorte em volta do que está sendo mostrado. */}
      {caixa ? (
        <div
          aria-hidden
          className="pointer-events-none fixed border-[3px] border-[#c21f16] transition-all duration-200"
          style={{ left: caixa.left - margem, top: caixa.top - margem, width: caixa.width + margem * 2, height: caixa.height + margem * 2, boxShadow: "0 0 0 9999px rgb(23 19 14 / 0.62)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[#17130e]/60" />
      )}
      <div className="fixed border-2 border-[#1f1a14] bg-[#fbf6e8] p-5 font-sans text-sm text-[#1f1a14] shadow-[6px_6px_0_#c21f16]" style={estilo}>
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-[#c21f16]">
          Tutorial · {passo + 1} de {PASSOS.length}
        </p>
        <h2 id="tutorial-titulo" className="mt-1 font-serif text-2xl font-semibold leading-tight">{atual.titulo}</h2>
        <p className="mt-2 leading-relaxed">{atual.texto}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {passo > 0 && (
            <button type="button" onClick={() => setPasso(passo - 1)} className="cursor-pointer border-2 border-[#1f1a14] px-3 py-1.5 font-bold hover:bg-[#f4ecd8]">
              ← Voltar
            </button>
          )}
          <button type="button" autoFocus onClick={() => (ultimo ? fechar() : setPasso(passo + 1))} className="cursor-pointer border-2 border-[#1f1a14] bg-[#c21f16] px-3.5 py-1.5 font-bold text-white shadow-[3px_3px_0_#1f1a14] hover:bg-[#a51810]">
            {ultimo ? "Começar a trabalhar" : "Próximo →"}
          </button>
          {!ultimo && (
            <button type="button" onClick={fechar} className="ml-auto cursor-pointer underline hover:text-[#c21f16]">
              Pular
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
