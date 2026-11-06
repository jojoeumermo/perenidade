// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Book } from "@/lib/content";
import { CapaDoLivro } from "./CapaDoLivro";
import { L } from "../I18n";

/** O título de uma fileira, no desenho das seções: a etiqueta com a estrela, o fio e, no fim, a contagem e os botões. */
export function Tarja({ titulo, conta, vermelha = false, children }: { titulo: string; conta?: number; vermelha?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
      <h2 className={`shrink-0 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] ${vermelha ? "bg-[#c21f16] text-white" : "bg-ink text-parchment"}`}>
        ★ {titulo}
        {conta !== undefined && <span className="ml-2 font-normal opacity-80">{conta}</span>}
      </h2>
      <span aria-hidden className={`min-w-8 flex-1 border-t-2 ${vermelha ? "border-[#c21f16]" : "border-ink"}`} />
      {children && <span className="flex shrink-0 flex-wrap items-center gap-3">{children}</span>}
    </div>
  );
}

/** Pausar e continuar, desenhados em traço (nada de símbolo de teclado). */
const Pausa = ({ tocando }: { tocando: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="currentColor">
    {tocando ? <path d="M4 2h3v12H4zM9 2h3v12H9z" /> : <path d="M4 2l10 6-10 6z" />}
  </svg>
);

/** A seta das fileiras, em traço. */
const Seta = ({ para }: { para: "tras" | "frente" }) => (
  <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="square">
    {para === "tras" ? <path d="M10 3L5 8l5 5" /> : <path d="M6 3l5 5-5 5" />}
  </svg>
);

/** Quantos pixels por segundo a vitrine anda sozinha. */
const VELOCIDADE = 30;
/** Depois de a pessoa mexer (setas, roda do mouse, arrastar, dedo), a vitrine espera este tempo parada antes de voltar a andar. */
const ESPERA_DEPOIS_DE_MEXER = 4000;

/** O foco veio do teclado? (:focus-visible; navegador antigo sem o seletor: conta como teclado, o jeito seguro.) */
function focoDeTeclado(el: EventTarget): boolean {
  if (!(el instanceof Element)) return false;
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

export type RotulosDoCarrossel = { pause: string; play: string; all: string; back: string; forward: string };

/**
 * A vitrine do acervo: uma fileira de livros que anda sozinha, em loop, e que a pessoa controla. Para quando o mouse
 * passa por cima, quando algo dentro dela recebe o foco do teclado ou quando a pessoa aperta "Pausar". As setas e o
 * arrastar (mouse, dedo ou roda) levam para frente e para trás, então dá para voltar ao livro que já passou. O foco nunca
 * fica preso: Tab entra num livro e sai para o próximo elemento da página como em qualquer lista de links.
 * Com movimento reduzido no aparelho, ou no celular, não anda sozinha: vira uma fileira para correr com o dedo e as setas.
 */
export function Carrossel({ titulo, obras, verTodas, rotulo, vermelha = false }: { titulo: string; obras: Book[]; verTodas?: () => void; rotulo: RotulosDoCarrossel; vermelha?: boolean }) {
  const janela = useRef<HTMLDivElement>(null);
  const trilho = useRef<HTMLUListElement>(null);
  const [pausado, setPausado] = useState(false);
  // Começa sem andar: o servidor não sabe se o aparelho pede movimento reduzido nem se é celular.
  const [podeAndar, setPodeAndar] = useState(false);
  const [emLoop, setEmLoop] = useState(false);
  const segurando = useRef({ mouse: false, foco: false, arrasto: false });
  const ultimaMexida = useRef(0);
  const arrasto = useRef<{ x: number; inicio: number; mexeu: boolean } | null>(null);
  const bloquearClique = useRef(false);
  const temCopia = obras.length >= 6;
  const lista = temCopia ? [...obras, ...obras] : obras;

  // O aparelho decide: movimento reduzido não anda; no celular (até 767 px, fora do modo leitor) a cópia some e não há loop.
  useEffect(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    const celular = window.matchMedia("(max-width: 767px)");
    const conferir = () => {
      const noCelular = celular.matches && !document.documentElement.hasAttribute("data-leitor");
      setEmLoop(temCopia && !noCelular);
      setPodeAndar(temCopia && !noCelular && !reduzido.matches);
    };
    conferir();
    reduzido.addEventListener("change", conferir);
    celular.addEventListener("change", conferir);
    return () => {
      reduzido.removeEventListener("change", conferir);
      celular.removeEventListener("change", conferir);
    };
  }, [temCopia]);

  /** A largura de uma volta inteira: a fileira tem os livros duas vezes, então meia fileira é uma volta. */
  const volta = () => (trilho.current ? trilho.current.scrollWidth / 2 : 0);
  // O andar sozinho: um passo por quadro, enquanto ninguém está segurando a vitrine. Só anda quando há loop (podeAndar).
  useEffect(() => {
    const el = janela.current;
    const ul = trilho.current;
    if (!el || !ul || !podeAndar || pausado) return;
    let quadro = 0;
    let antes = performance.now();
    let pos = el.scrollLeft;
    const passo = (agora: number) => {
      const dt = Math.min(0.1, (agora - antes) / 1000);
      antes = agora;
      const s = segurando.current;
      if (!s.mouse && !s.foco && !s.arrasto && agora - ultimaMexida.current > ESPERA_DEPOIS_DE_MEXER) {
        // Se a pessoa rolou a fileira, a vitrine continua de onde ela parou.
        if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft;
        const v = ul.scrollWidth / 2;
        pos += VELOCIDADE * dt;
        if (v > 0 && pos >= v) pos -= v;
        el.scrollLeft = pos;
      } else {
        pos = el.scrollLeft;
      }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [podeAndar, pausado]);

  const mexeu = () => {
    ultimaMexida.current = performance.now();
  };

  /** As setas: andam quase uma tela de livros. No loop, antes de voltar do começo, pula para a cópia (sem salto visível). */
  const andar = (sentido: -1 | 1) => {
    const el = janela.current;
    if (!el) return;
    mexeu();
    const distancia = Math.max(160, el.clientWidth * 0.8) * sentido;
    if (emLoop) {
      // Para trás a partir do começo: pula para a mesma posição na cópia. Para frente: volta da cópia para a primeira volta.
      const v = volta();
      if (sentido < 0 && el.scrollLeft + distancia < 0) el.scrollLeft += v;
      if (sentido > 0 && el.scrollLeft >= v) el.scrollLeft -= v;
    }
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: distancia, behavior: suave ? "smooth" : "auto" });
  };

  // Arrastar com o mouse (no dedo, a rolagem do próprio navegador já faz isso). Quem arrasta não abre o livro sem querer.
  const comecarArrasto = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !janela.current) return;
    arrasto.current = { x: e.clientX, inicio: janela.current.scrollLeft, mexeu: false };
    segurando.current.arrasto = true;
    const mover = (ev: PointerEvent) => {
      const a = arrasto.current;
      const el = janela.current;
      if (!a || !el) return;
      const dx = ev.clientX - a.x;
      if (Math.abs(dx) > 5) a.mexeu = true;
      if (!a.mexeu) return;
      let alvo = a.inicio - dx;
      if (emLoop) {
        const v = volta();
        if (alvo < 0) { alvo += v; a.inicio += v; }
        if (alvo > v) { alvo -= v; a.inicio -= v; }
      }
      el.scrollLeft = alvo;
    };
    const soltar = () => {
      // O clique que vem logo depois de soltar o arrasto não abre o livro. Se a pessoa soltou fora da fileira, esse
      // clique nem chega aqui: a trava se desfaz no próximo ciclo para não engolir o clique seguinte, que é de verdade.
      if (arrasto.current?.mexeu) {
        bloquearClique.current = true;
        setTimeout(() => { bloquearClique.current = false; }, 0);
      }
      arrasto.current = null;
      segurando.current.arrasto = false;
      // Soltou: a vitrine volta a andar depois da espera, mesmo com o mouse ainda por cima (ela só torna a parar se o
      // mouse sair e entrar de novo). Antes, o "mouse por cima" e o foco que o aperto do botão pôs no livro seguravam a
      // vitrine parada até a página ser recarregada (T13).
      segurando.current.mouse = false;
      segurando.current.foco = false;
      mexeu();
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  };

  if (obras.length === 0) return null;
  const botao = "botao botao-papel botao-menor min-h-11";
  return (
    <section
      className="carrossel"
      data-pausado={pausado ? "1" : undefined}
      aria-roledescription="carrossel"
      aria-label={titulo}
      // Só o mouse de verdade segura a vitrine por cima: no toque, o navegador inventa um "mouse entrou" e nunca o
      // "saiu", e a vitrine ficava parada para sempre depois do primeiro toque.
      onPointerEnter={(e) => { if (e.pointerType === "mouse") segurando.current.mouse = true; }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") segurando.current.mouse = false; }}
      // Só o foco do teclado segura (WCAG 2.2.2): o foco que um clique ou um arrasto põe no livro não conta, senão a
      // vitrine ficava parada até a pessoa clicar fora dela.
      onFocus={(e) => { segurando.current.foco = focoDeTeclado(e.target); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) segurando.current.foco = false; }}
    >
      <Tarja titulo={titulo} conta={obras.length} vermelha={vermelha}>
        {podeAndar && (
          <button type="button" aria-pressed={pausado} onClick={() => setPausado((p) => !p)} className={botao}>
            <Pausa tocando={!pausado} />
            {pausado ? rotulo.play : rotulo.pause}
          </button>
        )}
        <span className="flex" role="group" aria-label={titulo}>
          <button type="button" onClick={() => andar(-1)} aria-label={rotulo.back} title={rotulo.back} className={`${botao} carrossel-seta px-3`}>
            <Seta para="tras" />
          </button>
          <button type="button" onClick={() => andar(1)} aria-label={rotulo.forward} title={rotulo.forward} className={`${botao} carrossel-seta -ml-0.5 px-3`}>
            <Seta para="frente" />
          </button>
        </span>
        {verTodas && (
          <button type="button" className={botao} onClick={verTodas}>
            {rotulo.all} →
          </button>
        )}
      </Tarja>
      <div
        ref={janela}
        className="carrossel-janela mt-5"
        onPointerDown={comecarArrasto}
        onWheel={mexeu}
        onTouchStart={mexeu}
        onTouchMove={mexeu}
        onTouchEnd={mexeu}
        onKeyDown={mexeu}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (bloquearClique.current) {
            bloquearClique.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onScroll={() => {
          // Chegou ao fim da fileira (roda do mouse, teclado, seta): volta para a mesma posição na primeira volta.
          const el = janela.current;
          if (!el || !emLoop || arrasto.current) return;
          if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) el.scrollLeft -= volta();
        }}
      >
        <ul ref={trilho} className={`flex w-max pb-3 ${temCopia ? "carrossel-trilho" : ""}`}>
          {lista.map((b, i) => {
            const copia = i >= obras.length;
            return (
              <li key={`${b.id}-${i}`} className="w-[9.5rem] shrink-0 pt-1 pr-6" aria-hidden={copia || undefined}>
                <L href={`/acervo/${b.id}`} className="group block text-ink hover:text-ink" tabIndex={copia ? -1 : undefined} draggable={false}>
                  <span className="block transition-transform duration-150 group-hover:-translate-y-1 group-hover:-rotate-1">
                    <CapaDoLivro book={b} />
                  </span>
                  <span className="mt-3 block line-clamp-2 font-serif text-[0.95rem] font-semibold leading-tight group-hover:underline group-hover:decoration-[#c21f16]">{b.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-[0.65rem] uppercase tracking-[0.08em] text-ink-soft">{b.author}</span>
                </L>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
