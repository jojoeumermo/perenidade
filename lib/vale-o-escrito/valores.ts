// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: os "fluxos de dinheiro" (NOVAS-TAREFAS, T31 3.3) e o número grande do topo (3.1). Parte pura (sem
// React, sem disco, sem "@/"): roda no Node nos testes. Os valores vêm do campo `valores` de cada entrada, já conferido
// em regras.ts (o número tem de estar escrito no resumo revisado ou no trecho da fonte). Nada é calculado pela equipe
// além da soma, e a soma diz o que é: valores citados em fonte, de naturezas diferentes (multa, acordo, estimativa
// oficial, valor sob apuração), não um total de desvios.

import type { Entrada, RefDeNo, ValorDocumentado } from "./tipos";

export interface ValorDoCaso {
  entrada: Entrada;
  valor: ValorDocumentado;
  /** Número da fonte na ficha (1, 2...), para o "[n]". */
  nFonte: number;
}

/** Todos os valores das entradas dadas, do maior para o menor (a "lista ordenada por valor" da ficha). */
export function valoresOrdenados(entradas: readonly Entrada[]): ValorDoCaso[] {
  const lista: ValorDoCaso[] = [];
  for (const entrada of entradas)
    for (const valor of entrada.valores ?? []) lista.push({ entrada, valor, nFonte: entrada.fontes.findIndex((f) => f.id === valor.fonteId) + 1 });
  return lista.sort((a, b) => b.valor.valor - a.valor.valor || a.entrada.id.localeCompare(b.entrada.id) || a.valor.id.localeCompare(b.valor.id));
}

/** Os valores em que uma pessoa ou organização é a ponta (quem paga ou responde), do maior para o menor. */
export const valoresDaPonta = (entradas: readonly Entrada[], ponta: RefDeNo): ValorDoCaso[] =>
  valoresOrdenados(entradas).filter((v) => v.valor.ponta?.tipo === ponta.tipo && v.valor.ponta.id === ponta.id);

/** A soma documentada e a divisão por dossiê (a barra segmentada do topo), maior primeiro. */
export function somaDocumentada(entradas: readonly Entrada[]): { total: number; casos: number; porDossie: { dossie: string; total: number }[] } {
  const por = new Map<string, number>();
  const casos = new Set<string>();
  let total = 0;
  for (const e of entradas)
    for (const v of e.valores ?? []) {
      total += v.valor;
      casos.add(e.id);
      por.set(e.dossie, (por.get(e.dossie) ?? 0) + v.valor);
    }
  const porDossie = [...por].map(([dossie, t]) => ({ dossie, total: t })).sort((a, b) => b.total - a.total || a.dossie.localeCompare(b.dossie));
  return { total, casos: casos.size, porDossie };
}

/** Cor neon de cada categoria (dossiê), para a barra segmentada e o catálogo. Categoria nova cai no amarelo. */
export const COR_DA_CATEGORIA: Record<string, string> = {
  "povos-indigenas": "#ff2b4f",
  "conflitos-no-campo": "#ffe600",
  "crimes-ambientais": "#3ddc97",
  "dinheiro-publico": "#ffb020",
  "trabalho-escravo": "#b388ff",
  "violencia-policial": "#00b3ff",
};
export const corDaCategoria = (slug: string): string => COR_DA_CATEGORIA[slug] ?? "#ffe600";

const LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", ru: "ru-RU", zh: "zh-CN" };

/** "R$ 6,3 bi" / "R$ 694,6 mi" (compacto, para o painel) ou o valor inteiro ("R$ 3.009.000,00"). */
export function formatarReais(valor: number, lang: string, compacto = false): string {
  const locale = LOCALE[lang] ?? "pt-BR";
  if (!compacto) return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(valor);
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(valor);
}
