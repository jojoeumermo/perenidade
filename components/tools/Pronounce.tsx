// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, useSyncExternalStore } from "react";
import type { Dict } from "@/i18n/types";

type S = Dict["tools"]["speak"];

// Frases de partida, uma por idioma de estudo.
const LANGUAGES = [
  ["en-US", "English (US)", "Good morning. How are you today?"],
  ["en-GB", "English (UK)", "Good morning. How are you today?"],
  ["es-ES", "Español (España)", "Buenos días. ¿Cómo estás?"],
  ["es-MX", "Español (México)", "Buenos días. ¿Cómo estás?"],
  ["zh-CN", "中文（普通话）", "你好，很高兴认识你。"],
  ["ru-RU", "Русский", "Здравствуйте. Как у вас дела?"],
  ["pt-BR", "Português (Brasil)", "Bom dia. Como vai você?"],
] as const;

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;
const subscribe = (callback: () => void) => {
  if (!supported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", callback);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", callback);
};
/** Idiomas das vozes instaladas no aparelho, em um texto só (assim o valor só muda quando a lista muda). */
const voiceLangs = () => (supported() ? window.speechSynthesis.getVoices().map((voice) => voice.lang.replace("_", "-").toLowerCase()).join(" ") : "");

/** Ouve qualquer frase na voz do próprio aparelho, em velocidade normal ou devagar. Nada é enviado para fora. */
export function Pronounce({ s, initial }: { s: S; initial?: string }) {
  const start = LANGUAGES.find(([code]) => code.startsWith(initial ?? "en")) ?? LANGUAGES[0];
  const [code, setCode] = useState<string>(start[0]);
  const [text, setText] = useState<string>(start[2]);
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const voices = useSyncExternalStore(subscribe, voiceLangs, () => "");
  const ready = useSyncExternalStore(subscribe, supported, () => true);
  const hasVoice = voices.split(" ").some((lang) => lang.startsWith(code.slice(0, 2).toLowerCase()));

  function speak(speed: number) {
    if (!supported() || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim().slice(0, 600));
    const all = synth.getVoices();
    const voice = all.find((v) => v.lang.replace("_", "-").toLowerCase() === code.toLowerCase()) ?? all.find((v) => v.lang.toLowerCase().startsWith(code.slice(0, 2).toLowerCase()));
    utterance.lang = code;
    if (voice) utterance.voice = voice;
    utterance.rate = speed;
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  if (!ready) return <p className="mt-8 font-sans text-sm text-oxblood">{s.unsupported}</p>;
  return (
    <div className="mt-8 max-w-2xl font-sans text-sm">
      <label className="block">
        {s.language}
        <select
          value={code}
          onChange={(e) => {
            const next = LANGUAGES.find(([value]) => value === e.target.value)!;
            // Troca a frase de exemplo junto, a não ser que a pessoa já tenha escrito a sua.
            if (LANGUAGES.some(([, , sample]) => sample === text) || !text.trim()) setText(next[2]);
            setCode(next[0]);
          }}
          className="mt-1 block w-full border-2 border-ink bg-parchment-deep px-3 py-2"
        >
          {LANGUAGES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block">
        {s.text}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={600} lang={code} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-serif text-xl" />
      </label>
      <label className="mt-4 block">
        {s.speed} <span className="font-mono text-xs text-ink-soft">{rate.toFixed(1)}×</span>
        <input type="range" min={0.5} max={1.2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="mt-2 w-full" />
      </label>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => speak(rate)} className="cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood">
          ▶ {s.speak}
        </button>
        <button type="button" onClick={() => speak(0.6)} className="cursor-pointer border-2 border-ink px-5 py-2 font-medium hover:bg-ink hover:text-parchment">
          {s.slow}
        </button>
        {speaking && (
          <button type="button" onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false); }} className="cursor-pointer border-2 border-oxblood px-5 py-2 font-medium text-oxblood">
            {s.stop}
          </button>
        )}
      </div>
      {!hasVoice && <p role="status" className="mt-4 border-l-2 border-gold pl-4 text-ink-soft">{s.noVoice}</p>}
      <p className="mt-5 text-ink-soft">{s.note}</p>
    </div>
  );
}
