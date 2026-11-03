// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As marcas do aparelho que impedem a Escola de somar a mesma coisa duas vezes: cada contagem anônima (contar_escola)
// sai uma vez por período ('dia', 'mes' ou 'semestre') e aparelho. As marcas ficam em 'lucia:escola:contou' (entram na
// cópia de segurança e saem no "apagar" de Meus dados), no máximo 300; as de período que já passou saem sozinhas.
// Puro e sem os atalhos "@/" de propósito: scripts/testar-escola-banco.mjs roda este arquivo direto no Node.

export const CHAVE_DAS_MARCAS = "lucia:escola:contou";
export const MAXIMO_DE_MARCAS = 300;

export const TIPOS_DA_ESCOLA = ["escola_presenca", "escola_matricula", "escola_formatura", "escola_turma", "assembleia_voto"] as const;
export type TipoDaEscola = (typeof TIPOS_DA_ESCOLA)[number];
export type Periodo = "dia" | "mes" | "semestre";

/** O mesmo formato que o banco aceita (interno.contagens_escola). */
export const FORMATO_DO_ALVO = /^[a-z0-9/._-]{1,160}$/;

const dois = (n: number) => String(n).padStart(2, "0");

/** O período em que a data cai, no relógio do aparelho: 'd2026-11-03', 'm2026-11' ou 's2026.2'. */
export function chaveDoPeriodo(periodo: Periodo, hoje: Date): string {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  if (periodo === "dia") return `d${ano}-${dois(mes)}-${dois(hoje.getDate())}`;
  if (periodo === "mes") return `m${ano}-${dois(mes)}`;
  return `s${ano}.${mes <= 6 ? 1 : 2}`;
}

const periodoDaChave = (chave: string): Periodo | null => (chave.startsWith("d") ? "dia" : chave.startsWith("m") ? "mes" : chave.startsWith("s") ? "semestre" : null);

export const tipoValido = (tipo: string): tipo is TipoDaEscola => (TIPOS_DA_ESCOLA as readonly string[]).includes(tipo);

/** Uma marca é 'tipo|alvo|período'. */
const marca = (tipo: string, alvo: string, periodo: Periodo, hoje: Date) => `${tipo}|${alvo}|${chaveDoPeriodo(periodo, hoje)}`;

/** Lista guardada, limpa: só textos no formato de marca (qualquer outra coisa vira lista vazia). */
export function lerMarcas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((m): m is string => typeof m === "string" && m.split("|").length === 3 && m.length <= 220);
}

/** Ainda vale contar? Só tipo e alvo válidos e sem marca neste período. */
export function deveContar(marcas: unknown, tipo: string, alvo: string, periodo: Periodo, hoje: Date): boolean {
  if (!tipoValido(tipo) || !FORMATO_DO_ALVO.test(alvo)) return false;
  return !lerMarcas(marcas).includes(marca(tipo, alvo, periodo, hoje));
}

/** A lista nova: tira as marcas de período que já passou, acrescenta esta no fim e guarda as 300 mais novas. */
export function marcar(marcas: unknown, tipo: string, alvo: string, periodo: Periodo, hoje: Date): string[] {
  const nova = marca(tipo, alvo, periodo, hoje);
  const atuais = lerMarcas(marcas).filter((m) => {
    if (m === nova) return false;
    const chave = m.split("|")[2];
    const tipoDoPeriodo = periodoDaChave(chave);
    return tipoDoPeriodo !== null && chave === chaveDoPeriodo(tipoDoPeriodo, hoje);
  });
  return [...atuais, nova].slice(-MAXIMO_DE_MARCAS);
}
