// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Fonte } from "../tipos";

/**
 * Capacidade de condução de corrente (Iz, em ampères) de fios de cobre com isolação de PVC, 70 °C, ambiente a 30 °C,
 * método de instalação B1 (eletroduto embutido em alvenaria), dois condutores carregados, sem fatores de correção.
 * Valores citados da Tabela 36 da ABNT NBR 5410:2004, conferidos em fonte secundária (proeletrics.com): na obra de verdade,
 * confira na norma e aplique os fatores de agrupamento e temperatura. Citação mínima, para estudo (Lei 9.610/1998, art. 46, III).
 */
export const CAPACIDADE_DO_FIO: Record<number, number> = { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57 };

export const SECOES = [1.5, 2.5, 4, 6, 10] as const;
export const DISJUNTORES = [10, 16, 20, 25, 32, 40, 50] as const;

export type TipoDeCircuito = "iluminacao" | "tomadas" | "chuveiro" | "forno";

export interface Circuito {
  id: string;
  nome: string;
  tipo: TipoDeCircuito;
  /** Potência prevista, em watts. */
  watts: number;
  volts: 127 | 220;
  /** Área molhada (banheiro, cozinha, área de serviço, área externa): pede o DR de alta sensibilidade. */
  molhada: boolean;
}

export const CIRCUITOS: Circuito[] = [
  { id: "luz", nome: "Iluminação da sala e dos quartos", tipo: "iluminacao", watts: 800, volts: 127, molhada: false },
  { id: "tug-quarto", nome: "Tomadas do quarto e da sala", tipo: "tomadas", watts: 1800, volts: 127, molhada: false },
  { id: "tug-cozinha", nome: "Tomadas da cozinha (geladeira, liquidificador, micro-ondas)", tipo: "tomadas", watts: 2400, volts: 127, molhada: true },
  { id: "chuveiro", nome: "Chuveiro elétrico de 5500 W em 220 V", tipo: "chuveiro", watts: 5500, volts: 220, molhada: true },
  { id: "forno", nome: "Forno elétrico de embutir (cozinha) de 3000 W em 220 V", tipo: "forno", watts: 3000, volts: 220, molhada: true },
];

/** Corrente de projeto Ib = P / V (carga resistiva, fator de potência 1: simplificação do jogo). */
export function correnteDeProjeto(c: Circuito): number {
  return Math.round((c.watts / c.volts) * 10) / 10;
}

/** Seção mínima pelo tipo: iluminação 1,5 mm², demais 2,5 mm² (NBR 5410, tabela de seções mínimas). */
export function secaoMinima(tipo: TipoDeCircuito): number {
  return tipo === "iluminacao" ? 1.5 : 2.5;
}

export interface Escolhas {
  secao: number;
  disjuntor: number;
  dr: boolean;
}

export type Falha = "dr-faltando" | "secao-minima" | "desarma" | "fio-esquenta" | "fio-pequeno";

export interface Veredito {
  ok: boolean;
  falhas: Falha[];
  ib: number;
  iz: number;
}

/** A regra de ouro da proteção contra sobrecarga: Ib <= In <= Iz. Falhas explicam o que aconteceria na casa. */
export function avaliarCircuito(c: Circuito, e: Escolhas): Veredito {
  const ib = correnteDeProjeto(c);
  const iz = CAPACIDADE_DO_FIO[e.secao];
  const falhas: Falha[] = [];
  if (e.secao < secaoMinima(c.tipo)) falhas.push("secao-minima");
  if (iz < ib) falhas.push("fio-pequeno");
  if (e.disjuntor < ib) falhas.push("desarma");
  if (e.disjuntor > iz) falhas.push("fio-esquenta");
  if (c.molhada && !e.dr) falhas.push("dr-faltando");
  return { ok: falhas.length === 0, falhas, ib, iz };
}

export const TEXTO_DA_FALHA: Record<Falha, string> = {
  "dr-faltando": "Falta o DR de 30 mA: em área molhada, uma fuga de corrente por um corpo molhado precisa ser cortada em um instante.",
  "secao-minima": "O fio é mais fino que o mínimo da norma para esse tipo de circuito.",
  desarma: "O disjuntor é menor que a corrente do circuito: ele vai desarmar sozinho toda vez que o aparelho for ligado.",
  "fio-esquenta": "O disjuntor é maior que o fio aguenta. Numa sobrecarga, o fio esquenta e o disjuntor não desarma: a isolação derrete e pode haver incêndio.",
  "fio-pequeno": "Mesmo com carga normal, o fio já passa do que aguenta e esquenta. Só trocar o disjuntor não resolve: o fio precisa ser mais grosso.",
};

/** Todas as combinações (seção, disjuntor) que servem para o circuito (com DR quando for área molhada). */
export function combinacoesQueServem(c: Circuito): Escolhas[] {
  const lista: Escolhas[] = [];
  for (const secao of SECOES) {
    for (const disjuntor of DISJUNTORES) {
      const e = { secao, disjuntor, dr: c.molhada };
      if (avaliarCircuito(c, e).ok) lista.push(e);
    }
  }
  return lista;
}

export const FONTES_DISJUNTORES: Fonte[] = [
  { nome: "ABNT NBR 5410:2004, Instalações elétricas de baixa tensão (norma paga, da ABNT)", url: "https://www.abntcatalogo.com.br/" },
  { nome: "Tabela de capacidade de condução por bitola (conferência secundária, proeletrics.com)", url: "https://www.proeletrics.com/blog/corrente-suportada-cabo-nbr-5410" },
  { nome: "Lei 9.610/1998, art. 46, III: citação para estudo (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/leis/l9610.htm" },
];

export const AVISO_DE_SEGURANCA =
  "Isto é uma simulação para entender o raciocínio. Instalação elétrica de verdade é trabalho de profissional habilitado, com a norma e os fatores de correção em mãos, e com a energia desligada no quadro geral. Nada aqui substitui projeto, laudo ou o curso de segurança em eletricidade (NR-10).";
