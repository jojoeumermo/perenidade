// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Perfil livre (Alumia, A5): as regras PURAS da aparência do perfil. A pessoa escolhe cor, tema, capa em mosaico, faixa tecida
// própria, rosto em mosaico de pixels, layout do cabeçalho, ordem e escolha das abas, fixados, "tocando agora" e organizações que
// quer mostrar. Tudo aqui é ESCOLHA ENTRE VALORES CONHECIDOS ou valor conferido por expressão regular: nunca CSS, HTML ou URL
// livre chega à tela. O banco confere tudo de novo (supabase/migracoes/20261110-alumia-perfil.sql, interno.alumia_aparencia_valida).
// Sem DOM e sem "@/" de propósito (roda no Node nos testes: scripts/testar-alumia-perfil.mjs).

// ───────────────────────────── Cores ─────────────────────────────

/** As cores da casa para o destaque do perfil (as das comunidades e da faixa, mais claras para ler no fundo noite). */
export const PALETA_DO_PERFIL = {
  vermelho: "#e8321f",
  dourado: "#ffc21a",
  azul: "#5b8cff",
  verde: "#2fa36b",
  rosa: "#ff5c8a",
  laranja: "#ff8a1f",
  turquesa: "#1fc2b5",
  roxo: "#a27bff",
} as const;
export type CorDaPaleta = keyof typeof PALETA_DO_PERFIL;
export const CORES_DA_PALETA = Object.keys(PALETA_DO_PERFIL) as CorDaPaleta[];

/** "#rrggbb" em minúsculas: a única forma de cor livre aceita. */
export const corHexValida = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/.test(c);

/** O acento guardado (nome da paleta ou "#rrggbb") em cor hexadecimal; desconhecido = vermelho da casa. */
export function hexDoAcento(acento: string | null | undefined): string {
  if (acento && acento in PALETA_DO_PERFIL) return PALETA_DO_PERFIL[acento as CorDaPaleta];
  if (corHexValida(acento)) return acento;
  return PALETA_DO_PERFIL.vermelho;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;

/** Luminância relativa (WCAG 2.x). */
export function luminancia(cor: string): number {
  const [r, g, b] = rgb(cor).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Mistura `cor` com `alvo` na proporção `t` (0 = cor, 1 = alvo). */
function misturar(cor: string, alvo: string, t: number): string {
  const [a, b] = [rgb(cor), rgb(alvo)];
  return hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/** Os fundos em que o perfil aparece (styles/alumia-tokens.css): noite (padrão das pranchas) e papel (variante clara). */
export const FUNDO_NOITE = "#0f0e0d";
export const FUNDO_PAPEL = "#f3efe6";
/** Contraste mínimo de texto (WCAG 1.4.3, AA, texto comum). */
export const CONTRASTE_MINIMO = 4.5;

/**
 * A cor ajustada para ser LIDA sobre `fundo` com pelo menos `minimo` de contraste: clareia (fundo escuro) ou escurece (fundo claro)
 * aos poucos até passar. É assim que a cor livre fica "validada por contraste": nenhuma escolha deixa o texto ilegível.
 */
export function corLegivel(cor: string, fundo: string, minimo = CONTRASTE_MINIMO): string {
  if (contraste(cor, fundo) >= minimo) return cor;
  const alvo = luminancia(fundo) < 0.5 ? "#ffffff" : "#000000";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = misturar(cor, alvo, t);
    if (contraste(c, fundo) >= minimo) return c;
  }
  return alvo;
}

/**
 * O texto sobre um botão cheio de `cor`: branco, noite ou (nos tons do meio, em que a noite fica a 4,4:1) preto puro. Branco ou
 * preto sempre dão 4,58:1 ou mais com qualquer cor, então o botão nunca fica ilegível.
 */
export function textoSobre(cor: string): string {
  const branco = contraste(cor, "#ffffff");
  const noite = contraste(cor, FUNDO_NOITE);
  if (branco >= noite) return branco >= CONTRASTE_MINIMO ? "#ffffff" : "#000000";
  return noite >= CONTRASTE_MINIMO ? FUNDO_NOITE : "#000000";
}

/** Para a tela de edição: a cor escolhida passa sem ajuste nos dois fundos? E o contraste em cada um. */
export function laudoDeContraste(cor: string): { noite: number; papel: number; ajustada: boolean } {
  const noite = contraste(cor, FUNDO_NOITE);
  const papel = contraste(cor, FUNDO_PAPEL);
  return { noite, papel, ajustada: noite < CONTRASTE_MINIMO || papel < CONTRASTE_MINIMO };
}

/** As variáveis CSS do perfil (só cores hexadecimais conferidas; nunca texto livre): o acento lido em cada fundo e o texto sobre ele. */
export function variaveisDoAcento(acento: string | null | undefined): Record<`--pf-${string}`, string> {
  const base = hexDoAcento(acento);
  return {
    "--pf-acento": base,
    "--pf-acento-noite": corLegivel(base, FUNDO_NOITE),
    "--pf-acento-papel": corLegivel(base, FUNDO_PAPEL),
    "--pf-sobre-acento": textoSobre(base),
  };
}

// ───────────────────────────── Tema e layout ─────────────────────────────

/** O "clima" do cabeçalho do perfil. A página segue o tema de quem LÊ (escuro, claro, alto contraste, e-ink); isto muda só o cabeçalho. */
export const TEMAS_DO_PERFIL = ["brasa", "tingido", "papel", "noite"] as const;
export type TemaDoPerfil = (typeof TEMAS_DO_PERFIL)[number];

/** Os modelos de cabeçalho: clássico (capa e rosto à esquerda), centro (tudo centrado) e cartaz (capa alta com o nome por cima). */
export const LAYOUTS_DO_PERFIL = ["classico", "centro", "cartaz"] as const;
export type LayoutDoPerfil = (typeof LAYOUTS_DO_PERFIL)[number];

// ───────────────────────────── Faixa tecida própria ─────────────────────────────

/** As cores de fio da faixa (as das lutas do instituto + roxo). A ordem é o índice guardado. */
export const CORES_DA_FAIXA = ["#c21f16", "#f0b323", "#23408e", "#f3efe6", "#2e6b4f", "#e4577f", "#ea7a24", "#0f0e0d", "#1f8a85", "#7b3fa0"] as const;
/** As proporções das 11 listras (5-2-3-1-4-2-3-1-3-2-4, soma 30), as mesmas da faixa da casa. */
export const PROPORCOES_DA_FAIXA = [5, 2, 3, 1, 4, 2, 3, 1, 3, 2, 4] as const;
/** A faixa da casa (styles/alumia-tokens.css --al-faixa) em índices. */
export const FAIXA_DA_CASA: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 0];
/** Modelos prontos para começar (a pessoa troca qualquer fio depois). */
export const MODELOS_DE_FAIXA: Readonly<Record<string, readonly number[]>> = {
  casa: FAIXA_DA_CASA,
  brasa: [0, 6, 1, 0, 6, 1, 0, 6, 1, 0, 6],
  mar: [2, 8, 3, 2, 8, 3, 2, 8, 3, 2, 8],
  mata: [4, 1, 4, 3, 4, 1, 4, 3, 4, 1, 4],
  orgulho: [0, 6, 1, 4, 2, 9, 0, 6, 1, 4, 2],
  luto: [7, 3, 7, 3, 7, 3, 7, 3, 7, 3, 7],
};

export const faixaValida = (f: unknown): f is number[] =>
  Array.isArray(f) && f.length === 11 && f.every((i) => Number.isInteger(i) && i >= 0 && i < CORES_DA_FAIXA.length);

/** As listras da faixa em degraus de gradiente (o componente monta o `linear-gradient` só com cores da lista acima). */
export function listrasDaFaixa(f: readonly number[] | null | undefined): { cor: string; de: number; ate: number }[] {
  const fios = faixaValida(f) ? f : FAIXA_DA_CASA;
  let soma = 0;
  return fios.map((i, k) => {
    const de = (soma / 30) * 100;
    soma += PROPORCOES_DA_FAIXA[k];
    return { cor: CORES_DA_FAIXA[i], de, ate: (soma / 30) * 100 };
  });
}

export const gradienteDaFaixa = (f: readonly number[] | null | undefined): string =>
  `linear-gradient(to right, ${listrasDaFaixa(f)
    .map((l) => `${l.cor} ${l.de.toFixed(3)}% ${l.ate.toFixed(3)}%`)
    .join(", ")})`;

// ───────────────────────────── Rosto em mosaico (pixels) ─────────────────────────────

/** O rosto de pixels: 8 × 8 ladrilhos, cada um um índice de cor (0 = vazio). */
export const LADO_DO_ROSTO = 8;
/** As cores do rosto (o índice 0 é vazio; o 1 é o papel, o 2 a noite). */
export const CORES_DO_ROSTO = ["", "#f3efe6", "#2a2622", "#e8321f", "#ffc21a", "#5b8cff", "#2fa36b", "#ff5c8a", "#ff8a1f", "#a27bff"] as const;

/** 64 dígitos de 0 a 9; ao menos 6 ladrilhos cheios (um rosto vazio não identifica ninguém). */
export const rostoValido = (px: unknown): px is string =>
  typeof px === "string" && /^[0-9]{64}$/.test(px) && px.replace(/0/g, "").length >= 6;

/** Um rosto sorteado a partir de uma semente, espelhado como os identicons (fica parecido com "alguém"). */
export function rostoSorteado(semente: number): string {
  let s = (semente >>> 0) || 1;
  const sorte = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
  const cores = [1 + Math.floor(sorte() * 2), 3 + Math.floor(sorte() * 7), 3 + Math.floor(sorte() * 7)];
  const px: number[] = Array(64).fill(0);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const r = sorte();
      const c = r < 0.3 ? 0 : r < 0.55 ? cores[0] : r < 0.82 ? cores[1] : cores[2];
      px[y * 8 + x] = c;
      px[y * 8 + (7 - x)] = c;
    }
  }
  const texto = px.join("");
  return rostoValido(texto) ? texto : "0".repeat(27) + "11" + "0".repeat(6) + "11" + "0".repeat(27);
}

/** Pinta um ladrilho (e o espelho, se `espelhar`). Devolve o rosto novo. */
export function pintarRosto(px: string, i: number, cor: number, espelhar = false): string {
  if (!/^[0-9]{64}$/.test(px) || i < 0 || i > 63 || cor < 0 || cor > 9) return px;
  const a = px.split("");
  a[i] = String(cor);
  if (espelhar) a[Math.floor(i / 8) * 8 + (7 - (i % 8))] = String(cor);
  return a.join("");
}

// ───────────────────────────── Capa em mosaico ─────────────────────────────

/** A palavra da capa: só A–Z, 0–9 e espaço, até 10 (a fonte 5×7 de lib/rede/mosaico.ts). */
export const palavraDaCapaValida = (p: unknown): p is string => typeof p === "string" && /^[A-Z0-9 ]{0,10}$/.test(p);
export const arrumarPalavraDaCapa = (p: string): string =>
  p
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/ {2,}/g, " ")
    .slice(0, 10);

export interface CapaEmMosaico {
  tipo: "mosaico";
  palavra: string;
  /** 0 a 9999: muda o sorteio dos ladrilhos de fundo. */
  semente: number;
}

// ───────────────────────────── Abas ─────────────────────────────

export const ABAS_DO_PERFIL = ["posts", "respostas", "midia", "atos", "destaques", "organizacoes", "escola"] as const;
export type AbaDoPerfil = (typeof ABAS_DO_PERFIL)[number];
export const ABAS_PADRAO: readonly AbaDoPerfil[] = ["posts", "respostas", "midia"];

/** Só abas conhecidas, sem repetir, com "posts" sempre presente (ninguém esconde os próprios posts de quem segue). */
export function arrumarAbas(abas: unknown): AbaDoPerfil[] {
  const vistas = new Set<AbaDoPerfil>();
  if (Array.isArray(abas)) for (const a of abas) if ((ABAS_DO_PERFIL as readonly string[]).includes(a)) vistas.add(a as AbaDoPerfil);
  if (!vistas.has("posts")) return ["posts", ...vistas];
  return [...vistas];
}

/** Ligar (no fim) ou desligar uma aba, sem nunca repetir e sem tirar "posts". */
export function alternarAba(abas: readonly AbaDoPerfil[], aba: AbaDoPerfil, ligar: boolean): AbaDoPerfil[] {
  const sem = abas.filter((x) => x !== aba);
  return arrumarAbas(ligar || aba === "posts" ? [...sem, aba] : sem);
}

// ───────────────────────────── Links limpos ─────────────────────────────

/** Parâmetros de rastreio que saem de todo link do perfil (regra da casa: nada de UTM nem identificador de clique). */
const RASTREIO = /^(utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_[a-z]+|igshid|igsh|si|ref_src|ref_url|_hsenc|_hsmi|yclid|twclid|ttclid|s_cid|mkt_tok)$/i;

/**
 * Um link do perfil, limpo: só https, sem usuário/senha na URL, sem porta estranha, sem os parâmetros de rastreio, até 200
 * caracteres. Nulo se não servir. Devolve também o domínio, que a tela MOSTRA (a pessoa vê para onde vai antes de clicar).
 */
export function linkLimpo(bruto: unknown): { href: string; dominio: string; tirados: number } | null {
  if (typeof bruto !== "string") return null;
  const texto = bruto.trim();
  if (!/^https:\/\/[^\s<>"'`]+$/i.test(texto) || texto.length > 300) return null;
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) && !/^xn--/i.test(u.hostname)) return null;
  let tirados = 0;
  for (const k of [...u.searchParams.keys()]) {
    if (RASTREIO.test(k)) {
      u.searchParams.delete(k);
      tirados++;
    }
  }
  const href = u.toString();
  if (href.length > 200) return null;
  return { href, dominio: u.hostname.replace(/^www\./, "").toLowerCase(), tirados };
}

// ───────────────────────────── Bio com formatação simples ─────────────────────────────

/** Um pedaço da bio já entendido: texto, negrito, itálico, link limpo, #tema, @pessoa ou quebra de linha. Nunca HTML. */
export type PedacoDaBio =
  | { t: "texto"; v: string }
  | { t: "negrito"; v: string }
  | { t: "italico"; v: string }
  | { t: "link"; v: string; href: string }
  | { t: "tema"; v: string }
  | { t: "pessoa"; v: string }
  | { t: "quebra" };

/**
 * A bio em pedaços: **negrito**, _itálico_, links https (limpos), #temas, @pessoas e quebras de linha (no máximo 3 seguidas
 * viram 2). Tudo o mais é texto puro: o componente põe cada pedaço como texto do React, então nada vira HTML.
 */
export function pedacosDaBio(bio: string): PedacoDaBio[] {
  const saida: PedacoDaBio[] = [];
  const linhas = bio.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").split("\n");
  const padrao = /\*\*([^*\n]{1,80})\*\*|(?<![\p{L}\p{N}])_([^_\n]{1,80})_(?![\p{L}\p{N}])|(https:\/\/[^\s<>"'`]+)|(?<![\p{L}\p{N}_])#([\p{L}\p{N}_]{2,40})|(?<![\p{L}\p{N}_@])@([a-z0-9_]{3,20})/gu;
  linhas.forEach((linha, n) => {
    if (n > 0) saida.push({ t: "quebra" });
    let ultimo = 0;
    for (const m of linha.matchAll(padrao)) {
      const i = m.index ?? 0;
      if (i > ultimo) saida.push({ t: "texto", v: linha.slice(ultimo, i) });
      if (m[1]) saida.push({ t: "negrito", v: m[1] });
      else if (m[2]) saida.push({ t: "italico", v: m[2] });
      else if (m[3]) {
        const semPonto = m[3].replace(/[.,;:!?)]+$/, "");
        const l = linkLimpo(semPonto);
        if (l) saida.push({ t: "link", v: l.dominio + (new URL(l.href).pathname.length > 1 ? new URL(l.href).pathname : ""), href: l.href });
        else saida.push({ t: "texto", v: semPonto });
        if (semPonto.length < m[3].length) saida.push({ t: "texto", v: m[3].slice(semPonto.length) });
      } else if (m[4]) saida.push({ t: "tema", v: m[4] });
      else if (m[5]) saida.push({ t: "pessoa", v: m[5] });
      ultimo = i + m[0].length;
    }
    if (ultimo < linha.length) saida.push({ t: "texto", v: linha.slice(ultimo) });
  });
  return saida;
}

// ───────────────────────────── A aparência inteira ─────────────────────────────

/** "Tocando agora": só texto e, se quiser, um link limpo. A Alumia não liga em serviço de música nenhum (sem rastreio). */
export interface TocandoAgora {
  texto: string;
  link: string | null;
  /** Até quando aparece (ISO). */
  ate: string;
}

/** Um destaque do perfil: um post ou ato da própria pessoa, com título curto e cor. */
export interface DestaqueDaAparencia {
  tipo: "post" | "ato";
  ref: string;
  titulo: string;
  cor: CorDaPaleta;
}

/** Tudo o que a pessoa escolhe na aparência do perfil (perfis.rede_aparencia). */
export interface AparenciaDoPerfil {
  /** Nome da paleta ou "#rrggbb". */
  acento: string;
  tema: TemaDoPerfil;
  layout: LayoutDoPerfil;
  /** 11 índices de CORES_DA_FAIXA. */
  faixa: number[];
  /** Rosto de pixels (64 dígitos) ou nulo (usa o rosto de sempre: desenho, foto aceita ou iniciais). */
  rosto: string | null;
  /** Capa em mosaico ou nula (usa a capa de sempre: padrão ou foto aceita). */
  capa: CapaEmMosaico | null;
  abas: AbaDoPerfil[];
  /** Até 3 posts da própria pessoa, na ordem. */
  fixados: string[];
  destaques: DestaqueDaAparencia[];
  /** @ de organizações com selo que a pessoa ESCOLHE mostrar (opt-in; filiação é dado sensível, LGPD art. 11). */
  orgs: string[];
  tocando: TocandoAgora | null;
}

export const LIMITES_DA_APARENCIA = { fixados: 3, destaques: 6, orgs: 6, tocando: 80, tituloDestaque: 40 } as const;

export const APARENCIA_PADRAO: AparenciaDoPerfil = {
  acento: "vermelho",
  tema: "brasa",
  layout: "classico",
  faixa: [...FAIXA_DA_CASA],
  rosto: null,
  capa: null,
  abas: [...ABAS_PADRAO],
  fixados: [],
  destaques: [],
  orgs: [],
  tocando: null,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE = /^[a-z0-9_]{3,20}$/;
/** Ids de exemplo da prévia (p-1, ato-2) também passam na tela; o banco aceita só uuid. */
const ID_DA_TELA = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9-]{1,40})$/i;

const semControle = (s: string): string => s.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Lê qualquer coisa (o que veio do banco, de um rascunho do aparelho) e devolve uma aparência SÓ com valores válidos: o que não
 * servir volta ao padrão. `estrito` (como o banco) aceita só uuid nos ids.
 */
export function arrumarAparencia(bruto: unknown, agora: Date = new Date(), estrito = false): AparenciaDoPerfil {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const id = estrito ? UUID : ID_DA_TELA;
  const acento = typeof b.acento === "string" && (b.acento in PALETA_DO_PERFIL || corHexValida(b.acento)) ? b.acento : APARENCIA_PADRAO.acento;
  const tema = (TEMAS_DO_PERFIL as readonly unknown[]).includes(b.tema) ? (b.tema as TemaDoPerfil) : APARENCIA_PADRAO.tema;
  const layout = (LAYOUTS_DO_PERFIL as readonly unknown[]).includes(b.layout) ? (b.layout as LayoutDoPerfil) : APARENCIA_PADRAO.layout;
  const faixa = faixaValida(b.faixa) ? [...b.faixa] : [...FAIXA_DA_CASA];
  const rosto = rostoValido(b.rosto) ? b.rosto : null;
  const c = b.capa as Record<string, unknown> | null | undefined;
  const capa: CapaEmMosaico | null =
    c && c.tipo === "mosaico" && palavraDaCapaValida(c.palavra) && Number.isInteger(c.semente) && (c.semente as number) >= 0 && (c.semente as number) <= 9999
      ? { tipo: "mosaico", palavra: c.palavra as string, semente: c.semente as number }
      : null;
  const abas = b.abas === undefined ? [...ABAS_PADRAO] : arrumarAbas(b.abas);
  const fixados = Array.isArray(b.fixados) ? [...new Set(b.fixados.filter((x): x is string => typeof x === "string" && id.test(x)))].slice(0, LIMITES_DA_APARENCIA.fixados) : [];
  const destaques: DestaqueDaAparencia[] = [];
  if (Array.isArray(b.destaques)) {
    for (const d of b.destaques as Record<string, unknown>[]) {
      if (!d || typeof d !== "object") continue;
      const titulo = typeof d.titulo === "string" ? semControle(d.titulo).slice(0, LIMITES_DA_APARENCIA.tituloDestaque) : "";
      if ((d.tipo === "post" || d.tipo === "ato") && typeof d.ref === "string" && id.test(d.ref) && titulo && !destaques.some((x) => x.ref === d.ref)) {
        destaques.push({ tipo: d.tipo, ref: d.ref, titulo, cor: typeof d.cor === "string" && d.cor in PALETA_DO_PERFIL ? (d.cor as CorDaPaleta) : "dourado" });
      }
      if (destaques.length >= LIMITES_DA_APARENCIA.destaques) break;
    }
  }
  const orgs = Array.isArray(b.orgs) ? [...new Set(b.orgs.filter((x): x is string => typeof x === "string" && HANDLE.test(x)))].slice(0, LIMITES_DA_APARENCIA.orgs) : [];
  let tocando: TocandoAgora | null = null;
  const t = b.tocando as Record<string, unknown> | null | undefined;
  if (t && typeof t === "object" && typeof t.texto === "string" && typeof t.ate === "string") {
    const texto = semControle(t.texto).slice(0, LIMITES_DA_APARENCIA.tocando);
    const ate = new Date(t.ate);
    const link = t.link == null || t.link === "" ? null : linkLimpo(t.link)?.href ?? undefined;
    if (texto && !Number.isNaN(ate.getTime()) && ate.getTime() > agora.getTime() && link !== undefined) tocando = { texto, link, ate: ate.toISOString() };
  }
  return { acento, tema, layout, faixa, rosto, capa, abas, fixados, destaques, orgs, tocando };
}

/** O pedido que vai ao banco: a aparência inteira, já arrumada (o banco confere de novo e recusa o que não servir). */
export function pedidoDaAparencia(a: AparenciaDoPerfil): Record<string, unknown> {
  return {
    acento: a.acento,
    tema: a.tema,
    layout: a.layout,
    faixa: a.faixa,
    rosto: a.rosto,
    capa: a.capa,
    abas: a.abas,
    fixados: a.fixados,
    destaques: a.destaques,
    orgs: a.orgs,
    tocando: a.tocando ? { texto: a.tocando.texto, link: a.tocando.link, ate: a.tocando.ate } : null,
  };
}

/** As durações de status e de "tocando agora" que a tela oferece (horas). */
export const DURACOES = [1, 8, 24, 72, 168, 720] as const;

/** Duas aparências iguais? (para o "há mudanças não salvas"). */
export const mesmaAparencia = (a: AparenciaDoPerfil, b: AparenciaDoPerfil): boolean => JSON.stringify(pedidoDaAparencia(a)) === JSON.stringify(pedidoDaAparencia(b));
