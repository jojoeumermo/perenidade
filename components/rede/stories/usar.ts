// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, type RefObject } from "react";
import { clienteDosStories, type ClienteDeStories } from "@/lib/rede/cliente-stories";
import { carregarTextosDosStories, type TextosDosStories } from "@/lib/rede/textos-stories";

/** Avisa às fileiras de destaques abertas que um story foi guardado ou tirado (só dentro desta aba do navegador). */
export const EVENTO_DOS_DESTAQUES = "lucia:stories-destaques";
export const avisarDestaques = () => window.dispatchEvent(new Event(EVENTO_DOS_DESTAQUES));

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

/** O que recebe foco pelo Tab (sem os desligados, os escondidos e os de tabindex -1). */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focaveisEm(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCAVEIS)).filter((x) => {
    if (x.tabIndex < 0 || x.closest("[inert], [hidden]")) return false;
    if (x.getClientRects().length === 0) return false;
    const s = getComputedStyle(x);
    return s.visibility !== "hidden" && s.display !== "none";
  });
}

/**
 * Prende o foco num diálogo de tela cheia (o visor e o "criar"): tudo o que está atrás dele (a linha, o menu, a barra, os portais)
 * vira `inert` e `aria-hidden` enquanto ele está aberto, e o Tab / Shift+Tab dão a volta entre o primeiro e o último controle do
 * diálogo (o mais de dentro, se houver outro diálogo modal aberto nele, como a câmera). O foco que escapar (um clique fora, um
 * portal) volta para dentro. WCAG 2.1.2 e 2.4.3; aria-modal sozinho não basta. Ao fechar, devolve tudo como estava.
 */
export function useModalDosStories(raiz: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const travados: { no: HTMLElement; escondido: string | null }[] = [];
    let no: HTMLElement | null = el;
    while (no && no.parentElement) {
      for (const irmao of Array.from(no.parentElement.children)) {
        if (irmao === no || !(irmao instanceof HTMLElement) || irmao.inert || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(irmao.tagName)) continue;
        travados.push({ no: irmao, escondido: irmao.getAttribute("aria-hidden") });
        irmao.inert = true;
        irmao.setAttribute("aria-hidden", "true");
      }
      if (no.parentElement === document.body) break;
      no = no.parentElement;
    }
    /** O diálogo onde o foco deve ficar: o modal mais de dentro que estiver aberto (a câmera dentro do "criar"). */
    const prisao = (): HTMLElement => {
      const dentro = Array.from(el.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter((d) => d.getClientRects().length > 0);
      return dentro[dentro.length - 1] ?? el;
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented) return;
      const caixa = prisao();
      const lista = focaveisEm(caixa);
      if (lista.length === 0) {
        e.preventDefault();
        caixa.focus();
        return;
      }
      const ativo = document.activeElement as HTMLElement | null;
      const k = ativo ? lista.indexOf(ativo) : -1;
      if (e.shiftKey && (k <= 0 || !caixa.contains(ativo))) {
        e.preventDefault();
        lista[lista.length - 1].focus();
      } else if (!e.shiftKey && (k === -1 || k === lista.length - 1)) {
        e.preventDefault();
        lista[0].focus();
      }
    };
    const aoFocar = (e: FocusEvent) => {
      const alvo = e.target as Node | null;
      if (!alvo || el.contains(alvo)) return;
      (focaveisEm(prisao())[0] ?? prisao()).focus({ preventScroll: true });
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("focusin", aoFocar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("focusin", aoFocar);
      for (const t of travados) {
        t.no.inert = false;
        if (t.escondido === null) t.no.removeAttribute("aria-hidden");
        else t.no.setAttribute("aria-hidden", t.escondido);
      }
    };
  }, [raiz]);
}

/** As formas do plural nos textos (as categorias do Intl.PluralRules; "other" é a de reserva). */
export type FormasDoPlural = { one: string; few: string; many: string; other: string };

/** Escolhe a forma certa do plural para `n` no idioma (1 story / 2 stories; 1 история / 3 истории / 5 историй). */
export function noPlural(lang: string, n: number, formas: FormasDoPlural): string {
  let c: string = "other";
  try {
    c = new Intl.PluralRules(lang).select(n);
  } catch {
    /* idioma desconhecido: "other" */
  }
  const modelo = (formas as Record<string, string>)[c] || formas.other;
  return preencherStory(modelo, { n });
}

/**
 * O endereço desta mesma tela com o pedido dos stories (ver, criar, destaque) trocado: as outras chaves da busca (?aba=) ficam.
 * `pedido` nulo tira o pedido (fecha o que estava aberto).
 */
export function enderecoAqui(pedido: Record<string, string> | null, chaves: readonly string[]): string {
  const busca = new URLSearchParams(window.location.search);
  for (const k of chaves) busca.delete(k);
  if (pedido) for (const [k, v] of Object.entries(pedido)) busca.set(k, v);
  const q = busca.toString();
  return `${window.location.pathname}${q ? `?${q}` : ""}`;
}

/**
 * Setas num grupo de opções (radiogroup, tablist, menu): devolve o índice para onde ir com a tecla, ou nulo se a tecla não é de
 * navegação. `vertical` usa ↑/↓; senão ←/→ (e as duas no radiogroup, como no padrão ARIA).
 */
export function indiceDaSeta(tecla: string, atual: number, total: number, eixo: "horizontal" | "vertical" | "ambos" = "ambos"): number | null {
  if (total <= 0) return null;
  const antes = (eixo !== "vertical" && tecla === "ArrowLeft") || (eixo !== "horizontal" && tecla === "ArrowUp");
  const depois = (eixo !== "vertical" && tecla === "ArrowRight") || (eixo !== "horizontal" && tecla === "ArrowDown");
  if (antes) return (atual - 1 + total) % total;
  if (depois) return (atual + 1) % total;
  if (tecla === "Home") return 0;
  if (tecla === "End") return total - 1;
  return null;
}

/** Leva o foco para o irmão de índice `i` do mesmo grupo (o pai do botão). */
export function focarNoGrupo(atual: HTMLElement, seletor: string, i: number): void {
  const grupo = atual.closest("[role=radiogroup], [role=tablist], [role=menu]");
  grupo?.querySelectorAll<HTMLElement>(seletor)[i]?.focus();
}
