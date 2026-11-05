// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { AvisoDeRede } from "./offline/AvisoDeRede";

/** Tem de ser o mesmo nome de public/sw.js (lucia-paginas- mais a VERSAO de lá); scripts/testar-app-offline.mjs confere. */
export const NOME_DAS_PAGINAS = "lucia-paginas-v5";
/** Os cursos que a pessoa mandou guardar: cache À PARTE e SEM versão (public/sw.js CURSOS), que o service worker nunca apara nem apaga numa atualização. */
export const NOME_DOS_CURSOS = "lucia-cursos";
const PAGINAS = NOME_DAS_PAGINAS;
const CURSOS = NOME_DOS_CURSOS;

/**
 * Liga o funcionamento sem internet. O registro do service worker só vale no site publicado (durante o desenvolvimento ele
 * atrapalharia); os avisos (sem internet, fila, nova versão) são de components/offline/AvisoDeRede.tsx.
 */
export function OfflineSupport() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return <AvisoDeRede />;
}

/** "1,4 MB", "320 KB": o tamanho do que ficou guardado, para a pessoa saber quanto do aparelho a trilha ocupa. */
function tamanho(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Soma o tamanho das páginas desta trilha que já estão guardadas no aparelho (0 se nenhuma). */
async function guardadas(paths: string[]) {
  const cursos = await caches.open(CURSOS);
  const paginas = await caches.open(PAGINAS);
  let bytes = 0;
  for (const path of paths) {
    const href = new URL(path, window.location.origin).href;
    const resposta = (await cursos.match(href)) ?? (await paginas.match(href));
    if (resposta) bytes += (await resposta.blob()).size;
  }
  return bytes;
}

/** Guarda no aparelho todas as aulas de uma trilha, para ler no ônibus ou onde não houver sinal, e diz quanto ocupa. */
// Etapa 3: "Guardar trilha" virou "Guardar curso", com o tamanho estimado à vista ANTES de guardar (estimativa em bytes,
// calculada no servidor pelo tamanho das aulas); depois de guardado vale o tamanho medido.
export function SaveOffline({ paths, s, estimativa }: { paths: string[]; s: Dict["tracks"]; estimativa?: number }) {
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
      const cache = await caches.open(CURSOS);
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
    const cursos = await caches.open(CURSOS);
    const paginas = await caches.open(PAGINAS);
    await Promise.all(paths.flatMap((path) => [cursos.delete(new URL(path, window.location.origin).href), paginas.delete(new URL(path, window.location.origin).href)]));
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
          {state === "saving" ? s.offlineSaving : s.saveCourse}
        </button>
      )}
      {state !== "saved" && estimativa !== undefined && estimativa > 0 && <span className="ml-2 text-ink-soft">({s.saveSize.replace("{n}", Math.max(0.1, estimativa / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 }))})</span>}
      <span role="status" className="ml-3 text-ink-soft">
        {state === "saved" && `${s.offlineSaved} ${bytes > 0 ? s.offlineSize.replace("{tamanho}", tamanho(bytes)) : ""}`}
        {state === "failed" && s.offlineFailed}
        {state === "unsupported" && s.offlineUnsupported}
        {state === "removed" && s.offlineRemoved}
      </span>
    </p>
  );
}
