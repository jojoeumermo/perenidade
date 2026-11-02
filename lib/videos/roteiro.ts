// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vídeos curtos: o roteiro é dado (content/enem/videos/<id>.yml). Este arquivo lê, confere e "expande" o roteiro:
// troca {{conta:id}} pelo valor calculado (mathjs, a mesma conta que o validador refaz), {{enem:id}} pelo fato de
// content/enem/edicao.yml e divide a fala em frases. Nada de React aqui: os scripts (npm run video:*) rodam no Node.
// Sem os atalhos "@/" de propósito.

import { evaluate } from "mathjs";
import { type Edicao, formatarFato } from "../enem";

export const TIPOS_DE_CENA = ["cartaz", "pergunta", "folha", "carimbo", "lista", "final"] as const;
export type TipoDeCena = (typeof TIPOS_DE_CENA)[number];
export const TIPOS_DE_VIDEO = ["aula-curta", "estrategia", "redacao", "reta-final"] as const;

export interface Conta {
  expr: string;
  valor?: number;
  formato: "moeda" | "porcento" | "numero" | "decimal";
  casas?: number;
}
export interface Item {
  texto: string;
  /** Nome da marca da fala ({{marca:nome}}) em que o item aparece. Sem marca, aparece em sequência. */
  em?: string;
  destaque?: boolean;
}
export interface Visual {
  tipo: TipoDeCena;
  titulo?: string;
  texto?: string;
  nota?: string;
  itens?: Item[];
}
export interface Cena {
  id: string;
  visual: Visual;
  fala: string;
}
export interface Roteiro {
  id: string;
  aula: string;
  titulo: string;
  tipo: (typeof TIPOS_DE_VIDEO)[number];
  voz: "voz-1" | "voz-2";
  duracao: number;
  contas: Record<string, Conta>;
  cenas: Cena[];
  fontes: { titulo: string; url?: string }[];
  conferido: string;
  autores: string[];
  revisao: { status: "em-revisao" };
}

/** Frase pronta: o texto que aparece (legenda e transcrição) e as marcas que acontecem quando ela começa. */
export interface Frase {
  texto: string;
  marcas: string[];
  pausa: number;
}
export interface CenaExpandida {
  id: string;
  visual: Visual;
  frases: Frase[];
}

// Clichês de texto gerado, julgamento, elogio e promessa: o validador reprova.
export const PROIBIDOS: [RegExp, string][] = [
  [/vamos mergulhar/i, "Vamos mergulhar"],
  [/no mundo de hoje/i, "No mundo de hoje"],
  [/é importante ressaltar/i, "É importante ressaltar"],
  [/neste vídeo,? você vai/i, "Neste vídeo você vai"],
  [/\bem resumo\b/i, "Em resumo"],
  [/sem mais delongas/i, "Sem mais delongas"],
  [/não é apenas .{1,40}, é /i, "Não é apenas X, é Y"],
  [/desvend/i, "desvendar"],
  [/\bjornada\b/i, "jornada"],
  [/universo d[eo]/i, "universo de"],
  [/muito bem/i, "Muito bem"],
  [/(é|fica|parece) (fácil|simples)\b/i, "é fácil / simples"],
  [/você vai tirar/i, "promessa de nota"],
  [/nota mil garantida|garant(e|imos) (a )?(sua )?(nota|aprovação)/i, "promessa de nota"],
];

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const formatarNumero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Calcula a conta. A expressão pode usar fatos numéricos da edição: {{enem:duracao-dia-2}} vira 300. */
export function calcularConta(c: Conta, edicao?: Edicao): number {
  const expr = c.expr.replace(/\{\{enem:([a-z0-9-]+)\}\}/g, (_, id: string) => {
    const v = edicao?.fatos[id]?.valor;
    if (typeof v !== "number") throw new Error(`{{enem:${id}}} não é um número em content/enem/edicao.yml`);
    return String(v);
  });
  const v = Number(evaluate(expr));
  if (!Number.isFinite(v)) throw new Error(`a conta "${c.expr}" não dá um número`);
  return v;
}
export function formatarConta(c: Conta, v: number): string {
  if (c.formato === "moeda") return `R$ ${formatarNumero(v, 2)}`;
  if (c.formato === "porcento") return `${formatarNumero(v, c.casas ?? 0)}%`;
  if (c.formato === "decimal") return formatarNumero(v, c.casas ?? 2);
  return formatarNumero(v, c.casas ?? 0);
}

/** Lê o YAML já carregado e confere a forma. Devolve a lista de erros (vazia quando está tudo certo). */
export function validarRoteiro(b: unknown, arquivo: string): { roteiro?: Roteiro; erros: string[] } {
  const erros: string[] = [];
  const e = (m: string) => erros.push(`${arquivo}: ${m}`);
  if (!obj(b)) return { erros: [`${arquivo}: o roteiro precisa ser um objeto`] };
  if (typeof b.id !== "string" || !ID.test(b.id)) e('"id" em letras minúsculas e hífens');
  if (typeof b.aula !== "string" || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(b.aula)) e('"aula" é trilha/aula');
  if (typeof b.titulo !== "string" || !b.titulo.trim()) e('"titulo" é obrigatório');
  if (!TIPOS_DE_VIDEO.includes(b.tipo as never)) e(`"tipo" deve ser ${TIPOS_DE_VIDEO.join(", ")}`);
  if (b.voz !== "voz-1" && b.voz !== "voz-2") e('"voz" é voz-1 ou voz-2');
  if (typeof b.duracao !== "number" || b.duracao < 45 || b.duracao > 120) e('"duracao" alvo entre 45 e 120 s');
  if (!Array.isArray(b.autores) || b.autores.join() !== "Instituto Lúcia") e('autores: ["Instituto Lúcia"]');
  if (!obj(b.revisao) || b.revisao.status !== "em-revisao") e("tudo nasce com revisao: { status: em-revisao }");
  if (typeof b.conferido !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.conferido)) e('"conferido" é a data AAAA-MM-DD');
  if (!Array.isArray(b.fontes) || !b.fontes.length) e('"fontes" não pode ficar vazio');
  const contas = obj(b.contas) ? b.contas : {};
  for (const [id, c] of Object.entries(contas)) {
    if (!obj(c) || typeof c.expr !== "string") {
      e(`conta ${id}: precisa de expr`);
      continue;
    }
    if (!["moeda", "porcento", "numero", "decimal"].includes(c.formato as string)) e(`conta ${id}: formato moeda, porcento, numero ou decimal`);
  }
  if (!Array.isArray(b.cenas) || b.cenas.length < 3) e("pelo menos 3 cenas");
  const ids = new Set<string>();
  for (const [i, c] of (Array.isArray(b.cenas) ? b.cenas : []).entries()) {
    if (!obj(c) || typeof c.id !== "string" || !ID.test(c.id) || ids.has(c.id)) e(`cena ${i + 1}: id único`);
    else ids.add(c.id);
    if (!obj(c) || typeof c.fala !== "string" || !c.fala.trim()) e(`cena ${i + 1}: "fala" é obrigatória`);
    if (!obj(c) || !obj(c.visual) || !TIPOS_DE_CENA.includes(c.visual.tipo as never)) e(`cena ${i + 1}: visual.tipo deve ser ${TIPOS_DE_CENA.join(", ")}`);
  }
  const cenas = (b.cenas ?? []) as Cena[];
  if (cenas.length && cenas[cenas.length - 1]?.visual?.tipo !== "final") e('a última cena é do tipo "final"');
  return erros.length ? { erros } : { roteiro: b as unknown as Roteiro, erros };
}

/** Troca {{conta:x}} e {{enem:x}} pelo valor. Fato a confirmar sai como "confirmar no edital". */
export function interpolar(texto: string, r: Roteiro, edicao: Edicao): string {
  return texto
    .replace(/\{\{conta:([a-z0-9-]+)\}\}/g, (_, id: string) => {
      const c = r.contas?.[id];
      if (!c) throw new Error(`${r.id}: {{conta:${id}}} não existe em "contas"`);
      const v = calcularConta(c, edicao);
      // O validador refaz a conta: se o valor escrito no roteiro não bate, nada sai.
      if (typeof c.valor === "number" && Math.abs(v - c.valor) > 1e-9) throw new Error(`${r.id}: a conta ${id} (${c.expr}) dá ${v}, não ${c.valor}`);
      return formatarConta(c, v);
    })
    .replace(/\{\{enem:([a-z0-9-]+)\}\}/g, (_, id: string) => {
      const f = edicao.fatos[id];
      if (!f) throw new Error(`${r.id}: {{enem:${id}}} não existe em content/enem/edicao.yml`);
      return formatarFato(f);
    });
}

/** Divide em frases: ponto, interrogação, exclamação ou reticências seguidos de espaço. */
export function frasesDe(texto: string): string[] {
  return texto
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.?!…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“(\d{[])/u)
    .map((f) => f.trim())
    .filter(Boolean);
}

export const palavras = (t: string) => t.replace(/\{\{[^}]+\}\}|\[pausa \d+\]/g, " ").split(/\s+/).filter((p) => /[\p{L}\d]/u.test(p)).length;

/** Pausa depois da frase (ms): a marca [pausa N] manda; senão, pelo sinal do fim. */
function pausaDe(frase: string, ultimaDaCena: boolean): number {
  const m = /\[pausa (\d+)\]/.exec(frase);
  if (m) return Number(m[1]);
  if (ultimaDaCena) return 700;
  if (frase.endsWith("?")) return 480;
  if (frase.endsWith(":")) return 320;
  return 360;
}

export function expandir(r: Roteiro, edicao: Edicao): CenaExpandida[] {
  return r.cenas.map((c) => {
    const brutas = frasesDe(interpolar(c.fala, r, edicao));
    const visual: Visual = JSON.parse(interpolar(JSON.stringify(c.visual), r, edicao));
    return {
      id: c.id,
      visual,
      frases: brutas.map((f, i) => ({
        texto: f.replace(/\{\{marca:[a-z0-9-]+\}\}\s?/g, "").replace(/\s?\[pausa \d+\]/g, "").trim(),
        marcas: [...f.matchAll(/\{\{marca:([a-z0-9-]+)\}\}/g)].map((m) => m[1]),
        pausa: pausaDe(f, i === brutas.length - 1),
      })),
    };
  });
}

/** Conferências de texto: clichês, exclamações, tamanho das frases, marcas ligadas e números soltos. */
export function conferirTexto(r: Roteiro, cenas: CenaExpandida[]): string[] {
  const erros: string[] = [];
  const todas = cenas.flatMap((c) => c.frases);
  const fala = todas.map((f) => f.texto).join(" ");
  for (const [re, nome] of PROIBIDOS) if (re.test(fala)) erros.push(`${r.id}: clichê proibido "${nome}"`);
  if ((fala.match(/!/g) ?? []).length > 1) erros.push(`${r.id}: exclamação demais (no máximo uma)`);
  for (const f of todas) if (palavras(f.texto) > 22) erros.push(`${r.id}: frase com mais de 22 palavras: "${f.texto.slice(0, 60)}…"`);
  const media = todas.reduce((s, f) => s + palavras(f.texto), 0) / Math.max(1, todas.length);
  if (media < 9 || media > 20) erros.push(`${r.id}: média de ${media.toFixed(1)} palavras por frase (de 9 a 20)`);
  // Dinheiro e porcentagem só por conta ou fato: assim o número da tela é o mesmo que a conta dá.
  for (const c of r.cenas) {
    const bruto = `${c.fala} ${JSON.stringify(c.visual)}`;
    if (/R\$\s?\d|\d\s?%/.test(bruto)) erros.push(`${r.id}/${c.id}: dinheiro ou porcentagem escrito à mão; use {{conta:…}}`);
  }
  for (const c of cenas) {
    const marcas = new Set(c.frases.flatMap((f) => f.marcas));
    for (const it of c.visual.itens ?? []) if (it.em && !marcas.has(it.em)) erros.push(`${r.id}/${c.id}: o item "${it.texto}" espera a marca "${it.em}", que não está na fala`);
  }
  return erros;
}
