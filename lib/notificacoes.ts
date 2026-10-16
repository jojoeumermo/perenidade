// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { getItem, setItem } from "./storage";

// Avisos do navegador (e do aplicativo instalado) quando chega mensagem nas conversas. Sem prévia: o aviso diz só que
// chegou algo; a pessoa pode escolher ver o nome de quem mandou, e nada mais. Nenhum conteúdo passa por aqui, e não
// existe serviço de push: o aviso nasce no próprio aparelho, com o painel aberto (mesmo em outra aba).

export type ModoDeAviso = "nenhum" | "generico" | "nome";
const CHAVE = "lucia:avisos";

export const avisosDisponiveis = () => typeof window !== "undefined" && "Notification" in window;
export const modoDeAviso = (): ModoDeAviso => {
  const valor = getItem(CHAVE);
  return valor === "generico" || valor === "nome" ? valor : "nenhum";
};
export const permissaoDeAviso = () => (avisosDisponiveis() ? Notification.permission : "denied");

/** Liga os avisos (pedindo a permissão ao navegador, se ainda não deu) ou desliga. */
export async function escolherModo(modo: ModoDeAviso): Promise<boolean> {
  if (modo === "nenhum") { setItem(CHAVE, null); return true; }
  if (!avisosDisponiveis()) return false;
  const permissao = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permissao !== "granted") return false;
  setItem(CHAVE, modo);
  return true;
}

let ultimo = 0;

/** Mostra o aviso, se a pessoa quis e a aba não está à vista. No máximo um a cada vinte segundos. */
export function avisar(quem: string[]) {
  const modo = modoDeAviso();
  if (modo === "nenhum" || !avisosDisponiveis() || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" || Date.now() - ultimo < 20_000) return;
  ultimo = Date.now();
  const nomes = [...new Set(quem.filter(Boolean))];
  const corpo = modo === "nome" && nomes.length ? `${nomes.slice(0, 3).join(", ")}${nomes.length > 3 ? " e mais gente" : ""}: mensagem nova nas conversas da equipe.` : "Mensagem nova nas conversas da equipe.";
  try {
    const aviso = new Notification("Instituto Lúcia", { body: corpo, tag: "lucia-conversas", silent: false });
    aviso.onclick = () => { window.focus(); aviso.close(); };
  } catch {
    // Alguns navegadores (Android) só mostram aviso por service worker: sem ele, fica sem aviso.
  }
}
