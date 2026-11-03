// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { carregarLista, faltaBaixar, lerEscolha, MotorNatural, VOZ_DO_APARELHO, type Lista, type VozNatural } from "./catalogo";
import { dividirEmFrases, lerTex, normalizar, normalizarOutroIdioma, type Lexico } from "./normalizar";
import { escolherVoz, marcarTrechos, proximoTrecho } from "./trechos";
import { ligado } from "../recursos";

// O leitor do "Ouvir a aula": divide o texto em frases, destaca a frase que está sendo lida (sem mexer no texto: CSS
// Custom Highlight API) e fala com a voz escolhida, a do aparelho (speechSynthesis) ou uma natural (Kokoro), que roda
// no próprio aparelho. Cada frase sai no idioma dela (o lang da aula ou do trecho): trecho em inglês numa aula em
// português usa a voz inglesa. Pausar, voltar e avançar frase, e a velocidade, valem para todas.
//
// A leitura começa NA HORA: enquanto a voz natural abre (ou baixa), a voz do aparelho já vai lendo. As frases são
// agrupadas em trechos (parágrafo, item de lista, título) e a voz natural entra no começo do próximo trecho, quando o
// som dela já está pronto (as regras estão em ./trechos.ts). Se a voz do aparelho não fala (aparelho sem voz, aviso
// que não chega), o leitor percebe sozinho e passa para a voz natural ou avisa; não fica parado em silêncio.
//
// Para a voz natural soar logo: o modelo abre e a primeira frase começa a ser gerada assim que a pessoa passa o
// mouse no "Ouvir" ou abre o seletor (aquecer); a primeira frase longa é partida num pedaço curto; e enquanto uma
// frase toca, as três seguintes vão sendo geradas. Cada leitura tem um número de sessão: ao trocar de aula, o que
// estava na fila da aula anterior é descartado no Worker e nada dela chega a tocar.
//
// Tela desligada (Etapa 4, R1-24, com o recurso "escola" ligado): ao tocar, a leitura se registra na sessão de mídia
// do aparelho (navigator.mediaSession: título da aula, "Instituto Lúcia" e o ícone do site; tocar, pausar, trecho
// anterior e seguinte, voltar e avançar frase), para os controles aparecerem na tela de bloqueio e nos fones. O som da
// voz natural passa por um elemento <audio> (um WAV por frase, com a seguinte já preparada), que o sistema deixa
// continuar com a tela apagada; o AudioContext fica de reserva. A voz do aparelho (speechSynthesis) só ganha o que der:
// o sistema pode pará-la com a tela apagada, e o tocador avisa.
const telaDesligada = ligado("escola");

export type EstadoDoLeitor = {
  ativo: boolean;
  tocando: boolean;
  carregando: boolean;
  /** A voz natural ainda está gerando a frase que deveria estar tocando. */
  esperando: boolean;
  frase: number;
  total: number;
  /** O trecho (parágrafo, item, título) da frase lida, e quantos trechos há. */
  trecho: number;
  trechos: number;
  /** A voz que está lendo agora: a escolhida pode ser a natural e, enquanto ela abre, ler a do aparelho. */
  vozAgora: "natural" | "aparelho" | null;
  /** A voz natural escolhida já está aberta (entra no próximo trecho). */
  naturalPronta: boolean;
  velocidade: number;
  voz: string;
  modo: "frase" | "direto";
  baixado: number;
  aBaixar: number;
  erro: string | null;
};

const INICIAL: EstadoDoLeitor = { ativo: false, tocando: false, carregando: false, esperando: false, frase: 0, total: 0, trecho: 0, trechos: 0, vozAgora: null, naturalPronta: false, velocidade: 1, voz: VOZ_DO_APARELHO, modo: "frase", baixado: 0, aBaixar: 0, erro: null };
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

/** `fala` é o texto preparado para a voz; só é montado quando a frase vai soar (aula longa começa sem esperar). */
type Frase = { texto: string; fala: string | null; idioma: string; range: Range | null; trecho: number; abre: boolean };
let frases: Frase[] = [];
let vez = 0; // muda a cada parada, pulo ou troca: falas antigas que chegam atrasadas são ignoradas
let sessao = 1; // muda a cada leitura nova (outra aula): o Worker descarta o que era da anterior
let leitura = 0; // muda a cada começo e parada: a voz natural que termina de abrir depois disso não mexe em nada

function falaDe(i: number): string {
  const f = frases[i];
  f.fala ??= f.idioma === "pt" ? normalizar(f.texto, lexico) : normalizarOutroIdioma(f.texto, f.idioma);
  return f.fala;
}

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
  let trechoBase = 0;
  for (const raiz of raizes) {
    const { texto, pedacos } = coletar(raiz, padrao, recorte ?? undefined);
    const partes = dividirEmFrases(texto, 180).flatMap((inteira, k) => (saida.length === 0 && k === 0 ? partirPrimeira(texto, inteira.ini, inteira.fim) : [inteira]));
    const trechos = marcarTrechos(texto, partes);
    for (const [k, { ini, fim }] of partes.entries()) {
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
      const trecho = trechoBase + trechos[k];
      saida.push({ texto: pedacoDoTexto, fala: null, idioma, range, trecho, abre: saida.length === 0 || saida[saida.length - 1].trecho !== trecho });
    }
    if (trechos.length) trechoBase += trechos[trechos.length - 1] + 1;
  }
  // Os trechos numerados de 0 em diante, sem buracos (um bloco que não rendeu frase não conta).
  let n = -1;
  let anterior = -1;
  for (const f of saida) {
    if (f.trecho !== anterior) n++;
    anterior = f.trecho;
    f.trecho = n;
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
  document.dispatchEvent(new CustomEvent("lucia:voz-falou", { detail: { frase: i, trecho: frases[i]?.trecho, voz: estado.voz, motor: estado.vozAgora, duracao, texto: frases[i]?.texto ?? "", idioma: frases[i]?.idioma } }));
}

// ───────────── Voz do aparelho ─────────────

function vozDoAparelho(idioma: string): SpeechSynthesisVoice | undefined {
  const vozes = window.speechSynthesis.getVoices();
  return vozes.find((v) => v.lang.toLowerCase() === (idioma === "pt" ? "pt-br" : idioma)) ?? vozes.find((v) => v.lang.toLowerCase().startsWith(idioma));
}

// A fala em curso fica guardada aqui: sem isso, o Chrome pode recolher a fala da memória no meio e o aviso de fim
// nunca chega (a leitura parava sozinha depois de algumas frases).
let falaDoAparelho: SpeechSynthesisUtterance | null = null;
let vigia: number | undefined;
let aparelhoFalhou = false;

function limparVigia() {
  if (vigia !== undefined) window.clearInterval(vigia);
  vigia = undefined;
}

/**
 * Fala a frase com a voz do aparelho. Um vigia confere a cada meio segundo: se a fala não começou em 4 s, tenta mais
 * uma vez e depois desiste do aparelho (aparelhoNaoFala); se ela parou de soar e o aviso de fim não chegou (acontece
 * no Chrome e no Safari), segue para a próxima frase.
 */
function falarNoAparelho(i: number, minhaVez: number, atrasar = false, tentativa = 0) {
  const synth = window.speechSynthesis;
  const frase = frases[i];
  const u = new SpeechSynthesisUtterance(falaDe(i));
  u.lang = frase.idioma === "pt" ? "pt-BR" : frase.idioma;
  const v = vozDoAparelho(frase.idioma);
  if (v) u.voice = v;
  u.rate = estado.velocidade;
  let comecou = false;
  let acabou = false;
  const minha = () => minhaVez === vez && falaDoAparelho === u;
  const terminar = () => {
    if (acabou || !minha()) return;
    acabou = true;
    limparVigia();
    if (estado.tocando) avancarSozinho(i);
  };
  u.onstart = () => {
    if (!minha() || comecou) return;
    comecou = true;
    avisarQueFalou(i);
  };
  u.onend = terminar;
  u.onerror = (e) => {
    if (!minha() || acabou || e.error === "interrupted" || e.error === "canceled") return;
    acabou = true;
    limparVigia();
    aparelhoNaoFala(i, minhaVez);
  };
  falaDoAparelho = u;
  const soltar = () => {
    if (!minha()) return;
    synth.speak(u);
    const inicio = Date.now();
    let comecouEm = 0;
    let calado = 0;
    // Uma fala não acaba antes disto (25 letras por segundo é bem mais rápido que qualquer voz): o vigia não pula
    // frase num navegador que diz "não está falando" por engano.
    const minimo = ((u.text.length / 25) * 1000) / estado.velocidade;
    limparVigia();
    vigia = window.setInterval(() => {
      if (!minha() || acabou) return limparVigia();
      if (!comecou) {
        if (synth.speaking && !synth.paused) {
          // Falando sem ter avisado o começo: conta como começo.
          comecou = true;
          avisarQueFalou(i);
        } else if (Date.now() - inicio > (synth.pending ? 10000 : 5000)) {
          limparVigia();
          if (tentativa === 0) {
            synth.cancel();
            falarNoAparelho(i, minhaVez, true, 1);
          } else {
            acabou = true;
            aparelhoNaoFala(i, minhaVez);
          }
        }
        return;
      }
      comecouEm ||= Date.now();
      if (!synth.speaking && !synth.pending && Date.now() - comecouEm >= minimo) {
        if (++calado >= 2) terminar();
      } else calado = 0;
    }, 500);
  };
  // Logo depois de um cancel(), o Chrome às vezes ignora a fala nova: um respiro curto resolve. Na primeira frase
  // não há o que cancelar e a fala sai ainda dentro do clique (o Safari do iPhone exige).
  if (atrasar) window.setTimeout(soltar, 60);
  else soltar();
}

/** A voz do aparelho não falou: a natural assume (se já abriu ou está abrindo) ou a leitura para com um aviso. */
function aparelhoNaoFala(i: number, minhaVez: number) {
  aparelhoFalhou = true;
  if (minhaVez !== vez) return;
  if (naturalPronta) return falar(i, true);
  if (naturalACaminho) {
    mudar({ esperando: true });
    return;
  }
  semVoz();
}

function semVoz() {
  parar();
  mudar({ erro: "sem-voz" });
}

// ───────────── Voz natural ─────────────

let motor: MotorNatural | null = null;
let lista: Lista | null = null;
let contexto: AudioContext | null = null;
let fonte: AudioBufferSourceNode | null = null;
/** O <audio> da voz natural (tela desligada) e se a frase atual está tocando nele. */
let tocador: HTMLAudioElement | null = null;
let somNoAudio = false;
/** Os WAV já montados, pela mesma chave da fila de sons (ver chaveDoSom). */
const urls = new Map<string, string>();
let motorCarregado = false;
/** A voz natural escolhida está aberta e pode entrar nesta leitura. */
let naturalPronta = false;
/** A voz natural está abrindo (ou baixando) para esta leitura. */
let naturalACaminho = false;
/** A voz que está lendo o trecho atual. */
let vozAtual: "natural" | "aparelho" | null = null;
type Som = { pcm: Float32Array; taxa: number };
// A fila de frases prontas (ou sendo geradas), pela voz, velocidade e texto: a mesma frase não é gerada duas vezes,
// e uma frase de outra aula nunca é confundida com a desta (a chave é o texto, não a posição).
const sons = new Map<string, Promise<Som>>();
const prontos = new Set<string>();
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

function chaveDoSom(i: number): string | null {
  const voz = vozDaFrase(i);
  if (!voz || !frases[i]) return null;
  return `${voz.id}|${estado.velocidade}|${falaDe(i)}`;
}

function som(i: number): Promise<Som> | undefined {
  const voz = vozDaFrase(i);
  const chave = chaveDoSom(i);
  if (!voz || !motor || !chave) return undefined;
  let p = sons.get(chave);
  if (!p) {
    p = motor.falar(falaDe(i), estado.velocidade, voz, sessao);
    p.then(
      () => prontos.add(chave),
      () => sons.delete(chave),
    );
    sons.set(chave, p);
  }
  return p;
}

function somPronto(i: number) {
  const chave = chaveDoSom(i);
  return Boolean(chave && prontos.has(chave));
}

/** Enquanto a voz do aparelho lê, a natural já gera o começo do próximo trecho, para entrar sem silêncio. */
function adiantarNatural(i: number) {
  if (!naturalPronta || !motor) return;
  const j = proximoTrecho(
    frases.map((f) => f.trecho),
    i,
  );
  if (j < 0) return;
  som(j);
  if (j + 1 < frases.length) som(j + 1);
}

async function prepararNatural(voz: VozNatural): Promise<boolean> {
  if (motor) {
    // Outra voz do mesmo modelo: o motor (e o modelo aberto) continua; só o arquivo da voz muda, por frase.
    const atual = motor;
    try {
      await atual.carregado();
      return motor === atual;
    } catch {
      return false;
    }
  }
  mudar({ carregando: true, baixado: 0, aBaixar: 0 });
  const novo = new MotorNatural(lista!, voz, (feito, total) => mudar({ baixado: feito, aBaixar: total }));
  motor = novo;
  try {
    await novo.carregado();
    if (motor !== novo) return false; // download cancelado no meio
    motorCarregado = true;
    mudar({ carregando: false });
    return true;
  } catch (erro) {
    if (motor !== novo) return false;
    motor.encerrar();
    motor = null;
    motorCarregado = false;
    mudar({ carregando: false, erro: String((erro as Error).message ?? erro) });
    return false;
  }
}

// ───────────── Tela desligada: WAV no <audio> e sessão de mídia ─────────────

/** PCM de 32 bits (o que a voz natural gera) num WAV mono de 16 bits, que o <audio> toca. */
export function wavDe(pcm: Float32Array, taxa: number): Blob {
  const dados = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(dados);
  const texto = (pos: number, t: string) => {
    for (let k = 0; k < t.length; k++) v.setUint8(pos + k, t.charCodeAt(k));
  };
  texto(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let k = 0; k < pcm.length; k++) {
    const x = Math.max(-1, Math.min(1, pcm[k]));
    v.setInt16(44 + k * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([dados], { type: "audio/wav" });
}

function urlDoSom(chave: string, s: Som): string {
  let url = urls.get(chave);
  if (!url) {
    url = URL.createObjectURL(wavDe(s.pcm, s.taxa));
    urls.set(chave, url);
  }
  return url;
}

/** Deixa o WAV da frase `i` pronto (a seguinte da que toca), para a troca não ter silêncio. */
function prepararUrl(i: number) {
  const chave = chaveDoSom(i);
  const pedido = chave ? sons.get(chave) : undefined;
  if (chave && pedido) void pedido.then((s) => urlDoSom(chave, s)).catch(() => {});
}

function pararAudio() {
  if (!tocador || !somNoAudio) return;
  tocador.onended = null;
  tocador.pause();
  somNoAudio = false;
}

/** Libera o <audio> dentro do clique (o Safari e o Chrome do celular exigem), com um instante de silêncio. */
function liberarAudio() {
  if (!telaDesligada || typeof Audio === "undefined") return;
  tocador ??= new Audio();
  tocador.preload = "auto";
  const silencio = urls.get("silencio") ?? URL.createObjectURL(wavDe(new Float32Array(2400), 24000));
  urls.set("silencio", silencio);
  if (somNoAudio) return;
  tocador.src = silencio;
  void tocador.play().catch(() => {});
}

/** Toca a frase no <audio>. Se o aparelho recusar, devolve false e a frase vai pelo AudioContext. */
async function tocarNoAudio(s: Som, i: number, minhaVez: number): Promise<boolean> {
  const chave = chaveDoSom(i);
  if (!tocador || !chave) return false;
  const t = tocador;
  t.onended = null;
  t.src = urlDoSom(chave, s);
  t.playbackRate = 1;
  somNoAudio = true;
  t.onended = () => {
    if (minhaVez === vez && somNoAudio && estado.tocando) avancarSozinho(i);
  };
  try {
    await t.play();
  } catch {
    somNoAudio = false;
    t.onended = null;
    return false;
  }
  if (minhaVez !== vez) return true;
  avisarQueFalou(i, s.pcm.length / s.taxa);
  if (i + 1 < frases.length) prepararUrl(i + 1);
  return true;
}

const ACOES_DE_MIDIA = ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward"] as const;

/** A primeira frase do trecho `t` (ou -1). */
const inicioDoTrecho = (t: number) => frases.findIndex((f) => f.trecho === t);

/** Registra a leitura na sessão de mídia do aparelho (tela de bloqueio, fones, relógio). `false` tira o registro. */
function sessaoDeMidia(ligar: boolean) {
  if (!telaDesligada || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const acao = (nome: (typeof ACOES_DE_MIDIA)[number], fazer: (() => void) | null) => {
    try {
      ms.setActionHandler(nome, fazer);
    } catch {
      // ação que este navegador não conhece
    }
  };
  if (!ligar) {
    for (const nome of ACOES_DE_MIDIA) acao(nome, null);
    ms.playbackState = "none";
    return;
  }
  const titulo = document.querySelector(".folha-da-aula h1")?.textContent?.trim() || document.title;
  if (typeof MediaMetadata !== "undefined") {
    ms.metadata = new MediaMetadata({
      title: titulo,
      artist: "Instituto Lúcia",
      artwork: [
        { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  }
  acao("play", () => continuar());
  acao("pause", () => pausar());
  acao("previoustrack", () => {
    if (!estado.ativo) return;
    const comeco = inicioDoTrecho(estado.trecho);
    // No meio do trecho, volta ao começo dele; já no começo, vai para o anterior.
    const alvo = estado.frase > comeco ? comeco : inicioDoTrecho(Math.max(0, estado.trecho - 1));
    if (contexto?.state === "suspended") void contexto.resume();
    falar(Math.max(0, alvo), true);
  });
  acao("nexttrack", () => {
    if (!estado.ativo) return;
    const alvo = inicioDoTrecho(estado.trecho + 1);
    if (alvo < 0) return parar();
    if (contexto?.state === "suspended") void contexto.resume();
    falar(alvo, true);
  });
  acao("seekbackward", () => anterior());
  acao("seekforward", () => proxima());
}

function estadoDaMidia(tocando: boolean) {
  if (telaDesligada && typeof navigator !== "undefined" && "mediaSession" in navigator) navigator.mediaSession.playbackState = tocando ? "playing" : "paused";
}

async function falarNatural(i: number, minhaVez: number) {
  const pedido = som(i);
  if (!pedido) return "speechSynthesis" in window && !aparelhoFalhou ? falarNoAparelho(i, minhaVez) : semVoz();
  // Enquanto esta toca, as próximas vão sendo geradas: uma fila de três frases prontas.
  for (let k = 1; k <= ADIANTADAS && i + k < frases.length; k++) som(i + k);
  let pronto = false;
  const aviso = window.setTimeout(() => !pronto && minhaVez === vez && mudar({ esperando: true }), 250);
  let s: Som;
  try {
    s = await pedido;
  } catch {
    window.clearTimeout(aviso);
    if (minhaVez !== vez) return;
    // A voz natural falhou nesta frase (memória, motor fechado): a do aparelho segue a leitura, sem travar.
    naturalPronta = false;
    vozAtual = null;
    mudar({ esperando: false, naturalPronta: false });
    if ("speechSynthesis" in window && !aparelhoFalhou) falar(i, true);
    else semVoz();
    return;
  } finally {
    pronto = true;
  }
  window.clearTimeout(aviso);
  if (estado.esperando) mudar({ esperando: false });
  if (minhaVez !== vez || !estado.tocando) return;
  fonte?.stop();
  if (!s.pcm.length) return avancarSozinho(i);
  // Tela desligada: o <audio> toca; se o aparelho recusar, segue pelo AudioContext.
  if (telaDesligada && tocador && (await tocarNoAudio(s, i, minhaVez))) return;
  if (minhaVez !== vez || !estado.tocando || !contexto) return;
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

/**
 * Fala a frase `i`. `pulo`: a pessoa foi até ela (voltar, avançar, trocar a voz, começar), então a voz natural já
 * pronta pode entrar aqui mesmo, sem esperar o próximo trecho.
 */
function falar(i: number, pulo = false) {
  vez++;
  const minhaVez = vez;
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  const ocupado = Boolean(synth && (synth.speaking || synth.pending));
  synth?.cancel();
  limparVigia();
  falaDoAparelho = null;
  fonte?.stop();
  fonte = null;
  pararAudio();
  estadoDaMidia(true);
  const natural = naturalPronta && Boolean(motor) && Boolean(vozDaFrase(i));
  const qual = escolherVoz({ naturalPronta: natural, somPronto: natural && somPronto(i), abreTrecho: frases[i].abre || pulo, vozAtual, aparelhoFala: Boolean(synth) && !aparelhoFalhou });
  mudar({ frase: i, trecho: frases[i].trecho, tocando: true, esperando: qual === "esperar" });
  destacar(i);
  if (qual === "natural") {
    vozAtual = "natural";
    mudar({ vozAgora: "natural" });
    void falarNatural(i, minhaVez);
  } else if (qual === "aparelho") {
    // Frase num idioma sem voz natural: o aparelho lê só ela, e a natural continua na seguinte.
    if (!(naturalPronta && !vozDaFrase(i))) vozAtual = "aparelho";
    mudar({ vozAgora: "aparelho" });
    falarNoAparelho(i, minhaVez, ocupado);
    adiantarNatural(i);
  }
  // "esperar": nenhuma voz ainda; quando a natural abrir, prepararAoFundo() chama falar() de novo.
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
  mudar({ ativo: true, total: frases.length, trechos: frases[frases.length - 1].trecho + 1, frase: 0, trecho: 0, velocidade: escolha.velocidade, voz: escolha.voz, modo: escolha.modo, erro: null });
  comecar(0);
}

/**
 * Começa (ou recomeça) a leitura na frase `i`, sem esperar nada: tudo aqui roda ainda dentro do clique. Com a voz
 * natural já aberta, ela lê; senão, a do aparelho lê enquanto a natural abre ao fundo.
 */
function comecar(i: number) {
  leitura++;
  const minhaLeitura = leitura;
  vozAtual = null;
  aparelhoFalhou = false;
  naturalACaminho = false;
  const querNatural = estado.voz !== VOZ_DO_APARELHO;
  const temAparelho = "speechSynthesis" in window;
  naturalPronta = querNatural && motorCarregado && Boolean(vozEscolhida());
  mudar({ naturalPronta, vozAgora: null });
  if (!querNatural && !temAparelho) {
    mudar({ ativo: false, erro: "sem-voz" });
    return;
  }
  if (querNatural && typeof AudioContext !== "undefined") {
    // O som precisa ser liberado dentro do clique; depois, a voz natural pode tocar a qualquer momento.
    contexto ??= new AudioContext();
    void contexto.resume();
  }
  if (querNatural) liberarAudio();
  sessaoDeMidia(true);
  if (querNatural && !naturalPronta) void prepararAoFundo(minhaLeitura);
  falar(Math.min(i, frases.length - 1), true);
}

/** Abre a voz natural enquanto a leitura já anda; quando ela fica pronta, entra no próximo trecho. */
async function prepararAoFundo(minhaLeitura: number) {
  naturalACaminho = true;
  let ok = false;
  try {
    lista ??= await carregarLista();
    if (minhaLeitura !== leitura) return;
    const voz = vozEscolhida();
    if (!voz) {
      // Sem a lista ou sem esta voz no site: fica a do aparelho.
      mudar({ voz: VOZ_DO_APARELHO });
      return;
    }
    ok = await prepararNatural(voz);
    if (minhaLeitura !== leitura || !estado.ativo) return;
    if (!ok) {
      // Sem a voz natural (arquivo fora do ar, memória): segue com a do aparelho.
      mudar({ voz: VOZ_DO_APARELHO });
      return;
    }
    naturalPronta = true;
    mudar({ naturalPronta: true });
    if (estado.tocando && estado.esperando) falar(estado.frase, true); // nada soava: a natural começa já
    else if (estado.tocando) adiantarNatural(estado.frase);
  } finally {
    if (minhaLeitura === leitura) {
      naturalACaminho = false;
      // Nem o aparelho nem a voz natural: não há com que ler.
      if (!ok && estado.ativo && (aparelhoFalhou || !("speechSynthesis" in window))) semVoz();
    }
  }
}

export function pausar() {
  if (!estado.ativo || !estado.tocando) return;
  vez++;
  limparVigia();
  if (somNoAudio && tocador) tocador.pause();
  else if (fonte && contexto) void contexto.suspend();
  else window.speechSynthesis?.cancel();
  estadoDaMidia(false);
  mudar({ tocando: false, esperando: false });
}

export function continuar() {
  if (!estado.ativo || estado.tocando) return;
  if (somNoAudio && tocador?.paused) {
    // Retoma o <audio> do ponto exato da frase.
    vez++;
    const minhaVez = vez;
    const i = estado.frase;
    tocador.onended = () => {
      if (minhaVez === vez && somNoAudio && estado.tocando) avancarSozinho(i);
    };
    mudar({ tocando: true });
    estadoDaMidia(true);
    void tocador.play().catch(() => falar(i));
    return;
  }
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
  falar(Math.max(0, estado.frase - 1), true);
}

export function proxima() {
  if (!estado.ativo) return;
  if (estado.frase + 1 >= frases.length) return parar();
  if (contexto?.state === "suspended") void contexto.resume();
  falar(estado.frase + 1, true);
}

export function definirVelocidade(v: number) {
  const velocidade = Math.min(2, Math.max(0.5, v));
  mudar({ velocidade });
  // A voz do aparelho só muda a velocidade na próxima fala: recomeça a frase atual já no ritmo novo.
  if (estado.ativo && estado.tocando && !fonte && !somNoAudio) falar(estado.frase);
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
  leitura++;
  limparVigia();
  falaDoAparelho = null;
  naturalPronta = false;
  naturalACaminho = false;
  vozAtual = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  fonte?.stop();
  fonte = null;
  pararAudio();
  sessaoDeMidia(false);
  if (contexto?.state === "suspended") void contexto.resume();
  apagarDestaque();
  if (limpar) {
    sessao++;
    motor?.cancelar(sessao);
    sons.clear();
    prontos.clear();
    aquecidoPara = "";
    for (const [chave, url] of urls) {
      if (chave === "silencio") continue;
      URL.revokeObjectURL(url);
      urls.delete(chave);
    }
  }
  // A voz natural que estava baixando continua ao fundo (o progresso segue no seletor); só sai do tocador.
  mudar({ ativo: false, tocando: false, esperando: false, frase: 0, trecho: 0, vozAgora: null, naturalPronta: false, carregando: Boolean(motor) && !motorCarregado });
}

/** Ao sair da aula (troca de página no próprio site ou o leitor desmontado): para tudo e zera a fila. */
export function encerrarLeitura() {
  parar(true);
  frases = [];
  mudar({ total: 0, trechos: 0, erro: null });
}

/** Troca a voz no meio da leitura (ou antes de começar). */
export function trocarVoz(id: string) {
  if (id === estado.voz) return;
  const tocava = estado.ativo;
  const frase = estado.frase;
  mudar({ voz: id });
  if (tocava) {
    parar(false);
    iniciarDe(frase);
  }
}

function iniciarDe(frase: number) {
  if (!frases.length) return;
  mudar({ ativo: true, total: frases.length, trechos: frases[frases.length - 1].trecho + 1, erro: null });
  comecar(frase);
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
  motorCarregado = false;
  mudar({ carregando: false, baixado: 0, aBaixar: 0 });
  if (estado.ativo && naturalACaminho) {
    // A leitura esperava esta voz: segue com a do aparelho ou, sem ela, para com o aviso.
    naturalACaminho = false;
    mudar({ voz: VOZ_DO_APARELHO });
    if (aparelhoFalhou || !("speechSynthesis" in window)) semVoz();
  }
}
