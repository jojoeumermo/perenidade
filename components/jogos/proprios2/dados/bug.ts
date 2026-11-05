// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Fonte } from "../tipos";

export interface Passo {
  /** Linha executada (1 = primeira linha do código). */
  linha: number;
  /** O que a memória guarda depois dessa linha, no formato "nome = valor". */
  memoria: string[];
}

export interface Enigma {
  id: string;
  titulo: string;
  linguagem: "JavaScript" | "Python";
  enunciado: string;
  /** O código: cada item é uma linha. Código original do Instituto, escrito para o jogo. */
  codigo: string[];
  /** Número (1 a N) da linha com o erro. */
  linhaDoErro: number;
  /** O que o programa mostra de verdade. */
  saida: string;
  passos: Passo[];
  explicacao: string;
  correcao: string;
  /** Nulo quando o enigma é só raciocínio lógico, sem fato externo a conferir. */
  fonte: Fonte | null;
}

export const ENIGMAS: Enigma[] = [
  {
    id: "um-a-mais",
    titulo: "A soma que dá NaN",
    linguagem: "JavaScript",
    enunciado: "O programa devia mostrar a média das notas (7, 8 e 6 dá 7). Mostra NaN, que quer dizer 'não é número'.",
    codigo: ["const notas = [7, 8, 6];", "let soma = 0;", "for (let i = 0; i <= notas.length; i++) {", "  soma += notas[i];", "}", "console.log(soma / notas.length);"],
    linhaDoErro: 3,
    saida: "NaN",
    passos: [
      { linha: 2, memoria: ["notas = [7, 8, 6]", "soma = 0"] },
      { linha: 4, memoria: ["i = 2", "notas[2] = 6", "soma = 21"] },
      { linha: 4, memoria: ["i = 3", "notas[3] = undefined", "soma = NaN"] },
    ],
    explicacao: "A lista tem 3 notas, nas posições 0, 1 e 2. A condição i <= notas.length deixa o laço rodar com i = 3, uma posição que não existe: o valor é undefined e a soma vira NaN.",
    correcao: "for (let i = 0; i < notas.length; i++)",
    fonte: { nome: "Array (MDN Web Docs): listas começam na posição 0 e a última é length - 1", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array" },
  },
  {
    id: "igual-igual",
    titulo: "O estoque que 'acabou' sem acabar",
    linguagem: "JavaScript",
    enunciado: "Se a quantidade for zero, a loja avisa 'esgotado'. Mas ela avisa também quando a pessoa deixa o campo da quantidade em branco.",
    codigo: ["const quantidade = campo.value; // texto digitado", "if (quantidade == 0) {", '  aviso.textContent = "Esgotado";', "}"],
    linhaDoErro: 2,
    saida: "Esgotado (mesmo com o campo em branco)",
    passos: [{ linha: 1, memoria: ['quantidade = "" (texto vazio)'] }, { linha: 2, memoria: ['"" == 0  →  true', '"" === 0  →  false'] }],
    explicacao: "O operador == converte os tipos antes de comparar, e o texto vazio vira 0. O operador === compara sem converter: texto e número são coisas diferentes.",
    correcao: 'if (quantidade === "0")  // ou: if (Number(quantidade) === 0 && quantidade !== "")',
    fonte: { nome: "Strict equality (MDN Web Docs): === não converte tipos, == converte", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality" },
  },
  {
    id: "lista-compartilhada",
    titulo: "A lista de compras que não esquece",
    linguagem: "Python",
    enunciado: "A função devia dar uma lista nova a cada chamada. A segunda chamada devolve também o item da primeira.",
    codigo: ["def adicionar(item, lista=[]):", "    lista.append(item)", "    return lista", "", 'a = adicionar("pão")', 'b = adicionar("leite")', "print(b)"],
    linhaDoErro: 1,
    saida: "['pão', 'leite']",
    passos: [
      { linha: 1, memoria: ["lista (padrão) = []  ← criada UMA vez, quando a função é definida"] },
      { linha: 5, memoria: ["lista (padrão) = ['pão']", "a = ['pão']"] },
      { linha: 6, memoria: ["lista (padrão) = ['pão', 'leite']", "b = ['pão', 'leite']  ← é a mesma lista"] },
    ],
    explicacao: "O valor padrão do parâmetro é calculado uma vez, quando a função é definida, e a mesma lista é usada em todas as chamadas. Se ela é mudada, o padrão muda junto.",
    correcao: "def adicionar(item, lista=None):\n    if lista is None:\n        lista = []",
    fonte: { nome: "Function definitions (Python docs): o padrão é calculado uma vez", url: "https://docs.python.org/3/reference/compound_stmts.html#function-definitions" },
  },
  {
    id: "comeca-no-zero",
    titulo: "O maior número é zero?",
    linguagem: "JavaScript",
    enunciado: "O programa acha o maior número de uma lista de saldos. Com os saldos -5, -2 e -9, o maior devia ser -2. Ele mostra 0.",
    codigo: ["const saldos = [-5, -2, -9];", "let maior = 0;", "for (const s of saldos) {", "  if (s > maior) maior = s;", "}", "console.log(maior);"],
    linhaDoErro: 2,
    saida: "0",
    passos: [
      { linha: 2, memoria: ["maior = 0"] },
      { linha: 4, memoria: ["s = -5", "-5 > 0 → falso", "maior = 0"] },
      { linha: 4, memoria: ["s = -2", "-2 > 0 → falso", "maior = 0"] },
    ],
    explicacao: "Começar o maior valor em 0 só funciona se existir algum número maior que 0. Com saldos todos negativos, nenhum passa no teste e o 0, que nem está na lista, ganha. O ponto de partida não pode ser um valor inventado.",
    correcao: "let maior = saldos[0];  // começa por um valor que existe na lista",
    fonte: null,
  },
  {
    id: "apelido",
    titulo: "A cópia que não era cópia",
    linguagem: "JavaScript",
    enunciado: "Para guardar a lista original, o programa 'copia' a lista antes de acrescentar um item. Mas a original também mudou.",
    codigo: ['const original = ["Strawberry", "Mango"];', "const copia = original;", 'copia.push("Banana");', "console.log(original);"],
    linhaDoErro: 2,
    saida: '["Strawberry", "Mango", "Banana"]',
    passos: [
      { linha: 1, memoria: ['original → lista #1 ["Strawberry", "Mango"]'] },
      { linha: 2, memoria: ["copia → a mesma lista #1  (nenhuma cópia foi feita)"] },
      { linha: 3, memoria: ['lista #1 = ["Strawberry", "Mango", "Banana"]', "original e copia mostram a mesma coisa"] },
    ],
    explicacao: "Atribuir uma lista a outra variável não cria uma cópia: a nova variável é só um apelido para a mesma lista. Por isso mexer em uma mexe na outra.",
    correcao: "const copia = [...original];  // ou original.slice()",
    fonte: { nome: "Array (MDN Web Docs): atribuir não copia, é um apelido", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array" },
  },
];

/** Uma das linhas do código é o erro? Devolve verdadeiro se a linha escolhida (1 = primeira) for a do enigma. */
export function acertou(e: Enigma, linhaEscolhida: number): boolean {
  return linhaEscolhida === e.linhaDoErro;
}

export const FONTES_BUG: Fonte[] = [
  { nome: "MDN Web Docs: Array", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array" },
  { nome: "MDN Web Docs: Strict equality", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality" },
  { nome: "Python docs: Function definitions", url: "https://docs.python.org/3/reference/compound_stmts.html#function-definitions" },
];
