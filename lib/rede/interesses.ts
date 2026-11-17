// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O questionário de interesses da Alumia (onda 11, frente 11F): o que a pessoa quer encontrar aqui, as pautas, o estudo, quanto de
// conversa e de conteúdo, e o ritmo. As respostas ficam SÓ neste aparelho (interesse político é dado sensível, LGPD art. 5º, II,
// e art. 11): o servidor recebe, a cada leitura da linha, só o filtro que sai daqui (interessesNaLinha) e não guarda nada
// (supabase/migracoes/20261117-alumia-o11-interesses.sql). A chave começa por "lucia:rede", então o Sair rápido apaga junto.
// Puro e sem "@/": os testes rodam este arquivo direto no Node.

/** O que a pessoa quer na Alumia (pode marcar várias). */
export const OBJETIVOS = ["militancia", "atos", "nucleo", "amizades", "estudo", "debate", "noticias", "cultura"] as const;
export type Objetivo = (typeof OBJETIVOS)[number];

/** As pautas. Cada uma vira um ou mais #temas no filtro (a tabela abaixo, à vista na tela). */
export const PAUTAS = [
  "moradia", "transporte", "educacao", "saude", "trabalho", "meio_ambiente", "antirracismo", "feminismo", "lgbtqia", "indigena",
  "terra", "cultura", "juventude", "direitos_humanos",
] as const;
export type Pauta = (typeof PAUTAS)[number];

/** O estudo. */
export const ESTUDOS = ["enem", "vestibular", "formacao", "leitura", "idiomas"] as const;
export type Estudo = (typeof ESTUDOS)[number];

/** Quanto de conversa e de conteúdo. */
export const CONVERSAS = ["conversa", "equilibrio", "conteudo"] as const;
export type Conversa = (typeof CONVERSAS)[number];

/** O ritmo: quanto a pessoa quer ser chamada de volta ("Enquanto você esteve fora"). */
export const RITMOS = ["pouco", "medio", "muito"] as const;
export type Ritmo = (typeof RITMOS)[number];

export interface Interesses {
  v: 1;
  objetivos: Objetivo[];
  pautas: Pauta[];
  estudos: Estudo[];
  conversa: Conversa;
  ritmo: Ritmo;
}

export const INTERESSES_VAZIOS: Interesses = { v: 1, objetivos: [], pautas: [], estudos: [], conversa: "equilibrio", ritmo: "medio" };

/** Os #temas de cada pauta e de cada estudo. Escrito aqui para a tela mostrar e o teste conferir. */
export const TEMAS_DA_PAUTA: Record<Pauta, string[]> = {
  moradia: ["moradia", "sem_teto", "despejo_zero"],
  transporte: ["transporte", "tarifa_zero", "passe_livre"],
  educacao: ["educacao", "escola_publica"],
  saude: ["saude", "sus"],
  trabalho: ["trabalho", "greve", "sindicato"],
  meio_ambiente: ["meio_ambiente", "clima", "agua"],
  antirracismo: ["antirracismo", "vidas_negras"],
  feminismo: ["feminismo", "mulheres"],
  lgbtqia: ["lgbtqia", "orgulho"],
  indigena: ["indigena", "demarcacao"],
  terra: ["reforma_agraria", "terra"],
  cultura: ["cultura"],
  juventude: ["juventude"],
  direitos_humanos: ["direitos_humanos", "memoria"],
};
export const TEMAS_DO_ESTUDO: Record<Estudo, string[]> = {
  enem: ["enem"],
  vestibular: ["vestibular"],
  formacao: ["formacao_politica"],
  leitura: ["leitura", "livros"],
  idiomas: ["idiomas"],
};
/** Os objetivos que ligam tipos de post, #temas, estudo ou núcleo. "Conhecer pessoas" não sobe nada: só pesa na conversa. */
export const DO_OBJETIVO: Record<Objetivo, { tipos?: string[]; tags?: string[]; estudo?: true; nucleos?: true }> = {
  militancia: { tipos: ["chamado"] },
  atos: { tipos: ["chamado"] },
  nucleo: { nucleos: true },
  amizades: {},
  estudo: { tipos: ["duvida"], estudo: true },
  debate: { tipos: ["discussao", "enquete"] },
  noticias: { tags: ["noticias", "noticia"] },
  cultura: { tags: ["cultura", "arte", "musica", "poesia"] },
};

/** O filtro que vai ao servidor a cada leitura (o mesmo que interno.rede_o11_interesses aceita). */
export interface InteressesNaLinha {
  tipos?: string[];
  tags?: string[];
  estudo?: true;
  nucleos?: true;
  conteudo?: true;
}

const so = <T extends string>(lista: readonly T[], x: unknown): T[] =>
  Array.isArray(x) ? [...new Set(x.filter((v): v is T => (lista as readonly unknown[]).includes(v)))] : [];

/** As respostas só com o que existe (o resto cai fora em silêncio: veio de um aparelho antigo ou foi mexido à mão). */
export function arrumarInteresses(x: unknown): Interesses {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    v: 1,
    objetivos: so(OBJETIVOS, o.objetivos),
    pautas: so(PAUTAS, o.pautas),
    estudos: so(ESTUDOS, o.estudos),
    conversa: (CONVERSAS as readonly unknown[]).includes(o.conversa) ? (o.conversa as Conversa) : "equilibrio",
    ritmo: (RITMOS as readonly unknown[]).includes(o.ritmo) ? (o.ritmo as Ritmo) : "medio",
  };
}

/** Nada marcado que mude a linha? (O ritmo não muda a ordem; só a faixa "Enquanto você esteve fora".) */
export function semEfeitoNaLinha(i: Interesses): boolean {
  return Object.keys(interessesNaLinha(i)).length === 0;
}

/** As respostas viram o filtro aberto do servidor. Sem nada marcado: objeto vazio (o aparelho chama a regra de antes). */
export function interessesNaLinha(i: Interesses): InteressesNaLinha {
  const tipos = new Set<string>();
  const tags = new Set<string>();
  let estudo = false;
  let nucleos = false;
  for (const o of i.objetivos) {
    const d = DO_OBJETIVO[o];
    d.tipos?.forEach((t) => tipos.add(t));
    d.tags?.forEach((t) => tags.add(t));
    if (d.estudo) estudo = true;
    if (d.nucleos) nucleos = true;
  }
  for (const p of i.pautas) TEMAS_DA_PAUTA[p].forEach((t) => tags.add(t));
  for (const e of i.estudos) {
    TEMAS_DO_ESTUDO[e].forEach((t) => tags.add(t));
    estudo = true;
  }
  const saida: InteressesNaLinha = {};
  if (tipos.size) saida.tipos = [...tipos].sort();
  if (tags.size) saida.tags = [...tags].sort().slice(0, 30);
  if (estudo) saida.estudo = true;
  if (nucleos) saida.nucleos = true;
  if (i.conversa === "conteudo") saida.conteudo = true;
  return saida;
}

/** De quanto tempo fora em diante a faixa "Enquanto você esteve fora" aparece, conforme o ritmo. */
export const FORA_DO_RITMO_MS: Record<Ritmo, number> = { pouco: 24 * 3600 * 1000, medio: 8 * 3600 * 1000, muito: 4 * 3600 * 1000 };

// ───── Guardar no aparelho ─────

export interface Guarda {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** A chave no armazenamento do navegador. O prefixo "lucia:rede" é o que o Sair rápido apaga (lib/rede/saida.ts). */
export const CHAVE_DOS_INTERESSES = "lucia:rede:interesses:v1";

function guarda(g?: Guarda | null): Guarda | null {
  if (g !== undefined) return g;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** As respostas guardadas neste aparelho, ou nulo quando a pessoa ainda não respondeu (ou pulou). */
export function lerInteresses(g?: Guarda | null): Interesses | null {
  try {
    const bruto = guarda(g)?.getItem(CHAVE_DOS_INTERESSES);
    return bruto ? arrumarInteresses(JSON.parse(bruto)) : null;
  } catch {
    return null;
  }
}

/** Guarda (ou, com nulo, apaga) as respostas neste aparelho. Avisa as telas abertas para a linha remontar. */
export function guardarInteresses(i: Interesses | null, g?: Guarda | null): void {
  try {
    const onde = guarda(g);
    if (!onde) return;
    if (i) onde.setItem(CHAVE_DOS_INTERESSES, JSON.stringify(arrumarInteresses(i)));
    else onde.removeItem(CHAVE_DOS_INTERESSES);
  } catch {
    // aparelho sem espaço ou em modo privado: vale só enquanto a página estiver aberta
  }
  if (g === undefined && typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event(EVENTO_DOS_INTERESSES));
    } catch {
      // sem eventos: a linha pega na próxima abertura
    }
  }
}

/** O evento que as telas ouvem quando os interesses mudam neste aparelho. */
export const EVENTO_DOS_INTERESSES = "lucia:rede:interesses";

/** O filtro da linha a partir do que está guardado (nulo quando não há nada que mude a ordem). */
export function filtroDosInteresses(g?: Guarda | null): InteressesNaLinha | null {
  const i = lerInteresses(g);
  if (!i) return null;
  const f = interessesNaLinha(i);
  return Object.keys(f).length ? f : null;
}

/** O tempo fora a partir do qual a faixa aparece, pelo ritmo guardado (sem respostas: 8 horas, como antes). */
export function foraMinimo(g?: Guarda | null): number {
  return FORA_DO_RITMO_MS[lerInteresses(g)?.ritmo ?? "medio"];
}
