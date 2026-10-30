// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { resetPrefs, setPrefs, TEXT_SCALES, usePrefs } from "@/lib/prefs";
import { ligado } from "@/lib/recursos";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { useHydrated } from "@/lib/storage";
import { useI18n } from "./I18n";

// VLibras (recurso "vlibras", desligado por padrão): o código só é baixado com o recurso ligado e o painel aberto.
const AtivarVLibras = dynamic(() => import("./estudo/AtivarVLibras"), { ssr: false });
const VLibrasLembrado = dynamic(() => import("./estudo/VLibrasLembrado"), { ssr: false });

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-ink-soft">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 border-2 border-ink bg-parchment after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:bg-ink-soft peer-checked:bg-ink peer-checked:after:left-[1.375rem] peer-checked:after:bg-parchment peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold"
      />
    </label>
  );
}

/** Pede para abrir o painel de acessibilidade (o item "Acessibilidade" do "Mais", no aplicativo). */
export const ABRIR_ACESSIBILIDADE = "lucia:abrir-acessibilidade";
export const abrirAcessibilidade = () => window.dispatchEvent(new Event(ABRIR_ACESSIBILIDADE));

/**
 * Botão flutuante de acessibilidade: tamanho do texto, contraste, e-ink, foco e leitura em voz alta. No aplicativo o
 * botão redondo não flutua por cima do conteúdo (cobria ícones e títulos, coisa de site): o painel abre pelo item
 * "Acessibilidade" do "Mais". Só volta a aparecer enquanto a leitura em voz alta está tocando, para dar como parar.
 */
export function A11yWidget() {
  const { t } = useI18n();
  const prefs = usePrefs();
  const speaking = useSpeaking();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener(ABRIR_ACESSIBILIDADE, abrir);
    return () => window.removeEventListener(ABRIR_ACESSIBILIDADE, abrir);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="app-flutua no-print fixed bottom-[calc(4.75rem+var(--recuo-baixo))] right-3 z-40 font-sans text-sm md:bottom-4 md:right-4">
      {ligado("vlibras") && <VLibrasLembrado />}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t.a11y.title}
          className="absolute bottom-14 right-0 max-h-[78vh] w-[min(22rem,calc(100vw-1.5rem))] space-y-5 overflow-y-auto border-2 border-ink bg-folha p-5 text-ink shadow-[6px_6px_0_var(--sombra)]"
        >
          <div className="flex items-center justify-between border-b-2 border-ink pb-3">
            <div>
              <p className="rotulo">{t.a11y.button}</p>
              <h2 className="font-serif text-2xl font-semibold leading-tight">{t.a11y.title}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.a11y.close} className="flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-ink hover:bg-ink hover:text-parchment">
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* O VLibras no alto, em destaque: quem precisa de Libras não deve ter de rolar a janela para achar. */}
          {ligado("vlibras") && (
            <div className="border-2 border-ink bg-ink p-4 text-parchment shadow-[4px_4px_0_var(--prelo)] [&_.text-ink-soft]:text-[#e9dcbc] [&_button]:border-parchment">
              <AtivarVLibras />
            </div>
          )}

          <fieldset>
            <legend className="font-semibold">{t.a11y.textSize}</legend>
            <div className="mt-2 flex gap-2">
              {TEXT_SCALES.map((scale, i) => (
                <button
                  key={scale}
                  type="button"
                  aria-pressed={prefs.scale === scale}
                  onClick={() => setPrefs({ scale })}
                  className={`flex-1 cursor-pointer border-2 px-2 py-1.5 ${
                    prefs.scale === scale ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"
                  }`}
                >
                  <span aria-hidden style={{ fontSize: `${0.8 + i * 0.2}rem` }}>A</span>
                  <span className="sr-only">{t.a11y.sizes[i]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Switch checked={prefs.contrast} onChange={(contrast) => setPrefs({ contrast })} label={t.a11y.contrast} hint={t.a11y.contrastHint} />
          <Switch checked={prefs.eink} onChange={(eink) => setPrefs({ eink })} label={t.a11y.eink} hint={t.a11y.einkHint} />
          <Switch checked={prefs.spacing} onChange={(spacing) => setPrefs({ spacing })} label={t.a11y.spacing} hint={t.a11y.spacingHint} />
          <Switch checked={prefs.focus} onChange={(focus) => setPrefs({ focus })} label={t.a11y.focus} hint={t.a11y.focusHint} />
          <Switch checked={prefs.black} onChange={(black) => setPrefs({ black })} label={t.a11y.black} hint={t.a11y.blackHint} />
          <Switch checked={prefs.light} onChange={(light) => setPrefs({ light })} label={t.a11y.light} hint={t.a11y.lightHint} />

          <div>
            <p className="font-semibold">{t.a11y.read}</p>
            <p className="text-xs text-ink-soft">{t.a11y.readHint}</p>
            {hydrated && !speechSupported() ? (
              <p className="mt-2 text-xs text-oxblood">{t.a11y.noSpeech}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => startReading()} className="cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood">
                  {speaking ? t.a11y.readAgain : t.a11y.readPage}
                </button>
                {speaking && (
                  <button type="button" onClick={stopReading} className="cursor-pointer border-2 border-oxblood px-4 py-2 font-medium text-oxblood">
                    {t.a11y.stop}
                  </button>
                )}
              </div>
            )}
            <span role="status" className="sr-only">{speaking ? t.a11y.reading : ""}</span>
          </div>

          <button type="button" onClick={resetPrefs} className="cursor-pointer text-ink-soft underline hover:text-oxblood">
            {t.a11y.reset}
          </button>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={speaking ? `${t.a11y.button} (${t.a11y.reading})` : t.a11y.button}
        title={t.a11y.button}
        className={`relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-parchment bg-ink text-parchment hover:bg-oxblood ${speaking || open ? "" : "app:hidden"}`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="4.5" r="1.5" fill="currentColor" />
          <path d="M5 8.5c4.5 1.5 9.500 1.500 14 0M12 9.500v5.500m0 0-3.500 6m3.500-6 3.500 6" />
        </svg>
        {speaking && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-gold" />}
      </button>
    </div>
  );
}
