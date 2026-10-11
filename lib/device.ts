// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { rpc } from "./backend";
import { getItem, KEYS, setItem } from "./storage";

/** "Chrome em Android": o bastante para a pessoa reconhecer o próprio aparelho, sem identificar a máquina. */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Firefox\//.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const system = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "sistema desconhecido";
  return `${browser} em ${system}`;
}

/**
 * Avisa o serviço de que a conta foi aberta neste navegador. A marca é um número sorteado aqui e
 * embaralhado antes de sair: serve só para reconhecer "é o mesmo navegador de antes ou é outro".
 */
export async function registerDevice(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem("lucia:acesso") === today) return;
    let id = getItem(KEYS.device);
    if (!id) {
      id = crypto.randomUUID();
      setItem(KEYS.device, id);
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`lucia:${id}`));
    const mark = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    await rpc("acesso_registrar", { p_marca: mark, p_rotulo: deviceLabel() });
    sessionStorage.setItem("lucia:acesso", today);
  } catch {
    // Sem armazenamento ou sem conexão: a entrada segue normalmente, só não há registro do aparelho.
  }
}
