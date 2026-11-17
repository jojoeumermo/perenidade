// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O modo ato na tela (frente 9C): o estado do aparelho (lib/rede/modoato/aparelho.ts) como gancho do React, a marca que tira os
// números da tela e os textos do idioma da página.
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  armazemDoNavegador,
  DESLIGADO,
  escolherOrg,
  EVENTO_DO_MODO_ATO,
  lerModoAto,
  trocarModoAto,
  CHAVE_DO_MODO_ATO,
  type EstadoDoModoAto,
} from "@/lib/rede/modoato/aparelho";
import { carregarTextosDoModoAto, type TextosDoModoAto } from "@/lib/rede/modoato/textos";

let cache: { bruto: string | null; estado: EstadoDoModoAto } | null = null;

function ler(): EstadoDoModoAto {
  const armazem = armazemDoNavegador();
  let bruto: string | null = null;
  try {
    bruto = armazem?.getItem(CHAVE_DO_MODO_ATO) ?? null;
  } catch {
    bruto = null;
  }
  const estado = lerModoAto(armazem);
  // O mesmo objeto enquanto nada muda (o useSyncExternalStore compara por referência); o prazo de 18 horas também conta.
  if (cache && cache.bruto === bruto && cache.estado.ligado === estado.ligado) return cache.estado;
  cache = { bruto, estado };
  return estado;
}

function assinar(avisar: () => void): () => void {
  const aoArmazem = (e: StorageEvent) => {
    if (e.key === null || e.key === CHAVE_DO_MODO_ATO) avisar();
  };
  window.addEventListener(EVENTO_DO_MODO_ATO, avisar);
  window.addEventListener("storage", aoArmazem);
  // O modo ato desliga sozinho depois de 18 horas: confere de minuto em minuto.
  const relogio = window.setInterval(avisar, 60_000);
  return () => {
    window.removeEventListener(EVENTO_DO_MODO_ATO, avisar);
    window.removeEventListener("storage", aoArmazem);
    window.clearInterval(relogio);
  };
}

const avisarTodos = () => window.dispatchEvent(new Event(EVENTO_DO_MODO_ATO));

/** Liga ou desliga o modo ato neste aparelho. */
export function trocar(ligar: boolean): void {
  trocarModoAto(armazemDoNavegador(), ligar);
  avisarTodos();
}

/** Escolhe a assessoria jurídica do "Fui detido" (nulo = só os contatos). */
export function escolherAssessoria(org: string | null): void {
  escolherOrg(armazemDoNavegador(), org);
  avisarTodos();
}

/** O estado do modo ato neste aparelho (no servidor e na primeira pintura, desligado). */
export function useModoAto(): EstadoDoModoAto {
  return useSyncExternalStore(assinar, ler, () => DESLIGADO);
}

/**
 * A marca na raiz da Alumia ([data-al="2"]): com o modo ato ligado, `data-al-modo-ato` tira da tela tudo o que é número
 * (o mesmo [data-al-numero] do "ocultar números" da aparência; components/rede/modoato/modoato.css).
 */
export function useMarcaDoModoAto(ligado: boolean): void {
  useEffect(() => {
    const raiz = document.querySelector('[data-al="2"]');
    if (!raiz) return;
    if (ligado) raiz.setAttribute("data-al-modo-ato", "");
    else raiz.removeAttribute("data-al-modo-ato");
  }, [ligado]);
}

/** Os textos do modo ato no idioma da página. Nulo enquanto carrega. */
export function useTextosDoModoAto(lang: string): TextosDoModoAto | null {
  const [t, setT] = useState<{ lang: string; t: TextosDoModoAto } | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDoModoAto(lang).then((x) => vivo && setT({ lang, t: x }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** A hora curta no idioma da página ("14:05"). */
export function horaCurta(lang: string, quando: number | string): string {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { hour: "2-digit", minute: "2-digit" }).format(new Date(quando));
  } catch {
    return "";
  }
}

/** "em 23 horas", no idioma da página. */
export function daquiA(lang: string, ate: string, agora = Date.now()): string {
  const min = Math.max(1, Math.round((new Date(ate).getTime() - agora) / 60_000));
  try {
    const f = new Intl.RelativeTimeFormat(lang === "pt" ? "pt-BR" : lang, { numeric: "always" });
    return min >= 60 ? f.format(Math.round(min / 60), "hour") : f.format(min, "minute");
  } catch {
    return "";
  }
}
