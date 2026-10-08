// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useSyncExternalStore } from "react";

// Leitura em voz alta com a voz do próprio navegador: nada sai do aparelho.

const listeners = new Set<() => void>();
let speaking = false;

function setSpeaking(value: boolean) {
  speaking = value;
  listeners.forEach((listener) => listener());
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function useSpeaking(): boolean {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => speaking,
    () => false,
  );
}

/** Frases curtas: alguns navegadores cortam falas longas no meio. */
function chunks(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?。！？\n]+[.!?。！？]*/g) ?? [];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > 220 && current) {
      out.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Lê o trecho selecionado ou, sem seleção, o conteúdo principal da página. */
export function startReading() {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const selection = window.getSelection()?.toString().trim() ?? "";
  const main = document.getElementById("conteudo");
  const text = selection || main?.innerText || "";
  // Conteúdo ainda não traduzido fica marcado com o idioma original, para a voz certa ser usada.
  const lang = main?.querySelector<HTMLElement>("[data-content-lang]")?.dataset.contentLang ?? document.documentElement.lang;
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().split("-")[0]));

  const parts = chunks(text);
  if (parts.length === 0) return;
  setSpeaking(true);
  parts.forEach((part, i) => {
    const utterance = new SpeechSynthesisUtterance(part);
    utterance.lang = lang;
    if (voice) utterance.voice = voice;
    if (i === parts.length - 1) utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
  });
}

export function stopReading() {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  setSpeaking(false);
}
