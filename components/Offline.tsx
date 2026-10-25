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

/** "1,4 MB", "320 KB": o tamanho do que ficou guardado, para a pessoa saber quanto do aparelho a trilha ocupa. */
function tamanho(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Soma o tamanho das páginas desta trilha que já estão guardadas no aparelho (0 se nenhuma). */
async function guardadas(paths: string[]) {
  const cache = await caches.open(PAGINAS);
  let bytes = 0;
  for (const path of paths) {
    const resposta = await cache.match(new URL(path, window.location.origin).href);
    if (resposta) bytes += (await resposta.blob()).size;
  }
  return bytes;
}

/** Guarda no aparelho todas as aulas de uma trilha, para ler no ônibus ou onde não houver sinal, e diz quanto ocupa. */
export function SaveOffline({ paths, s }: { paths: string[]; s: Dict["tracks"] }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed" | "unsupported" | "removed">("idle");
  const [bytes, setBytes] = useState(0);

  // Trilha guardada numa visita anterior: mostra o tamanho e o botão de tirar.
  useEffect(() => {
    if (!("caches" in window)) return;
    let vivo = true;
    guardadas(paths)
      .then((total) => {
        if (vivo && total > 0) {
          setBytes(total);
          setState("saved");
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [paths]);

  async function save() {
    if (!("caches" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    setState("saving");
    try {
      const cache = await caches.open(PAGINAS);
      let total = 0;
      for (const path of paths) {
        const response = await fetch(path, { credentials: "same-origin" });
        if (!response.ok) throw new Error(path);
        total += (await response.clone().blob()).size;
        await cache.put(new URL(path, window.location.origin).href, response);
      }
      setBytes(total);
      setState("saved");
    } catch {
      setState("failed");
    }
  }

  async function remove() {
    const cache = await caches.open(PAGINAS);
    await Promise.all(paths.map((path) => cache.delete(new URL(path, window.location.origin).href)));
    setBytes(0);
    setState("removed");
  }

  return (
    <p className="no-print mt-6 font-sans text-sm">
      {state === "saved" ? (
        <button type="button" onClick={remove} className="cursor-pointer underline hover:text-oxblood">
          {s.offlineRemove}
        </button>
      ) : (
        <button type="button" onClick={save} disabled={state === "saving"} className="cursor-pointer underline hover:text-oxblood disabled:cursor-wait disabled:opacity-60">
          {state === "saving" ? s.offlineSaving : s.offlineSave}
        </button>
      )}
      <span role="status" className="ml-3 text-ink-soft">
        {state === "saved" && `${s.offlineSaved} ${bytes > 0 ? s.offlineSize.replace("{tamanho}", tamanho(bytes)) : ""}`}
        {state === "failed" && s.offlineFailed}
        {state === "unsupported" && s.offlineUnsupported}
        {state === "removed" && s.offlineRemoved}
      </span>
    </p>
  );
}
