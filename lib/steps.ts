// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { evaluate, parse, type Node } from "./expressao";

// Resolve uma expressão numérica mostrando cada passagem, na ordem em que se faz no caderno:
// primeiro o que está dentro dos parênteses, depois potências, depois multiplicação e divisão,
// por fim soma e subtração. A leitura do texto é a do analisador único do site (lib/expressao.ts).

const rank = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 } as const;
const signs = { "+": " + ", "-": " − ", "*": " × ", "/": " ÷ ", "^": "^" } as const;
const superscripts: Record<string, string> = { "2": "²", "3": "³" };
const names: Record<string, string> = { sqrt: "√", cbrt: "∛", sin: "sen", tan: "tg", asin: "arcsen", acos: "arccos", atan: "arctg" };

/** Escreve a árvore de volta como texto, com só os parênteses necessários. */
export function show(node: Node, format: (value: number) => string, parent = 0, right = false): string {
  if (node.kind === "number") {
    const text = format(node.value).replace("-", "−");
    return node.value < 0 && parent > 0 ? `(${text})` : text;
  }
  if (node.kind === "constant") return node.name === "pi" ? "π" : "e";
  if (node.kind === "variable") return node.name;
  if (node.kind === "negative") {
    const text = `−${show(node.inner, format, 3)}`;
    return right || parent > 2 ? `(${text})` : text;
  }
  if (node.kind === "call") {
    // Raiz de outro índice volta a ser escrita como raiz(x; n), do jeito que se digita.
    if (node.name === "sqrt" && node.args.length === 2) return `raiz(${node.args.map((arg) => show(arg, format)).join("; ")})`;
    return `${names[node.name] ?? node.name}(${node.args.map((arg) => show(arg, format)).join("; ")})`;
  }
  if (node.kind === "factorial") return `${show(node.inner, format, 5)}!`;
  if (node.kind === "percent") return `${show(node.inner, format, 5)}%`;
  const mine = rank[node.op];
  const exponent = node.op === "^" && node.right.kind === "number" ? superscripts[String(node.right.value)] : undefined;
  const text = exponent ? `${show(node.left, format, 5)}${exponent}` : `${show(node.left, format, mine)}${signs[node.op]}${show(node.right, format, mine, true)}`;
  // Subtração e divisão não comutam: o lado direito de mesma força precisa de parênteses.
  const needs = mine < parent || (mine === parent && right && (parent === 1 || parent === 2)) || (parent === 5 && node.kind === "binary");
  return needs ? `(${text})` : text;
}

const simple = (node: Node): boolean => node.kind === "number" || node.kind === "constant" || (node.kind === "negative" && node.inner.kind === "number");
const number = (value: number): Node => ({ kind: "number", value, text: String(value) });

/** Faz uma única passagem: resolve a operação mais interna e mais à esquerda cujos termos já são números. */
function reduce(node: Node, degrees: boolean): [Node, boolean] {
  if (node.kind === "number" || node.kind === "variable") return [node, false];
  if (node.kind === "constant") return [number(evaluate(node)), true];
  if (node.kind === "negative") {
    if (node.inner.kind === "number") return [number(-node.inner.value), false];
    if (node.inner.kind === "constant") return [number(-evaluate(node.inner)), true];
    const [inner, done] = reduce(node.inner, degrees);
    return [{ ...node, inner }, done];
  }
  if (node.kind === "factorial" || node.kind === "percent") {
    if (simple(node.inner)) return [number(evaluate(node, { degrees })), true];
    const [inner, done] = reduce(node.inner, degrees);
    return [{ ...node, inner }, done];
  }
  if (node.kind === "call") {
    if (node.args.every(simple)) return [number(evaluate(node, { degrees })), true];
    const args = [...node.args];
    for (let i = 0; i < args.length; i++) {
      if (simple(args[i])) continue;
      const [arg, done] = reduce(args[i], degrees);
      args[i] = arg;
      if (done) return [{ ...node, args }, true];
    }
    return [{ ...node, args }, false];
  }
  if (!simple(node.left)) {
    const [left, done] = reduce(node.left, degrees);
    if (done) return [{ ...node, left }, true];
    node = { ...node, left };
  }
  if (!simple(node.right)) {
    const [right, done] = reduce(node.right, degrees);
    if (done) return [{ ...node, right }, true];
    node = { ...node, right };
  }
  return [number(evaluate(node, { degrees })), true];
}

/**
 * Devolve as linhas da conta: a expressão como foi escrita e uma linha por passagem, cada uma começando com "=".
 * Lança erro se a expressão não puder ser lida ou der um resultado que não é número.
 */
export function explain(source: string, degrees: boolean, format: (value: number) => string, variables: readonly string[] = [], scope: Record<string, number> = {}): string[] {
  let tree = parse(source, { variables });
  // Variáveis (como "ans", o resultado anterior) entram já com o valor.
  const fillIn = (node: Node): Node => {
    if (node.kind === "variable") return number(scope[node.name] ?? Number.NaN);
    if (node.kind === "binary") return { ...node, left: fillIn(node.left), right: fillIn(node.right) };
    if (node.kind === "call") return { ...node, args: node.args.map(fillIn) };
    if (node.kind === "negative" || node.kind === "factorial" || node.kind === "percent") return { ...node, inner: fillIn(node.inner) };
    return node;
  };
  tree = fillIn(tree);
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
