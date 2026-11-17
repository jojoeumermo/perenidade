// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os códigos de recuperação do segundo fator, do lado do aparelho: a forma (5 + 5 algarismos hexadecimais, "A1B2C-3D4E5"), a
// limpeza do que a pessoa digita (o banco limpa igual, interno.codigo_normal) e o arquivo de texto para baixar. Os códigos só
// existem na tela no momento em que são gerados: o banco guarda o resumo bcrypt (20261114-alumia-o8-conta.sql).
// Sem "@/" de propósito: roda no Node nos testes.

/** O que conta num código: só os algarismos hexadecimais, em maiúsculas (traço, espaço e minúscula não importam). */
export function normalizarCodigo(digitado: string): string {
  return digitado.replace(/[^0-9a-f]/gi, "").toUpperCase();
}

/** O código está completo (10 algarismos hexadecimais)? */
export function codigoCompleto(digitado: string): boolean {
  return normalizarCodigo(digitado).length === 10;
}

/** Como mostrar enquanto a pessoa digita: "a1b2c3" → "A1B2C-3". No máximo 10 algarismos. */
export function formatarCodigo(digitado: string): string {
  const n = normalizarCodigo(digitado).slice(0, 10);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
}

/** Os textos do arquivo (vêm de i18n/rede/seguranca/). */
export interface TextosDoArquivo {
  titulo: string;
  geradosEm: string;
  instrucoes: readonly string[];
}

/**
 * O arquivo de texto com os códigos, numerados, para guardar fora do celular. Sem nome, e-mail ou @ da pessoa: quem achar o
 * papel não fica sabendo de quem é a conta.
 */
export function arquivoDosCodigos(codigos: readonly string[], t: TextosDoArquivo, quando: string): string {
  const linhas = codigos.map((c, i) => `${String(i + 1).padStart(2, " ")}. ${c}`);
  return [t.titulo, t.geradosEm.replace("{quando}", quando), "", ...t.instrucoes, "", ...linhas, ""].join("\n");
}
