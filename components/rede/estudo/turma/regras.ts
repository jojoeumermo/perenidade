// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras da turma de estudo (frente 11C, L2-43) que a tela e o teste leem: as mesmas de
// supabase/migracoes/20261117-alumia-o11-turma.sql. Puro: sem React e sem chamada ao banco (scripts/testar-alumia-o11-turma.mjs
// importa daqui e confere com o SQL). Sem os atalhos "@/" de propósito.
//
// O princípio: a turma vê só o TOTAL da semana, e só a partir de 3. Nada aqui devolve quem marcou, quem não marcou ou quem
// está na turma. Semana fraca não vira palavra nenhuma ("atrasado", "faltou"): o ladrilho só fica apagado.

/** O menor número de pessoas que aparece escrito (o mesmo de lib/rede/publicar/alumia2.ts e da regra do banco). */
export const MINIMO = 3;

export const LIMITES_DA_TURMA = {
  nomeMin: 3,
  nome: 60,
  metaMin: 3,
  meta: 120,
  pessoas: 12,
  turmasPorPessoa: 5,
  /** Quantas semanas fechadas a fileira do mosaico mostra. */
  semanas: 8,
} as const;

/** Combinados de exemplo, só como sugestão no campo (a turma escreve o dela). */
export const COMBINADOS_DE_EXEMPLO = ["1 redação por semana", "3 listas de exercícios por semana", "1 simulado por semana"] as const;

export interface SemanaFechada {
  /** A segunda-feira da semana, AAAA-MM-DD. */
  semana: string;
  /** Quantas pessoas cumpriram, só com ao menos 3 que cumpriram e 3 que não (fora disso, nulo). */
  total: number | null;
}

export interface Turma {
  id: string;
  nome: string;
  meta: string;
  codigo: string;
  cuida: boolean;
  /** Quantas pessoas estão na turma, só a partir de 3. */
  pessoas: number | null;
  /** A segunda-feira da semana que está correndo. */
  semana: string;
  marquei: boolean;
  /** O total desta semana pelo marco de 15 minutos, só com ao menos 3 que marcaram e 3 que não (fora disso, nulo). */
  total: number | null;
  semanas: SemanaFechada[];
}

/** O código como o banco procura: só letras e números, em minúsculas. Devolve "" se não pode ser um código. */
export function limparCodigo(texto: string): string {
  const limpo = texto.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return /^[a-z0-9]{10}$/.test(limpo) ? limpo : "";
}

/** O código lido de um endereço colado (…/alumia/turmas?codigo=xxxx) ou do próprio código. */
export function codigoDoTexto(texto: string): string {
  const achado = /[?&]codigo=([A-Za-z0-9]{10})\b/.exec(texto);
  return limparCodigo(achado ? achado[1] : texto);
}

const dois = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;

/** A segunda-feira (AAAA-MM-DD) da semana em que cai este instante, no horário de Brasília (UTC−3, sem horário de verão). */
export function segundaDe(instante: Date | number): string {
  const brasilia = new Date((typeof instante === "number" ? instante : instante.getTime()) - 3 * 3_600_000);
  const dia = brasilia.getUTCDay();
  brasilia.setUTCDate(brasilia.getUTCDate() - ((dia + 6) % 7));
  return iso(brasilia);
}

/** A data AAAA-MM-DD somada de n dias. */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  return iso(new Date(Date.UTC(a, m - 1, d + n)));
}

/**
 * A fileira do mosaico: as últimas semanas FECHADAS (da mais antiga para a mais nova), uma por ladrilho. Semana sem linha no
 * banco é semana sem total escrito (nulo): o ladrilho fica apagado, sem palavra nenhuma.
 */
export function fileiraDeSemanas(semanas: readonly SemanaFechada[], atual: string, quantas: number = LIMITES_DA_TURMA.semanas): SemanaFechada[] {
  const porSemana = new Map(semanas.map((s) => [s.semana, s.total]));
  const fileira: SemanaFechada[] = [];
  for (let i = quantas; i >= 1; i--) {
    const semana = somarDias(atual, -7 * i);
    const total = porSemana.get(semana);
    fileira.push({ semana, total: typeof total === "number" && total >= MINIMO ? total : null });
  }
  return fileira;
}

/** O endereço de convite da turma (o código vai no endereço; quem abre entra pelo botão, nunca sozinho). */
export function enderecoDoConvite(origem: string, lang: string, codigo: string): string {
  return `${origem.replace(/\/$/, "")}/${lang}/alumia/turmas?codigo=${codigo}`;
}

/** O dia e o mês de uma data AAAA-MM-DD ("08/11"). */
export function diaEMes(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}
