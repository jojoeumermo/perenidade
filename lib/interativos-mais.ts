// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Mais blocos interativos das aulas: simulação física, geometria, mapa, programação por blocos, código para rodar,
// cena clicável, arrastar para o grupo certo e música com letra. Como em lib/interativos.ts, este arquivo só lê os
// dados escritos por quem faz a aula (sem React), para o roteiro de conferência rodar direto no Node.

import { linhasDe, numero } from "./interativos";

const limpa = (linha: string) => linha.trim();
const semAcento = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/** Arquivo do próprio site (nunca endereço de fora): /arquivos/… ou /imagens/…. */
const arquivoDoSite = (caminho: string, extensoes: string) => new RegExp(`^/(arquivos|imagens)/[A-Za-z0-9/._-]+\\.(${extensoes})$`, "i").test(caminho) && !caminho.includes("..");
export const imagemDoSite = (caminho: string) => arquivoDoSite(caminho, "png|jpe?g|webp|gif|svg|avif");
/** Áudio do site ou gravado no editor e ainda em revisão (envio:<id>/<nome>). */
export const audioDoSite = (caminho: string) => arquivoDoSite(caminho, "mp3|ogg|m4a|webm|wav") || /^envio:[0-9a-f-]{36}\/[a-z0-9-]{8,60}\.(webm|m4a)$/.test(caminho);

/** "(1, 2)", "(1,5; 2)", "1 2" ou "1,5 -2,5" → [1, 2]. */
export function parDeNumeros(texto: string): [number, number] | null {
  const t = texto.replace(/[()]/g, "").trim();
  if (!t) return null;
  let partes: string[];
  if (t.includes(";")) partes = t.split(";");
  else if (/\s/.test(t)) partes = t.split(/\s+/).map((p) => p.replace(/,$/, ""));
  else partes = t.split(",");
  partes = partes.map((p) => p.trim()).filter(Boolean);
  if (partes.length !== 2) return null;
  const [a, b] = partes.map(numero);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}

// ───────────── Simulação física ─────────────

export interface Corpo {
  tipo: "bola" | "caixa" | "rampa" | "pendulo";
  nome: string;
  /** Metros, com o chão em y = 0 e y para cima. */
  x: number;
  y: number;
  x2: number;
  y2: number;
  raio: number;
  largura: number;
  altura: number;
  comprimento: number;
  angulo: number;
  fixo: boolean;
  quique: number;
  atrito: number;
  massa: number | null;
  vx: number;
  vy: number;
  cor: string;
}

export interface Simulacao {
  gravidade: number;
  chao: boolean;
  paredes: boolean;
  corpos: Corpo[];
  mostrar: string[];
}

/** O mundo da simulação, em metros: 16 de largura e 9 de altura. */
export const MUNDO = { largura: 16, altura: 9 };

const CORES: Record<string, string> = {
  vermelho: "#b3261e", vermelha: "#b3261e", azul: "#2f5fb3", verde: "#2e7d32", amarelo: "#c9a227", amarela: "#c9a227",
  preto: "#1f1f1f", preta: "#1f1f1f", laranja: "#d9731a", roxo: "#6a3fa0", roxa: "#6a3fa0", cinza: "#6b6b6b", rosa: "#c2477e", marrom: "#7a4a24",
};
export const corDe = (nome: string, padrao: string) => (/^#[0-9a-f]{6}$/i.test(nome) ? nome : CORES[semAcento(nome)] ?? padrao);

/**
 * gravidade: 9,8            (m/s²; 0 é o espaço)
 * bola A em (2, 6) raio 0,4 quique 0,8 velocidade (3, 0) cor azul
 * caixa em (8, 1) tamanho 2x0,5 fixa angulo 15
 * rampa de (1, 4) a (7, 1)
 * pendulo em (12, 8) comprimento 4 angulo 40
 * mostrar A
 */
export function lerSimulacao(spec: string): Simulacao {
  const s: Simulacao = { gravidade: 9.8, chao: true, paredes: true, corpos: [], mostrar: [] };
  for (const bruta of linhasDe(spec)) {
    const linha = limpa(bruta);
    if (!linha || linha.startsWith("#")) continue;
    const opcao = /^(gravidade|chao|chão|paredes)\s*:\s*(.+)$/i.exec(linha);
    if (opcao) {
      const chave = semAcento(opcao[1]);
      const valor = semAcento(opcao[2]);
      if (chave === "gravidade") {
        const g = numero(valor.replace(/m\/s.*$/, ""));
        if (Number.isFinite(g) && g >= -30 && g <= 30) s.gravidade = g;
      } else if (chave === "chao") s.chao = !/^(nao|n|sem|false)$/.test(valor);
      else s.paredes = !/^(nao|n|sem|false)$/.test(valor);
      continue;
    }
    const mostrar = /^mostrar\s+(.+)$/i.exec(linha);
    if (mostrar) {
      for (const nome of mostrar[1].split(/[\s,]+/)) if (/^[\p{L}\d]{1,12}$/u.test(nome) && s.mostrar.length < 4) s.mostrar.push(nome);
      continue;
    }
    const m = /^(bola|caixa|rampa|pendulo|pêndulo)\b\s*(.*)$/i.exec(linha);
    if (!m || s.corpos.length >= 30) continue;
    const tipo = semAcento(m[1]) as Corpo["tipo"];
    let resto = m[2];
    let nome = "";
    const n = /^([\p{L}\d]{1,12})(?=\s+(em|de|raio|tamanho|comprimento)\b|$)/iu.exec(resto);
    if (n && !/^(em|de)$/i.test(n[1])) {
      nome = n[1];
      resto = resto.slice(n[0].length);
    }
    const c: Corpo = { tipo, nome, x: MUNDO.largura / 2, y: MUNDO.altura - 1, x2: 0, y2: 0, raio: 0.4, largura: 1, altura: 1, comprimento: 3, angulo: 0, fixo: tipo === "rampa", quique: tipo === "bola" ? 0.6 : 0.2, atrito: 0.1, massa: null, vx: 0, vy: 0, cor: "" };
    const par = (chave: string) => {
      const r = new RegExp(`(?<!\\p{L})${chave}\\s*\\(([^)]*)\\)`, "iu").exec(resto);
      return r ? parDeNumeros(r[1]) : null;
    };
    const valor = (chave: string) => {
      const r = new RegExp(`(?<!\\p{L})${chave}\\s+(-?[\\d.,]+)`, "iu").exec(resto);
      const v = r ? numero(r[1]) : NaN;
      return Number.isFinite(v) ? v : null;
    };
    const pos = par("em") ?? par("de");
    if (pos) [c.x, c.y] = pos;
    if (tipo === "rampa") {
      const fim = par("a");
      if (!pos || !fim) continue;
      [c.x2, c.y2] = fim;
    }
    const tamanho = /\btamanho\s+([\d.,]+)\s*[x×]\s*([\d.,]+)/i.exec(resto);
    if (tamanho) {
      c.largura = numero(tamanho[1]);
      c.altura = numero(tamanho[2]);
    }
    c.raio = valor("raio") ?? (tipo === "pendulo" ? 0.35 : c.raio);
    c.comprimento = valor("comprimento") ?? c.comprimento;
    c.angulo = valor("angulo") ?? valor("ângulo") ?? 0;
    c.quique = valor("quique") ?? c.quique;
    c.atrito = valor("atrito") ?? c.atrito;
    c.massa = valor("massa");
    const v = par("velocidade");
    if (v) [c.vx, c.vy] = v;
    if (/\bfix[oa]\b/i.test(resto)) c.fixo = true;
    const cor = /\bcor\s+(#[0-9a-f]{6}|[\p{L}]+)/iu.exec(resto);
    c.cor = corDe(cor?.[1] ?? "", ["#b3261e", "#2f5fb3", "#2e7d32", "#c9a227", "#6a3fa0"][s.corpos.length % 5]);
    // Valores fora do mundo ou absurdos: o bloco ignora em vez de travar a página.
    const dentro = (x: number, y: number) => x >= -1 && x <= MUNDO.largura + 1 && y >= -1 && y <= MUNDO.altura + 3;
    if (!dentro(c.x, c.y) || (tipo === "rampa" && !dentro(c.x2, c.y2))) continue;
    c.raio = Math.min(3, Math.max(0.05, c.raio));
    c.largura = Math.min(16, Math.max(0.1, c.largura || 1));
    c.altura = Math.min(9, Math.max(0.1, c.altura || 1));
    c.comprimento = Math.min(8, Math.max(0.3, c.comprimento));
    c.quique = Math.min(1, Math.max(0, c.quique));
    c.atrito = Math.min(1, Math.max(0, c.atrito));
    c.angulo = Math.max(-360, Math.min(360, c.angulo));
    if (c.massa !== null && !(c.massa > 0 && c.massa <= 1000)) c.massa = null;
    c.vx = Math.max(-50, Math.min(50, c.vx));
    c.vy = Math.max(-50, Math.min(50, c.vy));
    s.corpos.push(c);
  }
  return s;
}

// ───────────── Geometria ─────────────

export interface PontoGeo {
  nome: string;
  tipo: "livre" | "fixo" | "meio";
  x: number;
  y: number;
  de: [string, string] | null;
}

export interface ObjetoGeo {
  tipo: "segmento" | "reta" | "semirreta" | "vetor" | "circulo" | "poligono" | "angulo" | "distancia";
  refs: string[];
  raio: number | null;
}

export interface Geometria {
  pontos: PontoGeo[];
  objetos: ObjetoGeo[];
  x: [number, number];
  y: [number, number] | null;
  grade: boolean;
  passo: number;
}

/**
 * A = (0, 0)          ponto que se arrasta
 * B = (4, 0) fixo     ponto parado
 * M = meio A B        ponto médio
 * segmento A B · reta A B · semirreta A B · vetor A B
 * circulo A 3 · circulo A B (passa por B)
 * poligono A B C · angulo B A C · distancia A B
 * x de -1 a 8 · y de -1 a 6 · grade: não · passo: 0,5
 */
export function lerGeometria(spec: string): Geometria {
  const g: Geometria = { pontos: [], objetos: [], x: [-1, 8], y: null, grade: true, passo: 0.5 };
  const existe = (nome: string) => g.pontos.some((p) => p.nome === nome);
  for (const bruta of linhasDe(spec)) {
    const linha = limpa(bruta);
    if (!linha || linha.startsWith("#")) continue;
    let m = /^([xy])\s+de\s+(-?[\d.,]+)\s+a\s+(-?[\d.,]+)$/i.exec(linha);
    if (m) {
      const faixa: [number, number] = [numero(m[2]), numero(m[3])];
      if (faixa.every(Number.isFinite) && faixa[0] < faixa[1] && faixa[1] - faixa[0] <= 1000) {
        if (m[1].toLowerCase() === "x") g.x = faixa;
        else g.y = faixa;
      }
      continue;
    }
    m = /^(grade|passo)\s*:\s*(.+)$/i.exec(linha);
    if (m) {
      if (m[1].toLowerCase() === "grade") g.grade = !/^(nao|n|sem|false)$/.test(semAcento(m[2]));
      else {
        const p = numero(m[2]);
        g.passo = Number.isFinite(p) && p >= 0 && p <= 10 ? p : g.passo;
      }
      continue;
    }
    m = /^([A-Z][A-Za-z0-9']{0,3})\s*=\s*(.+)$/.exec(linha);
    if (m) {
      if (existe(m[1]) || g.pontos.length >= 26) continue;
      const meio = /^(?:meio|ponto medio|ponto médio)\s*\(?\s*([A-Z][A-Za-z0-9']{0,3})\s*[, ]\s*([A-Z][A-Za-z0-9']{0,3})\s*\)?$/i.exec(m[2].trim());
      if (meio) {
        if (existe(meio[1]) && existe(meio[2])) g.pontos.push({ nome: m[1], tipo: "meio", x: 0, y: 0, de: [meio[1], meio[2]] });
        continue;
      }
      const p = /^\(([^)]*)\)\s*(fixo|fixa)?$/i.exec(m[2].trim());
      const xy = p ? parDeNumeros(p[1]) : null;
      if (xy && xy.every((v) => Math.abs(v) <= 1000)) g.pontos.push({ nome: m[1], tipo: p?.[2] ? "fixo" : "livre", x: xy[0], y: xy[1], de: null });
      continue;
    }
    m = /^(segmento|reta|semirreta|vetor|circulo|círculo|circunferencia|circunferência|poligono|polígono|triangulo|triângulo|angulo|ângulo|distancia|distância|medir)\s+(.+)$/i.exec(linha);
    if (!m || g.objetos.length >= 40) continue;
    const palavra = semAcento(m[1]);
    const tipo: ObjetoGeo["tipo"] = palavra.startsWith("circ") ? "circulo" : palavra === "triangulo" || palavra === "poligono" ? "poligono" : palavra === "medir" ? "distancia" : (palavra as ObjetoGeo["tipo"]);
    const partes = m[2].replace(/[(),]/g, " ").trim().split(/\s+/);
    if (tipo === "circulo") {
      const centro = partes[0];
      const r = numero(partes[1] ?? "");
      if (!existe(centro)) continue;
      if (Number.isFinite(r) && r > 0 && r <= 1000) g.objetos.push({ tipo, refs: [centro], raio: r });
      else if (existe(partes[1] ?? "")) g.objetos.push({ tipo, refs: [centro, partes[1]], raio: null });
      continue;
    }
    const refs = partes.filter(existe);
    const minimo = tipo === "poligono" || tipo === "angulo" ? 3 : 2;
    if (refs.length !== partes.length || refs.length < minimo) continue;
    g.objetos.push({ tipo, refs: tipo === "poligono" ? refs.slice(0, 12) : refs.slice(0, minimo), raio: null });
  }
  return g;
}

/** Onde cada ponto está, a partir das posições dos pontos que se arrastam (os médios acompanham). */
export function posicoesDaGeometria(g: Geometria, movidos: Record<string, { x: number; y: number }> = {}) {
  const pos: Record<string, { x: number; y: number }> = {};
  for (const p of g.pontos) {
    if (p.tipo === "meio" && p.de) {
      const [a, b] = [pos[p.de[0]], pos[p.de[1]]];
      if (a && b) pos[p.nome] = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    } else pos[p.nome] = movidos[p.nome] ?? { x: p.x, y: p.y };
  }
  return pos;
}

export const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
/** Ângulo em graus no vértice v, entre v→a e v→b (0 a 180). */
export function anguloEm(a: { x: number; y: number }, v: { x: number; y: number }, b: { x: number; y: number }) {
  const u = Math.atan2(a.y - v.y, a.x - v.x);
  const w = Math.atan2(b.y - v.y, b.x - v.x);
  let d = Math.abs(u - w) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}
/** Área pela fórmula do cadarço (vértices em ordem). */
export const areaDoPoligono = (ps: { x: number; y: number }[]) => Math.abs(ps.reduce((s, p, i) => s + p.x * ps[(i + 1) % ps.length].y - ps[(i + 1) % ps.length].x * p.y, 0)) / 2;

// ───────────── Mapa ─────────────

export interface Mapa {
  titulo: string;
  foco: string;
  destaques: string[];
  pontos: { lat: number; lon: number; rotulo: string }[];
  rotas: { trecho: [number, number][]; rotulo: string }[];
}

/** Regiões prontas para "foco:": [oeste, sul, leste, norte] em graus. */
export const REGIOES: Record<string, [number, number, number, number]> = {
  mundo: [-180, -58, 180, 84],
  "america do sul": [-84, -56, -32, 14],
  "america latina": [-118, -56, -32, 33],
  "america do norte": [-170, 7, -50, 75],
  "america central": [-93, 6, -59, 24],
  europa: [-25, 34, 45, 71],
  africa: [-20, -36, 53, 38],
  asia: [25, -11, 150, 56],
  "oriente medio": [25, 12, 63, 42],
  oceania: [110, -48, 180, 0],
  antartida: [-180, -90, 180, -60],
};

/**
 * titulo: As Grandes Navegações
 * foco: mundo                         (ou uma região, ou um país)
 * destacar: Portugal, Espanha
 * ponto 38,72 -9,14 | Lisboa
 * rota 38,72 -9,14 > -33,92 18,42 | Bartolomeu Dias (1488)
 */
export function lerMapa(spec: string): Mapa {
  const mapa: Mapa = { titulo: "", foco: "", destaques: [], pontos: [], rotas: [] };
  const latLon = (texto: string) => {
    const par = parDeNumeros(texto);
    return par && Math.abs(par[0]) <= 90 && Math.abs(par[1]) <= 180 ? par : null;
  };
  for (const bruta of linhasDe(spec)) {
    const linha = limpa(bruta);
    if (!linha || linha.startsWith("#")) continue;
    const opcao = /^(titulo|título|foco|destacar|destaque|paises|países)\s*:\s*(.*)$/i.exec(linha);
    if (opcao) {
      const chave = semAcento(opcao[1]);
      if (chave === "titulo") mapa.titulo = opcao[2].trim().slice(0, 120);
      else if (chave === "foco") mapa.foco = opcao[2].trim().slice(0, 60);
      else for (const pais of opcao[2].split(/[,;]/)) if (pais.trim() && mapa.destaques.length < 40) mapa.destaques.push(pais.trim().slice(0, 60));
      continue;
    }
    const [corpo, rotulo = ""] = linha.split("|").map((x) => x.trim());
    const ponto = /^ponto\s+(.+)$/i.exec(corpo);
    if (ponto) {
      const ll = latLon(ponto[1]);
      if (ll && mapa.pontos.length < 60) mapa.pontos.push({ lat: ll[0], lon: ll[1], rotulo: rotulo.slice(0, 80) });
      continue;
    }
    const rota = /^rota\s+(.+)$/i.exec(corpo);
    if (rota && mapa.rotas.length < 12) {
      const trecho = rota[1].split(/>|→/).map(latLon);
      if (trecho.length >= 2 && trecho.every(Boolean)) mapa.rotas.push({ trecho: (trecho as [number, number][]).slice(0, 40), rotulo: rotulo.slice(0, 80) });
    }
  }
  return mapa;
}

/** Nome comparável de país ou região: sem acento, sem artigo, minúsculo. */
export const nomeDeLugar = (texto: string) => semAcento(texto).replace(/[^a-z0-9 ]/g, " ").replace(/\b(o|a|os|as|de|do|da|dos|das|the|of|and|e)\b/g, " ").replace(/\s+/g, " ").trim();

// ───────────── Programação por blocos ─────────────

export const CATEGORIAS_DE_BLOCOS = ["logica", "lacos", "matematica", "texto", "listas", "variaveis", "funcoes"] as const;
export type CategoriaDeBlocos = (typeof CATEGORIAS_DE_BLOCOS)[number];

/**
 * objetivo: Faça o computador contar de 1 a 5.
 * blocos: laços, matemática, texto, variáveis
 * esperado:
 * 1
 * 2
 */
export function lerProgramacao(spec: string): { objetivo: string; categorias: CategoriaDeBlocos[]; esperado: string | null } {
  let objetivo = "";
  let categorias: CategoriaDeBlocos[] = [];
  const esperado: string[] = [];
  let lendoEsperado = false;
  for (const bruta of linhasDe(spec)) {
    const linha = bruta.trimEnd();
    if (lendoEsperado) {
      if (esperado.length < 200) esperado.push(linha.trim());
      continue;
    }
    const m = /^\s*(objetivo|blocos|esperado|saida esperada|saída esperada)\s*:\s*(.*)$/i.exec(linha);
    if (!m) continue;
    const chave = semAcento(m[1]);
    if (chave === "objetivo") objetivo = m[2].trim().slice(0, 400);
    else if (chave === "blocos") {
      categorias = m[2]
        .split(/[,;]/)
        .map((c) => semAcento(c).replace(/s$/, "").replace(/^logic$/, "logica").replace(/^laco$|^repeticao$|^repeticoe$/, "lacos").replace(/^lista$/, "listas").replace(/^variavei$|^variavel$/, "variaveis").replace(/^funcoe$|^funcao$/, "funcoes"))
        .filter((c): c is CategoriaDeBlocos => (CATEGORIAS_DE_BLOCOS as readonly string[]).includes(c));
    } else {
      lendoEsperado = true;
      if (m[2].trim()) esperado.push(m[2].trim());
    }
  }
  while (esperado.length && !esperado[esperado.length - 1]) esperado.pop();
  return { objetivo, categorias: categorias.length ? [...new Set(categorias)] : [...CATEGORIAS_DE_BLOCOS], esperado: esperado.length ? esperado.join("\n") : null };
}

/** A saída confere com a esperada? Espaços no fim das linhas e linhas em branco no fim não contam. */
export const saidaConfere = (obtida: string, esperada: string) => {
  const norma = (t: string) => t.replace(/\r/g, "").split("\n").map((l) => l.trimEnd()).join("\n").replace(/\n+$/, "");
  return norma(obtida) === norma(esperada);
};

// ───────────── Código para rodar ─────────────

export const LINGUAGENS_DE_RODAR = ["python", "javascript"] as const;

/**
 * linguagem: python
 * print("Olá")
 * --- esperado
 * Olá
 */
export function lerRodar(spec: string): { linguagem: (typeof LINGUAGENS_DE_RODAR)[number]; codigo: string; esperado: string | null } {
  const linhas = linhasDe(spec);
  let linguagem: (typeof LINGUAGENS_DE_RODAR)[number] = "python";
  const primeira = /^\s*(linguagem|lingua|língua|language)\s*:\s*(\w+)\s*$/i.exec(linhas[0] ?? "");
  if (primeira) {
    const l = primeira[2].toLowerCase();
    linguagem = l === "js" || l === "javascript" ? "javascript" : "python";
    linhas.shift();
  }
  const corte = linhas.findIndex((l) => /^\s*-{3,}\s*(esperado|saida|saída)/i.test(l));
  const codigo = (corte >= 0 ? linhas.slice(0, corte) : linhas).join("\n").replace(/^\n+|\s+$/g, "");
  const esperado = corte >= 0 ? linhas.slice(corte + 1).join("\n").replace(/\s+$/, "") : "";
  return { linguagem, codigo: codigo.slice(0, 20000), esperado: esperado || null };
}

// ───────────── Cena clicável ─────────────

export interface Cena {
  imagem: string;
  descricao: string;
  modo: "explorar" | "encontrar";
  areas: { nome: string; x: number; y: number; w: number; h: number; texto: string }[];
}

/**
 * imagem: /arquivos/coracao.webp | Desenho do coração por dentro
 * modo: encontrar
 * átrio direito | 20 15 25 30 | Recebe o sangue do corpo.
 * (as quatro medidas são em % da imagem: esquerda, topo, largura, altura)
 */
export function lerCena(spec: string): Cena | null {
  const cena: Cena = { imagem: "", descricao: "", modo: "explorar", areas: [] };
  for (const bruta of linhasDe(spec)) {
    const linha = limpa(bruta);
    if (!linha || linha.startsWith("#")) continue;
    const opcao = /^(imagem|modo)\s*:\s*(.+)$/i.exec(linha);
    if (opcao) {
      if (opcao[1].toLowerCase() === "modo") cena.modo = semAcento(opcao[2]).startsWith("encontr") ? "encontrar" : "explorar";
      else {
        const [caminho, descricao = ""] = opcao[2].split("|").map((x) => x.trim());
        if (imagemDoSite(caminho)) {
          cena.imagem = caminho;
          cena.descricao = descricao.slice(0, 300);
        }
      }
      continue;
    }
    const [nome, medidas = "", texto = ""] = linha.split("|").map((x) => x.trim());
    const n = medidas.split(/\s+/).map(numero);
    if (!nome || n.length !== 4 || !n.every((v) => Number.isFinite(v) && v >= 0 && v <= 100) || cena.areas.length >= 30) continue;
    const [x, y, w, h] = n;
    if (w > 0 && h > 0) cena.areas.push({ nome: nome.slice(0, 60), x, y, w: Math.min(w, 100 - x), h: Math.min(h, 100 - y), texto: texto.slice(0, 300) });
  }
  return cena.imagem && cena.areas.length ? cena : null;
}

// ───────────── Arrastar para o grupo certo ─────────────

/** "Grupo: item, item, item" por linha (ou ; entre os itens, se algum tiver vírgula). */
export function lerArrastar(spec: string): { grupos: { nome: string; itens: string[] }[] } {
  const grupos: { nome: string; itens: string[] }[] = [];
  let total = 0;
  for (const bruta of linhasDe(spec)) {
    const linha = limpa(bruta);
    const i = linha.indexOf(":");
    if (i <= 0 || grupos.length >= 6) continue;
    const resto = linha.slice(i + 1);
    const itens = resto.split(resto.includes(";") ? ";" : ",").map((x) => x.trim().slice(0, 80)).filter(Boolean).slice(0, 30 - total);
    total += itens.length;
    if (itens.length) grupos.push({ nome: linha.slice(0, i).trim().slice(0, 60), itens });
  }
  return { grupos: grupos.length >= 2 ? grupos : [] };
}

// ───────────── Música com letra ─────────────

/** "1:05", "65" ou "1:05.5" → segundos. */
export function segundos(texto: string): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}(?:[.,]\d+)?)$/.exec(texto.trim());
  if (!m) return null;
  const s = (m[1] ? Number(m[1]) * 60 : 0) + numero(m[2]);
  return Number.isFinite(s) ? s : null;
}

/**
 * audio: /arquivos/hino.mp3 | Crédito e licença
 * lingua: es-ES
 * 0:05 | Primeira linha da letra | tradução (opcional)
 */
export function lerMusica(spec: string): { audio: string; credito: string; lingua: string; linhas: { t: number; texto: string; traducao: string }[] } {
  const saida = { audio: "", credito: "", lingua: "", linhas: [] as { t: number; texto: string; traducao: string }[] };
  for (const bruta of linhasDe(spec)) {
    const linha = limpa(bruta);
    if (!linha) continue;
    const opcao = /^(audio|áudio|lingua|língua|idioma)\s*:\s*(.+)$/i.exec(linha);
    if (opcao) {
      if (semAcento(opcao[1]) === "audio") {
        const [caminho, credito = ""] = opcao[2].split("|").map((x) => x.trim());
        if (audioDoSite(caminho)) {
          saida.audio = caminho;
          saida.credito = credito.slice(0, 200);
        }
      } else if (/^[a-z]{2}(-[A-Z]{2})?$/.test(opcao[2].trim())) saida.lingua = opcao[2].trim();
      continue;
    }
    const [tempo, texto = "", traducao = ""] = linha.split("|").map((x) => x.trim());
    const t = segundos(tempo);
    if (t !== null && texto && saida.linhas.length < 300) saida.linhas.push({ t, texto: texto.slice(0, 200), traducao: traducao.slice(0, 200) });
  }
  saida.linhas.sort((a, b) => a.t - b.t);
  return saida;
}

// ───────────── Molécula ─────────────

/**
 * Primeira linha: o nome de uma molécula da biblioteca (água, metano, glicose…), uma fórmula em SMILES (CCO, c1ccccc1)
 * ou, nas linhas seguintes, coordenadas no formato XYZ ("C 0 0 0"). Opções: "estilo: bolas" e "rotulos: sim".
 */
export function lerMolecula(spec: string): { entrada: string; xyz: { el: string; x: number; y: number; z: number }[]; estilo: "bastoes" | "bolas"; rotulos: boolean; titulo: string } {
  const r = { entrada: "", xyz: [] as { el: string; x: number; y: number; z: number }[], estilo: "bastoes" as "bastoes" | "bolas", rotulos: false, titulo: "" };
  for (const bruta of linhasDe(spec)) {
    const linha = limpa(bruta);
    if (!linha || linha.startsWith("#")) continue;
    const opcao = /^(estilo|rotulos|rótulos|titulo|título)\s*:\s*(.+)$/i.exec(linha);
    if (opcao) {
      const chave = semAcento(opcao[1]);
      if (chave === "estilo") r.estilo = semAcento(opcao[2]).startsWith("bola") || semAcento(opcao[2]).startsWith("esfer") ? "bolas" : "bastoes";
      else if (chave === "rotulos") r.rotulos = !/^(nao|n|sem|false)$/.test(semAcento(opcao[2]));
      else r.titulo = opcao[2].trim().slice(0, 100);
      continue;
    }
    const atomo = /^([A-Z][a-z]?)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s+(-?[\d.,]+)$/.exec(linha);
    if (atomo) {
      const [x, y, z] = [atomo[2], atomo[3], atomo[4]].map(numero);
      if ([x, y, z].every((v) => Number.isFinite(v) && Math.abs(v) < 500) && r.xyz.length < 400) r.xyz.push({ el: atomo[1], x, y, z });
      continue;
    }
    if (!r.entrada && !/^\d+$/.test(linha)) r.entrada = linha.slice(0, 300);
  }
  return r;
}
