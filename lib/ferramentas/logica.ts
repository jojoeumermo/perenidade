// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Tabela-verdade da lógica proposicional. Conectivos, do que liga mais forte para o mais fraco: ¬ (não), ∧ (e),
// ∨ (ou), ⊕ (ou exclusivo), → (se… então) e ↔ (se e somente se). A condicional se agrupa da direita para a esquerda:
// p → q → r é p → (q → r). Também se pode escrever com palavras ou com o teclado comum: ~ ! nao, & e, | ou, xor,
// -> =>, <-> <=>. As proposições são letras minúsculas, menos "e" (o conectivo) e "v" e "f" (verdadeiro e falso).

export class ErroDeLogica extends Error {
  codigo: "vazio" | "simbolo" | "parentese" | "falta" | "muitas";
  constructor(codigo: ErroDeLogica["codigo"]) {
    super(codigo);
    this.codigo = codigo;
  }
}

export type No = { k: "var"; nome: string } | { k: "const"; valor: boolean } | { k: "nao"; dentro: No } | { k: "bin"; op: "e" | "ou" | "xou" | "se" | "sse"; a: No; b: No };

const SIMBOLO = { e: "∧", ou: "∨", xou: "⊕", se: "→", sse: "↔" } as const;

function separar(texto: string): string[] {
  const t = texto
    .toLowerCase()
    .replace(/<->|<=>|↔/g, " ↔ ")
    .replace(/->|=>|→/g, " → ")
    .replace(/[~!¬]/g, " ¬ ")
    .replace(/[&∧^]/g, " ∧ ")
    .replace(/[|∨]/g, " ∨ ")
    .replace(/[⊕⊻]/g, " ⊕ ")
    .replace(/[()]/g, (c) => ` ${c} `);
  const fichas = t.split(/\s+/).filter(Boolean);
  const palavras: Record<string, string> = { nao: "¬", não: "¬", not: "¬", e: "∧", and: "∧", ou: "∨", or: "∨", xor: "⊕", v: "1", f: "0" };
  return fichas.flatMap((f) => {
    if (palavras[f]) return [palavras[f]];
    if (/^[a-z]$/.test(f) || /^[01]$/.test(f) || "¬∧∨⊕→↔()".includes(f)) return [f];
    // Letras grudadas ("pq") viram proposições separadas só quando há operador entre elas: aqui é erro.
    throw new ErroDeLogica("simbolo");
  });
}

export function lerProposicao(texto: string): No {
  if (!texto.trim()) throw new ErroDeLogica("vazio");
  const fichas = separar(texto);
  let i = 0;
  const olhar = () => fichas[i];
  // Do mais fraco para o mais forte.
  const niveis: [string, "sse" | "se" | "xou" | "ou" | "e"][] = [["↔", "sse"], ["→", "se"], ["⊕", "xou"], ["∨", "ou"], ["∧", "e"]];
  function nivel(n: number): No {
    if (n === niveis.length) return unario();
    const [simbolo, op] = niveis[n];
    let esquerda = nivel(n + 1);
    if (op === "se") {
      // Condicional: da direita para a esquerda.
      if (olhar() === simbolo) {
        i++;
        return { k: "bin", op, a: esquerda, b: nivel(n) };
      }
      return esquerda;
    }
    while (olhar() === simbolo) {
      i++;
      esquerda = { k: "bin", op, a: esquerda, b: nivel(n + 1) };
    }
    return esquerda;
  }
  function unario(): No {
    const f = olhar();
    if (f === undefined) throw new ErroDeLogica("falta");
    if (f === "¬") {
      i++;
      return { k: "nao", dentro: unario() };
    }
    if (f === "(") {
      i++;
      const dentro = nivel(0);
      if (olhar() !== ")") throw new ErroDeLogica("parentese");
      i++;
      return dentro;
    }
    if (f === "1" || f === "0") {
      i++;
      return { k: "const", valor: f === "1" };
    }
    if (/^[a-z]$/.test(f)) {
      i++;
      return { k: "var", nome: f };
    }
    throw new ErroDeLogica(f === ")" ? "parentese" : "falta");
  }
  const arvore = nivel(0);
  if (i < fichas.length) throw new ErroDeLogica(fichas[i] === ")" ? "parentese" : "simbolo");
  return arvore;
}

export function variaveis(no: No, achadas = new Set<string>()): string[] {
  if (no.k === "var") achadas.add(no.nome);
  else if (no.k === "nao") variaveis(no.dentro, achadas);
  else if (no.k === "bin") {
    variaveis(no.a, achadas);
    variaveis(no.b, achadas);
  }
  return [...achadas].sort();
}

export function valorDe(no: No, valores: Record<string, boolean>): boolean {
  switch (no.k) {
    case "var":
      return valores[no.nome];
    case "const":
      return no.valor;
    case "nao":
      return !valorDe(no.dentro, valores);
    case "bin": {
      const a = valorDe(no.a, valores);
      const b = valorDe(no.b, valores);
      return no.op === "e" ? a && b : no.op === "ou" ? a || b : no.op === "xou" ? a !== b : no.op === "se" ? !a || b : a === b;
    }
  }
}

/** Escreve a fórmula com os símbolos da lógica e só os parênteses necessários. */
export function escrever(no: No, pai = 0): string {
  const forca = { sse: 1, se: 2, xou: 3, ou: 4, e: 5 } as const;
  if (no.k === "var") return no.nome;
  if (no.k === "const") return no.valor ? "V" : "F";
  if (no.k === "nao") return `¬${escrever(no.dentro, 6)}`;
  const f = forca[no.op];
  const texto = `${escrever(no.a, no.op === "se" ? f + 0.5 : f)} ${SIMBOLO[no.op]} ${escrever(no.b, f)}`;
  return f < pai ? `(${texto})` : texto;
}

/** As partes da fórmula, das menores para a maior, para virar colunas da tabela. */
export function subformulas(no: No): No[] {
  const lista: No[] = [];
  const visitar = (n: No) => {
    if (n.k === "nao") visitar(n.dentro);
    if (n.k === "bin") {
      visitar(n.a);
      visitar(n.b);
    }
    if (n.k !== "var" && n.k !== "const" && !lista.some((x) => escrever(x) === escrever(n))) lista.push(n);
  };
  visitar(no);
  return lista;
}

export interface Tabela {
  variaveis: string[];
  colunas: string[];
  linhas: { valores: boolean[]; resultados: boolean[] }[];
  classificacao: "tautologia" | "contradicao" | "contingencia";
}

/** Monta a tabela completa (até 6 proposições: 64 linhas) e classifica a fórmula. */
export function tabelaVerdade(texto: string): Tabela {
  const arvore = lerProposicao(texto);
  const vars = variaveis(arvore);
  if (vars.length > 6) throw new ErroDeLogica("muitas");
  const partes = subformulas(arvore);
  const linhas = Array.from({ length: 2 ** vars.length }, (_, i) => {
    // A primeira linha é toda verdadeira, como nos livros: V antes de F.
    const valores = vars.map((_, j) => ((i >> (vars.length - 1 - j)) & 1) === 0);
    const mapa = Object.fromEntries(vars.map((v, j) => [v, valores[j]]));
    return { valores, resultados: partes.map((p) => valorDe(p, mapa)) };
  });
  const finais = linhas.map((l) => (partes.length ? l.resultados[l.resultados.length - 1] : valorDe(arvore, Object.fromEntries(vars.map((v, j) => [v, l.valores[j]])))));
  const classificacao = finais.every(Boolean) ? "tautologia" : finais.some(Boolean) ? "contingencia" : "contradicao";
  return { variaveis: vars, colunas: partes.map((p) => escrever(p)), linhas, classificacao };
}
