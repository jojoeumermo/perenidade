// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useEffect, useRef, useState } from "react";
import { resetPrefs, setPrefs, TEXT_SCALES, usePrefs } from "@/lib/prefs";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { useHydrated } from "@/lib/storage";
import { useI18n } from "./I18n";

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

/** Botão flutuante de acessibilidade: tamanho do texto, contraste, e-ink, foco e leitura em voz alta. */
export function A11yWidget() {
  const { t } = useI18n();
  const prefs = usePrefs();
  const speaking = useSpeaking();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    <div className="no-print fixed bottom-4 right-4 z-40 font-sans text-sm">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t.a11y.title}
          className="absolute bottom-14 right-0 max-h-[75vh] w-[min(21rem,calc(100vw-2rem))] space-y-5 overflow-y-auto border-2 border-ink bg-parchment p-5 text-ink"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">{t.a11y.title}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.a11y.close} className="cursor-pointer px-1 text-lg hover:text-oxblood">
              ✕
            </button>
          </div>

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

          <div>
            <p className="font-semibold">{t.a11y.read}</p>
            <p className="text-xs text-ink-soft">{t.a11y.readHint}</p>
            {hydrated && !speechSupported() ? (
              <p className="mt-2 text-xs text-oxblood">{t.a11y.noSpeech}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={startReading} className="cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood">
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
        className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-parchment bg-ink text-parchment hover:bg-oxblood"
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
