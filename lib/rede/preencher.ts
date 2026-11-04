// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Separado de textos.ts para o componente de cliente poder usar sem trazer os seis dicionários da Rede para o navegador.

/** Troca {nome} pelo valor (mesma convenção do resto do site). */
export const preencher = (texto: string, valores: Record<string, string | number>): string =>
  texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
