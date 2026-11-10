// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./editor.css";
import { useRef, type CSSProperties, type KeyboardEvent as EventoDeTecla, type PointerEvent as EventoDePonteiro } from "react";
import { cortarTrecho, relogio } from "@/lib/rede/stories/midia";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["criar"]["midia"];

/**
 * O corte do vídeo: a tira de quadros, as duas alças (começo e fim, cada uma um "slider" de verdade para o teclado e o leitor de
 * tela: setas andam 0,5 s, Shift+setas 5 s, Home/End vão às pontas) e o meio que arrasta o trecho inteiro. No máximo 60 s, no
 * mínimo 1 s. A agulha mostra onde a prévia está tocando.
 */
export function Cortar({
  t,
  total,
  inicio,
  fim,
  agulha,
  miniaturas,
  aoMudar,
}: {
  t: T;
  total: number;
  inicio: number;
  fim: number;
  /** Onde a prévia está agora (ms), para a agulha. */
  agulha: number;
  miniaturas: string[];
  aoMudar: (inicio: number, fim: number) => void;
}) {
  const tira = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ qual: "ini" | "fim" | "meio"; x0: number; i0: number; f0: number } | null>(null);
  const pct = (ms: number) => `${(Math.min(1, Math.max(0, ms / Math.max(1, total))) * 100).toFixed(3)}%`;

  const mover = (qual: "ini" | "fim" | "meio", i0: number, f0: number, delta: number) => {
    if (qual === "ini") {
      // O fim fica parado; o começo anda entre (fim − 60 s) e (fim − 1 s).
      const ini = Math.min(Math.max(0, f0 - 60_000, i0 + delta), Math.max(0, f0 - 1000));
      const c = cortarTrecho(ini, f0, total);
      aoMudar(c.inicio, c.fim);
    } else if (qual === "fim") {
      const novoFim = Math.min(total, Math.min(i0 + 60_000, Math.max(i0 + 1000, f0 + delta)));
      const c = cortarTrecho(i0, novoFim, total);
      aoMudar(c.inicio, c.fim);
    } else {
      const largura = f0 - i0;
      const ini = Math.min(Math.max(0, i0 + delta), total - largura);
      aoMudar(Math.round(ini), Math.round(ini + largura));
    }
  };

  const baixo = (e: EventoDePonteiro<HTMLElement>) => {
    const qual = e.currentTarget.dataset.qual as "ini" | "fim" | "meio";
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { qual, x0: e.clientX, i0: inicio, f0: fim };
  };
  const move = (e: EventoDePonteiro<HTMLElement>) => {
    const a = arrasto.current;
    const r = tira.current?.getBoundingClientRect();
    if (!a || !r) return;
    mover(a.qual, a.i0, a.f0, ((e.clientX - a.x0) / r.width) * total);
  };
  const cima = () => {
    arrasto.current = null;
  };
  const tecla = (qual: "ini" | "fim") => (e: EventoDeTecla<HTMLElement>) => {
    const passo = e.shiftKey ? 5000 : 500;
    let delta: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -passo;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = passo;
    else if (e.key === "Home") delta = -total;
    else if (e.key === "End") delta = total;
    if (delta === null) return;
    e.preventDefault();
    mover(qual, inicio, fim, delta);
  };

  const dur = fim - inicio;
  return (
    <div className="al-ed-cortar">
      <p className="al-ed-cortar-rotulo">
        <strong>{t.cortar}</strong>
        <span aria-live="polite">{preencherStory(t.trecho, { dur: relogio(dur), ini: relogio(inicio), fim: relogio(fim) })}</span>
      </p>
      <div ref={tira} className="al-ed-tira" style={{ "--ini": pct(inicio), "--fim": pct(fim) } as CSSProperties}>
        <div className="al-ed-tira-quadros" aria-hidden>
          {miniaturas.length > 0 ? miniaturas.map((m, k) => (
            // Miniaturas locais do próprio aparelho (blob:), nada de rede.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={k} src={m} alt="" />
          )) : <span className="al-ed-tira-vazia" />}
        </div>
        <span className="al-ed-tira-fora al-ed-tira-fora-ini" aria-hidden />
        <span className="al-ed-tira-fora al-ed-tira-fora-fim" aria-hidden />
        <span className="al-ed-tira-janela" aria-hidden data-qual="meio" onPointerDown={baixo} onPointerMove={move} onPointerUp={cima} onPointerCancel={cima} />
        <span className="al-ed-agulha" aria-hidden style={{ left: pct(agulha) }} />
        {(["ini", "fim"] as const).map((q) => (
          <span
            key={q}
            role="slider"
            tabIndex={0}
            className={`al-ed-alca al-ed-alca-${q}`}
            aria-label={q === "ini" ? t.inicio : t.fim}
            aria-valuemin={0}
            aria-valuemax={Math.round(total / 1000)}
            aria-valuenow={Math.round((q === "ini" ? inicio : fim) / 1000)}
            aria-valuetext={relogio(q === "ini" ? inicio : fim)}
            data-qual={q}
            onPointerDown={baixo}
            onPointerMove={move}
            onPointerUp={cima}
            onPointerCancel={cima}
            onKeyDown={tecla(q)}
          />
        ))}
      </div>
    </div>
  );
}
