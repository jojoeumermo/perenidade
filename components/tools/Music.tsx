// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { Staff } from "../Staff";

type S = Dict["tools"]["music"];

const A4 = 440;
/** Posição de cada semitom dentro da oitava: índice da nota natural e se é sustenido. */
const SEMITONES: [number, boolean][] = [[0, false], [0, true], [1, false], [1, true], [2, false], [3, false], [3, true], [4, false], [4, true], [5, false], [5, true], [6, false]];
const noteName = (midi: number, s: S) => {
  const [natural, sharp] = SEMITONES[((midi % 12) + 12) % 12];
  return `${s.notes[natural]}${sharp ? "♯" : ""}`;
};
const button = "cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";

/** Frequência fundamental de um trecho de som, por autocorrelação. Devolve -1 quando o som é fraco demais. */
function detectPitch(buffer: Float32Array, sampleRate: number): number {
  let rms = 0;
  for (const value of buffer) rms += value * value;
  if (Math.sqrt(rms / buffer.length) < 0.01) return -1;

  const size = buffer.length;
  const correlation = new Float32Array(size);
  for (let lag = 0; lag < size; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) sum += buffer[i] * buffer[i + lag];
    correlation[lag] = sum;
  }
  // Pula a descida inicial e procura o primeiro grande pico: ele marca o período da onda.
  let start = 0;
  while (start < size - 1 && correlation[start] > correlation[start + 1]) start++;
  let best = -1;
  let bestAt = -1;
  for (let lag = start; lag < size; lag++) {
    if (correlation[lag] > best) {
      best = correlation[lag];
      bestAt = lag;
    }
  }
  if (bestAt <= 0) return -1;
  // Ajuste fino entre amostras, por parábola.
  const before = correlation[bestAt - 1] ?? 0;
  const after = correlation[bestAt + 1] ?? 0;
  const curve = (before + after - 2 * best) / 2;
  const slope = (after - before) / 2;
  const period = curve ? bestAt - slope / (2 * curve) : bestAt;
  return sampleRate / period;
}

/** Afinador: ouve o microfone e mostra a nota e quantos centésimos de semitom faltam ou sobram. */
export function Tuner({ s }: { s: S }) {
  const [on, setOn] = useState(false);
  const [denied, setDenied] = useState(false);
  const [reading, setReading] = useState<{ midi: number; cents: number; hz: number } | null>(null);

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let frame = 0;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        context.createMediaStreamSource(media).connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);
        const sampleRate = context.sampleRate;
        const tick = () => {
          analyser.getFloatTimeDomainData(buffer);
          const hz = detectPitch(buffer, sampleRate);
          if (hz > 50 && hz < 2000) {
            const exact = 12 * Math.log2(hz / A4) + 69;
            const midi = Math.round(exact);
            setReading({ midi, cents: Math.round((exact - midi) * 100), hz });
          }
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        setDenied(true);
        setOn(false);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [on]);

  const inTune = reading !== null && Math.abs(reading.cents) <= 5;
  return (
    <div className="mt-8 font-sans text-sm">
      <button type="button" className={button} onClick={() => { setDenied(false); setOn((value) => !value); }}>
        {on ? s.stop : s.start}
      </button>
      {denied && <p role="alert" className="mt-3 text-oxblood">{s.micDenied}</p>}
      <div className="mt-6 border border-rule bg-parchment-deep p-8 text-center" aria-live="polite">
        <p className={`font-serif text-7xl font-semibold ${inTune ? "text-ok" : ""}`}>{reading ? noteName(reading.midi, s) : "—"}</p>
        <p className="mt-2 font-mono text-xs text-ink-soft">{reading ? `${reading.hz.toFixed(1)} Hz` : s.listen}</p>
        <div className="relative mx-auto mt-6 h-3 max-w-md bg-rule" aria-hidden>
          <div className="absolute left-1/2 top-[-4px] h-5 w-0.5 bg-ink" />
          {reading && <div className={`absolute top-0 h-3 w-2 ${inTune ? "bg-ok" : "bg-oxblood"}`} style={{ left: `calc(${50 + Math.max(-50, Math.min(50, reading.cents))}% - 4px)` }} />}
        </div>
        <p className="mt-3 font-sans text-sm">{reading ? (inTune ? s.inTune : reading.cents < 0 ? s.tooLow : s.tooHigh) : ""}</p>
      </div>
      <p className="mt-4 text-ink-soft">{s.tunerNote}</p>
    </div>
  );
}

/** Metrônomo: marca o tempo com um clique, mais forte na primeira batida do compasso. */
export function Metronome({ s }: { s: S }) {
  const [bpm, setBpm] = useState(80);
  const [beats, setBeats] = useState(4);
  const [on, setOn] = useState(false);
  const [beat, setBeat] = useState(-1);

  useEffect(() => {
    if (!on) return;
    const context = new AudioContext();
    let next = context.currentTime + 0.1;
    let count = 0;
    // Os cliques são agendados um pouco à frente no relógio do áudio, que é mais preciso que o da página.
    const timer = setInterval(() => {
      while (next < context.currentTime + 0.12) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const first = count % beats === 0;
        oscillator.frequency.value = first ? 1200 : 800;
        gain.gain.setValueAtTime(first ? 0.5 : 0.3, next);
        gain.gain.exponentialRampToValueAtTime(0.001, next + 0.06);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(next);
        oscillator.stop(next + 0.07);
        const shown = count % beats;
        setTimeout(() => setBeat(shown), Math.max(0, (next - context.currentTime) * 1000));
        next += 60 / bpm;
        count++;
      }
    }, 25);
    return () => {
      clearInterval(timer);
      void context.close();
      setBeat(-1);
    };
  }, [on, bpm, beats]);

  return (
    <div className="mt-8 font-sans text-sm">
      <div className="border border-rule bg-parchment-deep p-8 text-center">
        <p className="font-serif text-7xl font-semibold">{bpm}</p>
        <p className="font-mono text-xs text-ink-soft">{s.bpm}</p>
        <div className="mt-5 flex justify-center gap-3" aria-hidden>
          {Array.from({ length: beats }, (_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 border-ink ${beat === i ? (i === 0 ? "bg-oxblood" : "bg-ink") : ""}`} />
          ))}
        </div>
      </div>
      <label className="mt-5 block">
        {s.tempo}
        <input type="range" min={40} max={220} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="mt-2 w-full" />
      </label>
      <label className="mt-4 block">
        {s.beats}
        <select value={beats} onChange={(e) => setBeats(Number(e.target.value))} className="mt-1 block border-2 border-ink bg-parchment-deep px-3 py-2">
          {[2, 3, 4, 6].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={`mt-5 ${button}`} onClick={() => setOn((value) => !value)}>
        {on ? s.stop : s.start}
      </button>
    </div>
  );
}

const KEYS = "awsedftgyhujkolp;";

/** Teclado de duas oitavas para tocar com o mouse, o dedo ou as letras do teclado do computador. */
export function Keyboard({ s }: { s: S }) {
  const context = useRef<AudioContext | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const first = 60; // dó central

  function play(midi: number) {
    context.current ??= new AudioContext();
    const audio = context.current;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = A4 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 1.2);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 1.25);
    setPressed(midi);
    setTimeout(() => setPressed((current) => (current === midi ? null : current)), 200);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const index = KEYS.indexOf(e.key.toLowerCase());
      if (index >= 0) play(first + index);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      void context.current?.close();
      context.current = null;
    };
  }, []);

  const notes = Array.from({ length: 24 }, (_, i) => first + i);
  const whites = notes.filter((midi) => !SEMITONES[midi % 12][1]);
  const width = 100 / whites.length;
  return (
    <div className="mt-8 font-sans text-sm">
      <div className="relative h-48 select-none border-2 border-ink">
        {whites.map((midi, i) => (
          <button
            key={midi}
            type="button"
            onPointerDown={() => play(midi)}
            aria-label={noteName(midi, s)}
            className={`absolute bottom-0 top-0 flex cursor-pointer items-end justify-center border-r border-ink pb-2 text-xs ${pressed === midi ? "bg-gold" : "bg-parchment"}`}
            style={{ left: `${i * width}%`, width: `${width}%` }}
          >
            {noteName(midi, s)}
          </button>
        ))}
        {notes
          .filter((midi) => SEMITONES[midi % 12][1])
          .map((midi) => {
            const before = whites.filter((white) => white < midi).length;
            return (
              <button
                key={midi}
                type="button"
                onPointerDown={() => play(midi)}
                aria-label={noteName(midi, s)}
                className={`absolute top-0 h-[60%] cursor-pointer border border-ink ${pressed === midi ? "bg-oxblood" : "bg-ink"}`}
                style={{ left: `${before * width - width * 0.3}%`, width: `${width * 0.6}%` }}
              />
            );
          })}
      </div>
      <p className="mt-4 text-ink-soft">{s.keyboardNote}</p>
    </div>
  );
}

const LETTERS = "CDEFGAB";

/** Treino de leitura: aparece uma nota na pauta e a pessoa diz qual é. */
export function NoteReading({ s }: { s: S }) {
  const [clef, setClef] = useState<"sol" | "fa">("sol");
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [last, setLast] = useState<{ right: boolean; name: string } | null>(null);
  // Notas dentro da pauta e até uma linha suplementar: dó4 a lá5 na clave de sol, mi2 a dó4 na de fá.
  const pick = (which: "sol" | "fa", avoid?: number) => {
    const [low, high] = which === "sol" ? [28, 40] : [16, 28];
    let value = avoid ?? -1;
    while (value === (avoid ?? -1)) value = low + Math.floor(Math.random() * (high - low + 1));
    return value;
  };
  const [position, setPosition] = useState(() => pick("sol"));
  const letter = LETTERS[position % 7];
  const octave = Math.floor(position / 7);

  function answer(index: number) {
    const right = index === position % 7;
    setScore((current) => ({ right: current.right + (right ? 1 : 0), total: current.total + 1 }));
    setLast({ right, name: s.notes[position % 7] });
    setPosition(pick(clef, position));
  }

  return (
    <div className="mt-8 font-sans text-sm">
      <div className="flex flex-wrap gap-2">
        {(["sol", "fa"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={clef === value}
            onClick={() => {
              setClef(value);
              setPosition(pick(value));
              setLast(null);
            }}
            className={`cursor-pointer border-2 px-4 py-2 ${clef === value ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}
          >
            {value === "sol" ? s.clefG : s.clefF}
          </button>
        ))}
      </div>
      <p className="mt-6 font-medium">{s.whichNote}</p>
      <div className="mt-3 max-w-xs">
        <Staff spec={`clave: ${clef}\nnotas: ${letter}${octave}/1`} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {s.notes.map((name, i) => (
          <button key={name} type="button" onClick={() => answer(i)} className="min-w-14 cursor-pointer border-2 border-ink px-4 py-2.5 font-medium hover:bg-ink hover:text-parchment">
            {name}
          </button>
        ))}
      </div>
      <p role="status" className="mt-4 min-h-6">
        {last && <span className={last.right ? "text-ok" : "text-oxblood"}>{last.right ? s.right : fill(s.wrong, { note: last.name })}</span>}
      </p>
      <p className="font-mono text-xs text-ink-soft">{fill(s.score, { a: score.right, b: score.total })}</p>
    </div>
  );
}
