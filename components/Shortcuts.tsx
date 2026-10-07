"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { localePath } from "@/i18n/config";
import { useI18n } from "./I18n";

// Página neutra para a saída rápida (Esc três vezes).
const NEUTRAL_PAGE = "https://pt.wikipedia.org/wiki/Matem%C3%A1tica";

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Atalhos de teclado do site inteiro:
 * "/" abre a busca; ← e → trocam de aula (links marcados com data-prev / data-next);
 * Esc três vezes em um segundo e meio sai do site na hora.
 */
export function Shortcuts() {
  const router = useRouter();
  const { lang } = useI18n();

  useEffect(() => {
    let escapes: number[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const now = Date.now();
        escapes = [...escapes.filter((time) => now - time < 1500), now];
        // replace() tira o site do botão "voltar" do navegador.
        if (escapes.length >= 3) window.location.replace(NEUTRAL_PAGE);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        router.push(localePath(lang, "/busca"));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const link = document.querySelector<HTMLAnchorElement>(e.key === "ArrowLeft" ? "a[data-prev]" : "a[data-next]");
        if (link) router.push(link.getAttribute("href") ?? "");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, lang]);

  return null;
}
