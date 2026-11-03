// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As duas conferências de texto do E4-16, sem servidor e sem IA, só regras:
//  - revisarConteudo: links, fontes e modelo de aula de um texto (rascunho do educador, aula que alguém escreveu);
//  - conferirTraducao: quem traduz é a pessoa; o aparelho confere se a tradução manteve parágrafos, números, endereços
//    e termos protegidos do original.
// Nenhum endereço é aberto aqui (CORS e exposição do IP a terceiros): para saber se ainda abrem, a coordenação roda
// `npm run conferir:links`. O texto nunca sai da memória da página.
// Sem os atalhos "@/" e sem "node:fs" de propósito: `npm run testar:agentes` roda este arquivo no Node.

import { conferirModelo, type ParteDoModelo } from "../modelo-de-aula";

export type Gravidade = "corrigir" | "conferir";

export type RegraDeAchado =
  | "http"
  | "encurtador"
  | "rastreio"
  | "repetido"
  | "texto-vazio"
  | "clique-aqui"
  | "sem-secao"
  | "secao-vazia"
  | "marcador"
  | "sem-ano-nem-endereco"
  | "numero-sem-fonte"
  | "modelo-objetivo"
  | "modelo-explicacao"
  | "modelo-exemplo"
  | "modelo-exercicio"
  | "modelo-resumo"
  | "universidade"
  | "diploma";

export interface Achado {
  tipo: "link" | "fonte" | "modelo" | "interface";
  gravidade: Gravidade;
  /** A linha do texto (começa em 1). */
  linha: number;
  trecho: string;
  regra: RegraDeAchado;
}

export const ENCURTADORES = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly"];
/** A mesma lista de scripts/testar-textos-escola.mjs: a Escola nunca se chama universidade nem promete diploma. */
export const PROIBIDAS_NA_INTERFACE = ["universidade", "universidad", "university", "université", "университет", "大学", "diploma", "diplôme", "диплом", "文凭", "学位"];

const GRAVIDADE: Record<RegraDeAchado, Gravidade> = {
  http: "corrigir",
  encurtador: "corrigir",
  rastreio: "conferir",
  repetido: "conferir",
  "texto-vazio": "corrigir",
  "clique-aqui": "conferir",
  "sem-secao": "corrigir",
  "secao-vazia": "corrigir",
  marcador: "corrigir",
  "sem-ano-nem-endereco": "conferir",
  "numero-sem-fonte": "conferir",
  "modelo-objetivo": "conferir",
  "modelo-explicacao": "conferir",
  "modelo-exemplo": "conferir",
  "modelo-exercicio": "conferir",
  "modelo-resumo": "conferir",
  universidade: "conferir",
  diploma: "conferir",
};

const FONTES = /^(fontes?|refer[eê]ncias|sources|fuentes|r[eé]f[eé]rences|источники|来源)\s*:?$/i;
const MARCADOR = /\[acrescente as fontes\]/i;
const CLIQUE_AQUI = /^(clique aqui|clique|aqui|click here|here|clic aqu[ií]|haga clic aqu[ií]|aqu[ií]|cliquez ici|ici|нажмите здесь|здесь|点击这里|点这里)\.?$/i;
const ANO = /\b(1[0-9]|20)\d{2}\b/;
const corte = (linha: string) => linha.trim().replace(/\s+/g, " ").slice(0, 160);

function titulo(linha: string): string | null {
  const h = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(linha.trim());
  if (h) return h[1].replace(/[*_`]/g, "").trim();
  const negrito = /^\*\*(.+?)\*\*:?\s*$/.exec(linha.trim());
  return negrito ? negrito[1].trim() : null;
}

interface Partes {
  linhas: string[];
  /** Índices das linhas que são código (cercas incluídas) ou cabeçalho da aula. */
  codigo: Set<number>;
  cabecalho: Set<number>;
  fonteDoCabecalho: string[];
  quizDoCabecalho: number;
}

function separar(texto: string): Partes {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n");
  const codigo = new Set<number>();
  const cabecalho = new Set<number>();
  const fonteDoCabecalho: string[] = [];
  let quizDoCabecalho = 0;
  let inicio = 0;
  if (linhas[0]?.trim() === "---") {
    const fim = linhas.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (fim > 0) {
      for (let i = 0; i <= fim; i++) cabecalho.add(i);
      inicio = fim + 1;
      let bloco: "fontes" | "quiz" | "" = "";
      let atual = "";
      for (let i = 1; i < fim; i++) {
        const l = linhas[i];
        if (/^fontes:\s*$/.test(l)) {
          bloco = "fontes";
          continue;
        }
        if (/^quiz:\s*$/.test(l)) {
          bloco = "quiz";
          continue;
        }
        if (/^\S/.test(l)) {
          if (atual) fonteDoCabecalho.push(atual);
          atual = "";
          bloco = "";
          continue;
        }
        if (bloco === "fontes") {
          if (/^\s{0,4}-\s/.test(l)) {
            if (atual) fonteDoCabecalho.push(atual);
            atual = l;
          } else atual += ` ${l}`;
        }
        if (bloco === "quiz" && /^\s{0,4}-\s+pergunta:/.test(l)) quizDoCabecalho++;
      }
      if (atual) fonteDoCabecalho.push(atual);
    }
  }
  let dentro = false;
  for (let i = inicio; i < linhas.length; i++) {
    if (/^\s*(```|~~~)/.test(linhas[i])) {
      codigo.add(i);
      dentro = !dentro;
    } else if (dentro) codigo.add(i);
  }
  return { linhas, codigo, cabecalho, fonteDoCabecalho, quizDoCabecalho };
}

/**
 * Revisa um texto de aula, só com regras. LINKS: http sem s, encurtador, rastreio (utm_*, fbclid, gclid), repetido,
 * texto de link vazio ou "clique aqui". FONTES: seção ausente ou vazia, o marcador "[acrescente as fontes]" ainda no
 * texto, fonte sem ano nem endereço, número ou % sem fonte. MODELO: as partes do modelo de aula (lib/modelo-de-aula.ts).
 * Com `naEscola`, também "universidade" e "diploma" nos 6 idiomas. Determinística: o mesmo texto dá a mesma lista.
 */
export function revisarConteudo(texto: string, o: { naEscola?: boolean } = {}): Achado[] {
  const { linhas, codigo, cabecalho, fonteDoCabecalho, quizDoCabecalho } = separar(texto);
  const achados: Achado[] = [];
  const achar = (regra: RegraDeAchado, tipo: Achado["tipo"], i: number, trecho = linhas[i] ?? "") => achados.push({ tipo, gravidade: GRAVIDADE[regra], linha: i + 1, trecho: corte(trecho), regra });

  // Links (no cabeçalho também: é onde ficam os endereços das fontes).
  const vistos = new Set<string>();
  linhas.forEach((linha, i) => {
    if (codigo.has(i)) return;
    const urls: { url: string; texto?: string }[] = [];
    const semLinks = linha.replace(/\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_, t: string, u: string) => {
      urls.push({ url: u, texto: t });
      return " ";
    });
    for (const m of semLinks.matchAll(/https?:\/\/[^\s)\]>"'<]+/g)) urls.push({ url: m[0].replace(/[.,;:!?]+$/, "") });
    for (const { url, texto: t } of urls) {
      if (!/^https?:\/\//i.test(url)) continue;
      if (t !== undefined && !t.trim()) achar("texto-vazio", "link", i);
      else if (t !== undefined && CLIQUE_AQUI.test(t.trim())) achar("clique-aqui", "link", i);
      let analisado: URL | null = null;
      try {
        analisado = new URL(url);
      } catch {
        // endereço torto: só os outros testes
      }
      if (/^http:\/\//i.test(url)) achar("http", "link", i);
      const host = (analisado?.hostname ?? "").toLowerCase().replace(/^www\./, "");
      if (ENCURTADORES.includes(host)) achar("encurtador", "link", i);
      if (analisado && [...analisado.searchParams.keys()].some((k) => /^utm_/i.test(k) || /^(fbclid|gclid)$/i.test(k))) achar("rastreio", "link", i);
      const chave = analisado ? `${host}${analisado.pathname.replace(/\/$/, "")}${analisado.search}` : url;
      if (vistos.has(chave)) achar("repetido", "link", i);
      vistos.add(chave);
    }
  });

  // Fontes.
  let secao: { linha: number; itens: { i: number; texto: string }[] } | null = null;
  for (let i = 0; i < linhas.length; i++) {
    if (cabecalho.has(i) || codigo.has(i)) continue;
    const t = titulo(linhas[i]);
    if (t !== null) {
      if (secao) break;
      if (FONTES.test(t)) secao = { linha: i, itens: [] };
    } else if (secao && linhas[i].trim()) secao.itens.push({ i, texto: linhas[i] });
  }
  linhas.forEach((linha, i) => {
    if (!codigo.has(i) && MARCADOR.test(linha)) achar("marcador", "fonte", i);
  });
  const reais = (secao?.itens ?? []).filter((it) => !MARCADOR.test(it.texto));
  const temMarcador = (secao?.itens.length ?? 0) > reais.length;
  const temFontes = fonteDoCabecalho.length > 0 || reais.length > 0;
  if (!temFontes) {
    if (secao && !temMarcador) achar("secao-vazia", "fonte", secao.linha);
    else if (!secao && fonteDoCabecalho.length === 0) achados.push({ tipo: "fonte", gravidade: GRAVIDADE["sem-secao"], linha: 1, trecho: "", regra: "sem-secao" });
  }
  for (const it of reais) if (!ANO.test(it.texto) && !/https?:\/\//i.test(it.texto)) achar("sem-ano-nem-endereco", "fonte", it.i);
  for (const f of fonteDoCabecalho) if (!ANO.test(f) && !/https?:\/\//i.test(f)) achados.push({ tipo: "fonte", gravidade: GRAVIDADE["sem-ano-nem-endereco"], linha: 1, trecho: corte(f.replace(/^\s*-\s*/, "")), regra: "sem-ano-nem-endereco" });
  if (!temFontes) {
    const dentroDaSecao = new Set((secao?.itens ?? []).map((it) => it.i));
    const i = linhas.findIndex((l, k) => !cabecalho.has(k) && !codigo.has(k) && !dentroDaSecao.has(k) && titulo(l) === null && !/^\s*#/.test(l) && /\d+(?:[.,]\d+)?\s?%|(?<![\d.,])\d{2,}(?![\d])/.test(l.replace(/https?:\/\/\S+/g, "")));
    if (i >= 0) achar("numero-sem-fonte", "fonte", i);
  }

  // Modelo de aula (as partes que ficam no texto; "fontes" já foi conferida acima).
  const corpo = linhas
    .filter((_, i) => !cabecalho.has(i))
    .map((l) => {
      const t = /^\*\*(.+?)\*\*:?\s*$/.exec(l.trim());
      return t ? `## ${t[1]}` : l;
    })
    .join("\n");
  const marcadasCertas = (corpo.match(/\(certa\)/g) ?? []).length;
  const resultado = conferirModelo({ corpo, quiz: Math.max(quizDoCabecalho, marcadasCertas), fontes: temFontes ? 1 : 0 });
  for (const r of resultado) {
    const parte: ParteDoModelo = r.parte;
    if (r.ok || parte === "fontes") continue;
    const regra = `modelo-${parte}` as RegraDeAchado;
    achados.push({ tipo: "modelo", gravidade: GRAVIDADE[regra], linha: 1, trecho: "", regra });
  }

  if (o.naEscola) {
    linhas.forEach((linha, i) => {
      if (codigo.has(i)) return;
      const minuscula = linha.toLowerCase();
      const termo = PROIBIDAS_NA_INTERFACE.find((p) => minuscula.includes(p));
      if (termo) achar(/^dipl|^диплом|^文凭|^学位/.test(termo) ? "diploma" : "universidade", "interface", i);
    });
  }
  return achados.sort((a, b) => a.linha - b.linha || a.regra.localeCompare(b.regra));
}

// ───────────────────────── Tradução supervisionada ─────────────────────────

export type RegraDaTraducao = "vazia" | "paragrafos" | "titulos" | "itens" | "numero" | "numero-a-mais" | "endereco" | "endereco-a-mais" | "termo" | "tamanho" | "universidade" | "diploma";

export interface AchadoDaTraducao {
  regra: RegraDaTraducao;
  gravidade: Gravidade;
  /** O que faltou ou sobrou (o número, o endereço, o termo, "3 → 2"). */
  detalhe: string;
}

export const TERMOS_PROTEGIDOS_PADRAO = ["Instituto Lúcia", "Escola Lúcia Maria", "Gaveta Aberta"];
/** A tradução só dispara o alerta de tamanho abaixo de 30% ou acima de 300% do original. */
export const FAIXA_DO_TAMANHO = { min: 0.3, max: 3 } as const;
export const IDIOMAS_DE_DESTINO = ["en", "es", "fr", "ru", "zh"] as const;
export type IdiomaDeDestino = (typeof IDIOMAS_DE_DESTINO)[number];

const PROIBIDAS_POR_IDIOMA: Record<string, { universidade: string[]; diploma: string[] }> = {
  en: { universidade: ["university"], diploma: ["diploma"] },
  es: { universidade: ["universidad"], diploma: ["diploma"] },
  fr: { universidade: ["université"], diploma: ["diplôme"] },
  ru: { universidade: ["университет"], diploma: ["диплом"] },
  zh: { universidade: ["大学"], diploma: ["文凭", "学位"] },
  pt: { universidade: ["universidade"], diploma: ["diploma"] },
};

const semUrls = (t: string) => t.replace(/https?:\/\/[^\s)\]>"'<]+/g, " ");

function numerosDe(texto: string): string[] {
  const t = semUrls(texto)
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/(?<!\d)(\d{1,3})[   ](?=\d{3}(?!\d))/g, "$1");
  return (t.match(/\d[\d.,]*\d|\d/g) ?? []).map((n) => n.replace(/[.,]/g, ""));
}

const enderecosDe = (texto: string) => (texto.match(/https?:\/\/[^\s)\]>"'<]+/g) ?? []).map((u) => u.replace(/[.,;:!?]+$/, "").replace(/\/$/, "").toLowerCase());

function faltas(origem: string[], traducao: string[]): { faltam: string[]; sobram: string[] } {
  const conta = (l: string[]) => l.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());
  const a = conta(origem);
  const b = conta(traducao);
  const faltam: string[] = [];
  const sobram: string[] = [];
  for (const [x, n] of a) for (let k = (b.get(x) ?? 0); k < n; k++) faltam.push(x);
  for (const [x, n] of b) for (let k = (a.get(x) ?? 0); k < n; k++) sobram.push(x);
  return { faltam, sobram };
}

const blocos = (t: string) => t.replace(/\r\n?/g, "\n").split(/\n\s*\n/).filter((b) => b.trim()).length;
const titulos = (t: string) => t.split("\n").filter((l) => /^\s{0,3}#{1,6}\s/.test(l)).length;
const itens = (t: string) => t.split("\n").filter((l) => /^\s*([-*+]|\d+[.)])\s+/.test(l)).length;

/**
 * Compara a tradução (feita por uma pessoa) com o original: parágrafos, títulos e itens de lista; os mesmos números e
 * endereços (como multiconjunto, ignorando separador de milhar e vírgula decimal); os termos protegidos; o tamanho (só
 * alerta "conferir": abaixo de 30% ou acima de 300%); e, com `naEscola`, "universidade" e "diploma" na língua de destino.
 * Tradução fiel dá lista vazia. A função não traduz nada.
 */
export function conferirTraducao(origem: string, traducao: string, idiomaDestino: string, o: { termosProtegidos?: readonly string[]; naEscola?: boolean } = {}): AchadoDaTraducao[] {
  const achados: AchadoDaTraducao[] = [];
  const add = (regra: RegraDaTraducao, gravidade: Gravidade, detalhe: string) => achados.push({ regra, gravidade, detalhe });
  if (!traducao.trim()) {
    add("vazia", "corrigir", "");
    return achados;
  }
  const comparar = (regra: "paragrafos" | "titulos" | "itens", a: number, b: number) => {
    if (a !== b) add(regra, "corrigir", `${a} → ${b}`);
  };
  comparar("paragrafos", blocos(origem), blocos(traducao));
  comparar("titulos", titulos(origem), titulos(traducao));
  comparar("itens", itens(origem), itens(traducao));

  const n = faltas(numerosDe(origem), numerosDe(traducao));
  for (const x of n.faltam) add("numero", "corrigir", x);
  for (const x of n.sobram) add("numero-a-mais", "conferir", x);
  const u = faltas(enderecosDe(origem), enderecosDe(traducao));
  for (const x of u.faltam) add("endereco", "corrigir", x);
  for (const x of u.sobram) add("endereco-a-mais", "conferir", x);

  const extras = (o.termosProtegidos ?? []).map((t) => t.trim()).filter((t) => t && t.length <= 60);
  const termos = [...new Set([...TERMOS_PROTEGIDOS_PADRAO, ...extras].slice(0, 30))];
  const o1 = origem.toLowerCase();
  const t1 = traducao.toLowerCase();
  for (const termo of termos) if (o1.includes(termo.toLowerCase()) && !t1.includes(termo.toLowerCase())) add("termo", "corrigir", termo);

  const razao = origem.trim().length ? traducao.trim().length / origem.trim().length : 1;
  if (razao < FAIXA_DO_TAMANHO.min || razao > FAIXA_DO_TAMANHO.max) add("tamanho", "conferir", `${Math.round(razao * 100)}%`);

  if (o.naEscola) {
    const lista = PROIBIDAS_POR_IDIOMA[idiomaDestino] ?? PROIBIDAS_POR_IDIOMA.pt;
    const achou = (palavras: string[]) => palavras.find((p) => t1.includes(p));
    const univ = achou(lista.universidade);
    const dip = achou(lista.diploma);
    if (univ) add("universidade", "conferir", univ);
    if (dip) add("diploma", "conferir", dip);
  }
  return achados;
}

/** A marca de "em revisão" que vai junto da cópia, na língua de destino. Texto escrito pelo pacote: em revisão. */
export const MARCA_EM_REVISAO: Record<string, string> = {
  pt: "[Tradução em revisão]",
  en: "[Translation under review]",
  es: "[Traducción en revisión]",
  fr: "[Traduction en révision]",
  ru: "[Перевод на проверке]",
  zh: "[译文审核中]",
};

/** A trava da tela: só libera "Copiar com a marca em revisão" depois que a pessoa marca, à mão, que um falante revisou. */
export const podeCopiarTraducao = (o: { revisadoPorFalante: boolean; traducao: string }): boolean => o.revisadoPorFalante === true && o.traducao.trim().length > 0;

export const copiarComMarca = (traducao: string, idiomaDestino: string): string => `${MARCA_EM_REVISAO[idiomaDestino] ?? MARCA_EM_REVISAO.pt}\n\n${traducao.trim()}`;
