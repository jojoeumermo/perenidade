// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/i18n/config";
import { captchaKey } from "@/lib/backend";

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const captchaEnabled = Boolean(captchaKey);

const languages: Record<Locale, string> = { pt: "pt-br", en: "en", es: "es", zh: "zh-cn", ru: "ru", fr: "fr" };

let loading: Promise<void> | null = null;

/** O script do desafio só é baixado na página de entrada, e só quando o desafio está ligado. */
function load(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("captcha"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Desafio contra robôs. Cada resposta vale para um único pedido: depois de cada tentativa,
 * quem usa o componente muda `round` e um desafio novo é feito.
 */
export function Captcha({ action, lang, round, onToken }: { action: string; lang: Locale; round: number; onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const deliver = useRef(onToken);

  useEffect(() => {
    deliver.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!captchaEnabled) return;
    let cancelled = false;
    load()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: captchaKey,
          action,
          language: languages[lang],
          callback: (token: string) => deliver.current(token),
          "expired-callback": () => deliver.current(""),
          "error-callback": () => deliver.current(""),
        });
      })
      .catch(() => deliver.current(""));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [action, lang]);

  useEffect(() => {
    if (round > 0 && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [round]);

  if (!captchaEnabled) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
