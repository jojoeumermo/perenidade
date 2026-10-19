// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { lerFerramenta, lerLinhaDoTempo, lerPronuncia } from "@/lib/interativos";
import { L, useI18n } from "../I18n";
import { PendingAudio } from "./PendingAudio";

// Pronúncia (voz do aparelho ou gravação do autor), diagrama (Mermaid, carregado só quando aparece), linha do tempo,
// quadro de desenho e atalho para uma ferramenta do site.

const caixa = "no-print my-6 border-l-2 border-gold bg-parchment-deep p-4 font-sans text-sm";
const claro = "cursor-pointer border-2 border-ink px-3 py-1 font-medium hover:border-oxblood hover:text-oxblood";

export function Pronuncia({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { lingua, frases } = useMemo(() => lerPronuncia(spec), [spec]);
  const [semVoz, setSemVoz] = useState(false);
  const [lento, setLento] = useState(false);
  if (!frases.length) return <pre className="text-sm">{spec}</pre>;
  function falar(texto: string) {
    if (!("speechSynthesis" in window)) return setSemVoz(true);
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = lingua;
    fala.rate = lento ? 0.6 : 1;
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lingua.toLowerCase().slice(0, 2)));
    if (voz) fala.voice = voz;
    else if (window.speechSynthesis.getVoices().length) setSemVoz(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(fala);
  }
  return (
    <div className={caixa}>
      <ul className="space-y-3">
        {frases.map((f, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3">
            {f.audio.startsWith("envio:") ? (
              <PendingAudio path={f.audio.slice(6)} />
            ) : f.audio ? (
              <audio controls preload="none" src={f.audio} className="h-9" aria-label={`${t.blocks.recorded}: ${f.texto}`} />
            ) : (
              <button type="button" className={claro} onClick={() => falar(f.texto)} aria-label={`${t.blocks.listen}: ${f.texto}`}>🔊</button>
            )}
            <span lang={lingua} className="font-serif text-lg">{f.texto}</span>
            {f.traducao && <span className="text-ink-soft">{f.traducao}</span>}
          </li>
        ))}
      </ul>
      <label className="mt-3 flex items-center gap-2 text-xs">
        <input type="checkbox" checked={lento} onChange={(e) => setLento(e.target.checked)} className="accent-[var(--oxblood)]" />
        {t.blocks.slow}
      </label>
      {semVoz && <p className="mt-2 text-xs text-oxblood">{t.blocks.noVoice}</p>}
    </div>
  );
}

let contadorDeDiagramas = 0;

export function Diagrama({ spec }: { spec: string }) {
  const { t } = useI18n();
  const alvo = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    const escuro = document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark";
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: escuro ? "dark" : "neutral", fontFamily: "Inter, system-ui, sans-serif" });
        const { svg } = await mermaid.render(`diagrama-${id}-${++contadorDeDiagramas}`, spec.slice(0, 5000));
        if (vivo && alvo.current) alvo.current.innerHTML = svg;
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [spec, id]);
  return (
    <figure className={caixa}>
      <div ref={alvo} role="img" aria-label={`${t.blocks.diagram}: ${spec.replace(/\s+/g, " ").slice(0, 300)}`} className="overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-full" />
      {falhou && <pre className="text-xs">{spec}</pre>}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer">{t.blocks.diagramText}</summary>
        <pre className="mt-1 whitespace-pre-wrap">{spec}</pre>
      </details>
    </figure>
  );
}

export function LinhaDoTempo({ spec }: { spec: string }) {
  const { t } = useI18n();
  const itens = useMemo(() => lerLinhaDoTempo(spec), [spec]);
  if (!itens.length) return <pre className="text-sm">{spec}</pre>;
  return (
    <section className={caixa} aria-label={t.blocks.timeline}>
      <ol className="relative border-l-2 border-oxblood pl-5">
        {itens.map((item, i) => (
          <li key={i} className="relative mb-4 last:mb-0">
            <span className="absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full border-2 border-parchment bg-oxblood" aria-hidden />
            <p className="font-mono text-xs font-semibold text-oxblood">{item.quando}</p>
            <p className="font-serif text-base">{item.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Desenho({ spec }: { spec: string }) {
  const { t } = useI18n();
  const tela = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [cor, setCor] = useState("#8b1e1e");
  const [borracha, setBorracha] = useState(false);
  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height] as const;
  };
  useEffect(() => {
    const ctx = tela.current?.getContext("2d");
    if (!ctx || !tela.current) return;
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, tela.current.width, tela.current.height);
  }, []);
  return (
    <div className={caixa}>
      <p className="font-serif text-base">{spec.trim()}</p>
      <canvas
        ref={tela}
        width={900}
        height={500}
        aria-label={t.blocks.draw}
        className="mt-3 w-full touch-none border-2 border-ink bg-[#fffdf7]"
        onPointerDown={(e) => {
          desenhando.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d");
          const [x, y] = ponto(e);
          ctx?.beginPath();
          ctx?.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!desenhando.current) return;
          const ctx = e.currentTarget.getContext("2d");
          if (!ctx) return;
          const [x, y] = ponto(e);
          ctx.strokeStyle = borracha ? "#fffdf7" : cor;
          ctx.lineWidth = borracha ? 24 : 4;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => (desenhando.current = false)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {["#8b1e1e", "#1f1f1f", "#c9a227", "#3d6fd6", "#3fa34d"].map((c) => (
          <button key={c} type="button" aria-label={`${t.blocks.color} ${c}`} aria-pressed={!borracha && cor === c} onClick={() => { setCor(c); setBorracha(false); }} className={`h-7 w-7 cursor-pointer rounded-full border-2 ${!borracha && cor === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} />
        ))}
        <button type="button" className={claro} aria-pressed={borracha} onClick={() => setBorracha((b) => !b)}>{t.blocks.eraser}</button>
        <button type="button" className={claro} onClick={() => { const c = tela.current; const ctx = c?.getContext("2d"); if (c && ctx) { ctx.fillStyle = "#fffdf7"; ctx.fillRect(0, 0, c.width, c.height); } }}>{t.blocks.clear}</button>
        <button type="button" className={claro} onClick={() => { const a = document.createElement("a"); a.href = tela.current?.toDataURL("image/png") ?? ""; a.download = "desenho.png"; a.click(); }}>{t.blocks.download}</button>
      </div>
    </div>
  );
}

export function Ferramenta({ spec }: { spec: string }) {
  const { t } = useI18n();
  const f = lerFerramenta(spec);
  if (!f) return <pre className="text-sm">{spec}</pre>;
  return (
    <p className="no-print my-6 font-sans">
      <L href={`/ferramentas/${f.id}`} className="inline-block bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood">{f.rotulo || t.blocks.open} →</L>
    </p>
  );
}
