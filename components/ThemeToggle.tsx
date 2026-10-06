"use client";

import { useLayoutEffect } from "react";

const KEY = "perenidade:tema";

// Roda antes da primeira pintura, para a página não piscar no tema errado.
const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

// O tipo muda no cliente para o React não reclamar de <script> dentro de componente:
// o script só precisa rodar no HTML vindo do servidor.
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  // No modo de desenvolvimento o React remonta a árvore e apaga o atributo posto pelo script.
  useLayoutEffect(() => {
    const theme = stored();
    if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
  }, []);

  function toggle() {
    const current =
      document.documentElement.getAttribute("data-theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Sem armazenamento, a escolha vale só para esta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Alternar entre tema claro e escuro"
      title="Alternar tema claro/escuro"
      className="cursor-pointer text-ink-soft hover:text-oxblood"
    >
      <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 2a8 8 0 0 1 0 16Z" fill="currentColor" />
      </svg>
    </button>
  );
}
