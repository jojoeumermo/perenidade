// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O começo da casca no app: liga os plugins nativos próprios (AlumiaCofre, AlumiaApp) e o HTTP nativo do Capacitor à interface de
// lib/rede/casca/plataforma.ts, e faz o chat falar com o servidor pelo HTTP nativo (sem `Origin`, só para o endereço do Instituto).
// No computador (Tauri 2, quando há window.__TAURI_INTERNALS__), a mesma casca usa os comandos do app (lib/rede/casca/computador.ts).
// É o ÚNICO lugar que importa o Capacitor (o site não o leva). Fora do app (a casca aberta num navegador, para testar), fica a casca
// do site, que não promete cofre. O ciclo de vida do app (aberto, no fundo) vai ao ritmo do tráfego (lib/rede/caixas/ritmo.ts, 3.3).
"use client";

import { App } from "@capacitor/app";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { definirBateria, definirEstado } from "@/lib/rede/caixas/ritmo";
import { configurarTransporte } from "@/lib/rede/caixas/transporte";
import { criarCascaAndroid, type PluginApp, type PluginCofre } from "@/lib/rede/casca/android";
import { cascaDoComputador } from "@/lib/rede/casca/computador";
import type { PluginAparelho } from "@/lib/rede/conta/aparelho";
import { type Casca, casca, definirCasca } from "@/lib/rede/casca/plataforma";

/** O endereço do servidor (as rotas do chat e da porta). Fixo na montagem: o app não aceita outro. */
export const BASE = (process.env.NEXT_PUBLIC_ALUMIA_APP_BASE || "https://institutolucia.org").replace(/\/$/, "");

/** O que só o plugin AlumiaApp tem além da interface comum (ajustes do app). */
export interface PluginAppCompleto extends PluginApp {
  abrirExterno(o: { url: string }): Promise<{ aberto: boolean }>;
  /** Sai de cena (manda o app para o fundo) logo depois de travar: usado pelo "Travar agora". */
  paraOFundo(): Promise<void>;
}

export const cofreNativo = registerPlugin<PluginCofre>("AlumiaCofre");
export const appNativo = registerPlugin<PluginAppCompleto>("AlumiaApp");
/** A checagem do aparelho (Prompt 4, item 110): só lê o que o Android diz a qualquer app; nada sai do aparelho. */
export const aparelhoNativo = registerPlugin<PluginAparelho>("AlumiaAparelho");

let feito: Casca | null = null;

export function noApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** No app do computador (o Tauri injeta window.__TAURI_INTERNALS__). */
export function noComputador(): boolean {
  return typeof globalThis !== "undefined" && "__TAURI_INTERNALS__" in globalThis;
}

/**
 * As chamadas com caminho relativo (a porta de entrada, o cliente do chat) vão ao servidor pelo fetch nativo. O resto (o serviço de
 * contas) segue pelo fetch do WebView, que a política de segurança da casca limita a esse endereço.
 */
function desviarApiParaONativo(nativo: typeof fetch) {
  const doWebView = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((entrada: RequestInfo | URL, init?: RequestInit) => {
    const endereco = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (endereco.startsWith("/api/")) return nativo(`${BASE}${endereco}`, init);
    return doWebView(entrada, init);
  }) as typeof fetch;
}

/**
 * O ritmo do tráfego (3.3) segue o app: no fundo, "fundo"; aberto, a reserva (a visibilidade do WebView e, quando o WebView tem a
 * API da bateria, a bateria fraca). Nenhum plugin de bateria: definirEstado(null) deixa a reserva decidir.
 */
function ligarRitmoAoApp(aoMudar: (f: (aberto: boolean) => void) => void) {
  aoMudar((aberto) => definirEstado(aberto ? null : "fundo"));
  const nav = globalThis.navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener(t: string, f: () => void): void }> };
  nav?.getBattery?.()
    .then((b) => {
      const ver = () => definirBateria(!b.charging && b.level <= 0.2);
      ver();
      b.addEventListener("levelchange", ver);
      b.addEventListener("chargingchange", ver);
    })
    .catch(() => undefined);
}

/** Monta a casca uma vez. */
export function iniciar(): Casca {
  if (feito) return feito;
  if (noComputador()) {
    const pc = cascaDoComputador();
    definirCasca(pc);
    configurarTransporte({ fetch: pc.fetchNativo, base: BASE });
    desviarApiParaONativo(pc.fetchNativo);
    // Minimizar ou esconder a janela é ir para o fundo (o Tauri esconde o WebView); voltar é a reserva.
    ligarRitmoAoApp((f) => document.addEventListener("visibilitychange", () => f(document.visibilityState === "visible")));
    window.open = () => null;
    feito = pc;
    return pc;
  }
  if (!noApp()) {
    feito = casca();
    return feito;
  }
  const c = criarCascaAndroid({ cofre: cofreNativo, app: appNativo, http: CapacitorHttp, base: BASE });
  definirCasca(c);
  const nativo = c.fetchNativo;
  if (nativo) {
    configurarTransporte({ fetch: nativo, base: BASE });
    desviarApiParaONativo(nativo);
  }
  ligarRitmoAoApp((f) => void App.addListener("appStateChange", ({ isActive }) => f(isActive)));
  // Nenhuma janela nova: link de fora só pelo nativo, com confirmação (casca/app/Casca.tsx).
  window.open = () => null;
  feito = c;
  return c;
}
