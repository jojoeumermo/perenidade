// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useLayoutEffect } from "react";
import { applyPrefs, prefsScript, readPrefs } from "@/lib/prefs";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { useI18n } from "./I18n";

// Aplica tema e preferências de acessibilidade antes da primeira pintura, para a página não piscar.
// O tipo muda no cliente para o React não reclamar de <script> dentro de componente:
// o script só precisa rodar no HTML vindo do servidor.
export function PrefsScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: prefsScript }}
    />
  );
}

export function ThemeToggle() {
  const { t } = useI18n();

  // No modo de desenvolvimento o React remonta a árvore e apaga os atributos postos pelo script.
  useLayoutEffect(() => {
    const theme = getItem(KEYS.theme);
    if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
    applyPrefs(readPrefs());
  }, []);

  function toggle() {
    const current =
      document.documentElement.getAttribute("data-theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setItem(KEYS.theme, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.common.theme}
      title={t.common.theme}
      className="cursor-pointer text-ink-soft hover:text-oxblood"
    >
      <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 2a8 8 0 0 1 0 16Z" fill="currentColor" />
      </svg>
    </button>
  );
}
