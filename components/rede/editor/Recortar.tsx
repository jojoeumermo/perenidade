// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Recortar a foto do story de verdade: uma moldura com proporção (9:16, 4:5, 1:1, 16:9 ou livre) que se arrasta e muda de
// tamanho pelo canto, e o giro livre (−45° a 45°). Teclado: setas movem a moldura, Shift + setas mudam o tamanho. A foto nova é
// refeita no aparelho (lib/rede/stories/midia.ts, recortarFoto), sem metadado.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { recortarFoto } from "@/lib/rede/stories/midia";
import { giroLivre, moverRecorte, PROPORCOES, RECORTE_INTEIRO, recorteNaProporcao, redimensionarRecorte, type IdDaProporcao, type Recorte } from "@/lib/rede/stories/recorte";
import type { TextosDosStories } from "@/lib/rede/textos-stories";

type T = TextosDosStories["b1"]["recortar"];

export function Recortar({ t, imagem, aoAplicar, aoCancelar }: { t: T; imagem: Blob; aoAplicar: (b: Blob) => void; aoCancelar: () => void }) {
  const id = useId();
  const [url, setUrl] = useState("");
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  const [proporcao, setProporcao] = useState<IdDaProporcao>("livre");
  const [r, setR] = useState<Recorte>(RECORTE_INTEIRO);
  const [giro, setGiro] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ modo: "mover" | "canto"; x: number; y: number; r: Recorte } | null>(null);
  const valor = PROPORCOES.find((p) => p.id === proporcao)?.valor ?? null;

  useEffect(() => {
    const u = URL.createObjectURL(imagem);
    // O endereço local (blob:) vive enquanto a janela está aberta: sincroniza com o recurso do navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [imagem]);

  useEffect(() => {
    const sair = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoCancelar();
      }
    };
    window.addEventListener("keydown", sair, true);
    return () => window.removeEventListener("keydown", sair, true);
  }, [aoCancelar]);

  const escolher = (p: IdDaProporcao) => {
    setProporcao(p);
    const v = PROPORCOES.find((x) => x.id === p)?.valor ?? null;
    if (medida) setR(recorteNaProporcao(v, medida.w, medida.h, r));
  };

  const baixar = (modo: "mover" | "canto", e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    arrasto.current = { modo, x: e.clientX, y: e.clientY, r };
  };
  const mover = (e: PointerEvent<HTMLElement>) => {
    const a = arrasto.current;
    const c = caixa.current?.getBoundingClientRect();
    if (!a || !c) return;
    const dx = (e.clientX - a.x) / c.width;
    const dy = (e.clientY - a.y) / c.height;
    setR(a.modo === "mover" ? moverRecorte(a.r, dx, dy) : redimensionarRecorte(a.r, dx, dy, valor, medida?.w ?? 0, medida?.h ?? 0));
  };
  const soltar = () => {
    arrasto.current = null;
  };
  const teclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = 0.02;
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key as "ArrowLeft"];
    if (!d) return;
    e.preventDefault();
    setR((x) => (e.shiftKey ? redimensionarRecorte(x, d[0], d[1], valor, medida?.w ?? 0, medida?.h ?? 0) : moverRecorte(x, d[0], d[1])));
  };

  async function aplicar() {
    setOcupado(true);
    try {
      aoAplicar(await recortarFoto(imagem, r, giro));
    } catch {
      aoCancelar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="al-ed-recortar" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
      <div className="al-ed-recortar-caixa">
        <h2 id={`${id}-t`} className="al-cond">
          {t.titulo}
        </h2>
        <div ref={caixa} className="al-ed-recortar-palco" onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
          {url ? (
            // Endereço local do próprio aparelho (blob:), nada de rede.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              style={{ transform: `rotate(${giro}deg)` }}
              onLoad={(e) => setMedida({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
          ) : null}
          <div
            className="al-ed-moldura"
            role="group"
            tabIndex={0}
            aria-label={t.moldura}
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.largura * 100}%`, height: `${r.altura * 100}%` }}
            onPointerDown={(e) => baixar("mover", e)}
            onKeyDown={teclar}
          >
            <span className="al-ed-moldura-grade" aria-hidden />
            <span className="al-ed-moldura-canto" aria-hidden title={t.canto} onPointerDown={(e) => baixar("canto", e)} />
          </div>
        </div>
        <fieldset className="al-ed-recortar-proporcoes">
          <legend>{t.proporcao}</legend>
          {PROPORCOES.map((p) => (
            <label key={p.id} className="al-ed-recortar-op" data-escolhida={proporcao === p.id ? "sim" : "nao"}>
              <input type="radio" name={`${id}-p`} className="sr-only" checked={proporcao === p.id} onChange={() => escolher(p.id)} />
              {p.id === "livre" ? t.livre : p.id}
            </label>
          ))}
        </fieldset>
        <label className="al-ed-recortar-giro">
          {t.giro}: {giro}°
          <input type="range" min={-45} max={45} step={1} value={giro} onChange={(e) => setGiro(giroLivre(Number(e.target.value)))} />
        </label>
        <div className="al-st-caixa-acoes">
          <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={aoCancelar}>
            {t.cancelar}
          </button>
          <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || !medida} aria-busy={ocupado} onClick={() => void aplicar()}>
            {t.aplicar}
          </button>
        </div>
      </div>
    </div>
  );
}
