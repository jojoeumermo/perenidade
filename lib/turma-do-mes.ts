// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A turma do mês: no dia 1, uma trilha começa para quem quiser estudar junto. Oito aulas em quatro semanas, duas
// por semana, e um encontro por semana na sala de vídeo (o banco sorteia a sala e só a entrega a quem entrou na
// turma). A trilha sai sozinha (mesmo passo do lambe-lambe do dia, para meses seguidos não repetirem área); a
// coordenação pode fixar outra em content/turmas.json ({"2026-11": "slug"}).
import fs from "node:fs";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import { getTracks } from "./content";
import { lambeDoDia } from "./lambe-do-dia";

export interface TurmaDoMes {
  /** AAAA-MM */
  mes: string;
  trilha: string;
  titulo: string;
  resumo: string;
  area: string;
  semanas: { inicio: string; encontro: string; aulas: { slug: string; titulo: string; minutos: number }[] }[];
}

const AULAS = 8;

function escolhidas(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "turmas.json"), "utf8"));
  } catch {
    return {};
  }
}

/** O mês de hoje em Brasília, e o seguinte. */
export function mesesDaTurma(agora = new Date()): [string, string] {
  const [ano, mes] = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(agora).split("-").map(Number);
  const seguinte = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
  return [`${ano}-${String(mes).padStart(2, "0")}`, seguinte];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function turmaDoMes(lang: Locale, mes: string): TurmaDoMes | null {
  const trilhas = getTracks(lang)
    .filter((t) => t.lessons.filter((l) => l.summary).length >= AULAS)
    .sort((a, b) => a.slug.localeCompare(b.slug));
  if (trilhas.length === 0) return null;
  const [ano, m] = mes.split("-").map(Number);
  const fixada = escolhidas()[mes];
  const trilha = trilhas.find((t) => t.slug === fixada) ?? trilhas[lambeDoDia(ano * 12 + m, trilhas.length)];
  const aulas = trilha.lessons.filter((l) => l.summary).slice(0, AULAS);
  const semanas = Array.from({ length: 4 }, (_, i) => {
    const inicio = new Date(Date.UTC(ano, m - 1, 1 + i * 7));
    // O encontro é na primeira quarta-feira a partir do começo da semana da turma.
    const encontro = new Date(inicio);
    encontro.setUTCDate(inicio.getUTCDate() + ((3 - inicio.getUTCDay() + 7) % 7));
    return { inicio: iso(inicio), encontro: iso(encontro), aulas: aulas.slice(i * 2, i * 2 + 2).map((a) => ({ slug: a.slug, titulo: a.title, minutos: a.minutes })) };
  });
  return { mes, trilha: trilha.slug, titulo: trilha.title, resumo: trilha.summary, area: trilha.area, semanas };
}
