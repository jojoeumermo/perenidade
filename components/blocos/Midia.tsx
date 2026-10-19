// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { lerFerramenta, lerLinhaDoTempo, lerPronuncia } from "@/lib/interativos";
import { lerMusica } from "@/lib/interativos-mais";
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

type Ferramenta = "lapis" | "linha" | "seta" | "retangulo" | "elipse" | "texto" | "borracha";
type Elemento = { tipo: Exclude<Ferramenta, "borracha">; cor: string; espessura: number; pontos: [number, number][]; texto?: string };
const FUNDO = "#fffdf7";
const LARGURA_DO_QUADRO = 960;
const ALTURA_DO_QUADRO = 540;

function desenharElemento(ctx: CanvasRenderingContext2D, e: Elemento) {
  ctx.strokeStyle = e.cor;
  ctx.fillStyle = e.cor;
  ctx.lineWidth = e.espessura;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const [a, b] = [e.pontos[0], e.pontos[e.pontos.length - 1]];
  ctx.beginPath();
  if (e.tipo === "lapis") {
    e.pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  } else if (e.tipo === "linha" || e.tipo === "seta") {
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    if (e.tipo === "seta") {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const ponta = 10 + e.espessura * 2.5;
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - ponta * Math.cos(ang - 0.45), b[1] - ponta * Math.sin(ang - 0.45));
      ctx.lineTo(b[0] - ponta * Math.cos(ang + 0.45), b[1] - ponta * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
    }
  } else if (e.tipo === "retangulo") {
    ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  } else if (e.tipo === "elipse") {
    ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.tipo === "texto" && e.texto) {
    ctx.font = `${18 + e.espessura * 4}px "EB Garamond", Georgia, serif`;
    ctx.textBaseline = "top";
    e.texto.split("\n").forEach((linha, i) => ctx.fillText(linha, a[0], a[1] + i * (22 + e.espessura * 5)));
  }
}

/** Distância do ponto ao elemento, para a borracha apagar o que foi tocado. */
function distanciaAte(e: Elemento, [x, y]: [number, number]) {
  const ateSegmento = ([x1, y1]: [number, number], [x2, y2]: [number, number]) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
  };
  const [a, b] = [e.pontos[0], e.pontos[e.pontos.length - 1]];
  if (e.tipo === "lapis") return Math.min(...e.pontos.slice(1).map((p, i) => ateSegmento(e.pontos[i], p)), Math.hypot(x - a[0], y - a[1]));
  if (e.tipo === "linha" || e.tipo === "seta") return ateSegmento(a, b);
  if (e.tipo === "texto") return x >= a[0] - 6 && x <= a[0] + 12 * (e.texto?.length ?? 1) && y >= a[1] - 6 && y <= a[1] + 30 ? 0 : 99;
  const cantos: [number, number][] = [a, [b[0], a[1]], b, [a[0], b[1]]];
  if (e.tipo === "retangulo") return Math.min(...cantos.map((p, i) => ateSegmento(p, cantos[(i + 1) % 4])));
  const [cx, cy, rx, ry] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1];
  return Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
}

const chaveDoQuadro = (spec: string) => {
  let h = 0;
  for (const c of spec) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return `lucia:quadro:${(h >>> 0).toString(36)}`;
};

/** Quadro de desenho à mão livre e com formas (linha, seta, retângulo, elipse, texto), no estilo do Excalidraw. Fica só no aparelho. */
export function Desenho({ spec }: { spec: string }) {
  const { t } = useI18n();
  const tela = useRef<HTMLCanvasElement>(null);
  const [elementos, setElementos] = useState<Elemento[]>([]);
  // Histórico de quadros inteiros: desenhar, apagar e limpar, tudo se desfaz e refaz.
  const [historico, setHistorico] = useState<Elemento[][]>([]);
  const [futuro, setFuturo] = useState<Elemento[][]>([]);
  const [atual, setAtual] = useState<Elemento | null>(null);
  // O traço em andamento também fica numa referência: os eventos do ponteiro chegam mais rápido que a tela redesenha.
  const emAndamento = useRef<Elemento | null>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("lapis");
  const [cor, setCor] = useState("#8b1e1e");
  const [espessura, setEspessura] = useState(3);
  const [escrevendo, setEscrevendo] = useState<{ x: number; y: number; valor: string } | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    // O desenho fica guardado neste aparelho, para a pessoa voltar depois. Só se grava depois de ler o que havia.
    let salvo: string | null = null;
    try {
      salvo = localStorage.getItem(chaveDoQuadro(spec));
    } catch {
      /* sem armazenamento: começa em branco */
    }
    void Promise.resolve().then(() => {
      try {
        if (salvo) setElementos(JSON.parse(salvo) as Elemento[]);
      } catch {
        /* guardado estragado: começa em branco */
      }
      setCarregado(true);
    });
  }, [spec]);
  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(chaveDoQuadro(spec), JSON.stringify(elementos.slice(-500)));
    } catch {
      /* sem espaço: segue sem guardar */
    }
  }, [elementos, spec, carregado]);
  useEffect(() => {
    const ctx = tela.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = FUNDO;
    ctx.fillRect(0, 0, LARGURA_DO_QUADRO, ALTURA_DO_QUADRO);
    for (const e of atual ? [...elementos, atual] : elementos) desenharElemento(ctx, e);
  }, [elementos, atual]);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * LARGURA_DO_QUADRO, ((e.clientY - r.top) / r.height) * ALTURA_DO_QUADRO];
  };
  const mudar = (novo: Elemento[]) => {
    setHistorico((h) => [...h.slice(-100), elementos]);
    setFuturo([]);
    setElementos(novo);
  };
  const incluir = (e: Elemento) => mudar([...elementos, e]);
  const desfazer = () => {
    const anterior = historico[historico.length - 1];
    if (!anterior) return;
    setHistorico((h) => h.slice(0, -1));
    setFuturo((f) => [...f, elementos]);
    setElementos(anterior);
  };
  const refazer = () => {
    const seguinte = futuro[futuro.length - 1];
    if (!seguinte) return;
    setFuturo((f) => f.slice(0, -1));
    setHistorico((h) => [...h, elementos]);
    setElementos(seguinte);
  };
  const confirmarTexto = () => {
    if (escrevendo?.valor.trim()) incluir({ tipo: "texto", cor, espessura, pontos: [[escrevendo.x, escrevendo.y]], texto: escrevendo.valor.slice(0, 300) });
    setEscrevendo(null);
  };
  const FERRAMENTAS: [Ferramenta, string, string][] = [
    ["lapis", "✎", t.blocks.pencil],
    ["linha", "╱", t.blocks.line],
    ["seta", "→", t.blocks.arrow],
    ["retangulo", "▭", t.blocks.rectangle],
    ["elipse", "◯", t.blocks.ellipse],
    ["texto", "T", t.blocks.text],
    ["borracha", "⌫", t.blocks.eraser],
  ];

  return (
    <div className={caixa}>
      <p className="font-serif text-base">{spec.trim()}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t.blocks.draw}>
        {FERRAMENTAS.map(([id, icone, nome]) => (
          <button key={id} type="button" title={nome} aria-label={nome} aria-pressed={ferramenta === id} onClick={() => { confirmarTexto(); setFerramenta(id); }} className={`min-w-9 cursor-pointer border-2 px-2 py-1 font-medium ${ferramenta === id ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
            {icone}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-rule" aria-hidden />
        {["#8b1e1e", "#1f1f1f", "#c9a227", "#3d6fd6", "#3fa34d"].map((c) => (
          <button key={c} type="button" aria-label={`${t.blocks.color} ${c}`} aria-pressed={cor === c} onClick={() => setCor(c)} className={`h-7 w-7 cursor-pointer rounded-full border-2 ${cor === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} />
        ))}
        <label className="ml-1 flex items-center gap-1 text-xs">
          {t.blocks.thickness}
          <input type="range" min={1} max={10} value={espessura} onChange={(e) => setEspessura(Number(e.target.value))} className="w-20 accent-[var(--oxblood)]" />
        </label>
      </div>
      <div className="relative mt-2">
        <canvas
          ref={tela}
          width={LARGURA_DO_QUADRO}
          height={ALTURA_DO_QUADRO}
          aria-label={t.blocks.draw}
          tabIndex={0}
          className={`w-full touch-none border-2 border-ink bg-[#fffdf7] ${ferramenta === "texto" ? "cursor-text" : "cursor-crosshair"}`}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
              e.preventDefault();
              if (e.shiftKey) refazer();
              else desfazer();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
              e.preventDefault();
              refazer();
            }
          }}
          onPointerDown={(e) => {
            const p = ponto(e);
            if (ferramenta === "texto") {
              confirmarTexto();
              setEscrevendo({ x: p[0], y: p[1], valor: "" });
              return;
            }
            if (ferramenta === "borracha") {
              const perto = elementos.map((el, i) => [distanciaAte(el, p), i] as const).filter(([d]) => d < 12).sort((x, y) => x[0] - y[0])[0];
              if (perto) mudar(elementos.filter((_, i) => i !== perto[1]));
              return;
            }
            e.currentTarget.setPointerCapture?.(e.pointerId);
            emAndamento.current = { tipo: ferramenta, cor, espessura, pontos: [p, p] };
            setAtual(emAndamento.current);
          }}
          onPointerMove={(e) => {
            const a = emAndamento.current;
            if (!a) return;
            const p = ponto(e);
            emAndamento.current = { ...a, pontos: a.tipo === "lapis" ? [...a.pontos, p] : [a.pontos[0], p] };
            setAtual(emAndamento.current);
          }}
          onPointerUp={() => {
            const a = emAndamento.current;
            emAndamento.current = null;
            if (a && (a.tipo === "lapis" || Math.hypot(a.pontos[1][0] - a.pontos[0][0], a.pontos[1][1] - a.pontos[0][1]) > 3)) incluir(a);
            setAtual(null);
          }}
        />
        {escrevendo && (
          <input
            autoFocus
            value={escrevendo.valor}
            aria-label={t.blocks.typeText}
            placeholder={t.blocks.typeText}
            onChange={(e) => setEscrevendo((x) => (x ? { ...x, valor: e.target.value } : x))}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmarTexto();
              else if (e.key === "Escape") setEscrevendo(null);
            }}
            onBlur={confirmarTexto}
            className="absolute border border-dashed border-ink bg-transparent px-1 font-serif text-lg outline-none"
            style={{ left: `${(escrevendo.x / LARGURA_DO_QUADRO) * 100}%`, top: `${(escrevendo.y / ALTURA_DO_QUADRO) * 100}%`, color: cor, minWidth: "10rem" }}
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={claro} disabled={!historico.length} onClick={desfazer}>↶ {t.blocks.undo}</button>
        <button type="button" className={claro} disabled={!futuro.length} onClick={refazer}>↷ {t.blocks.redo}</button>
        <button type="button" className={claro} disabled={!elementos.length} onClick={() => mudar([])}>{t.blocks.clear}</button>
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

// ───────────── Música com letra ─────────────

export function Musica({ spec }: { spec: string }) {
  const { t } = useI18n();
  const musica = useMemo(() => lerMusica(spec), [spec]);
  const tocador = useRef<HTMLAudioElement>(null);
  const lista = useRef<HTMLOListElement>(null);
  const [atual, setAtual] = useState(-1);
  const [traducao, setTraducao] = useState(false);
  const temTraducao = musica.linhas.some((l) => l.traducao);
  if (!musica.linhas.length) return <pre className="text-sm">{spec}</pre>;
  const pendente = musica.audio.startsWith("envio:");
  function acompanhar() {
    const agora = tocador.current?.currentTime ?? 0;
    let i = -1;
    for (let k = 0; k < musica.linhas.length && musica.linhas[k].t <= agora + 0.15; k++) i = k;
    if (i === atual) return;
    setAtual(i);
    // Rola só a caixa da letra, nunca a página.
    const caixaDaLetra = lista.current;
    const linha = caixaDaLetra?.children[i] as HTMLElement | undefined;
    if (caixaDaLetra && linha) caixaDaLetra.scrollTo({ top: linha.offsetTop - caixaDaLetra.clientHeight / 2 + linha.clientHeight / 2, behavior: "smooth" });
  }
  return (
    <figure className={caixa}>
      {musica.audio && (pendente ? <PendingAudio path={musica.audio.slice(6)} /> : <audio ref={tocador} controls preload="metadata" src={musica.audio} className="w-full" onTimeUpdate={acompanhar} onSeeked={acompanhar} />)}
      {temTraducao && (
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={traducao} onChange={(e) => setTraducao(e.target.checked)} className="accent-[var(--oxblood)]" />
          {t.blocks.showTranslation}
        </label>
      )}
      <ol ref={lista} className="relative mt-2 max-h-80 space-y-1 overflow-y-auto border border-rule bg-parchment p-3" aria-label={t.blocks.lyrics} lang={musica.lingua || undefined}>
        {musica.linhas.map((l, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={!musica.audio || pendente}
              onClick={() => {
                const a = tocador.current;
                if (!a) return;
                a.currentTime = l.t;
                void a.play().catch(() => {});
              }}
              aria-current={i === atual ? "true" : undefined}
              className={`w-full cursor-pointer text-left font-serif text-lg leading-snug transition-colors disabled:cursor-default ${i === atual ? "font-semibold text-oxblood" : i < atual ? "text-ink-soft" : ""}`}
            >
              {l.texto}
              {traducao && l.traducao && <span className="block font-sans text-sm text-ink-soft">{l.traducao}</span>}
            </button>
          </li>
        ))}
      </ol>
      {musica.credito && <figcaption className="mt-1 text-xs text-ink-soft">{musica.credito}</figcaption>}
    </figure>
  );
}
