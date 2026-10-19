// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { localePath } from "@/i18n/config";
import { chavesDeEstudo } from "@/lib/estudo";
import { KEYS, notifyStored } from "@/lib/storage";
import { useI18n } from "./I18n";

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Saída rápida: apaga tudo o que o site guardou neste navegador (progresso, rascunhos, sessão)
 * e troca a aba por um buscador, sem deixar o site no botão "voltar".
 * Para quem lê em um ambiente em que não é seguro ser visto aqui.
 */
export function quickExit() {
  const leave = () => window.location.replace("https://www.google.com/");
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
  // As páginas guardadas para ler sem internet também contam o que a pessoa leu: vão embora junto.
  void Promise.race([forgetPages(), new Promise((resolve) => setTimeout(resolve, 500))]).finally(leave);
}

async function forgetPages() {
  try {
    for (const name of await caches.keys()) await caches.delete(name);
  } catch {
    // sem páginas guardadas, nada a apagar
  }
}

/**
 * Purga por inatividade: quem pediu, em Meus dados, tem tudo apagado deste navegador quando fica
 * mais do que o prazo escolhido sem abrir o site. A escolha do prazo é a única coisa que fica.
 */
function purgeIfIdle() {
  try {
    const days = Number(localStorage.getItem(KEYS.purge) ?? 0);
    const seen = Number(localStorage.getItem(KEYS.seen) ?? 0);
    const now = Date.now();
    if (days > 0 && seen > 0 && now - seen > days * 86_400_000) {
      for (const key of Object.values(KEYS)) if (key !== KEYS.purge) localStorage.removeItem(key);
      // E o estudo guardado (caderno de erros, revisão, caderno, Meu estudo…), que não está em KEYS.
      for (const key of chavesDeEstudo(localStorage)) localStorage.removeItem(key);
      sessionStorage.clear();
      void forgetPages();
      notifyStored();
    }
    if (days > 0) localStorage.setItem(KEYS.seen, String(now));
    else localStorage.removeItem(KEYS.seen);
  } catch {
    // sem armazenamento, não há o que purgar
  }
}

/**
 * Atalhos de teclado do site inteiro:
 * "/" abre a busca; ← e → trocam de aula (links marcados com data-prev / data-next);
 * Esc três vezes em um segundo e meio (ou cinco toques na faixa do alto, no celular) aciona a saída rápida.
 */
export function Shortcuts() {
  const router = useRouter();
  const { lang } = useI18n();

  useEffect(() => {
    purgeIfIdle();
    // No celular não há tecla Esc: cinco toques seguidos na faixa do alto da página fazem o mesmo.
    let taps: number[] = [];
    const onTap = (e: Event) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-saida]")) return;
      const now = Date.now();
      taps = [...taps.filter((time) => now - time < 3000), now];
      if (taps.length >= 5) quickExit();
    };
    document.addEventListener("click", onTap);
    return () => document.removeEventListener("click", onTap);
  }, []);

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
