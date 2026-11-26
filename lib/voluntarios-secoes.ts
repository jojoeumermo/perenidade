// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Como o texto de /voluntarios vira partes e cartões; a página do site e a tela do aplicativo usam a mesma conta.

/** O texto da página em partes: a abertura e cada seção "## ". */
export function secoes(corpo: string): { abertura: string; partes: string[] } {
  const pedacos = corpo.split(/\n(?=## )/);
  const abertura = pedacos[0].startsWith("## ") ? "" : pedacos.shift()!;
  return { abertura, partes: pedacos };
}

/**
 * Uma seção com "### " vira cartões: o título, uma ou duas frases à vista e o resto em "saiba mais". Resumos do mesmo
 * tamanho deixam os cartões iguais (com o parágrafo inteiro, um cartão tinha quatro linhas e o vizinho, doze).
 */
export function funcoes(secao: string): { cabeca: string; cartoes: { titulo: string; resumo: string; resto: string }[] } | null {
  const [cabeca, ...blocos] = secao.split(/\n(?=### )/);
  if (blocos.length === 0) return null;
  return {
    cabeca,
    cartoes: blocos.map((bloco) => {
      const [linha, ...corpo] = bloco.split("\n");
      const texto = corpo.join("\n").trim();
      const fim = texto.indexOf("\n\n") === -1 ? texto.length : texto.indexOf("\n\n");
      // Fim de frase: ponto, interrogação ou exclamação seguidos de espaço, fora de lista e de link.
      let corte = -1;
      for (const m of texto.slice(0, fim).matchAll(/[.?!](?=\s)/g)) {
        corte = m.index + 1;
        if (corte >= 60) break;
      }
      if (corte === -1 || corte >= fim - 1) corte = fim;
      const resumo = texto.slice(0, corte).trim();
      return { titulo: linha.replace(/^###\s+/, "").trim(), resumo, resto: texto.slice(corte).trim() };
    }),
  };
}
