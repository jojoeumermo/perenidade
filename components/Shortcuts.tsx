// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { localePath } from "@/i18n/config";
import { useI18n } from "./I18n";

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Saída rápida: apaga tudo o que o site guardou neste navegador (progresso, rascunhos, sessão)
 * e troca a aba por um buscador, sem deixar o site no botão "voltar".
 * Para quem lê em um ambiente em que não é seguro ser visto aqui.
 */
export function quickExit() {
  try {
    localStorage.clear();
    sessionStorage.clear();
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  } catch {
    // Mesmo sem conseguir limpar, o importante é sair.
  }
  window.location.replace("https://www.google.com/");
}

/**
 * Atalhos de teclado do site inteiro:
 * "/" abre a busca; ← e → trocam de aula (links marcados com data-prev / data-next);
 * Esc três vezes em um segundo e meio aciona a saída rápida.
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
        if (escapes.length >= 3) quickExit();
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
