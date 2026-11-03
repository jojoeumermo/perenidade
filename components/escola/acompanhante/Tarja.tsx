// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";
import { aplicarTarjas, type Tarja as Retangulo } from "@/lib/escola/acompanhante";
import "@/styles/escola-acompanhante.css";

// A tarja do documento (R1-57): a pessoa risca no canvas o que não quer mandar (CPF, RG, número de conta, dados de
// outras pessoas). A tarja é GRAVADA nos pixels (aplicarTarjas troca a cor de cada pixel coberto por preto): não é uma
// camada por cima, e a imagem que sai é sempre a riscada, refeita a partir da foto já reduzida e sem EXIF
// (imageForAssistant). Dá para riscar com o dedo, com o mouse ou pelo teclado (setas, Shift + setas e Enter).

type S = TextosDoAcompanhante["tarja"];
export interface ImagemRiscada {
  tipo: string;
  dados: string;
}

const LIMITE_BASE64 = 1_900_000;

function exportar(canvas: HTMLCanvasElement): ImagemRiscada | null {
  for (const qualidade of [0.85, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", qualidade);
    const dados = url.slice(url.indexOf(",") + 1);
    if (dados.length <= LIMITE_BASE64) return { tipo: "image/jpeg", dados };
  }
  return null;
}

export function Tarja({ s, foto, aoMudar }: { s: S; foto: ImagemRiscada; aoMudar: (imagem: ImagemRiscada | null, tarjas: number) => void }) {
  const id = useId();
  const canvas = useRef<HTMLCanvasElement>(null);
  const original = useRef<ImageData | null>(null);
  const arrasto = useRef<{ x: number; y: number } | null>(null);
  const [tarjas, setTarjas] = useState<Retangulo[]>([]);
  const [previa, setPrevia] = useState<Retangulo | null>(null);
  const [cursor, setCursor] = useState<Retangulo | null>(null);
  const [pronta, setPronta] = useState(false);
  const exportadas = useRef<Retangulo[] | null>(null);
  const aoMudarRef = useRef(aoMudar);
  useEffect(() => {
    aoMudarRef.current = aoMudar;
  });

  // Carrega a foto no canvas, no tamanho dela (já reduzida no aparelho).
  useEffect(() => {
    const img = new Image();
    let vivo = true;
    img.onload = () => {
      const c = canvas.current;
      const ctx = c?.getContext("2d", { willReadFrequently: true });
      if (!vivo || !c || !ctx) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      original.current = ctx.getImageData(0, 0, c.width, c.height);
      exportadas.current = null;
      setTarjas([]);
      setCursor({ x: c.width * 0.3, y: c.height * 0.45, w: c.width * 0.4, h: c.height * 0.06 });
      setPronta(true);
    };
    img.src = `data:${foto.tipo};base64,${foto.dados}`;
    return () => {
      vivo = false;
    };
  }, [foto]);

  // Redesenha: a foto, as tarjas gravadas nos pixels, a exportação (sem nada por cima) e só então as marcas de ajuda.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d", { willReadFrequently: true });
    const base = original.current;
    if (!pronta || !c || !ctx || !base) return;
    const copia = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    aplicarTarjas(copia.data, copia.width, copia.height, tarjas);
    ctx.putImageData(copia, 0, 0);
    // Exporta só quando as tarjas mudam (mover o quadro do teclado não refaz o JPEG).
    if (exportadas.current !== tarjas) {
      exportadas.current = tarjas;
      aoMudarRef.current(exportar(c), tarjas.length);
    }
    const linha = Math.max(2, Math.round(c.width / 300));
    ctx.lineWidth = linha;
    if (previa) {
      ctx.strokeStyle = "#c21f16";
      ctx.setLineDash([linha * 3, linha * 2]);
      ctx.strokeRect(previa.x, previa.y, previa.w, previa.h);
    }
    if (cursor && document.activeElement === c) {
      ctx.strokeStyle = "#c21f16";
      ctx.setLineDash([]);
      ctx.strokeRect(cursor.x, cursor.y, cursor.w, cursor.h);
    }
  }, [tarjas, previa, cursor, pronta]);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const caixa = c.getBoundingClientRect();
    return { x: ((e.clientX - caixa.left) / caixa.width) * c.width, y: ((e.clientY - caixa.top) / caixa.height) * c.height };
  };

  function teclar(e: React.KeyboardEvent<HTMLCanvasElement>) {
    const c = canvas.current;
    if (!c || !cursor) return;
    const passo = Math.max(4, Math.round(c.width / 50));
    const setas: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (e.key in setas) {
      e.preventDefault();
      const [dx, dy] = setas[e.key];
      setCursor((k) => {
        if (!k) return k;
        if (e.shiftKey) return { ...k, w: Math.max(passo, Math.min(c.width - k.x, k.w + dx * passo)), h: Math.max(passo, Math.min(c.height - k.y, k.h + dy * passo)) };
        return { ...k, x: Math.max(0, Math.min(c.width - k.w, k.x + dx * passo)), y: Math.max(0, Math.min(c.height - k.h, k.y + dy * passo)) };
      });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setTarjas((lista) => [...lista, cursor]);
    }
  }

  return (
    <div className="acompanhante-tarja mt-4">
      <h3 className="font-serif text-xl font-semibold">{s.titulo}</h3>
      <p className="mt-1">{s.instrucao}</p>
      <p id={`${id}-teclado`} className="text-sm text-ink-soft">
        {s.teclado}
      </p>
      <canvas
        ref={canvas}
        tabIndex={0}
        role="application"
        aria-label={s.rotulo}
        aria-describedby={`${id}-teclado`}
        className="mt-3"
        onKeyDown={teclar}
        onFocus={() => setCursor((k) => (k ? { ...k } : k))}
        onBlur={() => setCursor((k) => (k ? { ...k } : k))}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          arrasto.current = ponto(e);
        }}
        onPointerMove={(e) => {
          const inicio = arrasto.current;
          if (!inicio) return;
          const p = ponto(e);
          setPrevia({ x: inicio.x, y: inicio.y, w: p.x - inicio.x, h: p.y - inicio.y });
        }}
        onPointerUp={(e) => {
          const inicio = arrasto.current;
          arrasto.current = null;
          setPrevia(null);
          if (!inicio) return;
          const p = ponto(e);
          // Um toque sem arrastar vira uma faixa curta, do tamanho de uma linha de texto.
          const c = e.currentTarget;
          const w = Math.abs(p.x - inicio.x) < 6 ? c.width * 0.25 : p.x - inicio.x;
          const h = Math.abs(p.y - inicio.y) < 6 ? c.height * 0.04 : p.y - inicio.y;
          const x = Math.abs(p.x - inicio.x) < 6 ? inicio.x - w / 2 : inicio.x;
          const y = Math.abs(p.y - inicio.y) < 6 ? inicio.y - h / 2 : inicio.y;
          setTarjas((lista) => [...lista, { x, y, w, h }]);
        }}
        onPointerCancel={() => {
          arrasto.current = null;
          setPrevia(null);
        }}
      />
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <span aria-live="polite" className="text-sm font-semibold">
          {fill(s.contagem, { n: tarjas.length })}
        </span>
        <button type="button" className="acompanhante-botao-claro" disabled={!tarjas.length} onClick={() => setTarjas((lista) => lista.slice(0, -1))}>
          {s.desfazer}
        </button>
        <button type="button" className="acompanhante-botao-claro" disabled={!tarjas.length} onClick={() => setTarjas([])}>
          {s.limpar}
        </button>
      </p>
    </div>
  );
}
