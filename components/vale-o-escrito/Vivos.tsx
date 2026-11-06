// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState, type ElementType } from "react";

// Microinterações de texto do Vale o Escrito: o título que se revela letra a letra (como um terminal que decifra) e o
// contador que sobe até o número quando aparece na tela. O servidor manda o texto e o número finais (sem JavaScript, ou com
// "reduzir movimento", é isso que fica); o leitor de tela sempre recebe o texto inteiro, nunca as letras sorteadas.

const SIMBOLOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#_-·";

const calmo = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

/** Texto que se revela: cada letra passa por símbolos sorteados até assentar, da esquerda para a direita. */
export function Revelar({ texto, como: Tag = "span", className, duracao = 900 }: { texto: string; como?: ElementType; className?: string; duracao?: number }) {
  const [visto, setVisto] = useState(texto);
  useEffect(() => {
    if (calmo()) return;
    const letras = Array.from(texto);
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / duracao);
      const firmes = Math.floor(p * letras.length);
      setVisto(letras.map((c, i) => (i < firmes || c === " " ? c : SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)])).join(""));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [texto, duracao]);
  return (
    <Tag className={className}>
      <span className="ve-so-leitor">{texto}</span>
      <span aria-hidden="true">{visto}</span>
    </Tag>
  );
}

/** Número que conta de 0 até o valor quando entra na tela (uma vez). */
export function Contador({ valor, formatar = (n: number) => String(n) }: { valor: number; formatar?: (n: number) => string }) {
  const [n, setN] = useState(valor);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || calmo() || valor <= 0 || typeof IntersectionObserver === "undefined") return;
    let quadro = 0;
    const io = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const inicio = performance.now();
      const passo = (agora: number) => {
        const p = Math.min(1, (agora - inicio) / 1100);
        setN(Math.round(valor * (1 - Math.pow(2, -10 * p))));
        if (p < 1) quadro = requestAnimationFrame(passo);
        else setN(valor);
      };
      setN(0);
      quadro = requestAnimationFrame(passo);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(quadro);
    };
  }, [valor]);
  return (
    <span ref={ref} className="ve-contador-n">
      <span className="ve-so-leitor">{formatar(valor)}</span>
      <span aria-hidden="true">{formatar(n)}</span>
    </span>
  );
}
