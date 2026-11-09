// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { clienteDosStories, type ClienteDeStories } from "@/lib/rede/cliente-stories";
import { carregarTextosDosStories, type TextosDosStories } from "@/lib/rede/textos-stories";

/** Os textos dos stories no idioma da pessoa (baixa só aquele idioma). Nulo enquanto carrega. */
export function useTextosDosStories(lang: string): TextosDosStories | null {
  const [t, setT] = useState<{ lang: string; t: TextosDosStories } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDosStories(lang).then((x) => vivo && setT({ lang, t: x })).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** O cliente dos stories (o de verdade, ou o dublê da prévia). Nulo enquanto carrega. */
export function useClienteDosStories(): ClienteDeStories | null {
  const [c, setC] = useState<ClienteDeStories | null>(null);
  useEffect(() => {
    let vivo = true;
    clienteDosStories().then((x) => vivo && setC(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return c;
}

/** O relógio da tela, que anda de `passo` em `passo` ms (a contagem do ato e o "3 h" ao lado do nome). */
export function useAgora(passo = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), passo);
    return () => window.clearInterval(id);
  }, [passo]);
  return agora;
}

/** Troca {chave} pelo valor (os textos dos stories usam {nome}, {n}…). */
export function preencherStory(modelo: string, valores: Record<string, string | number>): string {
  return modelo.replace(/\{(\w+)\}/g, (m, k: string) => (k in valores ? String(valores[k]) : m));
}

/** O código de erro que o banco devolve (a mensagem da função) virou texto da tela? */
export function codigoDoErro(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/function .*rede_story|PGRST202|does not exist|Could not find the function/i.test(m)) return "banco";
  if (/sem_sessao|not_logged|nao_logado|JWT|auth/i.test(m)) return "semConta";
  if (/dado_pessoal/i.test(m)) return "dadoPessoal";
  if (/limite|rate/i.test(m)) return "limite";
  return "falha";
}

/** A largura da tela do story em px (no celular, a da janela; no computador, a da moldura em pé), para o texto grande caber. */
export function larguraDaTela(maximo = 440): number {
  return typeof window === "undefined" ? 390 : Math.min(window.innerWidth, maximo);
}
