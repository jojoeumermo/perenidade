// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O tempo da Escola Revolucionária Lúcia Maria: em que semestre estamos, se é tempo de aula ou de férias, e quando é a semana de
// provas. As datas vêm de content/escola/ano-letivo.json e são PROPOSTA enquanto "confirmado" for false (a interface
// avisa). Sem os atalhos "@/" de propósito: `npm run testar:escola` roda este arquivo direto no Node.

import anoLetivoPadrao from "../../content/escola/ano-letivo.json";
import { diaDe, semanaDe } from "../lambe-do-dia";

export interface AnoLetivo {
  _sobre?: string;
  confirmado: boolean;
  fuso: string;
  /** Datas MM-DD de cada semestre. */
  semestres: { "1": { inicio: string; fim: string }; "2": { inicio: string; fim: string } };
  provas: { regra: "duas-ultimas-semanas" | string };
  recessos: { inicio: string; fim: string; motivo?: string }[];
}

export const ANO_LETIVO = anoLetivoPadrao as AnoLetivo;

/** O calendário ainda é proposta? Enquanto for, a interface diz "calendário proposto, a confirmar pela coordenação". */
export const calendarioProposto = (ano: AnoLetivo = ANO_LETIVO) => !ano.confirmado;

export interface Semestre {
  /** "AAAA.1" ou "AAAA.2" */
  id: string;
  /** AAAA-MM-DD */
  inicio: string;
  fim: string;
  situacao: "aulas" | "ferias";
  /** O semestre que vem depois deste. */
  proximo: { id: string; inicio: string; fim: string };
}

/** O dia de hoje (AAAA-MM-DD) em Brasília, a mesma conta do cartaz do dia (lib/lambe-do-dia.ts). */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Date(diaDe(agora) * 86_400_000).toISOString().slice(0, 10);
}
/** O número da semana em Brasília (segunda a domingo), igual ao da aula da semana. */
export { semanaDe };

const somar = (dia: string, dias: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

function datas(anoCivil: number, s: 1 | 2, ano: AnoLetivo) {
  const c = ano.semestres[String(s) as "1" | "2"];
  return { id: `${anoCivil}.${s}`, inicio: `${anoCivil}-${c.inicio}`, fim: `${anoCivil}-${c.fim}` };
}
const seguinte = (anoCivil: number, s: 1 | 2): [number, 1 | 2] => (s === 1 ? [anoCivil, 2] : [anoCivil + 1, 1]);

/**
 * O semestre de uma data (AAAA-MM-DD ou Date). Dentro das datas do semestre é "aulas" (a não ser num recesso, que é
 * "ferias" sem trocar de semestre). Entre um semestre e outro é "ferias" e devolve o semestre que acabou, com o
 * próximo em `proximo`.
 */
export function semestreDe(data: string | Date, ano: AnoLetivo = ANO_LETIVO): Semestre {
  const dia = typeof data === "string" ? data : hojeEmBrasilia(data);
  const anoCivil = Number(dia.slice(0, 4));
  const candidatos: [number, 1 | 2][] = [
    [anoCivil - 1, 2],
    [anoCivil, 1],
    [anoCivil, 2],
  ];
  // O último semestre que já começou até esta data.
  let atual: [number, 1 | 2] = candidatos[0];
  for (const c of candidatos) if (datas(c[0], c[1], ano).inicio <= dia) atual = c;
  const d = datas(atual[0], atual[1], ano);
  const emRecesso = ano.recessos.some((r) => r.inicio <= dia && dia <= r.fim);
  const situacao = dia <= d.fim && !emRecesso ? "aulas" : "ferias";
  const [pa, ps] = seguinte(atual[0], atual[1]);
  return { ...d, situacao, proximo: datas(pa, ps, ano) };
}

/**
 * A semana de provas de um semestre, pela regra do ano letivo. "duas-ultimas-semanas": os 14 últimos dias do semestre,
 * contando o último. Regra desconhecida cai na mesma conta (e o teste avisa).
 */
export function semanaDeProvas(semestre: Pick<Semestre, "inicio" | "fim">, ano: AnoLetivo = ANO_LETIVO): { inicio: string; fim: string } {
  void ano.provas.regra;
  const inicio = somar(semestre.fim, -13);
  return { inicio: inicio < semestre.inicio ? semestre.inicio : inicio, fim: semestre.fim };
}
