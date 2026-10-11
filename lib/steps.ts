// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Resolve uma expressão numérica mostrando cada passagem, na ordem em que se faz no caderno:
// primeiro o que está dentro dos parênteses, depois potências, depois multiplicação e divisão,
// por fim soma e subtração. O texto nunca é executado como código: é lido símbolo a símbolo.

type Node =
  | { kind: "number"; value: number }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Node; right: Node }
  | { kind: "negative"; inner: Node }
  | { kind: "call"; name: string; inner: Node }
  | { kind: "factorial"; inner: Node };

const functions: Record<string, (value: number, degrees: boolean) => number> = {
  sqrt: Math.sqrt,
  raiz: Math.sqrt,
  sin: (value, degrees) => Math.sin(degrees ? (value * Math.PI) / 180 : value),
  sen: (value, degrees) => Math.sin(degrees ? (value * Math.PI) / 180 : value),
  cos: (value, degrees) => Math.cos(degrees ? (value * Math.PI) / 180 : value),
  tan: (value, degrees) => Math.tan(degrees ? (value * Math.PI) / 180 : value),
  tg: (value, degrees) => Math.tan(degrees ? (value * Math.PI) / 180 : value),
  log: Math.log10,
  ln: Math.log,
  abs: Math.abs,
};

function parse(source: string): Node {
  const text = source.toLowerCase().replace(/\s+/g, "").replace(/,/g, ".").replace(/×/g, "*").replace(/[÷:]/g, "/").replace(/−/g, "-").replace(/π/g, "pi").replace(/√/g, "sqrt").replace(/²/g, "^2").replace(/³/g, "^3");
  let at = 0;

  function expression(): Node {
    let node = term();
    while (text[at] === "+" || text[at] === "-") node = { kind: "binary", op: text[at++] as "+" | "-", left: node, right: term() };
    return node;
  }
  function term(): Node {
    let node = unary();
    while (text[at] === "*" || text[at] === "/") node = { kind: "binary", op: text[at++] as "*" | "/", left: node, right: unary() };
    return node;
  }
  function unary(): Node {
    if (text[at] === "-") return at++, { kind: "negative", inner: unary() };
    if (text[at] === "+") return at++, unary();
    return power();
  }
  function power(): Node {
    const base = postfix();
    if (text[at] !== "^") return base;
    at++;
    return { kind: "binary", op: "^", left: base, right: unary() };
  }
  function postfix(): Node {
    let node = atom();
    while (text[at] === "!") {
      at++;
      node = { kind: "factorial", inner: node };
    }
    return node;
  }
  function atom(): Node {
    if (text[at] === "(") {
      at++;
      const node = expression();
      if (text[at++] !== ")") throw new Error("parêntese");
      return node;
    }
    const digits = /^\d+(\.\d+)?|^\.\d+/.exec(text.slice(at));
    if (digits) {
      at += digits[0].length;
      return { kind: "number", value: Number(digits[0]) };
    }
    const word = /^[a-z]+/.exec(text.slice(at))?.[0];
    if (!word) throw new Error("símbolo");
    at += word.length;
    if (word === "pi") return { kind: "number", value: Math.PI };
    if (word === "e") return { kind: "number", value: Math.E };
    if (!Object.hasOwn(functions, word) || text[at] !== "(") throw new Error("nome");
    return { kind: "call", name: word, inner: atom() };
  }

  const tree = expression();
  if (at < text.length) throw new Error("expressão");
  return tree;
}

const rank = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 } as const;
const signs = { "+": " + ", "-": " − ", "*": " × ", "/": " ÷ ", "^": "^" } as const;
const superscripts: Record<string, string> = { "2": "²", "3": "³" };

function show(node: Node, format: (value: number) => string, parent = 0, right = false): string {
  if (node.kind === "number") {
    const text = format(node.value).replace("-", "−");
    return node.value < 0 && parent > 0 ? `(${text})` : text;
  }
  if (node.kind === "negative") {
    const text = `−${show(node.inner, format, 3)}`;
    return right || parent > 2 ? `(${text})` : text;
  }
  if (node.kind === "call") return `${node.name === "sqrt" || node.name === "raiz" ? "√" : node.name}(${show(node.inner, format)})`;
  if (node.kind === "factorial") return `${show(node.inner, format, 5)}!`;
  const mine = rank[node.op];
  const exponent = node.op === "^" && node.right.kind === "number" ? superscripts[String(node.right.value)] : undefined;
  const text = exponent ? `${show(node.left, format, 5)}${exponent}` : `${show(node.left, format, mine)}${signs[node.op]}${show(node.right, format, mine, true)}`;
  // Subtração e divisão não comutam: o lado direito de mesma força precisa de parênteses.
  const needs = mine < parent || (mine === parent && right && (parent === 1 || parent === 2)) || (parent === 5 && node.kind === "binary");
  return needs ? `(${text})` : text;
}

function compute(node: Node, degrees: boolean): number {
  if (node.kind === "number") return node.value;
  if (node.kind === "negative") return -compute(node.inner, degrees);
  if (node.kind === "call") return functions[node.name](compute(node.inner, degrees), degrees);
  if (node.kind === "factorial") {
    const n = compute(node.inner, degrees);
    if (!Number.isInteger(n) || n < 0 || n > 170) return Number.NaN;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }
  const a = compute(node.left, degrees);
  const b = compute(node.right, degrees);
  return node.op === "+" ? a + b : node.op === "-" ? a - b : node.op === "*" ? a * b : node.op === "/" ? a / b : a ** b;
}

const simple = (node: Node): boolean => node.kind === "number" || (node.kind === "negative" && node.inner.kind === "number");

/** Faz uma única passagem: resolve a operação mais interna e mais à esquerda cujos termos já são números. */
function reduce(node: Node, degrees: boolean): [Node, boolean] {
  if (node.kind === "number") return [node, false];
  if (node.kind === "negative") {
    if (node.inner.kind === "number") return [{ kind: "number", value: -node.inner.value }, false];
    const [inner, done] = reduce(node.inner, degrees);
    return [{ ...node, inner }, done];
  }
  if (node.kind === "call" || node.kind === "factorial") {
    if (simple(node.inner)) return [{ kind: "number", value: compute(node, degrees) }, true];
    const [inner, done] = reduce(node.inner, degrees);
    return [{ ...node, inner }, done];
  }
  if (!simple(node.left)) {
    const [left, done] = reduce(node.left, degrees);
    if (done) return [{ ...node, left }, true];
  }
  if (!simple(node.right)) {
    const [right, done] = reduce(node.right, degrees);
    if (done) return [{ ...node, right }, true];
  }
  return [{ kind: "number", value: compute(node, degrees) }, true];
}

/**
 * Devolve as linhas da conta: a expressão como foi escrita e uma linha por passagem, cada uma começando com "=".
 * Lança erro se a expressão não puder ser lida ou der um resultado que não é número.
 */
export function explain(source: string, degrees: boolean, format: (value: number) => string): string[] {
  let tree = parse(source);
  const lines = [show(tree, format)];
  for (let i = 0; i < 60 && tree.kind !== "number"; i++) {
    const [next, done] = reduce(tree, degrees);
    tree = next;
    if (!done && tree.kind !== "number") continue;
    const line = `= ${show(tree, format)}`;
    if (line !== lines[lines.length - 1] && line !== `= ${lines[0]}`) lines.push(line);
  }
  if (tree.kind !== "number" || !Number.isFinite(tree.value)) throw new Error("expressão");
  return lines;
}
