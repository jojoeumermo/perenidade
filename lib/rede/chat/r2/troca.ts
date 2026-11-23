// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A troca de cifra do chat (onda R2): o dia em que as conversas e os grupos do beta são apagados, no servidor (o SQL único,
// supabase/migracoes/20261124-r2-dupla.sql) e em cada aparelho (lib/rede/chat/r2/limpeza.ts). A tela avisa ANTES, com a data
// (texto "troca.aviso" de i18n/rede/chat), e uma vez DEPOIS, na primeira abertura.
//
// A data é decisão do Jonathan (pelo menos 7 dias depois do aviso geral pelo painel). Enquanto for null, o aviso não aparece.
// Formato: "AAAA-MM-DD" (o dia, em UTC).
export const DATA_DA_TROCA: string | null = "2026-11-23";

/** "DD/MM/AAAA" da data da troca, para os textos. */
export function dataDaTrocaNaTela(data: string | null = DATA_DA_TROCA): string | null {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

/** O aviso de antes vale até a data (e some depois dela). */
export function avisarTroca(agora = Date.now(), data: string | null = DATA_DA_TROCA): boolean {
  if (!data) return false;
  const dia = Date.parse(`${data}T00:00:00Z`);
  return Number.isFinite(dia) && agora < dia + 86_400_000;
}
