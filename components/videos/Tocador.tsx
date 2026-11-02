// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { fill } from "@/i18n/config";
import { cenaEm, type Pronto, quadro } from "@/lib/videos/palco";
import { useI18n } from "../I18n";

// O tocador dos vídeos curtos. Tudo vem do próprio site (/videos-curtos/<id>/): roteiro pronto, áudio e legendas.
// Sem reprodução automática, sem pedido a terceiros. O relógio é o áudio: o palco desenha o quadro do instante atual.
// Guarda só no aparelho (lucia:video-curto) a posição de cada vídeo e a velocidade; entra na cópia e no "apagar".

const CHAVE = "lucia:video-curto";
type Guardado = { vel?: number; pos?: Record<string, number> };
const lerGuardado = (): Guardado => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Guardado;
  } catch {
    return {};
  }
};
const guardar = (g: Guardado) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(g));
  } catch {
    /* sem espaço ou bloqueado: segue sem guardar */
  }
};
const VELOCIDADES = [0.75, 1, 1.25, 1.5];
const nada = () => () => {};
const movimentoReduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Tocador({ id, titulo }: { id: string; titulo: string }) {
  const { t } = useI18n();
  const v = t.lesson.videoCurto;
  const base = `/videos-curtos/${id}`;
  const [pronto, setPronto] = useState<Pronto | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [vel, setVel] = useState(1);
  const [legendas, setLegendas] = useState(true);
  const [soAudio, setSoAudio] = useState(false);
  const [aviso, setAviso] = useState("");
  const [vozDoAparelho, setVozDoAparelho] = useState(false);
  const reduzido = useSyncExternalStore(nada, movimentoReduzido, () => false);
  const audio = useRef<HTMLAudioElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`${base}/pronto.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((p: Pronto) => vivo && setPronto(p))
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [base]);

  // Posição e velocidade guardadas no aparelho. Depois do carregamento, tenta tocar (o clique em "tocar" acabou de acontecer).
  useEffect(() => {
    const a = audio.current;
    if (!pronto || !a) return;
    const g = lerGuardado();
    const ini = g.pos?.[id] ?? 0;
    if (ini > 0 && ini < pronto.duracao / 1000 - 3) a.currentTime = ini;
    a.playbackRate = g.vel ?? 1;
    setVel(g.vel ?? 1);
    a.play().catch(() => {});
  }, [pronto, id]);

  // Relógio: enquanto toca, o quadro acompanha o áudio.
  useEffect(() => {
    if (!tocando) return;
    let quadroPedido = 0;
    const passo = () => {
      if (audio.current) setTempo(audio.current.currentTime);
      quadroPedido = requestAnimationFrame(passo);
    };
    quadroPedido = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadroPedido);
  }, [tocando]);

  const lembrar = useCallback(
    (s: number) => {
      const g = lerGuardado();
      guardar({ ...g, pos: { ...g.pos, [id]: Math.round(s) } });
    },
    [id],
  );

  const alternar = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setFalhou(true));
    else a.pause();
  }, []);
  const pular = useCallback((d: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d));
    setTempo(a.currentTime);
  }, []);
  const irPara = (s: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = s;
    setTempo(s);
  };
  const mudarVel = (x: number) => {
    setVel(x);
    if (audio.current) audio.current.playbackRate = x;
    guardar({ ...lerGuardado(), vel: x });
  };
  const trocarLegendas = useCallback(() => {
    setLegendas((l) => {
      setAviso(l ? v.legendasDesligadas : v.legendasLigadas);
      return !l;
    });
  }, [v]);
  const telaCheia = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else caixa.current?.requestFullscreen?.().catch(() => {});
  }, []);

  // Último recurso, avisado: a voz do aparelho lê as frases, e o palco acompanha frase a frase.
  const lerComAVozDoAparelho = () => {
    if (!pronto || !("speechSynthesis" in window)) return;
    setVozDoAparelho(true);
    speechSynthesis.cancel();
    for (const f of pronto.cenas.flatMap((c) => c.frases)) {
      const u = new SpeechSynthesisUtterance(f.texto);
      u.lang = "pt-BR";
      u.onstart = () => setTempo(f.ini / 1000);
      u.onend = () => setTempo(f.fim / 1000);
      speechSynthesis.speak(u);
    }
  };
  useEffect(() => () => speechSynthesis?.cancel?.(), []);

  const teclas = (e: React.KeyboardEvent) => {
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === "SELECT" || (alvo.tagName === "INPUT" && e.key.startsWith("Arrow"))) return;
    if (e.key === " " && alvo.tagName !== "BUTTON") {
      e.preventDefault();
      alternar();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      pular(-5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      pular(5);
    } else if (e.key.toLowerCase() === "c") trocarLegendas();
    else if (e.key.toLowerCase() === "f") telaCheia();
  };

  const ms = tempo * 1000;
  const svg = useMemo(() => (pronto ? quadro(pronto, ms, { reduzido }) : ""), [pronto, ms, reduzido]);
  const legenda = pronto?.legendas.find((l) => ms >= l.ini && ms < l.fim)?.texto ?? "";
  const cenaAtual = pronto ? cenaEm(pronto, ms) : null;
  const total = (pronto?.duracao ?? 0) / 1000;

  if (falhou && !pronto) return <p className="cartao p-4 font-sans text-sm" role="alert">{v.erro}</p>;
  if (!pronto) return <p className="font-sans text-sm text-ink-soft" role="status">{v.carregando}</p>;
  return (
    <div ref={caixa} className="video-curto bg-folha" onKeyDown={teclas}>
      {!soAudio && (
        <div className="relative border-[3px] border-ink" style={{ aspectRatio: "16 / 9" }}>
          <div className="absolute inset-0" role="img" aria-label={fill(v.rotulo, { titulo })} dangerouslySetInnerHTML={{ __html: svg }} />
          {legendas && legenda && (
            <p className="absolute inset-x-3 bottom-3 mx-auto w-fit max-w-[90%] border-2 border-ink bg-folha px-3 py-1 text-center font-sans text-sm font-semibold sm:text-lg" aria-hidden="true">
              {legenda}
            </p>
          )}
        </div>
      )}
      <audio
        ref={audio}
        preload="auto"
        onPlay={() => {
          setTocando(true);
          setAviso(v.tocando);
        }}
        onPause={() => {
          setTocando(false);
          setAviso(v.pausado);
          if (audio.current) lembrar(audio.current.currentTime);
        }}
        onEnded={() => lembrar(0)}
        onSeeked={() => audio.current && setTempo(audio.current.currentTime)}
        onError={() => setFalhou(true)}
      >
        <source src={`${base}/voz.webm`} type="audio/webm; codecs=opus" onError={() => {}} />
        <source src={`${base}/voz.m4a`} type="audio/mp4" onError={() => setFalhou(true)} />
      </audio>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-sans text-sm">
        <button type="button" className="botao min-h-11 min-w-11 px-3 font-semibold" onClick={alternar} aria-label={tocando ? v.pausar : v.tocarAgora}>
          {tocando ? v.pausar : v.tocarAgora}
        </button>
        <button type="button" className="botao min-h-11 min-w-11 px-3" onClick={() => pular(-5)} aria-label={v.voltar}>−5 s</button>
        <button type="button" className="botao min-h-11 min-w-11 px-3" onClick={() => pular(5)} aria-label={v.avancar}>+5 s</button>
        <label className="flex min-h-11 grow items-center gap-2">
          <span className="font-mono text-xs tabular-nums">{mmss(tempo)} / {mmss(total)}</span>
          <input type="range" className="min-h-11 grow" min={0} max={total} step={0.1} value={Math.min(tempo, total)} onChange={(e) => irPara(Number(e.target.value))} aria-label={v.posicao} aria-valuetext={`${mmss(tempo)} / ${mmss(total)}`} />
        </label>
        <label className="flex min-h-11 items-center gap-1">
          <span>{v.velocidade}</span>
          <select className="min-h-11 border-2 border-ink bg-folha px-1" value={vel} onChange={(e) => mudarVel(Number(e.target.value))}>
            {VELOCIDADES.map((x) => (
              <option key={x} value={x}>{`${String(x).replace(".", ",")}×`}</option>
            ))}
          </select>
        </label>
        <button type="button" className="botao min-h-11 px-3" aria-pressed={legendas} onClick={trocarLegendas}>{v.legendas}</button>
        <button type="button" className="botao min-h-11 px-3" aria-pressed={soAudio} onClick={() => setSoAudio((s) => !s)}>{v.soAudio}</button>
        <button type="button" className="botao min-h-11 px-3" onClick={telaCheia}>{v.telaCheia}</button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{aviso}</p>
      {falhou && (
        <div className="cartao mt-3 p-3 font-sans text-sm" role="alert">
          <p>{v.erro}</p>
          {!vozDoAparelho && (
            <button type="button" className="botao mt-2 min-h-11 px-3" onClick={lerComAVozDoAparelho}>{v.vozDoAparelho}</button>
          )}
        </div>
      )}
      <nav className="mt-3 font-sans text-sm" aria-label={v.capitulos}>
        <ol className="flex flex-wrap gap-2">
          {pronto.cenas.map((c, i) => (
            <li key={c.id}>
              <button type="button" className={`min-h-11 border-2 border-ink px-2 ${cenaAtual?.id === c.id ? "bg-ink text-folha" : "bg-folha"}`} aria-current={cenaAtual?.id === c.id ? "step" : undefined} onClick={() => irPara(c.ini / 1000)}>
                {i + 1}. {mmss(c.ini / 1000)}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <details className="mt-3 font-sans text-sm" open={soAudio}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{v.transcricao}</summary>
        <div className="mt-2 space-y-2 font-serif text-base">
          {pronto.cenas.map((c) => (
            <p key={c.id}>{c.frases.map((f) => f.texto).join(" ")}</p>
          ))}
        </div>
        <p className="mt-2 font-mono text-xs text-ink-soft">{pronto.narracao}. {v.emRevisao}</p>
      </details>
    </div>
  );
}
