// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { carregarLista, faltaBaixar, lerEscolha, MotorNatural, VOZ_DO_APARELHO, type Lista, type VozNatural } from "./catalogo";
import { dividirEmFrases, lerTex, normalizar, normalizarOutroIdioma, type Lexico } from "./normalizar";

// O leitor do "Ouvir a aula": divide o texto em frases, destaca a frase que está sendo lida (sem mexer no texto: CSS
// Custom Highlight API) e fala com a voz escolhida, a do aparelho (speechSynthesis) ou uma natural (Kokoro), que roda
// no próprio aparelho. Cada frase sai no idioma dela (o lang da aula ou do trecho): trecho em inglês numa aula em
// português usa a voz inglesa. Pausar, voltar e avançar frase, e a velocidade, valem para todas.
//
// Para a voz natural começar logo: o modelo abre e a primeira frase começa a ser gerada assim que a pessoa passa o
// mouse no "Ouvir" ou abre o seletor (aquecer); a primeira frase longa é partida num pedaço curto; e enquanto uma
// frase toca, as três seguintes vão sendo geradas. Cada leitura tem um número de sessão: ao trocar de aula, o que
// estava na fila da aula anterior é descartado no Worker e nada dela chega a tocar.

export type EstadoDoLeitor = {
  ativo: boolean;
  tocando: boolean;
  carregando: boolean;
  /** A voz natural ainda está gerando a frase que deveria estar tocando. */
  esperando: boolean;
  frase: number;
  total: number;
  velocidade: number;
  voz: string;
  modo: "frase" | "direto";
  baixado: number;
  aBaixar: number;
  erro: string | null;
};

const INICIAL: EstadoDoLeitor = { ativo: false, tocando: false, carregando: false, esperando: false, frase: 0, total: 0, velocidade: 1, voz: VOZ_DO_APARELHO, modo: "frase", baixado: 0, aBaixar: 0, erro: null };
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

type Frase = { texto: string; fala: string; idioma: string; range: Range | null };
let frases: Frase[] = [];
let vez = 0; // muda a cada parada, pulo ou troca: falas antigas que chegam atrasadas são ignoradas
let sessao = 1; // muda a cada leitura nova (outra aula): o Worker descarta o que era da anterior

// ───────────── Texto e frases ─────────────

const PULAR = "script, style, noscript, button, select, textarea, input, svg, pre, [aria-hidden='true'], .no-print, .katex-html, .katex-mathml, .sr-only";
const BLOCOS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "BLOCKQUOTE", "TD", "TH", "DT", "DD", "FIGCAPTION", "SECTION", "ARTICLE", "TR", "UL", "OL", "TABLE", "HEADER", "ASIDE", "DETAILS", "SUMMARY", "CAPTION"]);

type Pedaco = { no: Node; ini: number; fim: number; desloca: number; atomico: boolean; idioma: string };

function blocoDe(no: Node): Element | null {
  let e = no.parentElement;
  while (e && !BLOCOS.has(e.tagName)) e = e.parentElement;
  return e;
}

/** "pt", "en", "es"… O idioma do trecho: o lang mais próximo (ou a marca de conteúdo ainda não traduzido). */
function idiomaDe(no: Node, padrao: string): { idioma: string; dono: Element | null } {
  const dono = no.parentElement?.closest("[lang], [data-content-lang]") ?? null;
  const valor = dono?.getAttribute("lang") || dono?.getAttribute("data-content-lang") || padrao;
  return { idioma: valor.toLowerCase().split("-")[0], dono };
}

/** O texto de uma raiz (ou do trecho selecionado), com o mapa de volta para os nós (para o destaque). */
function coletar(raiz: Element, padrao: string, recorte?: Range): { texto: string; pedacos: Pedaco[] } {
  let texto = "";
  const pedacos: Pedaco[] = [];
  let blocoAnterior: Element | null = null;
  let idiomaAnterior = "";
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
    const { idioma, dono } = idiomaDe(no, padrao);
    // Troca de idioma vira fronteira de frase quando o trecho é de verdade (3 palavras ou mais): a voz troca junto.
    // Uma palavra solta em outra língua fica na frase, lida pela voz da frase.
    const trechoLongo = (dono?.textContent ?? "").trim().split(/\s+/).length >= 3;
    if ((bloco !== blocoAnterior || (idioma !== idiomaAnterior && trechoLongo)) && texto && !texto.endsWith("\n")) texto += "\n";
    blocoAnterior = bloco;
    if (trechoLongo || !idiomaAnterior) idiomaAnterior = idioma;
    if (no.nodeType === Node.ELEMENT_NODE) {
      // Fórmula (KaTeX): lida em palavras a partir do LaTeX; o destaque cobre a fórmula inteira.
      const tex = (no as Element).querySelector("annotation")?.textContent ?? no.textContent ?? "";
      const fala = ` ${lerTex(tex)} `;
      pedacos.push({ no, ini: texto.length, fim: texto.length + fala.length, desloca: 0, atomico: true, idioma: idiomaAnterior });
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
    pedacos.push({ no, ini: texto.length, fim: texto.length + valor.length, desloca, atomico: false, idioma: idiomaAnterior });
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

/** A primeira frase longa vira duas: um pedaço curto (6 a 10 palavras) sai logo, enquanto o resto é gerado. */
function partirPrimeira(texto: string, ini: number, fim: number): { ini: number; fim: number }[] {
  const trecho = texto.slice(ini, fim);
  const espacos = [...trecho.matchAll(/\s+/g)].map((m) => m.index);
  if (espacos.length < 12) return [{ ini, fim }];
  // De preferência numa vírgula entre a 6ª e a 10ª palavra; senão, depois da 8ª.
  let corte = espacos[7];
  for (let p = 5; p <= 9; p++) if (/[,;:]$/.test(trecho.slice(0, espacos[p]))) corte = espacos[p];
  return [
    { ini, fim: ini + corte },
    { ini: ini + corte + 1, fim },
  ];
}

function montarFrases(alvos: string[] | undefined, padrao: string): Frase[] {
  const selecao = window.getSelection();
  const recorte = selecao && !selecao.isCollapsed && selecao.toString().trim() ? selecao.getRangeAt(0) : null;
  const raizes = recorte
    ? [recorte.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? (recorte.commonAncestorContainer as Element) : recorte.commonAncestorContainer.parentElement!]
    : alvos?.length
      ? alvos.map((a) => document.querySelector(a)).filter((e): e is Element => Boolean(e))
      : [document.getElementById("conteudo") ?? document.body];
  const saida: Frase[] = [];
  for (const raiz of raizes) {
    const { texto, pedacos } = coletar(raiz, padrao, recorte ?? undefined);
    for (const inteira of dividirEmFrases(texto, 180)) {
      for (const { ini, fim } of saida.length === 0 ? partirPrimeira(texto, inteira.ini, inteira.fim) : [inteira]) {
        const pedacoDoTexto = texto.slice(ini, fim).replace(/\s+/g, " ").trim();
        if (!pedacoDoTexto) continue;
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
        const idioma = pedacos.find((p) => p.fim > ini)?.idioma ?? padrao;
        saida.push({ texto: pedacoDoTexto, fala: idioma === "pt" ? normalizar(pedacoDoTexto, lexico) : normalizarOutroIdioma(pedacoDoTexto, idioma), idioma, range });
      }
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
function avisarQueFalou(i: number, duracao = 0) {
  document.dispatchEvent(new CustomEvent("lucia:voz-falou", { detail: { frase: i, voz: estado.voz, duracao, texto: frases[i]?.texto ?? "", idioma: frases[i]?.idioma } }));
}

// ───────────── Voz do aparelho ─────────────

function vozDoAparelho(idioma: string): SpeechSynthesisVoice | undefined {
  const vozes = window.speechSynthesis.getVoices();
  return vozes.find((v) => v.lang.toLowerCase() === (idioma === "pt" ? "pt-br" : idioma)) ?? vozes.find((v) => v.lang.toLowerCase().startsWith(idioma));
}

function falarNoAparelho(i: number, minhaVez: number) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const frase = frases[i];
  const u = new SpeechSynthesisUtterance(frase.fala);
  u.lang = frase.idioma === "pt" ? "pt-BR" : frase.idioma;
  const v = vozDoAparelho(frase.idioma);
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
type Som = { pcm: Float32Array; taxa: number };
// A fila de frases prontas (ou sendo geradas), pela voz, velocidade e texto: a mesma frase não é gerada duas vezes,
// e uma frase de outra aula nunca é confundida com a desta (a chave é o texto, não a posição).
const sons = new Map<string, Promise<Som>>();
const ADIANTADAS = 3;

function vozEscolhida(): VozNatural | null {
  if (estado.voz === VOZ_DO_APARELHO || !lista) return null;
  return lista.vozes.find((v) => v.id === estado.voz) ?? null;
}

/** A voz natural para o idioma da frase: a escolhida (português) ou, nos outros idiomas, a do mesmo gênero. */
function vozDaFrase(i: number): VozNatural | null {
  const escolhida = vozEscolhida();
  if (!escolhida || !lista) return null;
  const idioma = frases[i]?.idioma ?? "pt";
  if ((escolhida.idioma ?? "pt") === idioma) return escolhida;
  const doIdioma = lista.vozes.filter((v) => (v.idioma ?? "pt") === idioma && v.motor === escolhida.motor && !v.bloqueada);
  return doIdioma.find((v) => v.genero === escolhida.genero) ?? doIdioma[0] ?? null;
}

function som(i: number): Promise<Som> | undefined {
  const voz = vozDaFrase(i);
  if (!voz || !motor || !frases[i]) return undefined;
  const chave = `${voz.id}|${estado.velocidade}|${frases[i].fala}`;
  let p = sons.get(chave);
  if (!p) {
    p = motor.falar(frases[i].fala, estado.velocidade, voz, sessao);
    p.catch(() => sons.delete(chave));
    sons.set(chave, p);
  }
  return p;
}

async function prepararNatural(voz: VozNatural): Promise<boolean> {
  if (motor) {
    // Outra voz do mesmo modelo: o motor (e o modelo aberto) continua; só o arquivo da voz muda, por frase.
    await motor.carregado();
    return true;
  }
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
  if (!pedido) return falarNoAparelho(i, minhaVez);
  // Enquanto esta toca, as próximas vão sendo geradas: uma fila de três frases prontas.
  for (let k = 1; k <= ADIANTADAS && i + k < frases.length; k++) som(i + k);
  let pronto = false;
  const aviso = window.setTimeout(() => !pronto && minhaVez === vez && mudar({ esperando: true }), 250);
  let s: Som;
  try {
    s = await pedido;
  } catch {
    window.clearTimeout(aviso);
    if (minhaVez === vez) parar();
    return;
  } finally {
    pronto = true;
  }
  window.clearTimeout(aviso);
  if (estado.esperando) mudar({ esperando: false });
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
  avisarQueFalou(i, buffer.duration);
}

// ───────────── Comandos ─────────────

function falar(i: number) {
  vez++;
  const minhaVez = vez;
  window.speechSynthesis?.cancel();
  fonte?.stop();
  fonte = null;
  mudar({ frase: i, tocando: true });
  destacar(i);
  if (vozEscolhida() && motor && vozDaFrase(i)) void falarNatural(i, minhaVez);
  else if ("speechSynthesis" in window) falarNoAparelho(i, minhaVez);
  else avancarSozinho(i);
}

function avancarSozinho(i: number) {
  if (i + 1 >= frases.length) return parar();
  const minhaVez = vez;
  // No modo "frase a frase", uma respiração entre as frases; no "direto", emenda sem pausa.
  const pausa = estado.modo === "direto" ? 0 : 220 / estado.velocidade;
  window.setTimeout(() => {
    if (minhaVez === vez && estado.tocando) falar(i + 1);
  }, pausa);
}

function idiomaDaPagina() {
  const main = document.getElementById("conteudo");
  const valor = main?.querySelector<HTMLElement>("[data-content-lang]")?.dataset.contentLang ?? document.documentElement.lang ?? "pt";
  return valor.toLowerCase().split("-")[0];
}

let aquecidoPara = "";

/**
 * Prepara a voz natural antes do clique (mouse em cima do "Ouvir", foco pelo teclado ou seletor aberto): abre o
 * modelo, monta as frases e já gera as primeiras. Só quando a voz já está baixada: aquecer nunca baixa nada.
 */
export async function aquecer(alvos?: string[]) {
  if (estado.ativo) return;
  const escolha = lerEscolha();
  if (escolha.voz === VOZ_DO_APARELHO) return;
  lista ??= await carregarLista();
  const voz = lista?.vozes.find((v) => v.id === escolha.voz);
  if (!lista || !voz || (await faltaBaixar(lista, voz)) > 0) return;
  const chave = `${location.pathname}|${escolha.voz}|${escolha.velocidade}`;
  if (aquecidoPara === chave && motor) return;
  aquecidoPara = chave;
  if (!(await prepararNatural(voz)) || estado.ativo) return;
  mudar({ voz: escolha.voz, velocidade: escolha.velocidade });
  frases = montarFrases(alvos, idiomaDaPagina());
  for (let k = 0; k < 2 && k < frases.length; k++) som(k);
}

/** Começa a ler (o trecho selecionado ou os alvos, na ordem; sem alvos, a página). */
export async function iniciar(alvos?: string[]) {
  parar(false);
  const escolha = lerEscolha();
  frases = montarFrases(alvos, idiomaDaPagina());
  if (!frases.length) return;
  mudar({ ativo: true, total: frases.length, frase: 0, velocidade: escolha.velocidade, voz: escolha.voz, modo: escolha.modo, erro: null });
  if (escolha.voz !== VOZ_DO_APARELHO) {
    lista ??= await carregarLista();
    const voz = vozEscolhida();
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
  if (!(vozEscolhida() && motor) && !("speechSynthesis" in window)) {
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
  mudar({ tocando: false, esperando: false });
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

export function definirModo(modo: "frase" | "direto") {
  mudar({ modo });
}

/**
 * Para a leitura. Com `limpar` (o padrão), também esvazia a fila de frases prontas e cancela, no Worker, o que ainda
 * estava sendo gerado: é o que acontece ao trocar de aula ou fechar a página. O modelo continua aberto.
 */
export function parar(limpar = true) {
  vez++;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  fonte?.stop();
  fonte = null;
  if (contexto?.state === "suspended") void contexto.resume();
  apagarDestaque();
  if (limpar) {
    sessao++;
    motor?.cancelar(sessao);
    sons.clear();
    aquecidoPara = "";
  }
  mudar({ ativo: false, tocando: false, carregando: false, esperando: false, frase: 0 });
}

/** Ao sair da aula (troca de página no próprio site ou o leitor desmontado): para tudo e zera a fila. */
export function encerrarLeitura() {
  parar(true);
  frases = [];
  mudar({ total: 0, erro: null });
}

/** Troca a voz no meio da leitura (ou antes de começar). */
export function trocarVoz(id: string) {
  if (id === estado.voz) return;
  const tocava = estado.ativo;
  const frase = estado.frase;
  mudar({ voz: id });
  if (tocava) {
    parar(false);
    void iniciarDe(frase);
  }
}

async function iniciarDe(frase: number) {
  if (!frases.length) return;
  mudar({ ativo: true, total: frases.length, erro: null });
  const voz = estado.voz !== VOZ_DO_APARELHO ? ((lista ??= await carregarLista()), vozEscolhida()) : null;
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
