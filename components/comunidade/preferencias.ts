// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";

// O que cada pessoa arruma na comunidade (salas que segue, conversas salvas e escondidas, jeito de ver a lista) fica
// só neste aparelho: não vai para o servidor, não forma perfil e some ao limpar os dados do site.

export interface Salva {
  id: string;
  titulo: string;
  sala: string | null;
  tipo: "conversa" | "duvida";
  em: string;
}

export interface Preferencias {
  seguidas: string[];
  salvas: Salva[];
  escondidas: string[];
  vista: "cartoes" | "compacto";
}

const CHAVE = "lucia:comunidade";
const VAZIO: Preferencias = { seguidas: [], salvas: [], escondidas: [], vista: "cartoes" };
const EVENTO = "lucia:comunidade-mudou";

function ler(): Preferencias {
  try {
    const d = JSON.parse(window.localStorage.getItem(CHAVE) ?? "{}") as Partial<Preferencias>;
    return {
      seguidas: Array.isArray(d.seguidas) ? d.seguidas.filter((x) => typeof x === "string").slice(0, 30) : [],
      salvas: Array.isArray(d.salvas) ? d.salvas.filter((x) => x && typeof x.id === "string").slice(0, 300) : [],
      escondidas: Array.isArray(d.escondidas) ? d.escondidas.filter((x) => typeof x === "string").slice(-500) : [],
      vista: d.vista === "compacto" ? "compacto" : "cartoes",
    };
  } catch {
    return VAZIO;
  }
}

export function usePreferencias() {
  const [pref, setPref] = useState<Preferencias>(VAZIO);
  useEffect(() => {
    const recarregar = () => setPref(ler());
    void Promise.resolve().then(recarregar);
    window.addEventListener(EVENTO, recarregar);
    window.addEventListener("storage", recarregar);
    return () => {
      window.removeEventListener(EVENTO, recarregar);
      window.removeEventListener("storage", recarregar);
    };
  }, []);
  const mudar = useCallback((f: (p: Preferencias) => Preferencias) => {
    const nova = f(ler());
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(nova));
    } catch {
      // Sem espaço ou modo anônimo: vale só até fechar a página.
    }
    setPref(nova);
    window.dispatchEvent(new Event(EVENTO));
  }, []);
  return [pref, mudar] as const;
}

/** A pontuação "em alta" igual à do servidor: votos que envelhecem com as horas. */
export function quente(pontos: number, criado: string, agora: number) {
  const horas = Math.max(0, (agora - new Date(criado).getTime()) / 3_600_000);
  return (pontos + 1) / Math.pow(horas + 2, 1.5);
}

/** Compartilhar um link: a folha do aparelho quando houver, senão copiar. Devolve true quando copiou. */
export async function compartilhar(url: string, titulo: string) {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
    try {
      await nav.share({ url, title: titulo });
      return false;
    } catch {
      // Cancelou ou não deu: cai para copiar.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt("", url);
    return false;
  }
}
