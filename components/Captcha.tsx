// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * O estado do desafio num formulário: a resposta recebida, a rodada (muda a cada tentativa, porque cada resposta vale um pedido só)
 * e se ainda falta a resposta (só quando o desafio está ligado).
 */
export function useCaptcha() {
  const [token, setToken] = useState("");
  const [round, setRound] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const receive = useCallback((v: string) => setToken(v), []);
  const fail = useCallback(() => setFalhou(true), []);
  const spend = useCallback(() => {
    setToken("");
    setRound((r) => r + 1);
  }, []);
  // 21/11/2026: com a Cloudflare degradada o desafio não carregava e o botão ficava travado para sempre (ninguém entrava
  // no próprio site). O desafio falhando, o formulário para de esperar e o pedido segue sem a resposta dele: quem decide
  // é o servidor (com a chave configurada, recusa com "captcha"; sem ela, passa). A porta nunca mais trava no navegador.
  return { token, round, receive, spend, fail, waiting: captchaEnabled && !token && !falhou };
}

/**
 * Desafio contra robôs (Turnstile). Cada resposta vale para um único pedido: depois de cada tentativa,
 * quem usa o componente muda `round` e um desafio novo é feito. A resposta vai junto do pedido para o servidor do site, que a
 * confere na Cloudflare antes de criar a conta, entrar ou mandar um e-mail (app/api/alumia/porta/*).
 */
export function Captcha({ action, lang, round, onToken, onFalha }: { action: string; lang: Locale; round: number; onToken: (token: string) => void; onFalha: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const deliver = useRef(onToken);
  const falha = useRef(onFalha);

  useEffect(() => {
    deliver.current = onToken;
    falha.current = onFalha;
  }, [onToken, onFalha]);

  useEffect(() => {
    if (!captchaEnabled) return;
    let cancelled = false;
    let vigia = 0;
    load()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: captchaKey,
          action,
          language: languages[lang],
          callback: (token: string) => deliver.current(token),
          "expired-callback": () => deliver.current(""),
          "error-callback": () => {
            deliver.current("");
            falha.current();
          },
        });
        // A caixa do desafio demora ou não aparece (rede da Cloudflare degradada): 8 s sem o quadro, desiste de esperar.
        vigia = window.setTimeout(() => {
          if (!cancelled && box.current && !box.current.querySelector("iframe")) falha.current();
        }, 8000);
      })
      .catch(() => {
        deliver.current("");
        falha.current();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(vigia);
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
