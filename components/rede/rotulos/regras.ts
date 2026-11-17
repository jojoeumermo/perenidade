// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os números e as listas fechadas da frente de rótulos e transparência, num lugar só. São os mesmos de
// supabase/migracoes/20261115-alumia-o9-transparencia.sql: o teste (scripts/testar-alumia-o9-transparencia.mjs) confere um contra o
// outro. Sem os atalhos "@/" de propósito (roda no Node nos testes).

/** A lista fechada de rótulos. Nenhum rotulador escreve rótulo livre. */
export const ROTULOS = ["assedio_coordenado", "golpe", "spam", "perfil_falso", "discurso_de_odio"] as const;
export type Rotulo = (typeof ROTULOS)[number];

/** O que quem assina escolhe: "avisar" (tarja no cartão) ou "esconder" (a lista de bloqueio assinável). */
export const EFEITOS = ["avisar", "esconder"] as const;
export type Efeito = (typeof EFEITOS)[number];

/** Os tipos de órgão público de um pedido de autoridade. */
export const ORGAOS = ["judiciario", "policia", "ministerio_publico", "eleitoral", "administrativo", "estrangeiro", "outro"] as const;
export type Orgao = (typeof ORGAOS)[number];

/** O que o órgão pediu. */
export const PEDIDOS = ["dados_de_conta", "identificar_autor", "retirar_conteudo", "preservar_dados", "outro"] as const;
export type PedidoDeAutoridade = (typeof PEDIDOS)[number];

/** O que a coordenação respondeu. */
export const RESPOSTAS = ["em_analise", "atendido", "atendido_em_parte", "recusado", "sem_dados"] as const;
export type Resposta = (typeof RESPOSTAS)[number];

/** As categorias de denúncia, na ordem do relatório. */
export const CATEGORIAS_DO_RELATORIO = ["menores", "ameaca", "exposicao", "violencia", "autolesao", "odio", "assedio", "golpe", "spam", "ilegal", "outro"] as const;
export type CategoriaDoRelatorio = (typeof CATEGORIAS_DO_RELATORIO)[number];

/** O aviso de ordem sigilosa vale 90 dias a partir da última renovação. */
export const PRAZO_DO_AVISO_DIAS = 90;

/** O relatório de um trimestre sai 15 dias depois de o trimestre acabar. */
export const FOLGA_DO_RELATORIO_DIAS = 15;

/** A frase que a coordenação escreve para renovar o aviso (o banco não liga para maiúsculas, acentos e espaços). */
export const FRASE_DO_AVISO = "NÃO RECEBEMOS ORDEM SIGILOSA";

/**
 * Um número do relatório: o banco manda o número (3 ou mais), "menos_de_3" ou "reservado" (3 ou mais, escondido para que um número
 * pequeno do mesmo grupo não saia pela subtração). Devolve o número, ou nulo quando não há número para mostrar.
 */
export type NumeroDoRelatorio = number | "menos_de_3" | "reservado";
export function numeroDoRelatorio(n: NumeroDoRelatorio | undefined | null): number | null {
  return typeof n === "number" && n >= 3 ? n : null;
}

/** O número em texto: o número, "sem número" (reservado) ou "menos de 3". */
export function textoDoNumero(n: NumeroDoRelatorio | undefined | null, t: { menosDe3: string; reservado: string }): string | number {
  return numeroDoRelatorio(n) ?? (n === "reservado" ? t.reservado : t.menosDe3);
}
