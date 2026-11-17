// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A versão dos termos de uso e da política de privacidade da Alumia, e os prazos que as páginas prometem. Os mesmos números do
// banco (supabase/migracoes/20261114-alumia-o8-lei.sql: alumia_termos, interno.alumia_lei_prazo, interno.alumia_lei_prazo_recurso
// e a retenção de 24 horas); o teste (scripts/testar-alumia-o8-lei.mjs) confere que batem.
// Sem "@/" de propósito (roda no Node nos testes).

/**
 * A versão em vigor. Mudou o texto dos termos ou da política de um jeito que muda o que a pessoa aceitou? Suba o número, troque a
 * data e acrescente a mesma linha em interno.alumia_termos (com "mudou" dizendo o que mudou): quem aceitou a anterior passa pela
 * tela de reaceite. Correção de vírgula não muda a versão.
 */
export const VERSAO_DOS_TERMOS = { numero: 1, data: "2026-11-14" } as const;

/** Em quantas horas a mediação responde a uma denúncia, pela categoria. */
export const PRAZOS_DAS_DENUNCIAS = {
  menores: 24,
  ilegal: 24,
  ameaca: 24,
  exposicao: 24,
  violencia: 24,
  autolesao: 24,
  odio: 72,
  assedio: 72,
  golpe: 72,
  spam: 168,
  outro: 168,
} as const;

export type CategoriaDaDenuncia = keyof typeof PRAZOS_DAS_DENUNCIAS;

/** Em quantos dias a mediação responde a um pedido de revisão (recurso). */
export const PRAZO_DO_RECURSO_DIAS = 7;
/** Até quantos dias depois da decisão dá para pedir revisão. */
export const JANELA_DO_RECURSO_DIAS = 30;
/** Em quantas horas a mediação lê uma conta retida por precaução (denúncia de menor). */
export const PRAZO_DA_RETENCAO_HORAS = 24;

/** A data da versão escrita por extenso no idioma da página ("14 de novembro de 2026"). */
export function dataDaVersao(lang: string): string {
  const [a, m, d] = VERSAO_DOS_TERMOS.data.split("-").map(Number);
  const idioma = lang === "pt" ? "pt-BR" : lang;
  try {
    return new Intl.DateTimeFormat(idioma, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d)));
  } catch {
    return VERSAO_DOS_TERMOS.data;
  }
}
