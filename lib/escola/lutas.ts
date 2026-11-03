// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O Mapa das lutas da Escola Lúcia Maria (E4-11, docs/escola/vida.md): um mapa NO TEMPO, não no espaço (não há
// coordenada com fonte no repositório). Cruza os feriados do campus (lib/escola/calendario.ts, que não é redefinido
// aqui) com os fatos de content/neste-dia.json pelo dia MM-DD. Só feriado é "feriado do campus"; a data que só tem
// fato é "data de memória". Nada de dia, número ou fato inventado: tudo vem dos dois arquivos, cada um com fonte.
// Sem "@/" e sem fs: o teste roda direto no Node.

import { calendarioAindaProposto, type Evento, type Feriado, icsDoEvento } from "./calendario";

export interface FatoDeLuta {
  /** MM-DD */
  dia: string;
  ano: number;
  texto: string;
  link: string;
}

export interface Luta {
  /** MM-DD */
  dia: string;
  /** O nome do feriado do campus; null na data de memória. */
  nome: string | null;
  fonte?: string;
  /** trilha/aula do tema, quando o feriado tem. */
  aula?: string;
  fatos: { ano: number; texto: string; link: string }[];
  feriado: boolean;
}

/** A data existe (29/02 só em ano bissexto)? */
function existe(ano: number, dia: string): boolean {
  const d = new Date(Date.parse(`${ano}-${dia}T00:00:00Z`));
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(5, 10) === dia;
}

/** Cruza feriados e fatos pelo dia. Em ordem de calendário; os fatos de cada data vêm do mais antigo ao mais novo. */
export function lutasDoAno(feriados: readonly Feriado[], fatos: readonly FatoDeLuta[]): Luta[] {
  const porDia = new Map<string, Luta>();
  for (const f of feriados) porDia.set(f.dia, { dia: f.dia, nome: f.nome, fonte: f.fonte, ...(f.aula ? { aula: f.aula } : {}), fatos: [], feriado: true });
  for (const f of fatos) {
    const l = porDia.get(f.dia) ?? { dia: f.dia, nome: null, fatos: [], feriado: false };
    l.fatos.push({ ano: f.ano, texto: f.texto, link: f.link });
    porDia.set(f.dia, l);
  }
  const lista = [...porDia.values()];
  for (const l of lista) l.fatos.sort((a, b) => a.ano - b.ano);
  return lista.sort((a, b) => a.dia.localeCompare(b.dia));
}

/**
 * A próxima data a partir de `hoje` (AAAA-MM-DD, inclusive o próprio dia) e o dia completo em que ela cai. Passe
 * `soFeriados` para só olhar os feriados do campus. null quando não há data nenhuma.
 */
export function proximaLuta(lutas: readonly Luta[], hoje: string, soFeriados = false): { luta: Luta; data: string } | null {
  const ano = Number(hoje.slice(0, 4));
  let melhor: { luta: Luta; data: string } | null = null;
  for (const luta of lutas) {
    if (soFeriados && !luta.feriado) continue;
    for (let a = ano; a <= ano + 8; a++) {
      if (!existe(a, luta.dia)) continue;
      const data = `${a}-${luta.dia}`;
      if (data < hoje) continue;
      if (!melhor || data < melhor.data) melhor = { luta, data };
      break;
    }
  }
  return melhor;
}

/** As datas por mês (1 a 12), só os meses que têm alguma. */
export function agrupadasPorMes(lutas: readonly Luta[]): { mes: number; lutas: Luta[] }[] {
  const meses = new Map<number, Luta[]>();
  for (const l of lutas) {
    const m = Number(l.dia.slice(0, 2));
    meses.set(m, [...(meses.get(m) ?? []), l]);
  }
  return [...meses.entries()].sort((a, b) => a[0] - b[0]).map(([mes, ls]) => ({ mes, lutas: ls }));
}

/** O arquivo de agenda (.ics) da próxima ocorrência de uma data: evento único, sem recorrência, feito no aparelho. */
export function icsDaLuta(luta: Luta, hoje: string, url: string, agora: Date = new Date()): string | null {
  const prox = proximaLuta([luta], hoje);
  if (!prox) return null;
  const evento: Evento = {
    tipo: "feriado",
    data: prox.data,
    titulo: luta.nome ?? `Data de memória: ${luta.fatos[0]?.texto.slice(0, 80) ?? luta.dia}`,
    link: luta.aula ? `/trilhas/${luta.aula}` : (luta.fonte ?? luta.fatos[0]?.link ?? url),
    ...(luta.fonte ? { fonte: luta.fonte } : luta.fatos[0] ? { fonte: luta.fatos[0].link } : {}),
    ...(luta.feriado && calendarioAindaProposto() ? { proposto: true } : {}),
    id: `luta-${prox.data}`,
  };
  return icsDoEvento(evento, url, agora);
}
