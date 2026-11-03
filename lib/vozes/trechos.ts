// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// As regras puras do "Ouvir a aula" (sem DOM, para `npm run testar:vozes`): em que trecho (parágrafo, item de lista,
// título) cai cada frase, e com que voz cada frase sai.
//
// A leitura começa na hora com a voz do aparelho (speechSynthesis) enquanto a voz natural abre. Quando a voz natural
// fica pronta, ela entra no começo do próximo trecho, nunca no meio de um parágrafo: a troca de voz no meio da frase
// ou do parágrafo confunde quem está ouvindo.

/**
 * O número do trecho de cada frase. `texto` é o texto coletado da aula, com uma quebra de linha entre os blocos
 * (parágrafo, item de lista, título…); `frases` são os pedaços dele, na ordem. Uma quebra de linha entre o fim de uma
 * frase e o começo da seguinte abre um trecho novo.
 */
export function marcarTrechos(texto: string, frases: readonly { ini: number; fim: number }[]): number[] {
  const trechos: number[] = [];
  let atual = -1;
  let fimAnterior = 0;
  for (const [k, f] of frases.entries()) {
    if (k === 0 || texto.slice(fimAnterior, f.ini).includes("\n")) atual++;
    trechos.push(atual);
    fimAnterior = f.fim;
  }
  return trechos;
}

export type QualVoz = "natural" | "aparelho" | "esperar";

export type Situacao = {
  /** A voz natural está aberta e serve para o idioma desta frase. */
  naturalPronta: boolean;
  /** O som desta frase, na voz natural, já foi gerado. */
  somPronto: boolean;
  /** A frase abre um trecho, ou a pessoa pulou para ela (voltar, avançar, trocar a voz). */
  abreTrecho: boolean;
  /** A voz que estava lendo o trecho até aqui (null: a leitura acabou de começar). */
  vozAtual: "natural" | "aparelho" | null;
  /** O aparelho tem voz e ela está falando (não falhou nesta leitura). */
  aparelhoFala: boolean;
};

/**
 * Com que voz sai a frase:
 * - sem a voz natural pronta, a do aparelho; sem nenhuma das duas, espera a natural abrir;
 * - a voz natural, uma vez no trecho, continua até o fim da leitura (se o som atrasa, espera por ele);
 * - a voz do aparelho cede o lugar no começo de um trecho, quando o som da natural já está pronto (assim a troca
 *   não deixa silêncio); se o aparelho não fala, a natural entra logo, mesmo que precise esperar o som.
 */
export function escolherVoz(s: Situacao): QualVoz {
  if (!s.naturalPronta) return s.aparelhoFala ? "aparelho" : "esperar";
  if (s.vozAtual === "natural" || !s.aparelhoFala) return "natural";
  if (s.abreTrecho && s.somPronto) return "natural";
  return "aparelho";
}

/** O índice da primeira frase do próximo trecho depois da frase `i` (ou -1, se não há). */
export function proximoTrecho(trechos: readonly number[], i: number): number {
  for (let j = i + 1; j < trechos.length; j++) if (trechos[j] !== trechos[i]) return j;
  return -1;
}
