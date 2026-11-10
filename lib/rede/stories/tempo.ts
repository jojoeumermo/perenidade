// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O tempo dos stories, puro: "3 h" ao lado do nome (prancha "ver story"), se o story ainda está no ar (24 h) e a contagem da
// figurinha do ato ("2 DIAS · 04 HORAS · 31 MIN"). Sem "@/" de propósito (roda no Node nos testes).

/** Há quanto tempo, curto: { n, unidade } ("agora", 12 min, 3 h). Datas inválidas ou futuras = agora. */
export function haQuanto(iso: string, agora: number): { n: number; unidade: "agora" | "min" | "h" | "d" } {
  const t = Date.parse(iso);
  const ms = agora - t;
  if (!Number.isFinite(ms) || ms < 60_000) return { n: 0, unidade: "agora" };
  const min = Math.floor(ms / 60_000);
  if (min < 60) return { n: min, unidade: "min" };
  const h = Math.floor(min / 60);
  if (h < 24) return { n: h, unidade: "h" };
  return { n: Math.floor(h / 24), unidade: "d" };
}

/** O story ainda está no ar? (o banco já filtra; o aparelho confere de novo, para não mostrar o que expirou com a tela aberta) */
export function noAr(expiraEm: string, agora: number): boolean {
  const t = Date.parse(expiraEm);
  return Number.isFinite(t) && t > agora;
}

/** Quanto falta para o ato, em dias, horas e minutos (a figurinha de contagem). Já começou = passou. */
export function faltaParaOAto(inicio: string, agora: number): { dias: number; horas: number; minutos: number; passou: boolean } {
  const ms = Date.parse(inicio) - agora;
  if (!Number.isFinite(ms) || ms <= 0) return { dias: 0, horas: 0, minutos: 0, passou: true };
  const total = Math.floor(ms / 60_000);
  return { dias: Math.floor(total / 1440), horas: Math.floor((total % 1440) / 60), minutos: total % 60, passou: false };
}

/** Dois dígitos ("04"). */
export const doisDigitos = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, "0");
