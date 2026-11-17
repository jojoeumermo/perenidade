// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { type Arranjo, ladrilhosDaColagem, passoDoCarrossel } from "@/lib/rede/publicar/compositor";
import { preencher } from "@/lib/rede/preencher";
import type { MidiaDoPost } from "@/lib/rede/tipos";
import type { TextosDoCompositor } from "./textos";
import "./compositor.css";

/**
 * As imagens de um post no cartão, no arranjo que quem escreveu escolheu (onda 12, 12A):
 *   grade      a de sempre (duas colunas);
 *   carrossel  uma por vez, com setas, o "2 de 5" e as bolinhas; no celular, arrastar com o dedo (rolagem com encaixe, do próprio
 *              navegador); no teclado, as setas andam quando o carrossel tem o foco;
 *   colagem    ladrilhos de tamanhos diferentes numa grade de 6 colunas (lib/rede/publicar/compositor.ts, ladrilhosDaColagem).
 * A legenda de cada imagem aparece embaixo dela, para todo mundo. A imagem em si (endereço assinado, ALT, selo) é a do cartão de
 * sempre, que vem em `imagem` (uma função, chamada aqui, para a imagem não ser montada de novo a cada desenho).
 */
export function ImagensDoPost({
  midia,
  arranjo,
  legendas,
  t,
  imagem,
}: {
  midia: MidiaDoPost[];
  arranjo: Arranjo;
  legendas: Record<string, string>;
  t: TextosDoCompositor;
  imagem: (p: { m: MidiaDoPost; n: number; total: number; preencher?: boolean }) => React.ReactNode;
}) {
  const total = midia.length;
  if (arranjo === "carrossel" && total > 1) return <Carrossel midia={midia} legendas={legendas} t={t} imagem={imagem} />;
  if (arranjo === "colagem" && total > 1) {
    const ladrilhos = ladrilhosDaColagem(total);
    return (
      <div className="cp-colagem mt-2">
        {midia.map((m, n) => (
          <figure key={m.id} className="cp-colagem-item" style={{ gridColumn: `span ${ladrilhos[n].colunas}`, gridRow: `span ${ladrilhos[n].linhas}` }}>
            {imagem({ m, n, total, preencher: true })}
            {legendas[m.id] && <figcaption className="cp-legenda cp-legenda-sobre">{legendas[m.id]}</figcaption>}
          </figure>
        ))}
      </div>
    );
  }
  return (
    <div className={`mt-2 grid gap-1.5 ${total > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {midia.map((m, n) => (
        <figure key={m.id} className="m-0 min-w-0">
          {imagem({ m, n, total })}
          {legendas[m.id] && <figcaption className="cp-legenda">{legendas[m.id]}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

function Carrossel({ midia, legendas, t, imagem }: { midia: MidiaDoPost[]; legendas: Record<string, string>; t: TextosDoCompositor; imagem: (p: { m: MidiaDoPost; n: number; total: number; preencher?: boolean }) => React.ReactNode }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const total = midia.length;
  const comLegenda = midia.some((m) => Boolean(legendas[m.id]));
  // A imagem à vista acompanha a rolagem (dedo, roda do mouse ou setas): a mais centrada no trilho.
  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => setAtual(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", medir, { passive: true });
    return () => {
      cancelAnimationFrame(quadro);
      el.removeEventListener("scroll", medir);
    };
  }, []);
  const ir = (n: number) => {
    const el = trilho.current;
    if (!el) return;
    const alvo = Math.min(total - 1, Math.max(0, n));
    const parado = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: alvo * el.clientWidth, behavior: parado ? "auto" : "smooth" });
    setAtual(alvo);
  };
  return (
    <div className="cp-carrossel mt-2" role="group" aria-roledescription="carousel" aria-label={preencher(t.imagens.posicao, { n: atual + 1, total })}>
      <div
        ref={trilho}
        className="cp-carrossel-trilho"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            ir(passoDoCarrossel(atual, total, e.key === "ArrowRight" ? 1 : -1));
          }
        }}
      >
        {midia.map((m, n) => (
          <figure key={m.id} className="cp-carrossel-item" aria-hidden={n !== atual} inert={n !== atual} aria-label={preencher(t.imagens.posicao, { n: n + 1, total })}>
            {imagem({ m, n, total, preencher: true })}
            {legendas[m.id] && <figcaption className="sr-only">{legendas[m.id]}</figcaption>}
          </figure>
        ))}
      </div>
      {comLegenda && (
        // A legenda da imagem à vista numa faixa sólida embaixo dela (como a do vídeo), nunca em cima da foto: o contraste não
        // depende da imagem. O leitor de tela lê a legenda de cada imagem pela figcaption.
        <div className="cp-carrossel-pe" aria-hidden>
          <Pontos midia={midia} atual={atual} />
          <p className="cp-carrossel-legenda">{legendas[midia[atual]?.id ?? ""] ?? ""}</p>
        </div>
      )}
      <span className="cp-carrossel-contador" aria-hidden>
        {atual + 1}/{total}
      </span>
      <button type="button" className="cp-carrossel-seta cp-carrossel-seta-antes" onClick={() => ir(atual - 1)} disabled={atual === 0} aria-label={t.imagens.anterior} title={t.imagens.anterior}>
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="cp-carrossel-seta cp-carrossel-seta-depois" onClick={() => ir(atual + 1)} disabled={atual === total - 1} aria-label={t.imagens.proxima} title={t.imagens.proxima}>
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
          <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* As bolinhas só mostram onde se está (as setas e o dedo é que andam): alvo pequeno não vira botão. */}
      {!comLegenda && <Pontos midia={midia} atual={atual} />}
      <p className="sr-only" aria-live="polite">
        {preencher(t.imagens.posicao, { n: atual + 1, total })}
      </p>
    </div>
  );
}

function Pontos({ midia, atual }: { midia: MidiaDoPost[]; atual: number }) {
  return (
    <div className="cp-carrossel-pontos" aria-hidden>
      {midia.map((m, n) => (
        <span key={m.id} className="cp-carrossel-ponto" data-atual={n === atual ? "" : undefined} />
      ))}
    </div>
  );
}
