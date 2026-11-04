// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import type { TextosPublicar } from "@/lib/rede/textos-publicar";
import { acharRostos, type AreaBorrada, temDetectorDeRostos } from "./imagem";

/**
 * Borrar rostos numa imagem. Com o detector do navegador, "Achar rostos" marca sozinho; sem ele (ou para o que ele não achou), a
 * pessoa arrasta um retângulo sobre cada rosto. As áreas aparecem tracejadas; "Pronto" devolve a lista e quem chamou aplica o
 * borrado (imagem.ts) sobre a imagem-base. Janela dentro da página (nunca alert/confirm do navegador).
 */
export function BorrarRostos({ t, base, areasIniciais, aoConcluir, aoCancelar }: { t: TextosPublicar; base: Blob; areasIniciais: AreaBorrada[]; aoConcluir: (areas: AreaBorrada[]) => void; aoCancelar: () => void }) {
  const [areas, setAreas] = useState<AreaBorrada[]>(areasIniciais);
  const [url, setUrl] = useState("");
  const [rascunho, setRascunho] = useState<AreaBorrada | null>(null);
  const [procurando, setProcurando] = useState(false);
  const [semRosto, setSemRosto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const detector = temDetectorDeRostos();

  useEffect(() => {
    const u = URL.createObjectURL(base);
    // Um endereço local (blob:) vive enquanto a janela está aberta: sincroniza com o recurso do navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [base]);

  useEffect(() => {
    const sair = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoCancelar();
    };
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [aoCancelar]);

  const ponto = (e: React.PointerEvent) => {
    const r = caixa.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const retangulo = (a: { x: number; y: number }, b: { x: number; y: number }): AreaBorrada => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  async function procurar() {
    setProcurando(true);
    setSemRosto(false);
    const achadas = await acharRostos(base);
    setProcurando(false);
    if (!achadas.length) return setSemRosto(true);
    setAreas((atuais) => [...atuais, ...achadas]);
  }

  const botao = "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-sans font-bold hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label={t.imagens.borrar}>
      <div className="flex max-h-full w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-2xl border-[1.5px] border-ink bg-parchment p-4 font-sans">
        <h2 className="font-serif text-lg font-semibold">{t.imagens.borrar}</h2>
        {(!detector || semRosto) && <p className="text-sm text-ink-soft">{t.imagens.semDetector}</p>}
        <div
          ref={caixa}
          className="relative mx-auto max-h-[60vh] w-full touch-none select-none overflow-hidden rounded-md border border-rule"
          style={{ cursor: "crosshair" }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            inicio.current = ponto(e);
            setRascunho(null);
          }}
          onPointerMove={(e) => {
            if (inicio.current) setRascunho(retangulo(inicio.current, ponto(e)));
          }}
          onPointerUp={(e) => {
            if (inicio.current) {
              const r = retangulo(inicio.current, ponto(e));
              if (r.w > 0.02 && r.h > 0.02) setAreas((a) => [...a, r]);
            }
            inicio.current = null;
            setRascunho(null);
          }}
        >
          {/* A imagem local (blob:), só para desenhar as áreas. */}
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" draggable={false} className="block max-h-[60vh] w-full object-contain" />
          )}
          {[...areas, ...(rascunho ? [rascunho] : [])].map((a, i) => (
            <div key={i} className="pointer-events-none absolute border-2 border-dashed border-[#c21f16] bg-black/30" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }} />
          ))}
        </div>
        <p role="status" className="text-sm text-ink-soft">
          {preencher(t.imagens.borradas, { n: areas.length })}
        </p>
        <div className="flex flex-wrap gap-2">
          {detector && (
            <button type="button" className={botao} disabled={procurando} onClick={() => void procurar()}>
              {procurando ? t.imagens.preparando : t.imagens.achar}
            </button>
          )}
          <button type="button" className={botao} disabled={!areas.length} onClick={() => setAreas((a) => a.slice(0, -1))}>
            {t.imagens.desfazer}
          </button>
          <span className="flex-1" />
          <button type="button" className={botao} onClick={aoCancelar}>
            {t.imagens.cancelar}
          </button>
          <button type="button" className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-sans font-bold text-white hover:bg-[#1f1a14]" onClick={() => aoConcluir(areas)}>
            {t.imagens.pronto}
          </button>
        </div>
      </div>
    </div>
  );
}
