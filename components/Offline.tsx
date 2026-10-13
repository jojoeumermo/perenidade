// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";

/** Tem de ser o mesmo nome de public/sw.js (lucia-paginas- mais a VERSAO de lá): se divergirem, o que se guarda aqui é apagado na ativação. */
const PAGINAS = "lucia-paginas-v4";

/** Liga o funcionamento sem internet. Só no site publicado: durante o desenvolvimento ele atrapalharia. */
export function OfflineSupport() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}

/** Guarda no aparelho todas as aulas de uma trilha, para ler no ônibus ou onde não houver sinal. */
export function SaveOffline({ paths, s }: { paths: string[]; s: Dict["tracks"] }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed" | "unsupported">("idle");

  async function save() {
    if (!("caches" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    setState("saving");
    try {
      const cache = await caches.open(PAGINAS);
      for (const path of paths) {
        const response = await fetch(path, { credentials: "same-origin" });
        if (!response.ok) throw new Error(path);
        await cache.put(new URL(path, window.location.origin).href, response);
      }
      setState("saved");
    } catch {
      setState("failed");
    }
  }

  return (
    <p className="no-print mt-6 font-sans text-sm">
      <button type="button" onClick={save} disabled={state === "saving"} className="cursor-pointer underline hover:text-oxblood disabled:cursor-wait disabled:opacity-60">
        {state === "saving" ? s.offlineSaving : s.offlineSave}
      </button>
      <span role="status" className="ml-3 text-ink-soft">
        {state === "saved" && s.offlineSaved}
        {state === "failed" && s.offlineFailed}
        {state === "unsupported" && s.offlineUnsupported}
      </span>
    </p>
  );
}
