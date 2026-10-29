// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";
import type { ToolId } from "@/lib/areas";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { ABRIR_CAIXA } from "./aula/MargemDaAula";
import { ToolView } from "./tools/ToolView";

const TAMANHO = "lucia:caixa-tamanho";
type Tamanho = { largura: number; altura: number; cheia: boolean };

type Tools = Dict["tools"];

/**
 * A caixa de ferramentas das aulas: a calculadora, o resolvedor, a tabela periódica… sem sair da página. Não é uma
 * janela que tranca a tela: no computador ela abre ao lado e a aula se afasta para a esquerda; no celular, sobe de
 * baixo, acima da barra de navegação, e a aula continua rolando por trás. A ferramenta só é baixada quando se abre, e o
 * que se digitou nela continua lá ao fechar e abrir de novo.
 */
export function Caixa({ ferramentas, sugeridas, area, nomes, s, lang, laboratorios = [] }: { ferramentas: ToolId[]; sugeridas: ToolId[]; area: string; nomes: Record<string, string[]>; s: Partial<Tools> & { box: Tools["box"] }; lang: string; laboratorios?: { id: string; nome: string; caminho: string }[] }) {
  const b = s.box;
  const [aberta, setAberta] = useState(false);
  // A escolha é uma ferramenta ("calculadora") ou um laboratório ("lab:linux"), que abre a página dele aqui dentro.
  const [atual, setAtual] = useState<ToolId | `lab:${string}`>(ferramentas[0]);
  const [montadas, setMontadas] = useState<(ToolId | `lab:${string}`)[]>([]);
  const labAtual = atual.startsWith("lab:") ? laboratorios.find((l) => `lab:${l.id}` === atual) : undefined;
  // O tamanho escolhido pela pessoa (arrastando a borda): largura no computador, altura no celular. Fica guardado.
  const [tamanho, setTamanho] = useState<Tamanho>({ largura: 0, altura: 0, cheia: false });
  const caixa = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(TAMANHO) ?? "null") as Partial<Tamanho> | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- o tamanho guardado só existe no navegador
      if (v) setTamanho({ largura: Number(v.largura) || 0, altura: Number(v.altura) || 0, cheia: Boolean(v.cheia) });
    } catch {
      // nada guardado
    }
  }, []);
  const guardarTamanho = (novo: Tamanho) => {
    setTamanho(novo);
    try {
      localStorage.setItem(TAMANHO, JSON.stringify(novo));
    } catch {
      // sem armazenamento: vale até fechar a página
    }
  };
  // Arrastar a borda (o mouse, o dedo ou a caneta): no computador muda a largura, no celular a altura.
  function arrastar(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const largo = window.matchMedia("(min-width: 1024px)").matches;
    const alvo = e.currentTarget;
    alvo.setPointerCapture(e.pointerId);
    let ultimo = tamanho;
    const mover = (ev: PointerEvent) => {
      ultimo = largo
        ? { ...tamanho, cheia: false, largura: Math.round(Math.min(window.innerWidth * 0.92, Math.max(320, window.innerWidth - ev.clientX))) }
        : { ...tamanho, cheia: false, altura: Math.round(Math.min(window.innerHeight * 0.92, Math.max(200, window.innerHeight - ev.clientY - 72))) };
      setTamanho(ultimo);
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      guardarTamanho(ultimo);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }
  // Pelo teclado: com o foco na borda, as setas mudam o tamanho de 40 em 40 px.
  function teclaNaBorda(e: React.KeyboardEvent<HTMLDivElement>) {
    const largo = window.matchMedia("(min-width: 1024px)").matches;
    const passo = e.key === "ArrowLeft" || e.key === "ArrowUp" ? 40 : e.key === "ArrowRight" || e.key === "ArrowDown" ? -40 : 0;
    if (!passo) return;
    e.preventDefault();
    const atualLargura = tamanho.largura || caixa.current?.offsetWidth || 448;
    const atualAltura = tamanho.altura || caixa.current?.offsetHeight || 400;
    guardarTamanho(
      largo
        ? { ...tamanho, cheia: false, largura: Math.min(window.innerWidth * 0.92, Math.max(320, atualLargura + passo)) }
        : { ...tamanho, cheia: false, altura: Math.min(window.innerHeight * 0.92, Math.max(200, atualAltura + passo)) },
    );
  }
  const botao = useRef<HTMLButtonElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Na primeira vez que a caixa abre nesta página, volta à última ferramenta usada nesta disciplina.
  function ultimaUsada(): ToolId | `lab:${string}` {
    if (montadas.length) return atual;
    try {
      const guardado = JSON.parse(getItem(KEYS.tools) || "{}") as Record<string, string>;
      const ultima = guardado[area] as ToolId | undefined;
      if (ultima && (ferramentas.includes(ultima) || laboratorios.some((l) => `lab:${l.id}` === ultima))) return ultima;
    } catch {
      // nada guardado ainda
    }
    return atual;
  }

  // A aula abre espaço no computador enquanto a caixa está aberta (a regra fica em app/globals.css), do tamanho dela.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.toggle("caixa-aberta", aberta);
    if (aberta && tamanho.largura && !tamanho.cheia) raiz.style.setProperty("--largura-caixa", `${tamanho.largura}px`);
    else raiz.style.removeProperty("--largura-caixa");
    return () => {
      raiz.classList.remove("caixa-aberta");
      raiz.style.removeProperty("--largura-caixa");
    };
  }, [aberta, tamanho.largura, tamanho.cheia]);

  // O cartão do laboratório na margem da aula abre a caixa direto nele.
  useEffect(() => {
    const abrirDeFora = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!id) return abrir(ultimaUsada());
      if ((ferramentas.includes(id as ToolId) || laboratorios.some((l) => `lab:${l.id}` === id))) abrir(id as ToolId | `lab:${string}`);
    };
    window.addEventListener(ABRIR_CAIXA, abrirDeFora);
    return () => window.removeEventListener(ABRIR_CAIXA, abrirDeFora);
  });

  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta]);

  function abrir(id: ToolId | `lab:${string}` = atual) {
    setAtual(id);
    setMontadas((lista) => (lista.includes(id) ? lista : [...lista, id]));
    setAberta(true);
    try {
      const guardado = JSON.parse(getItem(KEYS.tools) || "{}") as Record<string, string>;
      setItem(KEYS.tools, JSON.stringify({ ...guardado, [area]: id }));
    } catch {
      setItem(KEYS.tools, JSON.stringify({ [area]: id }));
    }
    window.setTimeout(() => titulo.current?.focus(), 0);
  }
  function fechar() {
    setAberta(false);
    window.setTimeout(() => botao.current?.focus(), 0);
  }

  return (
    <div className="no-print font-sans text-sm">
      {!aberta && (
        <button
          ref={botao}
          type="button"
          onClick={() => abrir(ultimaUsada())}
          aria-label={b.openLabel}
          aria-expanded={false}
          aria-controls="caixa-de-ferramentas"
          className="botao-da-caixa fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom,0px))] right-3 z-40 flex xl:hidden items-center gap-2 border-2 border-ink bg-parchment px-3 py-2.5 font-medium shadow-[3px_3px_0_var(--ink)] hover:border-oxblood hover:text-oxblood md:bottom-20 md:right-4"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h18v12H3zM8 8V5h8v3M3 13h18M10 13v2h4v-2" />
          </svg>
          {b.open}
        </button>
      )}
      <section
        ref={caixa}
        id="caixa-de-ferramentas"
        aria-label={b.title}
        hidden={!aberta}
        style={
          {
            "--caixa-largura": tamanho.cheia ? "100vw" : tamanho.largura ? `${tamanho.largura}px` : labAtual ? "min(60rem, 62vw)" : "28rem",
            "--caixa-altura": tamanho.cheia ? "calc(100dvh - 5rem - env(safe-area-inset-bottom, 0px))" : tamanho.altura ? `${tamanho.altura}px` : labAtual ? "78dvh" : "52dvh",
          } as React.CSSProperties
        }
        className="caixa-da-aula fixed inset-x-0 z-40 flex h-[var(--caixa-altura)] max-h-[calc(100dvh-5rem-env(safe-area-inset-bottom,0px))] flex-col border-t-[3px] border-ink bg-parchment shadow-[0_-6px_24px_rgba(0,0,0,0.25)] bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 lg:inset-y-0 lg:left-auto lg:right-0 lg:!h-auto lg:max-h-none lg:w-[var(--caixa-largura)] lg:border-l-[3px] lg:border-t-0 lg:shadow-none"
      >
        {/* A borda que se arrasta: à esquerda no computador, no alto no celular. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={b.resize}
          title={b.resize}
          tabIndex={0}
          onPointerDown={arrastar}
          onKeyDown={teclaNaBorda}
          className="caixa-borda group absolute z-10 touch-none max-lg:inset-x-0 max-lg:-top-3 max-lg:h-6 max-lg:cursor-ns-resize lg:inset-y-0 lg:-left-2 lg:w-4 lg:cursor-ew-resize"
        >
          <span aria-hidden className="absolute bg-ink/40 group-hover:bg-[#c21f16] group-focus-visible:bg-[#c21f16] max-lg:left-1/2 max-lg:top-2 max-lg:h-1.5 max-lg:w-16 max-lg:-translate-x-1/2 lg:left-1.5 lg:top-1/2 lg:h-16 lg:w-1.5 lg:-translate-y-1/2" />
        </div>
        <header className="flex items-center gap-2 border-b-2 border-ink px-3 py-2">
          <h2 ref={titulo} tabIndex={-1} className="mr-auto font-serif text-lg font-semibold outline-none">{b.title}</h2>
          {labAtual && (
            <a href={labAtual.caminho} target="_blank" rel="noopener" title={labAtual.nome} className="border border-rule px-2 py-1 hover:border-ink">
              ↗<span className="sr-only">{labAtual.nome}</span>
            </a>
          )}
          <button type="button" onClick={() => guardarTamanho({ ...tamanho, cheia: !tamanho.cheia })} className="cursor-pointer border border-rule px-2 py-1 hover:border-ink" aria-pressed={tamanho.cheia}>
            {tamanho.cheia ? b.restore : b.maximize}
          </button>
          <button type="button" onClick={fechar} className="cursor-pointer border-2 border-ink px-3 py-1 font-medium hover:border-oxblood hover:text-oxblood">
            {b.close}
          </button>
        </header>
        <nav aria-label={b.choose} className="flex gap-1.5 overflow-x-auto border-b border-rule px-3 py-2 [scrollbar-width:thin]">
          {ferramentas.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => abrir(id)}
              aria-current={atual === id ? "true" : undefined}
              title={nomes[id]?.[1]}
              className={`shrink-0 cursor-pointer whitespace-nowrap border px-2.5 py-1 ${atual === id ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment-deep hover:border-ink"}`}
            >
              {nomes[id]?.[0] ?? id}
              {sugeridas.includes(id) && <span className="sr-only"> · {b.suggested}</span>}
              {sugeridas.includes(id) && <span aria-hidden className="ml-1 text-gold">★</span>}
            </button>
          ))}
          {laboratorios.length > 0 && <span aria-hidden className="mx-1 w-px shrink-0 bg-rule" />}
          {laboratorios.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => abrir(`lab:${l.id}`)}
              aria-current={atual === `lab:${l.id}` ? "true" : undefined}
              className={`shrink-0 cursor-pointer whitespace-nowrap border px-2.5 py-1 ${atual === `lab:${l.id}` ? "border-ink bg-ink text-parchment" : "border-[#c21f16]/50 bg-parchment-deep hover:border-ink"}`}
            >
              <span aria-hidden></span>{l.nome}
            </button>
          ))}
        </nav>
        <div className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {/* Toda ferramenta aberta continua montada: o que se digitou não se perde ao trocar de ferramenta ou fechar a caixa. */}
          {montadas.map((id) => {
            if (id.startsWith("lab:")) {
              const lab = laboratorios.find((l) => `lab:${l.id}` === id);
              // O laboratório é a própria página dele, aberta aqui dentro (mesmo endereço do site, sem cabeçalho nem rodapé).
              return lab ? (
                <div key={id} hidden={id !== atual} className="-mx-4 h-full">
                  <iframe src={lab.caminho} title={lab.nome} className="h-full min-h-[60dvh] w-full border-0 bg-parchment" allow="clipboard-write; fullscreen" />
                </div>
              ) : null;
            }
            return (
              <div key={id} hidden={id !== atual} className="[&>div]:!mt-4">
                <ToolView id={id as ToolId} s={s} lang={lang} area={area} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
