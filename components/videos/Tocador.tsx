// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { fill } from "@/i18n/config";
import { cenaEm, type Pronto, quadro } from "@/lib/videos/palco";
import { useI18n } from "../I18n";

// O tocador dos vídeos curtos. Tudo vem do próprio site (/videos-curtos/<id>/): roteiro pronto, áudio e legendas.
// Sem reprodução automática, sem pedido a terceiros. O relógio é o áudio: o palco desenha o quadro do instante atual.
// Guarda só no aparelho (lucia:video-curto) a posição de cada vídeo e a velocidade; entra na cópia e no "apagar".
// Os controles seguem o tocador das videoaulas (components/VideoPlayer.tsx): barra escura, botões de 44 px,
// mesmos atalhos. Aqui não dá para reaproveitar o componente inteiro porque a imagem não é um <video>: é um
// desenho (SVG) feito a cada instante a partir do áudio.

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
const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const nada = () => () => {};
const movimentoReduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const vezes = (x: number, lang: string) => `${new Intl.NumberFormat(lang).format(x)}×`;
const cheiaPossivel = () => document.fullscreenEnabled === true;

const BOTAO =
  "flex h-11 min-w-11 cursor-pointer items-center justify-center px-2 text-[#f8f5ee] hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f0cf8e] disabled:cursor-not-allowed disabled:opacity-40";

export function Tocador({ id, titulo }: { id: string; titulo: string }) {
  const { t, lang } = useI18n();
  const v = t.lesson.videoCurto;
  const base = `/videos-curtos/${id}`;
  const [pronto, setPronto] = useState<Pronto | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [vel, setVel] = useState(1);
  const [legendas, setLegendas] = useState(true);
  const [soAudio, setSoAudio] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [volume, setVolume] = useState(1);
  const [cheia, setCheia] = useState(false);
  const [aviso, setAviso] = useState("");
  const [vozDoAparelho, setVozDoAparelho] = useState(false);
  const reduzido = useSyncExternalStore(nada, movimentoReduzido, () => false);
  // No iPhone o navegador não deixa pôr um <div> em tela cheia: aí o botão some em vez de não fazer nada.
  const podeCheia = useSyncExternalStore(nada, cheiaPossivel, () => false);
  const audio = useRef<HTMLAudioElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const idAtalhos = useId();

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
    const guardada = VELOCIDADES.includes(g.vel ?? 1) ? (g.vel ?? 1) : 1;
    a.playbackRate = guardada;
    setVel(guardada);
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

  // A tela cheia pode ser fechada pelo Esc do navegador: o botão acompanha.
  useEffect(() => {
    const mudou = () => setCheia(document.fullscreenElement === caixa.current && caixa.current !== null);
    document.addEventListener("fullscreenchange", mudou);
    return () => document.removeEventListener("fullscreenchange", mudou);
  }, []);

  const lembrar = useCallback(
    (s: number) => {
      const g = lerGuardado();
      guardar({ ...g, pos: { ...g.pos, [id]: Math.round(s) } });
    },
    [id],
  );

  // Ao sair da aula no meio do vídeo, a posição fica guardada também.
  useEffect(() => {
    const a = audio.current;
    return () => {
      if (a && !a.paused && !a.ended) lembrar(a.currentTime);
    };
  }, [lembrar, pronto]);

  const total = (pronto?.duracao ?? 0) / 1000;
  const cenas = useMemo(() => pronto?.cenas ?? [], [pronto]);
  const nomeDaParte = useCallback((i: number) => cenas[i]?.visual.titulo?.trim() || fill(v.parte, { n: i + 1, total: cenas.length }), [cenas, v]);

  const alternar = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setFalhou(true));
    else a.pause();
  }, []);
  const irPara = useCallback(
    (s: number) => {
      const a = audio.current;
      if (!a) return;
      const alvo = Math.max(0, Math.min(total || a.duration || 0, s));
      a.currentTime = alvo;
      setTempo(alvo);
    },
    [total],
  );
  const pular = useCallback((d: number) => irPara((audio.current?.currentTime ?? 0) + d), [irPara]);
  const mudarVel = useCallback(
    (x: number) => {
      setVel(x);
      if (audio.current) audio.current.playbackRate = x;
      guardar({ ...lerGuardado(), vel: x });
      setAviso(fill(v.velocidadeAgora, { vel: vezes(x, lang) }));
    },
    [v, lang],
  );
  const passoDeVel = useCallback(
    (d: 1 | -1) => {
      const i = VELOCIDADES.indexOf(vel);
      const novo = VELOCIDADES[Math.max(0, Math.min(VELOCIDADES.length - 1, (i < 0 ? 2 : i) + d))];
      if (novo !== vel) mudarVel(novo);
    },
    [vel, mudarVel],
  );
  const trocarLegendas = useCallback(() => {
    setLegendas((l) => {
      setAviso(l ? v.legendasDesligadas : v.legendasLigadas);
      return !l;
    });
  }, [v]);
  const trocarSom = useCallback(() => {
    const a = audio.current;
    const novo = !mudo;
    setMudo(novo);
    if (a) a.muted = novo;
    setAviso(novo ? v.somDesligado : v.somLigado);
  }, [mudo, v]);
  const mudarVolume = (x: number) => {
    setVolume(x);
    const a = audio.current;
    if (a) {
      a.volume = x;
      a.muted = x === 0;
    }
    setMudo(x === 0);
  };
  const telaCheia = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else caixa.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const ms = tempo * 1000;
  const cenaAtual = pronto ? cenaEm(pronto, ms) : null;
  const indice = cenaAtual ? cenas.findIndex((c) => c.id === cenaAtual.id) : -1;
  const irParaParte = useCallback(
    (i: number) => {
      const c = cenas[i];
      if (!c) return;
      irPara(c.ini / 1000);
      setAviso(`${fill(v.parte, { n: i + 1, total: cenas.length })}: ${nomeDaParte(i)}`);
    },
    [cenas, irPara, nomeDaParte, v],
  );
  // "Parte anterior" no meio de uma parte volta ao começo dela, como nos tocadores de música.
  const parteAnterior = useCallback(() => {
    if (indice < 0) return;
    const c = cenas[indice];
    if (c && ms - c.ini > 2000) irParaParte(indice);
    else irParaParte(Math.max(0, indice - 1));
  }, [cenas, indice, ms, irParaParte]);

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
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === "SELECT" || alvo.tagName === "TEXTAREA") return;
    const emCampo = alvo instanceof HTMLInputElement;
    const naBarra = emCampo && alvo.type === "range" && alvo.dataset.barra === "posicao";
    // No controle de volume, as setas mexem no volume; nos outros campos, as letras são do campo.
    if (emCampo && !naBarra && (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End")) return;
    if (emCampo && alvo.type !== "range") return;
    const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // Espaço num botão aperta o próprio botão; no "Transcrição" (summary) abre e fecha; num link, segue o link.
    if (tecla === " " && (alvo.tagName === "BUTTON" || alvo.tagName === "SUMMARY" || alvo.tagName === "A")) return;
    const acoes: Record<string, () => void> = {
      " ": alternar,
      k: alternar,
      ArrowLeft: () => pular(-5),
      ArrowRight: () => pular(5),
      j: () => pular(-10),
      l: () => pular(10),
      Home: () => irPara(0),
      End: () => irPara(total),
      n: () => irParaParte(Math.min(cenas.length - 1, indice + 1)),
      p: parteAnterior,
      "<": () => passoDeVel(-1),
      ">": () => passoDeVel(1),
      m: trocarSom,
      c: trocarLegendas,
      f: () => podeCheia && telaCheia(),
    };
    if (/^[0-9]$/.test(tecla)) acoes[tecla] = () => irPara((total * Number(tecla)) / 10);
    const acao = acoes[tecla];
    if (acao) {
      e.preventDefault();
      acao();
    }
  };

  const svg = useMemo(() => (pronto ? quadro(pronto, ms, { reduzido }) : ""), [pronto, ms, reduzido]);
  const legenda = pronto?.legendas.find((l) => ms >= l.ini && ms < l.fim)?.texto ?? "";

  if (falhou && !pronto) return <p className="cartao p-4 font-sans text-sm" role="alert">{v.erro}</p>;
  if (!pronto) return <p className="font-sans text-sm text-ink-soft" role="status">{v.carregando}</p>;

  const agora = Math.min(tempo, total);
  const fracao = total > 0 ? agora / total : 0;
  const tempoTexto = fill(v.tempoDe, { atual: mmss(agora), total: mmss(total) });
  const parteTexto = indice >= 0 ? `${fill(v.parte, { n: indice + 1, total: cenas.length })}: ${nomeDaParte(indice)}` : "";

  return (
    <div className="video-curto" onKeyDown={teclas}>
      <div
        ref={caixa}
        className={`overflow-hidden border-[3px] border-ink bg-[#17130e] ${cheia ? "flex flex-col justify-center" : ""}`}
        role="group"
        aria-label={fill(v.rotulo, { titulo })}
        aria-describedby={idAtalhos}
      >
        {!soAudio && (
          <div
            className="relative mx-auto w-full bg-folha"
            style={{ aspectRatio: "16 / 9", ...(cheia ? { width: "min(100vw, calc((100vh - 7.5rem) * 16 / 9))" } : {}) }}
          >
            <div className="absolute inset-0" role="img" aria-label={parteTexto ? `${titulo}. ${parteTexto}` : titulo} dangerouslySetInnerHTML={{ __html: svg }} />
            {/* Clique na imagem toca e pausa (quem usa teclado tem o botão da barra, por isso fica fora da ordem do Tab). */}
            <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 flex cursor-pointer items-center justify-center" onClick={alternar}>
              {!tocando && (
                <span className="flex h-16 w-16 items-center justify-center border-[3px] border-ink bg-folha text-ink shadow-[4px_4px_0_var(--prelo)] sm:h-20 sm:w-20">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 sm:h-10 sm:w-10" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              )}
            </button>
            {legendas && legenda && (
              <p
                className={`pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-[90%] border-2 border-ink bg-folha px-3 py-1 text-center font-sans font-semibold text-ink ${cheia ? "text-xl sm:text-3xl" : "text-sm sm:text-lg"}`}
                aria-hidden="true"
              >
                {legenda}
              </p>
            )}
          </div>
        )}
        {soAudio && (
          <p className="flex min-h-24 items-center gap-3 px-5 py-4 font-sans text-sm text-[#f8f5ee]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-[#f0cf8e]" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 14v-2a9 9 0 0 1 18 0v2M3 14a2 2 0 0 1 2-2h1v7H5a2 2 0 0 1-2-2zM21 14a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z" />
            </svg>
            <span>
              {parteTexto}
              {legendas && legenda && <span className="mt-1 block font-semibold" aria-hidden="true">{legenda}</span>}
            </span>
          </p>
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

        {/* Barra de progresso: o controle nativo (arrastável, lido pelo leitor de tela) fica por cima do desenho,
            que mostra o quanto já tocou e onde começa cada parte. */}
        <div className="relative mx-2 mt-1 flex h-8 items-center focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#f0cf8e]">
          <div className="relative h-2 w-full bg-white/25" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 bg-[#e0372b]" style={{ width: `${fracao * 100}%` }} />
            {cenas.slice(1).map((c) => (
              <span key={c.id} className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 bg-[#17130e]" style={{ left: `${total > 0 ? (c.ini / 1000 / total) * 100 : 0}%` }} />
            ))}
            <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#17130e] bg-[#f8f5ee]" style={{ left: `${fracao * 100}%` }} />
          </div>
          <input
            type="range"
            data-barra="posicao"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            min={0}
            max={total}
            step="any"
            value={agora}
            onChange={(e) => irPara(Number(e.target.value))}
            aria-label={v.posicao}
            aria-valuetext={parteTexto ? `${tempoTexto}. ${parteTexto}` : tempoTexto}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-1 pb-1 font-sans text-sm text-[#f8f5ee]">
          <button type="button" className={BOTAO} onClick={alternar} aria-label={tocando ? v.pausar : v.tocarAgora} title={tocando ? v.pausar : v.tocarAgora}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              {tocando ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
            </svg>
          </button>
          <button type="button" className={BOTAO} onClick={parteAnterior} aria-label={v.parteAnterior} title={v.parteAnterior}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
          </button>
          <button type="button" className={`${BOTAO} font-mono text-xs`} onClick={() => pular(-5)} aria-label={v.voltar} title={v.voltar}>−5s</button>
          <button type="button" className={`${BOTAO} font-mono text-xs`} onClick={() => pular(5)} aria-label={v.avancar} title={v.avancar}>+5s</button>
          <button type="button" className={BOTAO} onClick={() => irParaParte(indice + 1)} disabled={indice >= cenas.length - 1} aria-label={v.proximaParte} title={v.proximaParte}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
          </button>
          <span className="px-1 font-mono text-xs tabular-nums whitespace-nowrap" aria-hidden="true">
            {mmss(agora)} / {mmss(total)}
          </span>
          <span className="mr-auto hidden min-w-0 truncate px-1 text-xs text-[#f8f5ee]/80 md:inline" aria-hidden="true">
            {parteTexto}
          </span>
          <button type="button" className={BOTAO} onClick={trocarSom} aria-label={mudo ? v.comSom : v.semSom} aria-pressed={mudo} title={mudo ? v.comSom : v.semSom}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 9h4l5-4v14l-5-4H4z" />
              {mudo ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
            </svg>
          </button>
          <label className="hidden items-center px-1 sm:flex">
            <span className="sr-only">{v.volume}</span>
            <input type="range" min={0} max={1} step={0.05} value={mudo ? 0 : volume} onChange={(e) => mudarVolume(Number(e.target.value))} className="w-20 cursor-pointer accent-[#e0372b]" />
          </label>
          <label className="flex items-center px-1">
            <span className="sr-only">{v.velocidade}</span>
            <select value={vel} onChange={(e) => mudarVel(Number(e.target.value))} className="h-9 cursor-pointer border border-white/40 bg-[#17130e] px-1 text-[#f8f5ee]" title={v.velocidade}>
              {VELOCIDADES.map((x) => (
                <option key={x} value={x}>{vezes(x, lang)}</option>
              ))}
            </select>
          </label>
          <button type="button" className={`${BOTAO} font-bold`} onClick={trocarLegendas} aria-pressed={legendas} aria-label={v.legendas} title={v.legendas}>
            CC
          </button>
          <button type="button" className={`${BOTAO} text-xs font-semibold`} onClick={() => setSoAudio((s) => !s)} aria-pressed={soAudio}>
            {v.soAudio}
          </button>
          {podeCheia && (
          <button type="button" className={BOTAO} onClick={telaCheia} aria-label={cheia ? v.sairTelaCheia : v.telaCheia} title={cheia ? v.sairTelaCheia : v.telaCheia}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              {cheia ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
          )}
        </div>
      </div>
      <p id={idAtalhos} className="mt-2 font-sans text-xs text-ink-soft">{v.atalhos}</p>
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
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-prelo-texto" aria-hidden="true">{v.capitulos}</p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {cenas.map((c, i) => {
            const atual = i === indice;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full cursor-pointer items-center gap-2 border-2 border-ink px-2 text-left ${atual ? "bg-ink text-folha" : "bg-folha hover:bg-ink/10"}`}
                  aria-current={atual ? "step" : undefined}
                  onClick={() => irParaParte(i)}
                >
                  <span className="font-mono text-xs tabular-nums">{mmss(c.ini / 1000)}</span>
                  <span className="min-w-0 truncate">{i + 1}. {nomeDaParte(i)}</span>
                </button>
              </li>
            );
          })}
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
