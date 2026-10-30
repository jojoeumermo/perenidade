// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { marcarVisto } from "./GuiaDaSecao";

const VISTO = "lucia:tutorial-painel";
const ABRIR = "lucia:abrir-tutorial";
const EXPERIMENTOU = "lucia:tutorial-experimentou";

/** Abre o tutorial de novo (o botão "Tutorial" do alto do painel e o quadro da Mesa). */
export const abrirTutorial = () => window.dispatchEvent(new Event(ABRIR));

/** Avisa o tutorial que a pessoa mexeu numa parte que ele mostra (o menu chama ao abrir ou fechar uma área). */
export const experimentou = (alvo: string) => window.dispatchEvent(new CustomEvent(EXPERIMENTOU, { detail: alvo }));

interface Passo {
  /** Onde apontar (atributo data-tour; vale o primeiro visível). Sem alvo, o quadro aparece no meio da tela. */
  alvo?: string;
  /** Só entra no passeio se o alvo estiver na tela (o departamento, o Escrever e o recolher não são de todo mundo). */
  seExistir?: boolean;
  titulo: string;
  texto: string;
  /** Um convite para mexer de verdade: o recorte deixa clicar, e o quadro comemora quando a pessoa faz. */
  experimente?: { convite: string; feito: string };
  /** Quando o alvo não está na tela (o menu fechado do celular): onde apontar no lugar dele, com uma nota. Sem experimentar. */
  reserva?: { alvo: string; nota: string };
}

// O caminho de quem chega: do menu ao trabalho do dia, em poucos passos e sem jargão. O passo a passo de cada seção
// fica no botão "Como funciona esta seção" (components/painel/guias.ts), para o passeio não precisar explicar tudo.
const PASSOS: Passo[] = [
  { titulo: "Bem-vindo ao painel", texto: "É aqui que a equipe do Instituto Lúcia trabalha. Em dois minutos, este passeio mostra onde fica cada coisa. Dá para pular agora e rever quando quiser." },
  {
    alvo: "areas",
    titulo: "Tudo fica no menu",
    texto: "As áreas do painel ficam uma embaixo da outra, como o sumário de um caderno: Hoje, Produção, Atendimento, Pessoas, Site, Segurança e Você. O número vermelho diz quanta coisa espera por você em cada uma.",
    experimente: { convite: "Experimente: clique no nome de uma área.", feito: "Isso! Toda área abre e fecha com um clique, e o painel lembra como você deixou." },
    reserva: { alvo: "menu-celular", nota: "No celular, o menu abre neste botão." },
  },
  { alvo: "departamento", seExistir: true, titulo: "O seu departamento", texto: "No alto do menu ficam juntas as seções do seu departamento, para você não precisar procurar." },
  { alvo: "ir-para", titulo: "Ir para…", texto: "Não achou? Escreva o nome do que procura (fila, horas, rádio) e aperte Enter. De qualquer tela, o atalho é Ctrl K." },
  { alvo: "recolher", seExistir: true, titulo: "Mais espaço", texto: "Este botão recolhe o menu e deixa só os ícones das áreas. Recolhido, clique num ícone e o menu volta já com aquela área aberta." },
  { alvo: "mesa", titulo: "A Mesa", texto: "É a primeira tela. Mostra o que chegou para você hoje: o que revisar, o que responder e o que fazer. Clique numa linha e vá direto ao trabalho." },
  { alvo: "como-funciona", seExistir: true, titulo: "Toda seção se explica", texto: "No alto de cada seção há este botão, com o passo a passo dela. Na primeira visita, a seção mesma oferece ajuda, e para de oferecer se você pedir." },
  { alvo: "escrever", seExistir: true, titulo: "Escrever", texto: "Aulas, matérias, verbetes e tudo o que vai para o site começam aqui. Nada vai ao ar sem revisão, e o rascunho se guarda sozinho." },
  {
    alvo: "conta",
    titulo: "Você",
    texto: "Na sua foto fica Minha conta: o nome, a senha, o código do celular que protege a conta e a faixa de assinatura de e-mail.",
    reserva: { alvo: "menu-celular", nota: "No celular, a sua foto fica no fim do menu." },
  },
  { alvo: "tutorial", titulo: "Pronto", texto: "Este passeio volta quando você quiser, neste botão. Dúvida? Chame a coordenação nas Conversas. Ninguém precisa saber tudo no primeiro dia." },
];

/** O primeiro elemento visível com aquele data-tour (o menu do celular fica escondido, o do computador também às vezes). */
function alvoNaTela(alvo: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`)].find((x) => x.offsetParent !== null || x.getClientRects().length > 0) ?? null;
}

/**
 * O tutorial guiado do painel: na primeira vez que a pessoa abre o painel neste aparelho, um passeio aponta cada parte
 * (com um recorte em volta e o quadro de explicação ao lado). Esc fecha, as setas andam. O botão "Tutorial" reabre.
 * Os passos se ajustam ao que a pessoa vê (função, menu recolhido, celular), e no passo do menu dá para clicar de
 * verdade. No fim, os atalhos para o glossário e para a lista de teclas.
 */
export function TutorialDoPainel({ pronto = true, extras = [] }: { pronto?: boolean; extras?: { rotulo: string; fazer: () => void }[] }) {
  const [passos, setPassos] = useState<Passo[]>(PASSOS);
  const [passo, setPasso] = useState<number | null>(null);
  const [caixa, setCaixa] = useState<DOMRect | null>(null);
  const [feito, setFeito] = useState(false);
  const [naReserva, setNaReserva] = useState(false);

  const comecar = useCallback(() => {
    setPassos(PASSOS.filter((p) => !p.seExistir || (p.alvo && alvoNaTela(p.alvo))));
    setFeito(false);
    setPasso(0);
  }, []);

  useEffect(() => {
    window.addEventListener(ABRIR, comecar);
    return () => window.removeEventListener(ABRIR, comecar);
  }, [comecar]);

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
    const primeira = window.setTimeout(comecar, 900);
    return () => window.clearTimeout(primeira);
  }, [pronto, comecar]);

  const atual = passo === null ? null : passos[passo];

  const medir = useCallback(() => {
    if (!atual?.alvo) return setCaixa(null);
    const proprio = alvoNaTela(atual.alvo);
    const el = proprio ?? (atual.reserva ? alvoNaTela(atual.reserva.alvo) : null);
    setNaReserva(!proprio && Boolean(el));
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

  // A pessoa mexeu no que o passo mostra: o quadro comemora, e o recorte acompanha (o menu pode ter mudado de forma).
  useEffect(() => {
    if (!atual?.experimente) return;
    const ouvir = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== atual.alvo) return;
      setFeito(true);
      window.setTimeout(medir, 80);
    };
    window.addEventListener(EXPERIMENTOU, ouvir);
    return () => window.removeEventListener(EXPERIMENTOU, ouvir);
  }, [atual, medir]);

  const fechar = useCallback(() => {
    setPasso(null);
    try {
      localStorage.setItem(VISTO, String(Date.now()));
    } catch {
      // sem armazenamento
    }
    // O passeio já mostrou a Mesa: o passo a passo dela não precisa se oferecer de novo.
    marcarVisto("mesa");
  }, []);

  const andar = useCallback(
    (para: number) => {
      setFeito(false);
      setPasso(Math.max(0, Math.min(para, passos.length - 1)));
    },
    [passos.length],
  );

  useEffect(() => {
    if (passo === null) return;
    const tecla = (e: KeyboardEvent) => {
      // Escrevendo num campo (o Ir para… do passo do menu, por exemplo), as setas são do campo.
      const escrevendo = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if (e.key === "Escape") fechar();
      else if (escrevendo) return;
      else if (e.key === "ArrowRight") andar(passo + 1);
      else if (e.key === "ArrowLeft") andar(passo - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [passo, fechar, andar]);

  if (passo === null || !atual) return null;
  const ultimo = passo === passos.length - 1;
  const margem = 8;
  const experimente = naReserva ? undefined : atual.experimente;
  const furo = caixa && experimente;
  // O quadro fica à direita do alvo quando cabe; senão embaixo; sem alvo, no meio.
  const largura = Math.min(360, window.innerWidth - 32);
  let estilo: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: largura };
  if (caixa) {
    const direita = caixa.right + 16 + largura < window.innerWidth;
    const top = Math.max(16, Math.min(caixa.top, window.innerHeight - 300));
    estilo = direita
      ? { left: caixa.right + 16, top, width: largura }
      : { left: Math.max(16, Math.min(caixa.left, window.innerWidth - largura - 16)), top: Math.min(caixa.bottom + 14, window.innerHeight - 280), width: largura };
  }

  return (
    <div className="tutorial no-print pointer-events-none fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo">
      {/* O véu escuro com o recorte em volta do que está sendo mostrado. */}
      {caixa ? (
        <div
          aria-hidden
          className="tutorial-veu fixed border-[3px] border-[#c21f16] transition-all duration-200"
          style={{ left: caixa.left - margem, top: caixa.top - margem, width: caixa.width + margem * 2, height: caixa.height + margem * 2, boxShadow: "0 0 0 9999px rgb(23 19 14 / 0.62)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[#17130e]/60" />
      )}
      {/* O que fica fora do recorte não recebe clique; no passo de experimentar, o recorte recebe. */}
      {furo ? (
        <>
          <div className="pointer-events-auto fixed inset-x-0 top-0" style={{ height: Math.max(0, caixa.top - margem) }} />
          <div className="pointer-events-auto fixed inset-x-0 bottom-0" style={{ top: caixa.bottom + margem }} />
          <div className="pointer-events-auto fixed left-0" style={{ top: caixa.top - margem, height: caixa.height + margem * 2, width: Math.max(0, caixa.left - margem) }} />
          <div className="pointer-events-auto fixed right-0" style={{ top: caixa.top - margem, height: caixa.height + margem * 2, left: caixa.right + margem }} />
        </>
      ) : (
        <div className="pointer-events-auto fixed inset-0" />
      )}
      <div className="pointer-events-auto fixed border-2 border-ink bg-folha p-5 font-sans text-sm text-ink shadow-[6px_6px_0_#c21f16]" style={estilo}>
        {ultimo && (
          <span aria-hidden className="tutorial-carimbo absolute top-3 right-3 rotate-[-5deg] border-[3px] border-double border-[#c21f16] bg-folha px-2.5 py-0.5 font-mono text-[0.66rem] font-black uppercase tracking-[0.22em] text-prelo-texto">
            Passeio feito
          </span>
        )}
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-prelo-texto">
          {`Tutorial · ${passo + 1} de ${passos.length}`}
        </p>
        <h2 id="tutorial-titulo" className="mt-1.5 flex items-start gap-2.5 font-serif text-2xl font-semibold leading-tight">
          <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink bg-[#c21f16] font-sans text-[0.8rem] font-black text-white">
            {passo + 1}
          </span>
          {atual.titulo}
        </h2>
        <p className="mt-2 leading-relaxed">{atual.texto}</p>
        {naReserva && atual.reserva && <p className="mt-2 font-semibold leading-snug">{atual.reserva.nota}</p>}
        {experimente && caixa && (
          <p role="status" className={`mt-3 flex items-start gap-2 border-2 px-3 py-2 font-semibold leading-snug ${feito ? "tutorial-feito border-ink bg-ink text-parchment" : "border-dashed border-ink"}`}>
            <span aria-hidden className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center border-2 ${feito ? "border-[#c21f16] bg-[#c21f16] text-white" : "border-ink"}`}>
              {feito && (
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              )}
            </span>
            {feito ? experimente.feito : experimente.convite}
          </p>
        )}
        {ultimo && extras.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {extras.map((extra) => (
              <button
                key={extra.rotulo}
                type="button"
                onClick={() => {
                  fechar();
                  extra.fazer();
                }}
                className="cursor-pointer font-semibold underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto"
              >
                {extra.rotulo}
              </button>
            ))}
          </p>
        )}
        <div aria-hidden className="mt-4 flex gap-1">
          {passos.map((p, i) => (
            <span key={p.titulo} className={`h-1.5 flex-1 ${i <= passo ? "bg-[#c21f16]" : "bg-rule"}`} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {passo > 0 && (
            <button type="button" onClick={() => andar(passo - 1)} className="cursor-pointer border-2 border-ink px-3 py-1.5 font-bold hover:bg-parchment">
              ← Voltar
            </button>
          )}
          <button type="button" autoFocus onClick={() => (ultimo ? fechar() : andar(passo + 1))} className="cursor-pointer border-2 border-ink bg-[#c21f16] px-3.5 py-1.5 font-bold text-white shadow-[3px_3px_0_#1f1a14] hover:bg-[#a51810]">
            {ultimo ? "Começar a trabalhar" : "Próximo →"}
          </button>
          {!ultimo && (
            <button type="button" onClick={fechar} className="ml-auto cursor-pointer underline hover:text-prelo-texto">
              Pular
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
