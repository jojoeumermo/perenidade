// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 48 (Prompt 4): o ritmo de estudo privado. Só neste aparelho (chave "lucia:p4-de:ritmo", que o Sair rápido apaga), nada vai ao
// servidor. A conta é por SEMANA, não por dia seguido: não existe sequência que quebra, nem número que cai porque a pessoa perdeu
// um dia. A pessoa escolhe uma meta semanal (ou nenhuma), marca o que estudou e vê só a própria semana e as quatro últimas.
// Guardamos só os minutos de cada dia das últimas 8 semanas; o que é mais velho some sozinho. Sem "@/" de propósito (roda nos testes).
import { gravarNoAparelho, lerDoAparelho, type Guarda } from "./aparelho";

export interface Ritmo {
  /** Meta da semana, em minutos (0 = sem meta). */
  meta: number;
  /** Minutos por dia (AAAA-MM-DD), só das últimas 8 semanas. */
  dias: Record<string, number>;
}

export const METAS = [0, 60, 120, 180, 300, 420, 600] as const;
export const ACRESCIMOS = [15, 30, 45, 60] as const;
export const SEMANAS_GUARDADAS = 8;
const MAXIMO_POR_DIA = 16 * 60;

const vazio = (): Ritmo => ({ meta: 0, dias: {} });

/** O dia de hoje no horário do aparelho (AAAA-MM-DD). */
export function diaDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
/** A segunda-feira da semana de um dia. */
export function segundaDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00`);
  const passo = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - passo);
  return diaDe(d);
}
function somar(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return diaDe(d);
}

export function lerRitmo(g?: Guarda | null): Ritmo {
  const r = lerDoAparelho<Ritmo>("ritmo", g);
  if (!r || typeof r !== "object") return vazio();
  const meta = (METAS as readonly number[]).includes(r.meta) ? r.meta : 0;
  const dias: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.dias ?? {})) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(v) && v > 0) dias[k] = Math.min(MAXIMO_POR_DIA, Math.round(v));
  return { meta, dias };
}

/** Tira o que passou de 8 semanas (contadas da segunda-feira da semana de hoje). */
export function podar(r: Ritmo, hoje: string): Ritmo {
  const limite = somar(segundaDe(hoje), -7 * (SEMANAS_GUARDADAS - 1));
  return { meta: r.meta, dias: Object.fromEntries(Object.entries(r.dias).filter(([k]) => k >= limite && k <= hoje)) };
}

export function escolherMeta(meta: number, hoje: string, g?: Guarda | null): Ritmo {
  const r = podar({ ...lerRitmo(g), meta: (METAS as readonly number[]).includes(meta) ? meta : 0 }, hoje);
  gravarNoAparelho("ritmo", r, g);
  return r;
}

/** Marca minutos estudados num dia (o de hoje, ou corrigir: número negativo tira). Nunca abaixo de zero nem acima de 16 h. */
export function marcar(minutos: number, hoje: string, g?: Guarda | null): Ritmo {
  const r = podar(lerRitmo(g), hoje);
  const novo = Math.max(0, Math.min(MAXIMO_POR_DIA, (r.dias[hoje] ?? 0) + Math.round(minutos)));
  if (novo) r.dias[hoje] = novo;
  else delete r.dias[hoje];
  gravarNoAparelho("ritmo", r, g);
  return r;
}

/** Apaga tudo do ritmo neste aparelho. */
export function esquecerRitmo(g?: Guarda | null): void {
  gravarNoAparelho("ritmo", null, g);
}

export interface Semana {
  segunda: string;
  minutos: number;
  dias: number;
}

/** A semana de hoje e as três anteriores: só minutos e dias com estudo. A meta é da pessoa; nada de "atrasada". */
export function resumo(r: Ritmo, hoje: string): { semana: Semana; anteriores: Semana[]; meta: number; hoje: number; metaFeita: boolean } {
  const seg = segundaDe(hoje);
  const deSemana = (s: string): Semana => {
    const fim = somar(s, 6);
    const dias = Object.entries(r.dias).filter(([k]) => k >= s && k <= fim);
    return { segunda: s, minutos: dias.reduce((a, [, v]) => a + v, 0), dias: dias.length };
  };
  const semana = deSemana(seg);
  return {
    semana,
    anteriores: [1, 2, 3].map((n) => deSemana(somar(seg, -7 * n))),
    meta: r.meta,
    hoje: r.dias[hoje] ?? 0,
    metaFeita: r.meta > 0 && semana.minutos >= r.meta,
  };
}

/** "1 h 30 min" / "45 min". */
export function tempo(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}
