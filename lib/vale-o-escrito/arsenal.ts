// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: o catálogo "Arsenal" (NOVAS-TAREFAS, T31 3.5) e a vista de relações ("quem é dono de quê", 3.7).
// Parte pura (sem React, sem disco, sem "@/"): tudo sai do que já está publicado e conferido. Eventos são datas que JÁ
// estão nas entradas (fato, publicação, mudança de situação, valor documentado, data da fonte): nada é deduzido.

import { normalizar } from "./regras";
import type { Confianca, Entrada, Fonte, Ligacao, RefDeNo, ValorDocumentado } from "./tipos";
import { confiancaDaLigacao, dataParaMs, type DadosDoObservatorio } from "./visual";

export const ABAS_DO_ARSENAL = ["casos", "eventos", "documentos", "relacoes"] as const;
export type AbaDoArsenal = (typeof ABAS_DO_ARSENAL)[number];

/** Um termo de busca bate quando todas as palavras aparecem em algum dos campos (sem acento, sem caixa). */
export function casaBusca(campos: readonly (string | undefined)[], termo: string): boolean {
  const palavras = normalizar(termo ?? "").split(" ").filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = normalizar(campos.filter(Boolean).join(" "));
  return palavras.every((p) => alvo.includes(p));
}

/** Os campos de busca de um caso: título, resumo, lugar, etiquetas, veículos e nomes de quem é citado. */
export function camposDoCaso(d: DadosDoObservatorio, e: Entrada): string[] {
  const nomes = [
    ...e.pessoas.map((p) => d.pessoas.find((x) => x.id === p.pessoaId)?.nome),
    ...e.organizacoes.map((o) => d.organizacoes.find((x) => x.id === o)?.nome),
  ].filter((x): x is string => Boolean(x));
  return [e.titulo, e.resumo, e.lugar.nome ?? "", e.lugar.regiao ?? "", ...e.etiquetas, ...e.fontes.map((f) => f.veiculo), ...nomes];
}

export type TipoDeEvento = "fato" | "publicado" | "mudanca" | "valor" | "fonte";

export interface EventoDoArsenal {
  chave: string;
  data: string;
  tipo: TipoDeEvento;
  entrada: Entrada;
  /** Mudança de situação: de → para (rótulos ficam na tela). */
  mudanca?: NonNullable<Entrada["historico"]>[number];
  valor?: ValorDocumentado;
  fonte?: Fonte;
}

/** Todos os eventos datados das entradas, do mais novo ao mais antigo. */
export function eventosDoArsenal(entradas: readonly Entrada[]): EventoDoArsenal[] {
  const lista: EventoDoArsenal[] = [];
  for (const e of entradas) {
    lista.push({ chave: `${e.id}:fato`, data: e.dataDoFato, tipo: "fato", entrada: e });
    lista.push({ chave: `${e.id}:publicado`, data: e.publicadoEm, tipo: "publicado", entrada: e });
    (e.historico ?? []).forEach((m, i) => lista.push({ chave: `${e.id}:mudanca:${i}`, data: m.em, tipo: "mudanca", entrada: e, mudanca: m }));
    // Valor sem data própria na fonte entra na data da fonte que o registra (e a tela diz isso).
    for (const v of e.valores ?? []) {
      const data = v.data ?? e.fontes.find((f) => f.id === v.fonteId)?.data;
      if (data) lista.push({ chave: `${e.id}:valor:${v.id}`, data, tipo: "valor", entrada: e, valor: v });
    }
    for (const f of e.fontes) lista.push({ chave: `${e.id}:fonte:${f.id}`, data: f.data, tipo: "fonte", entrada: e, fonte: f });
  }
  return lista.sort((a, b) => dataParaMs(b.data) - dataParaMs(a.data) || a.chave.localeCompare(b.chave));
}

export interface DocumentoDoArsenal {
  chave: string;
  fonte: Fonte;
  /** Número da fonte na ficha do caso (1, 2...). */
  n: number;
  entrada: Entrada;
}

/** Todas as fontes (documentos) das entradas, da mais nova à mais antiga. */
export function documentosDoArsenal(entradas: readonly Entrada[]): DocumentoDoArsenal[] {
  return entradas
    .flatMap((entrada) => entrada.fontes.map((fonte, i) => ({ chave: `${entrada.id}:${fonte.id}`, fonte, n: i + 1, entrada })))
    .sort((a, b) => dataParaMs(b.fonte.data) - dataParaMs(a.fonte.data) || a.chave.localeCompare(b.chave));
}

export interface RelacaoDoArsenal {
  ligacao: Ligacao;
  outro: RefDeNo & { nome: string };
  entrada: Entrada;
  confianca: Confianca;
  /** Números das fontes na ficha do caso. */
  fontes: number[];
}

export interface GrupoDeRelacoes {
  ponta: RefDeNo & { nome: string };
  relacoes: RelacaoDoArsenal[];
  /** Casos em que a ponta é citada (organização ou pessoa), com a situação jurídica de pessoa quando houver. */
  casos: Entrada[];
}

const nomeDe = (d: DadosDoObservatorio, r: RefDeNo): string =>
  r.tipo === "pessoa"
    ? (d.pessoas.find((x) => x.id === r.id)?.nome ?? r.id)
    : r.tipo === "organizacao"
      ? (d.organizacoes.find((x) => x.id === r.id)?.nome ?? r.id)
      : r.tipo === "entrada"
        ? (d.entradas.find((x) => x.id === r.id)?.titulo ?? r.id)
        : r.id;

/**
 * A vista de relações ("quem é dono de quê"): cada organização com as ligações com fonte que chegam ou saem dela
 * (integra, dirige, financia, contrata, doa para...), e cada pessoa ligada a outra pessoa ou organização. Organizações
 * primeiro, as com mais relações no alto. Só as Ligacao publicadas (com fonte); a confiança é a da fonte.
 */
export function relacoesDoArsenal(d: DadosDoObservatorio): GrupoDeRelacoes[] {
  const idsPublicados = new Set(d.entradas.map((e) => e.id));
  const grupos = new Map<string, GrupoDeRelacoes>();
  const grupo = (r: RefDeNo): GrupoDeRelacoes => {
    const k = `${r.tipo}:${r.id}`;
    let g = grupos.get(k);
    if (!g) {
      const casos = d.entradas.filter((e) => (r.tipo === "organizacao" ? e.organizacoes.includes(r.id) : e.pessoas.some((p) => p.pessoaId === r.id)));
      g = { ponta: { ...r, nome: nomeDe(d, r) }, relacoes: [], casos };
      grupos.set(k, g);
    }
    return g;
  };
  for (const l of d.ligacoes) {
    if (!idsPublicados.has(l.entradaId)) continue;
    const entrada = d.entradas.find((e) => e.id === l.entradaId)!;
    const agentes = [l.de, l.para].filter((r) => r.tipo === "pessoa" || r.tipo === "organizacao");
    if (agentes.length < 2) continue;
    // O grupo é a organização (o "dono"); entre duas pessoas, quem está em "de".
    const dono = l.de.tipo === "organizacao" ? l.de : l.para.tipo === "organizacao" ? l.para : l.de;
    const outro = dono === l.de ? l.para : l.de;
    const fontes = l.fonteIds.map((id) => entrada.fontes.findIndex((f) => f.id === id || f.catalogoId === id) + 1).filter((n) => n > 0);
    grupo(dono).relacoes.push({ ligacao: l, outro: { ...outro, nome: nomeDe(d, outro) }, entrada, confianca: confiancaDaLigacao(l, entrada), fontes });
  }
  // Organizações citadas em caso, mesmo sem ligação explícita: entram com a lista de casos.
  for (const o of d.organizacoes) if (d.entradas.some((e) => e.organizacoes.includes(o.id))) grupo({ tipo: "organizacao", id: o.id });
  return [...grupos.values()].sort(
    (a, b) =>
      Number(b.ponta.tipo === "organizacao") - Number(a.ponta.tipo === "organizacao") ||
      b.relacoes.length - a.relacoes.length ||
      a.ponta.nome.localeCompare(b.ponta.nome),
  );
}
