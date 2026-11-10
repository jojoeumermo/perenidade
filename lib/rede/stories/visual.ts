// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O visual dos stories, em funções puras (as telas em components/rede/stories e os testes usam): as cores de fundo da prancha
// "criar story", o mosaico de fundo da prancha "ver story", o anel colorido da faixa, o tamanho da letra que cabe, a barra de
// progresso e as regras de link e de figurinha. Sem "@/" de propósito (roda no Node nos testes).
import { sementeDe, gerador } from "../mosaico";
import {
  CORES_DA_LETRA, CORES_DO_STORY, FONTES_DO_STORY, LIMITES_DO_STORY,
  type Alinhamento, type CorDaLetra, type CorDoStory, type EstiloDoStory, type Figurinha, type FonteDoStory, type TipoDeFigurinha,
} from "../tipos-stories";

/**
 * As cores de fundo (as listras da faixa tecida, styles/alumia-tokens.css): fundo, a listra mais escura, e a cor do texto por cima.
 * O texto em cima de cada uma passa de 4,5:1 (papel #F3EFE6 sobre o azul dá 9,2:1; noite sobre o dourado, 10:1).
 */
export const PALETA_DO_STORY: Readonly<Record<CorDoStory, { fundo: string; listra: string; escuro: string; texto: string; quentes: readonly string[] }>> = {
  azul: { fundo: "#23408e", listra: "#1d3679", escuro: "#172a5e", texto: "#f3efe6", quentes: ["#2b4ca3", "#3a5cb8", "#d99e14"] },
  vermelho: { fundo: "#c21f16", listra: "#a91a12", escuro: "#8e1610", texto: "#f3efe6", quentes: ["#d9351f", "#e8661f", "#f08a24", "#de7a2a"] },
  dourado: { fundo: "#f0b323", listra: "#d99e14", escuro: "#c98a10", texto: "#0f0e0d", quentes: ["#ffc21a", "#f6c84a", "#e8661f"] },
  verde: { fundo: "#2e6b4f", listra: "#265b43", escuro: "#1d4734", texto: "#f3efe6", quentes: ["#357b5b", "#3f8a67", "#d99e14"] },
  rosa: { fundo: "#e4577f", listra: "#cf4a70", escuro: "#b83c60", texto: "#0f0e0d", quentes: ["#ec6d92", "#f2849f", "#f08a24"] },
  noite: { fundo: "#0f0e0d", listra: "#1b1917", escuro: "#080707", texto: "#f3efe6", quentes: ["#2a2622", "#141210", "#3a3430"] },
};

/** A cor é uma das 6? (o que vem do banco ou do aparelho passa por aqui). Outra coisa vira "azul", a primeira da prancha. */
export function corValida(cor: unknown): CorDoStory {
  return (CORES_DO_STORY as readonly unknown[]).includes(cor) ? (cor as CorDoStory) : "azul";
}

/** As listras diagonais do fundo de texto (prancha "criar story"): um CSS de fundo. */
export function fundoListrado(cor: CorDoStory): string {
  const p = PALETA_DO_STORY[corValida(cor)];
  return `repeating-linear-gradient(135deg, ${p.fundo} 0 22px, ${p.listra} 22px 44px)`;
}

/**
 * O mosaico de fundo (prancha "ver story": cartões quadrados vermelhos e laranja). A grade e as cores saem só da semente (o id do
 * story): o mesmo story desenha sempre o mesmo fundo, em todo aparelho. Devolve uma cor por cartão, linha a linha.
 */
export function mosaicoDeFundo(semente: string, cor: CorDoStory, colunas = 26, linhas = 48): string[] {
  const p = PALETA_DO_STORY[corValida(cor)];
  const sorte = gerador(sementeDe(semente));
  const cartoes: string[] = [];
  for (let i = 0; i < colunas * linhas; i++) {
    const r = sorte();
    // Como na prancha: metade na cor do fundo, um terço no tom escuro (o vinho entre os vermelhos) e poucos cartões quentes
    // (laranja) espalhados.
    cartoes.push(r < 0.5 ? p.fundo : r < 0.82 ? p.escuro : p.quentes[Math.floor(((r - 0.82) / 0.18) * p.quentes.length) % p.quentes.length]);
  }
  return cartoes;
}

/** As cores do anel de cada bolinha (prancha "stories na linha": 4 arcos da faixa tecida), sorteadas pelo @nome. */
const CORES_DO_ANEL = ["#c21f16", "#f0b323", "#1f8a85", "#e4577f", "#23408e", "#ea7a24", "#2e6b4f"] as const;

export function coresDoAnel(handle: string): string[] {
  const sorte = gerador(sementeDe(`anel:${handle}`));
  const primeira = Math.floor(sorte() * CORES_DO_ANEL.length);
  // Sempre o vermelho no alto (como na prancha) e mais três, sem repetir.
  const restantes = CORES_DO_ANEL.filter((c) => c !== "#c21f16");
  const tres: string[] = [];
  let i = primeira;
  while (tres.length < 3) {
    const c = restantes[i % restantes.length];
    if (!tres.includes(c)) tres.push(c);
    i += 2;
  }
  return ["#c21f16", ...tres];
}

/** O anel como conic-gradient (4 arcos iguais; o vermelho cobre o alto). Visto = cinza (cor só do aparelho, ninguém sabe). */
export function anelEmCss(handle: string, visto: boolean): string {
  if (visto) return "var(--al-superficie-2)";
  const [a, b, c, d] = coresDoAnel(handle);
  return `conic-gradient(from -45deg, ${a} 0 25%, ${b} 25% 50%, ${c} 50% 75%, ${d} 75% 100%)`;
}

/** O nome na bolinha: corta com "…" depois de `max` letras (a prancha mostra "Rosa Ver…", "Passe Li…"). */
export function nomeCurto(nome: string, max = 8): string {
  const letras = [...nome.trim()];
  return letras.length <= max ? letras.join("") : `${letras.slice(0, max).join("").trimEnd()}…`;
}

/**
 * O tamanho da letra do texto grande, em px, para caber na tela de `largura` px: começa grande (a prancha usa ~70 px para 2 linhas
 * em 390 px) e diminui com o tamanho do texto; nunca abaixo de 28 px. `escala` encolhe tudo (o "criar" usa 0,76: a prancha mostra o
 * texto em edição menor que no visor, para as cores e a figurinha caberem acima da dobra).
 */
export function tamanhoDoTexto(texto: string, largura = 390, escala = 1): number {
  const n = [...texto.trim()].length;
  const base = largura * 0.19 * escala;
  const porTamanho = n <= 24 ? base : n <= 48 ? base * 0.78 : n <= 90 ? base * 0.58 : base * 0.44;
  // A palavra mais longa precisa caber inteira numa linha (a letra condensada em maiúsculas ocupa ~0,47 do tamanho): sem isso,
  // "PARALISAÇÃO" quebrava no meio.
  const maior = Math.max(1, ...texto.trim().split(/\s+/).map((p) => [...p].length));
  const porPalavra = (largura - 44) / (maior * 0.47);
  return Math.max(28, Math.round(Math.min(porTamanho, porPalavra)));
}

/** Quanto dura cada story na tela, em ms: 6 s; com figurinha de toque (enquete, pergunta), 10 s. */
export function duracaoDoStory(figurinhas: readonly Figurinha[]): number {
  return figurinhas.some((f) => f.tipo === "enquete" || f.tipo === "pergunta" || f.tipo === "contagem") ? 10_000 : 6_000;
}

/** O preenchimento de cada barra do alto (0–1): as de antes cheias, a atual pela fração, as de depois vazias. */
export function barrasDoProgresso(total: number, atual: number, fracao: number): number[] {
  const f = Math.min(1, Math.max(0, Number.isFinite(fracao) ? fracao : 0));
  return Array.from({ length: Math.max(0, total) }, (_, i) => (i < atual ? 1 : i === atual ? f : 0));
}

/**
 * O link da figurinha: só https, sem usuário/senha no endereço, até 300 caracteres. Devolve o endereço limpo ou nulo. (A prévia não
 * é buscada no aparelho: abrir é escolha de quem vê, com rel="noopener noreferrer", para não dizer de onde veio.)
 */
export function linkSeguro(entrada: string): string | null {
  const t = entrada.trim();
  if (!t || t.length > 300) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
  return u.toString();
}

/** O domínio que a figurinha de link mostra ("cartacapital.com.br"), sem "www.". */
export function dominioDoLink(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Liga/desliga uma figurinha no "criar": um de cada tipo, no máximo LIMITES_DO_STORY.figurinhas. Puro. */
export function alternarFigurinha<T extends { tipo: TipoDeFigurinha }>(lista: readonly T[], nova: T): T[] {
  if (lista.some((f) => f.tipo === nova.tipo)) return lista.filter((f) => f.tipo !== nova.tipo);
  if (lista.length >= LIMITES_DO_STORY.figurinhas) return [...lista];
  return [...lista, nova];
}

/**
 * A soma da enquete como a autora vê: agregada e só a partir de 3 votos (PLANO-ALUMIA §6.1). Abaixo disso, nulo ("poucas
 * pessoas"). Devolve as porcentagens inteiras (somam 100).
 */
export function somaDaEnquete(soma: readonly [number, number] | null | undefined): { total: number; pct: [number, number] } | null {
  if (!soma) return null;
  const a = Math.max(0, Math.floor(soma[0] || 0));
  const b = Math.max(0, Math.floor(soma[1] || 0));
  const total = a + b;
  if (total < 3) return null;
  const pa = Math.round((a / total) * 100);
  return { total, pct: [pa, 100 - pa] };
}

// ── O estilo do texto grande (fonte, cor da letra, alinhamento e caixa), só valores da lista fechada ──────────────────────
/** A família de cada fonte (as do site, que só baixam quando alguém usa): condensada da prancha, serifa, máquina e marcador. */
export const FAMILIA_DA_FONTE: Readonly<Record<FonteDoStory, string>> = {
  condensada: "var(--al-fonte)",
  serifa: 'var(--font-serif-display, "EB Garamond"), Georgia, "Times New Roman", serif',
  maquina: 'var(--font-archive, "IBM Plex Mono"), ui-monospace, "Courier New", monospace',
  marcador: 'var(--font-hand, "Caveat"), "Segoe Print", "Bradley Hand", cursive',
};

/** A cor de cada letra possível (o papel e as 6 do fundo). */
export function corDaLetraEmHex(c: CorDaLetra): string {
  return c === "papel" ? "#f3efe6" : PALETA_DO_STORY[corValida(c)].fundo;
}

/** O texto escuro ou claro que contrasta mais com uma cor hex (#rrggbb). Pura. */
export function contrasteDe(hex: string): "#0f0e0d" | "#f3efe6" {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#f3efe6";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => {
    const v = parseInt(x, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contra o quase preto (#0f0e0d, lum ≈ 0,005) e o papel (#f3efe6, lum ≈ 0,86): fica com o de maior contraste.
  return (lum + 0.05) / (0.005 + 0.05) >= (0.86 + 0.05) / (lum + 0.05) ? "#0f0e0d" : "#f3efe6";
}

/**
 * O estilo do texto como a tela desenha: família, cor da letra, alinhamento e, com "caixa", o fundo sólido atrás (a letra vira a
 * cor que contrasta com a caixa). Valor fora da lista cai no padrão da prancha. Pura.
 */
export function estiloDoTexto(e: EstiloDoStory | null | undefined, corDoFundo: CorDoStory): {
  familia: string;
  fonte: FonteDoStory;
  cor: string;
  caixa: string | null;
  alinhar: Alinhamento;
} {
  const fonte: FonteDoStory = e?.fonte && (FONTES_DO_STORY as readonly string[]).includes(e.fonte) ? e.fonte : "condensada";
  const alinhar: Alinhamento = e?.alinhar === "centro" || e?.alinhar === "dir" ? e.alinhar : "esq";
  const escolhida = e?.cor_texto && (CORES_DA_LETRA as readonly string[]).includes(e.cor_texto) ? corDaLetraEmHex(e.cor_texto) : null;
  if (e?.caixa === "caixa") {
    const caixa = escolhida ?? "#f3efe6";
    return { familia: FAMILIA_DA_FONTE[fonte], fonte, cor: contrasteDe(caixa), caixa, alinhar };
  }
  return { familia: FAMILIA_DA_FONTE[fonte], fonte, cor: escolhida ?? PALETA_DO_STORY[corValida(corDoFundo)].texto, caixa: null, alinhar };
}

/** Quanto dura o story na tela: o vídeo dura o que ele tem (até 60 s); o resto, a regra de duracaoDoStory. */
export function duracaoNaTela(s: { fundo: { tipo: string; duracao?: number }; figurinhas: readonly Figurinha[] }): number {
  if (s.fundo.tipo === "video" && typeof s.fundo.duracao === "number" && s.fundo.duracao > 0) return Math.min(LIMITES_DO_STORY.videoMs, s.fundo.duracao);
  return duracaoDoStory(s.figurinhas);
}
