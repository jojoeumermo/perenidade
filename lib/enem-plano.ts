// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O plano de estudos do curso ENEM: a pessoa diz quantas horas tem por semana, em que dias, se trabalha e (se já
// escolheu curso) os pesos das áreas; o plano junta isso ao diagnóstico, à data da prova (de content/enem/edicao.yml) e
// à incidência (content/enem/incidencia.yml) e monta semanas com aulas e exercícios, revisões espaçadas (os mesmos
// intervalos de lib/estudo.ts), uma proposta de redação por semana e simulados. Atrasou? É só montar de novo a partir de
// hoje: o plano nunca acumula atraso nem culpa. Tudo roda e fica no aparelho.
// Sem os atalhos "@/" de propósito: `npm run testar:enem` roda este arquivo direto no Node.

import { INTERVALOS, somarDias } from "./estudo";

export type AreaDoPlano = "linguagens" | "humanas" | "natureza" | "matematica";
export const AREAS_DO_PLANO: AreaDoPlano[] = ["linguagens", "humanas", "natureza", "matematica"];

export const MODOS = { "reta-final": 2, "1-mes": 4, "3-meses": 13, "6-meses": 26, "1-ano": 52 } as const;
export type Modo = keyof typeof MODOS;

export interface Topico {
  id: string;
  nome: string;
  area: AreaDoPlano;
  /** Questões oficiais classificadas neste tópico (a incidência). */
  peso: number;
  /** Onde estudar (aula do percurso, ou a prática do tópico). */
  href: string;
}

export interface Pedido {
  /** Dia de hoje, AAAA-MM-DD (no aparelho). */
  hoje: string;
  /** 1º dia de prova, AAAA-MM-DD; null quando não há data (fica só o modo). */
  prova: string | null;
  modo: Modo;
  horasPorSemana: number;
  /** Dias da semana em que dá para estudar (0 = domingo … 6 = sábado). */
  dias: number[];
  trabalha: boolean;
  /** Pesos das áreas no curso escolhido (digitados pela pessoa); ausentes valem 1. */
  pesos?: Partial<Record<AreaDoPlano, number>>;
  /** Acerto no diagnóstico, de 0 a 1, por área; ausente vale 0,5. */
  diagnostico?: Partial<Record<AreaDoPlano, number>>;
  /** Os tópicos de cada área, na ordem da incidência (o que mais cai primeiro). */
  topicos: Topico[];
}

export type TipoDeItem = "estudo" | "revisao" | "redacao" | "simulado";
export interface ItemDoPlano {
  tipo: TipoDeItem;
  dia: string;
  minutos: number;
  titulo: string;
  area?: AreaDoPlano;
  topico?: string;
  href: string;
}
export interface SemanaDoPlano {
  inicio: string;
  fim: string;
  itens: ItemDoPlano[];
}
export interface Plano {
  feitoEm: string;
  semanas: SemanaDoPlano[];
  /** A prova já passou (o plano vale para a próxima edição, pelo modo escolhido). */
  provaPassou: boolean;
  /** Quantos dias até a prova (null sem data). */
  diasAteAProva: number | null;
  /** Tópicos que não couberam no tempo (para a pessoa saber que existem). */
  ficaramDeFora: number;
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const diaDaSemana = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

/** Quanto tempo cada sessão de estudo leva, por tópico: menos na reta final (revisão condensada) e para quem trabalha. */
export function minutosPorTopico(modo: Modo, trabalha: boolean): number {
  const base = modo === "reta-final" ? 40 : modo === "1-mes" ? 60 : 90;
  return trabalha ? Math.round(base * 0.75) : base;
}

export function gerarPlano(p: Pedido): Plano {
  const dias = [...new Set(p.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const usar = dias.length ? dias : [0, 1, 2, 3, 4, 5, 6];
  const horas = Math.max(0.5, Math.min(80, Number.isFinite(p.horasPorSemana) ? p.horasPorSemana : 1));
  const ate = p.prova ? diasEntre(p.hoje, p.prova) : null;
  const provaPassou = ate !== null && ate < 0;
  // O horizonte: até a véspera da prova (no máximo o que o modo pede); sem data ou com a prova passada, o modo.
  const diasDoPlano = ate !== null && !provaPassou ? Math.max(1, Math.min(ate, MODOS[p.modo] * 7)) : MODOS[p.modo] * 7;
  const datas = Array.from({ length: diasDoPlano }, (_, i) => somarDias(p.hoje, i)).filter((d) => usar.includes(diaDaSemana(d)));
  const datasUteis = datas.length ? datas : [p.hoje];
  const minutosPorDia = Math.round((horas * 60) / usar.length);

  // A fila de tópicos: as áreas alternam, cada uma na ordem da incidência; quem tem mais peso e mais lacuna no
  // diagnóstico entra mais vezes na rodada.
  const porArea = new Map(AREAS_DO_PLANO.map((a) => [a, p.topicos.filter((t) => t.area === a).sort((x, y) => y.peso - x.peso)]));
  const prioridade = Object.fromEntries(AREAS_DO_PLANO.map((a) => [a, Math.max(0.1, p.pesos?.[a] ?? 1) * (1.5 - Math.max(0, Math.min(1, p.diagnostico?.[a] ?? 0.5)))])) as Record<AreaDoPlano, number>;
  const fila: Topico[] = [];
  const credito = Object.fromEntries(AREAS_DO_PLANO.map((a) => [a, 0])) as Record<AreaDoPlano, number>;
  const total = p.topicos.length;
  while (fila.length < total) {
    for (const a of AREAS_DO_PLANO) credito[a] += prioridade[a];
    const vez = AREAS_DO_PLANO.filter((a) => porArea.get(a)!.length).sort((x, y) => credito[y] - credito[x])[0];
    if (!vez) break;
    credito[vez] -= Math.max(...AREAS_DO_PLANO.map((a) => prioridade[a]));
    fila.push(porArea.get(vez)!.shift()!);
  }

  const porDia = new Map<string, ItemDoPlano[]>(datasUteis.map((d) => [d, []]));
  const livre = new Map(datasUteis.map((d) => [d, minutosPorDia]));
  const pôr = (item: ItemDoPlano) => {
    porDia.get(item.dia)!.push(item);
    livre.set(item.dia, (livre.get(item.dia) ?? 0) - item.minutos);
  };
  const primeiroDiaComTempo = (desde: string, minutos: number) => datasUteis.find((d) => d >= desde && (livre.get(d) ?? 0) >= minutos);

  // Uma proposta de redação por semana (no primeiro dia de estudo da semana com tempo) e um simulado por semana na reta
  // final e no plano de um mês; nos planos longos, um simulado a cada quatro semanas.
  const semanas = Math.ceil(diasDoPlano / 7);
  for (let s = 0; s < semanas; s++) {
    const inicio = somarDias(p.hoje, s * 7);
    const fim = somarDias(p.hoje, s * 7 + 6);
    const redacao = Math.min(60, minutosPorDia);
    const dRed = datasUteis.find((d) => d >= inicio && d <= fim && (livre.get(d) ?? 0) >= redacao);
    if (dRed) pôr({ tipo: "redacao", dia: dRed, minutos: redacao, titulo: "Proposta de redação da semana", href: "/trilhas/enem-reta-final/redacao-expressa-a-estrutura-em-30-linhas" });
    const temSimulado = p.modo === "reta-final" || p.modo === "1-mes" || s % 4 === 3;
    const simulado = Math.min(90, minutosPorDia);
    const dSim = [...datasUteis].reverse().find((d) => d >= inicio && d <= fim && (livre.get(d) ?? 0) >= simulado);
    if (temSimulado && dSim) pôr({ tipo: "simulado", dia: dSim, minutos: simulado, titulo: "Simulado com questões oficiais, no tempo da prova", href: "/enem/provas" });
  }

  // Os tópicos, em ordem, cada um no primeiro dia com tempo; e as revisões espaçadas nos intervalos de lib/estudo.ts.
  const sessao = Math.min(minutosPorTopico(p.modo, p.trabalha), Math.max(20, minutosPorDia));
  const revisao = 15;
  let ficaramDeFora = 0;
  for (const t of fila) {
    const d = primeiroDiaComTempo(datasUteis[0], sessao);
    if (!d) {
      ficaramDeFora++;
      continue;
    }
    pôr({ tipo: "estudo", dia: d, minutos: sessao, titulo: t.nome, area: t.area, topico: t.id, href: t.href });
    for (const salto of INTERVALOS.slice(2, 5)) {
      const dr = primeiroDiaComTempo(somarDias(d, salto), revisao);
      if (dr && diasEntre(d, dr) <= salto + 3) pôr({ tipo: "revisao", dia: dr, minutos: revisao, titulo: `Revisar: ${t.nome}`, area: t.area, topico: t.id, href: t.href });
    }
  }

  const saida: SemanaDoPlano[] = [];
  for (let s = 0; s < semanas; s++) {
    const inicio = somarDias(p.hoje, s * 7);
    const fim = somarDias(p.hoje, Math.min(s * 7 + 6, diasDoPlano - 1));
    const itens = datasUteis.filter((d) => d >= inicio && d <= fim).flatMap((d) => porDia.get(d)!);
    saida.push({ inicio, fim, itens: itens.sort((a, b) => a.dia.localeCompare(b.dia)) });
  }
  return { feitoEm: p.hoje, semanas: saida, provaPassou, diasAteAProva: ate, ficaramDeFora };
}

const escapar = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
/** Quebra as linhas longas como o formato pede (até 75 caracteres; a continuação começa com espaço). */
const dobrar = (linha: string) => (linha.match(/.{1,73}/g) ?? [linha]).join("\r\n ");

/** O plano como arquivo de agenda (.ics): um evento por dia de estudo, às `hora`, com a lista do dia. */
export function icsDoPlano(plano: Plano, hora = "19:00", site = "https://institutolucia.org/pt", agora = new Date()): string {
  const [h, m] = (/^(\d{2}):(\d{2})$/.exec(hora) ?? ["", "19", "00"]).slice(1);
  const carimbo = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Instituto Lucia//Plano ENEM//PT", "CALSCALE:GREGORIAN"];
  const porDia = new Map<string, ItemDoPlano[]>();
  for (const s of plano.semanas) for (const i of s.itens) porDia.set(i.dia, [...(porDia.get(i.dia) ?? []), i]);
  for (const [dia, itens] of porDia) {
    const minutos = itens.reduce((x, i) => x + i.minutos, 0);
    const inicio = `${dia.replace(/-/g, "")}T${h}${m}00`;
    const fimData = new Date(`${dia}T${h}:${m}:00Z`);
    fimData.setUTCMinutes(fimData.getUTCMinutes() + minutos);
    const fim = fimData.toISOString().replace(/[-:]/g, "").slice(0, 15);
    linhas.push(
      "BEGIN:VEVENT",
      `UID:plano-enem-${dia}@institutolucia.org`,
      `DTSTAMP:${carimbo}`,
      `DTSTART:${inicio}`,
      `DTEND:${fim}`,
      dobrar(`SUMMARY:${escapar(`Estudo ENEM (${minutos} min)`)}`),
      dobrar(`DESCRIPTION:${escapar(itens.map((i) => `${i.titulo} (${i.minutos} min): ${site}${i.href}`).join("\n"))}`),
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR", "");
  return linhas.join("\r\n");
}
