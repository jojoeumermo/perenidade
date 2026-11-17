// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { limitarRecorte, quadroDoRecorte, ZOOM_MAXIMO, type Recorte } from "@/lib/rede/identidade";
import { desenharRecorte } from "./foto";
import type { TextosDaIdentidade } from "./textos";

const LADO_NA_TELA = 560;

/**
 * O recorte da foto: a pessoa arrasta para enquadrar e aproxima com a régua. O que se vê no quadro é exatamente o que será
 * gravado (o mesmo desenho, em 240 px). Funciona no dedo, no mouse e no teclado (setas movem; + e - aproximam). Nada sai do
 * aparelho aqui.
 */
export function RecorteDaFoto({ bitmap, recorte, aoMudar, t }: { bitmap: ImageBitmap; recorte: Recorte; aoMudar: (r: Recorte) => void; t: TextosDaIdentidade }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<{ x: number; y: number; de: Recorte } | null>(null);
  const idAjuda = useId();
  const idZoom = useId();

  useEffect(() => {
    if (canvas.current) desenharRecorte(canvas.current, bitmap, recorte, LADO_NA_TELA);
  }, [bitmap, recorte]);

  /** Anda o quadro `dx`, `dy` (em fração do quadro visto): arrastar a foto para a direita leva o quadro para a esquerda. */
  function andar(de: Recorte, dx: number, dy: number): Recorte {
    const q = quadroDoRecorte(bitmap.width, bitmap.height, de);
    const sobraX = bitmap.width - q.lado;
    const sobraY = bitmap.height - q.lado;
    return limitarRecorte({
      zoom: de.zoom,
      x: sobraX > 0 ? de.x - (2 * dx * q.lado) / sobraX : 0,
      y: sobraY > 0 ? de.y - (2 * dy * q.lado) / sobraY : 0,
    });
  }

  function aoApertar(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, de: recorte };
  }
  function aoMover(e: PointerEvent<HTMLCanvasElement>) {
    const a = arrasto.current;
    if (!a) return;
    const lado = e.currentTarget.getBoundingClientRect().width || 1;
    aoMudar(andar(a.de, (e.clientX - a.x) / lado, (e.clientY - a.y) / lado));
  }
  function aoSoltar() {
    arrasto.current = null;
  }
  function aoTeclar(e: KeyboardEvent<HTMLCanvasElement>) {
    const passo = e.shiftKey ? 0.1 : 0.03;
    const mapa: Record<string, () => Recorte> = {
      ArrowLeft: () => andar(recorte, passo, 0),
      ArrowRight: () => andar(recorte, -passo, 0),
      ArrowUp: () => andar(recorte, 0, passo),
      ArrowDown: () => andar(recorte, 0, -passo),
      "+": () => limitarRecorte({ ...recorte, zoom: recorte.zoom + 0.15 }),
      "=": () => limitarRecorte({ ...recorte, zoom: recorte.zoom + 0.15 }),
      "-": () => limitarRecorte({ ...recorte, zoom: recorte.zoom - 0.15 }),
    };
    const f = mapa[e.key];
    if (!f) return;
    e.preventDefault();
    aoMudar(f());
  }

  return (
    <div className="ali-recorte">
      <div className="ali-recorte-quadro">
        <canvas
          ref={canvas}
          className="ali-recorte-tela"
          width={LADO_NA_TELA}
          height={LADO_NA_TELA}
          tabIndex={0}
          role="application"
          aria-label={t.foto.recorte.area}
          aria-describedby={idAjuda}
          onPointerDown={aoApertar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onKeyDown={aoTeclar}
        />
        <span aria-hidden className="ali-recorte-guia" />
      </div>
      <p id={idAjuda} className="ali-miudo">
        {t.foto.recorte.ajuda}
      </p>
      <label className="ali-zoom" htmlFor={idZoom}>
        <span>{t.foto.recorte.zoom}</span>
        <input id={idZoom} type="range" min={1} max={ZOOM_MAXIMO} step={0.01} value={recorte.zoom} onChange={(e) => aoMudar(limitarRecorte({ ...recorte, zoom: Number(e.target.value) }))} />
      </label>
    </div>
  );
}
