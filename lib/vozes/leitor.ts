// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { carregarLista, lerEscolha, MotorNatural, VOZ_DO_APARELHO, type Lista, type VozNatural } from "./catalogo";
import { dividirEmFrases, lerTex, normalizar, type Lexico } from "./normalizar";

// O leitor do "Ouvir a aula": divide o texto em frases, destaca a frase que está sendo lida (sem mexer no texto: CSS
// Custom Highlight API) e fala com a voz escolhida, a do aparelho (speechSynthesis) ou uma natural (Kokoro, Piper),
// que roda no próprio aparelho. Pausar, voltar e avançar frase, e a velocidade, valem para as duas.

export type EstadoDoLeitor = {
  ativo: boolean;
  tocando: boolean;
  carregando: boolean;
  frase: number;
  total: number;
  velocidade: number;
  voz: string;
  baixado: number;
  aBaixar: number;
  erro: string | null;
};

const INICIAL: EstadoDoLeitor = { ativo: false, tocando: false, carregando: false, frase: 0, total: 0, velocidade: 1, voz: VOZ_DO_APARELHO, baixado: 0, aBaixar: 0, erro: null };
let estado = INICIAL;
const ouvintes = new Set<() => void>();

function mudar(parte: Partial<EstadoDoLeitor>) {
  estado = { ...estado, ...parte };
  ouvintes.forEach((o) => o());
}

export function useLeitor(): EstadoDoLeitor {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => estado,
    () => INICIAL,
  );
}
export const estadoDoLeitor = () => estado;

let lexico: Lexico = {};
/** O léxico de pronúncia (content/vozes/lexico.yml), entregue pela página da aula. */
export function definirLexico(l: Lexico) {
  lexico = l;
}

type Frase = { texto: string; fala: string; range: Range | null };
let frases: Frase[] = [];
let idioma = "pt";
let vez = 0; // muda a cada parada, pulo ou troca: falas antigas que chegam atrasadas são ignoradas

// ───────────── Texto e frases ─────────────

const PULAR = "script, style, noscript, button, select, textarea, input, svg, pre, [aria-hidden='true'], .no-print, .katex-html, .katex-mathml, .sr-only";
const BLOCOS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "BLOCKQUOTE", "TD", "TH", "DT", "DD", "FIGCAPTION", "SECTION", "ARTICLE", "TR", "UL", "OL", "TABLE", "HEADER", "ASIDE", "DETAILS", "SUMMARY", "CAPTION"]);

type Pedaco = { no: Node; ini: number; fim: number; desloca: number; atomico: boolean };

function blocoDe(no: Node): Element | null {
  let e = no.parentElement;
  while (e && !BLOCOS.has(e.tagName)) e = e.parentElement;
  return e;
}

/** O texto de uma raiz (ou do trecho selecionado), com o mapa de volta para os nós (para o destaque). */
function coletar(raiz: Element, recorte?: Range): { texto: string; pedacos: Pedaco[] } {
  let texto = "";
  const pedacos: Pedaco[] = [];
  let blocoAnterior: Element | null = null;
  const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(no) {
      if (no.nodeType === Node.ELEMENT_NODE) {
        const el = no as Element;
        if (el.classList.contains("katex")) return NodeFilter.FILTER_ACCEPT;
        if (el.matches(PULAR)) return NodeFilter.FILTER_REJECT;
        if ((el as HTMLElement).hidden || (typeof (el as HTMLElement).checkVisibility === "function" && !(el as HTMLElement).checkVisibility())) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let no = andar.nextNode(); no; no = andar.nextNode()) {
    if (recorte && !recorte.intersectsNode(no)) continue;
    const bloco = blocoDe(no);
    if (bloco !== blocoAnterior && texto && !texto.endsWith("\n")) texto += "\n";
    blocoAnterior = bloco;
    if (no.nodeType === Node.ELEMENT_NODE) {
      // Fórmula (KaTeX): lida em palavras a partir do LaTeX; o destaque cobre a fórmula inteira.
      const tex = (no as Element).querySelector("annotation")?.textContent ?? no.textContent ?? "";
      const fala = ` ${lerTex(tex)} `;
      pedacos.push({ no, ini: texto.length, fim: texto.length + fala.length, desloca: 0, atomico: true });
      texto += fala;
      // Pula o miolo da fórmula.
      let ultimo: Node = no;
      while (ultimo.lastChild) ultimo = ultimo.lastChild;
      andar.currentNode = ultimo;
      continue;
    }
    let valor = no.nodeValue ?? "";
    let desloca = 0;
    if (recorte) {
      if (no === recorte.endContainer) valor = valor.slice(0, recorte.endOffset);
      if (no === recorte.startContainer) {
        desloca = recorte.startOffset;
        valor = valor.slice(desloca);
      }
    }
    if (!valor) continue;
    pedacos.push({ no, ini: texto.length, fim: texto.length + valor.length, desloca, atomico: false });
    texto += valor;
  }
  return { texto, pedacos };
}

function ponto(pedacos: Pedaco[], pos: number, fim: boolean): [Node, number] | null {
  for (const p of pedacos) {
    if (pos < p.ini || pos > p.fim || (pos === p.fim && !fim) || (pos === p.ini && fim && p.fim !== p.ini)) continue;
    if (p.atomico) return fim ? [p.no.parentNode!, Array.prototype.indexOf.call(p.no.parentNode!.childNodes, p.no) + 1] : [p.no.parentNode!, Array.prototype.indexOf.call(p.no.parentNode!.childNodes, p.no)];
    return [p.no, p.desloca + pos - p.ini];
  }
  return null;
}

function montarFrases(alvos?: string[]): Frase[] {
  const selecao = window.getSelection();
  const recorte = selecao && !selecao.isCollapsed && selecao.toString().trim() ? selecao.getRangeAt(0) : null;
  const raizes = recorte
    ? [recorte.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? (recorte.commonAncestorContainer as Element) : recorte.commonAncestorContainer.parentElement!]
    : alvos?.length
      ? alvos.map((a) => document.querySelector(a)).filter((e): e is Element => Boolean(e))
      : [document.getElementById("conteudo") ?? document.body];
  const saida: Frase[] = [];
  for (const raiz of raizes) {
    const { texto, pedacos } = coletar(raiz, recorte ?? undefined);
    for (const { ini, fim } of dividirEmFrases(texto)) {
      const pedacoDoTexto = texto.slice(ini, fim).replace(/\s+/g, " ").trim();
      let range: Range | null = null;
      const a = ponto(pedacos, ini, false);
      const b = ponto(pedacos, fim, true);
      if (a && b) {
        try {
          range = document.createRange();
          range.setStart(a[0], a[1]);
          range.setEnd(b[0], b[1]);
        } catch {
          range = null;
        }
      }
      saida.push({ texto: pedacoDoTexto, fala: idioma === "pt" ? normalizar(pedacoDoTexto, lexico) : pedacoDoTexto, range });
    }
  }
  return saida;
}

// ───────────── Destaque ─────────────

type ComDestaque = typeof CSS & { highlights?: Map<string, unknown> };
declare const Highlight: { new (...ranges: Range[]): unknown } | undefined;

/**
 * A cor do destaque. Fica aqui, e não em app/globals.css, porque o otimizador de CSS do build ainda não conhece o
 * ::highlight e o descartaria. Entra uma vez, na primeira leitura.
 */
const ESTILO_DO_DESTAQUE = [
  "::highlight(lucia-frase){background-color:rgb(194 31 22/.16);color:inherit}",
  ':root[data-theme="dark"] ::highlight(lucia-frase){background-color:rgb(255 140 110/.28)}',
  '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) ::highlight(lucia-frase){background-color:rgb(255 140 110/.28)}}',
  ":root:is([data-contrast],[data-eink]) ::highlight(lucia-frase){background-color:Highlight;color:HighlightText}",
].join("\n");

function estiloDoDestaque() {
  if (document.getElementById("estilo-lucia-frase")) return;
  const estilo = document.createElement("style");
  estilo.id = "estilo-lucia-frase";
  estilo.textContent = ESTILO_DO_DESTAQUE;
  document.head.append(estilo);
}

function destacar(i: number) {
  estiloDoDestaque();
  const css = CSS as ComDestaque;
  const range = frases[i]?.range;
  if (css.highlights && typeof Highlight !== "undefined") {
    if (range) css.highlights.set("lucia-frase", new Highlight(range));
    else css.highlights.delete("lucia-frase");
  }
  if (!range) return;
  const caixa = range.getBoundingClientRect();
  const topo = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--altura-topo")) || 0;
  if (caixa.height && (caixa.top < topo + 40 || caixa.bottom > window.innerHeight - 120)) {
    const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: caixa.top - window.innerHeight / 3, behavior: calmo ? "auto" : "smooth" });
  }
}

function apagarDestaque() {
  (CSS as ComDestaque).highlights?.delete("lucia-frase");
}

/** Avisa a página (e os testes) que a frase começou a soar. */
function avisarQueFalou(i: number) {
  document.dispatchEvent(new CustomEvent("lucia:voz-falou", { detail: { frase: i, voz: estado.voz } }));
}

// ───────────── Voz do aparelho ─────────────

function vozDoAparelho(): SpeechSynthesisVoice | undefined {
  const vozes = window.speechSynthesis.getVoices();
  const base = idioma.toLowerCase().split("-")[0];
  return vozes.find((v) => v.lang.toLowerCase() === (base === "pt" ? "pt-br" : base)) ?? vozes.find((v) => v.lang.toLowerCase().startsWith(base));
}

function falarNoAparelho(i: number, minhaVez: number) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(frases[i].fala);
  u.lang = idioma === "pt" ? "pt-BR" : idioma;
  const v = vozDoAparelho();
  if (v) u.voice = v;
  u.rate = estado.velocidade;
  u.onend = () => {
    if (minhaVez === vez && estado.tocando) avancarSozinho(i);
  };
  u.onerror = (e) => {
    if (minhaVez === vez && e.error !== "interrupted" && e.error !== "canceled") parar();
  };
  u.onstart = () => avisarQueFalou(i);
  synth.speak(u);
}

// ───────────── Voz natural ─────────────

let motor: MotorNatural | null = null;
let lista: Lista | null = null;
let contexto: AudioContext | null = null;
let fonte: AudioBufferSourceNode | null = null;
const sons = new Map<string, Promise<{ pcm: Float32Array; taxa: number }>>();

function som(i: number) {
  const chave = `${i}|${estado.velocidade}`;
  let p = sons.get(chave);
  if (!p && motor) {
    p = motor.falar(frases[i].fala, estado.velocidade);
    p.catch(() => sons.delete(chave));
    sons.set(chave, p);
  }
  return p;
}

async function prepararNatural(voz: VozNatural): Promise<boolean> {
  if (motor?.id === voz.id) {
    await motor.carregado();
    return true;
  }
  motor?.encerrar();
  sons.clear();
  mudar({ carregando: true, baixado: 0, aBaixar: 0 });
  motor = new MotorNatural(lista!, voz, (feito, total) => mudar({ baixado: feito, aBaixar: total }));
  try {
    await motor.carregado();
    mudar({ carregando: false });
    return true;
  } catch (erro) {
    motor?.encerrar();
    motor = null;
    mudar({ carregando: false, erro: String((erro as Error).message ?? erro) });
    return false;
  }
}

async function falarNatural(i: number, minhaVez: number) {
  const pedido = som(i);
  if (!pedido) return;
  // Já pede as duas seguintes, para a voz não parar entre as frases.
  if (i + 1 < frases.length) som(i + 1);
  if (i + 2 < frases.length) som(i + 2);
  let s: { pcm: Float32Array; taxa: number };
  try {
    s = await pedido;
  } catch {
    if (minhaVez === vez) parar();
    return;
  }
  if (minhaVez !== vez || !estado.tocando || !contexto) return;
  fonte?.stop();
  if (!s.pcm.length) return avancarSozinho(i);
  const buffer = contexto.createBuffer(1, s.pcm.length, s.taxa);
  buffer.copyToChannel(s.pcm as Float32Array<ArrayBuffer>, 0);
  const f = contexto.createBufferSource();
  f.buffer = buffer;
  f.connect(contexto.destination);
  f.onended = () => {
    if (minhaVez === vez && fonte === f && estado.tocando) avancarSozinho(i);
  };
  fonte = f;
  f.start();
  avisarQueFalou(i);
  // A frase que já tocou não precisa mais ficar na memória.
  for (const chave of sons.keys()) if (Number(chave.split("|")[0]) < i - 1) sons.delete(chave);
}

// ───────────── Comandos ─────────────

function vozNaturalEscolhida(): VozNatural | null {
  if (estado.voz === VOZ_DO_APARELHO || idioma !== "pt" || !lista) return null;
  return lista.vozes.find((v) => v.id === estado.voz) ?? null;
}

function falar(i: number) {
  vez++;
  const minhaVez = vez;
  window.speechSynthesis?.cancel();
  fonte?.stop();
  fonte = null;
  mudar({ frase: i, tocando: true });
  destacar(i);
  if (vozNaturalEscolhida() && motor) void falarNatural(i, minhaVez);
  else if ("speechSynthesis" in window) falarNoAparelho(i, minhaVez);
}

function avancarSozinho(i: number) {
  if (i + 1 >= frases.length) return parar();
  // Uma respiração entre as frases (mais curta quando a pessoa acelera).
  const minhaVez = vez;
  window.setTimeout(() => {
    if (minhaVez === vez && estado.tocando) falar(i + 1);
  }, 220 / estado.velocidade);
}

function idiomaDaPagina() {
  const main = document.getElementById("conteudo");
  return main?.querySelector<HTMLElement>("[data-content-lang]")?.dataset.contentLang ?? document.documentElement.lang ?? "pt";
}

/** Começa a ler (o trecho selecionado ou os alvos, na ordem; sem alvos, a página). */
export async function iniciar(alvos?: string[]) {
  parar();
  const escolha = lerEscolha();
  idioma = idiomaDaPagina().toLowerCase().startsWith("pt") ? "pt" : idiomaDaPagina();
  frases = montarFrases(alvos);
  if (!frases.length) return;
  mudar({ ativo: true, total: frases.length, frase: 0, velocidade: escolha.velocidade, voz: escolha.voz, erro: null });
  if (escolha.voz !== VOZ_DO_APARELHO) {
    lista = await carregarLista();
    const voz = vozNaturalEscolhida();
    if (voz) {
      contexto ??= new AudioContext();
      void contexto.resume();
      if (!(await prepararNatural(voz))) {
        // Sem a voz natural (arquivo fora do ar, memória): segue com a do aparelho.
        mudar({ voz: VOZ_DO_APARELHO });
      }
    } else mudar({ voz: VOZ_DO_APARELHO });
  }
  if (!estado.ativo) return;
  if (!(vozNaturalEscolhida() && motor) && !("speechSynthesis" in window)) {
    // Sem voz do aparelho e sem voz natural pronta: não há com que ler.
    mudar({ ativo: false, erro: "sem-voz" });
    return;
  }
  falar(0);
}

export function pausar() {
  if (!estado.ativo || !estado.tocando) return;
  vez++;
  if (fonte && contexto) void contexto.suspend();
  else window.speechSynthesis?.cancel();
  mudar({ tocando: false });
}

export function continuar() {
  if (!estado.ativo || estado.tocando) return;
  if (fonte && contexto && contexto.state === "suspended") {
    // Retoma do ponto exato da frase.
    vez++;
    const minhaVez = vez;
    const f = fonte;
    const i = estado.frase;
    f.onended = () => {
      if (minhaVez === vez && fonte === f && estado.tocando) avancarSozinho(i);
    };
    mudar({ tocando: true });
    void contexto.resume();
    return;
  }
  falar(estado.frase);
}

export const alternarPausa = () => (estado.tocando ? pausar() : continuar());

export function anterior() {
  if (!estado.ativo) return;
  if (contexto?.state === "suspended") void contexto.resume();
  falar(Math.max(0, estado.frase - 1));
}

export function proxima() {
  if (!estado.ativo) return;
  if (estado.frase + 1 >= frases.length) return parar();
  if (contexto?.state === "suspended") void contexto.resume();
  falar(estado.frase + 1);
}

export function definirVelocidade(v: number) {
  const velocidade = Math.min(2, Math.max(0.5, v));
  mudar({ velocidade });
  // A voz do aparelho só muda a velocidade na próxima fala: recomeça a frase atual já no ritmo novo.
  if (estado.ativo && estado.tocando && !fonte) falar(estado.frase);
}

export function parar() {
  vez++;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  fonte?.stop();
  fonte = null;
  if (contexto?.state === "suspended") void contexto.resume();
  apagarDestaque();
  mudar({ ativo: false, tocando: false, carregando: false, frase: 0 });
}

/** Troca a voz no meio da leitura (ou antes de começar). O motor anterior é desligado e sai da memória. */
export function trocarVoz(id: string) {
  if (id === estado.voz) return;
  if (motor && motor.id !== id) {
    motor.encerrar();
    motor = null;
  }
  sons.clear();
  const tocava = estado.ativo;
  const frase = estado.frase;
  mudar({ voz: id });
  if (tocava) {
    parar();
    void iniciarDe(frase);
  }
}

async function iniciarDe(frase: number) {
  if (!frases.length) return;
  mudar({ ativo: true, total: frases.length, erro: null });
  const voz = estado.voz !== VOZ_DO_APARELHO ? ((lista ??= await carregarLista()), vozNaturalEscolhida()) : null;
  if (voz) {
    contexto ??= new AudioContext();
    void contexto.resume();
    if (!(await prepararNatural(voz))) mudar({ voz: VOZ_DO_APARELHO });
  }
  if (estado.ativo) falar(Math.min(frase, frases.length - 1));
}

/** Baixa a voz agora (o botão "Baixar" do seletor), sem começar a ler. */
export async function baixarVoz(id: string): Promise<boolean> {
  lista ??= await carregarLista();
  const voz = lista?.vozes.find((v) => v.id === id);
  if (!voz) return false;
  return prepararNatural(voz);
}

/** Cancela um download em andamento. */
export function cancelarDownload() {
  motor?.encerrar();
  motor = null;
  mudar({ carregando: false, baixado: 0, aBaixar: 0 });
}
