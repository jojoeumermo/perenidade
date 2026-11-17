// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O trecho de um post cifrado que vai em texto aberto na denúncia. Sem "@/" de propósito (roda no Node nos testes).

/** O teto do trecho (o mesmo do banco: rede_denuncias_trecho). */
export const LIMITE_DO_TRECHO = 1000;

const juntar = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * O trecho está no texto que abriu no aparelho (com as mesmas palavras; só os espaços e as quebras de linha podem mudar)? A tela
 * só manda o que a pessoa leu: cortar pode, reescrever não. O banco não tem como conferir (não tem a chave), e a fila diz isso.
 */
export function trechoContido(aberto: string, trecho: string): boolean {
  const t = juntar(trecho);
  return t.length > 0 && t.length <= LIMITE_DO_TRECHO && juntar(aberto).includes(t);
}
