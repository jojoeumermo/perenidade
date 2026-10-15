// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// O analisador de expressões do site, um só para a calculadora, os gráficos e o resolvedor.
// O texto nunca é executado como código: é lido símbolo a símbolo, vira uma árvore e a árvore é calculada.
// Só números, operadores, parênteses e os nomes das listas abaixo são aceitos; qualquer outra coisa é erro.

export type BinaryOp = "+" | "-" | "*" | "/" | "^";

export type Node =
  | { kind: "number"; value: number; text: string }
  | { kind: "constant"; name: "pi" | "e" }
  | { kind: "variable"; name: string }
  | { kind: "negative"; inner: Node }
  | { kind: "binary"; op: BinaryOp; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] }
  | { kind: "factorial"; inner: Node }
  | { kind: "percent"; inner: Node };

export type ErrorCode = "vazio" | "parentese" | "simbolo" | "nome" | "funcao" | "argumentos" | "divisao" | "dominio" | "grande";

/** Erro de leitura ou de conta, com a posição no texto (para a tela apontar onde está o problema). */
export class ExprError extends Error {
  code: ErrorCode;
  at: number;
  constructor(code: ErrorCode, at = -1) {
    super(code);
    this.code = code;
    this.at = at;
  }
}

/** Nome canônico de cada função e quantos argumentos ela aceita. Os apelidos cobrem o jeito de escrever de cada idioma. */
const FUNCTIONS: Record<string, { name: string; min: number; max: number }> = {};
function define(name: string, aliases: string[], min = 1, max = 1) {
  for (const alias of [name, ...aliases]) FUNCTIONS[alias] = { name, min, max };
}
define("sqrt", ["raiz", "√"], 1, 2);
define("cbrt", ["∛"]);
define("sin", ["sen"]);
define("cos", []);
define("tan", ["tg"]);
define("asin", ["arcsin", "asen", "arcsen"]);
define("acos", ["arccos"]);
define("atan", ["arctan", "arctg", "atg"]);
define("sinh", ["senh"]);
define("cosh", []);
define("tanh", ["tgh"]);
define("log", [], 1, 2);
define("ln", []);
define("exp", []);
define("abs", []);

const CONSTANTS: Record<string, "pi" | "e"> = { pi: "pi", π: "pi", e: "e" };

export const functionNames = Object.keys(FUNCTIONS).filter((name) => /^[a-z]+$/.test(name));

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

type Token = { type: "num"; text: string; at: number } | { type: "name"; text: string; at: number } | { type: "op"; text: string; at: number };

/** Troca os símbolos tipográficos pelos de teclado, sem mudar o comprimento (as posições continuam valendo). */
function normalize(source: string): string {
  return source
    .replace(/[×·⋅∙]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/\*\*/g, "^ ");
}

function tokenize(source: string, known: Set<string>): Token[] {
  const text = normalize(source);
  const tokens: Token[] = [];
  let at = 0;
  while (at < text.length) {
    const char = text[at];
    if (/\s/.test(char)) {
      at++;
      continue;
    }
    // Número: a vírgula e o ponto separam as casas decimais ("2,5" e "2.5" valem o mesmo).
    const number = /^(\d+([.,]\d+)?|[.,]\d+)/.exec(text.slice(at));
    if (number) {
      tokens.push({ type: "num", text: number[0].replace(",", "."), at });
      at += number[0].length;
      continue;
    }
    // Expoente escrito pequeno ("x²", "10⁻³") é uma potência como outra qualquer.
    const small = /^⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/.exec(text.slice(at));
    if (small) {
      const digits = [...small[0].replace("⁻", "")].map((digit) => SUPERSCRIPT.indexOf(digit)).join("");
      tokens.push({ type: "op", text: "^", at });
      if (small[0].startsWith("⁻")) tokens.push({ type: "op", text: "-", at });
      tokens.push({ type: "num", text: digits, at });
      at += small[0].length;
      continue;
    }
    if (char === "√" || char === "∛" || char === "π") {
      tokens.push({ type: "name", text: char, at });
      at++;
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      // Um bloco de letras pode juntar nomes ("2xsen(x)"): separa pelo nome conhecido mais comprido.
      const word = /^[a-zA-Z]+/.exec(text.slice(at))![0].toLowerCase();
      let i = 0;
      while (i < word.length) {
        let size = 0;
        for (let length = word.length - i; length > 0; length--) {
          if (known.has(word.slice(i, i + length))) {
            size = length;
            break;
          }
        }
        if (!size) throw new ExprError("nome", at + i);
        tokens.push({ type: "name", text: word.slice(i, i + size), at: at + i });
        i += size;
      }
      at += word.length;
      continue;
    }
    // A vírgula solta (fora de um número) e o ponto e vírgula separam os argumentos de uma função.
    if (char === ";" || char === ",") {
      tokens.push({ type: "op", text: ";", at });
      at++;
      continue;
    }
    if ("+-*/^()!%|".includes(char)) {
      tokens.push({ type: "op", text: char, at });
      at++;
      continue;
    }
    throw new ExprError("simbolo", at);
  }
  return tokens;
}

export interface ParseOptions {
  /** Letras aceitas como variável ("x" nos gráficos, "x" e "y" no resolvedor, "ans" na calculadora). */
  variables?: readonly string[];
}

/** Lê a expressão e devolve a árvore. Lança ExprError se o texto não for uma conta válida. */
export function parse(source: string, options: ParseOptions = {}): Node {
  const variables = new Set(options.variables ?? []);
  const known = new Set([...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS), ...variables]);
  const tokens = tokenize(source, known);
  if (tokens.length === 0) throw new ExprError("vazio", 0);
  let at = 0;
  let bars = 0;
  const peek = () => tokens[at];
  const end = () => (tokens[at - 1] ? tokens[at - 1].at + tokens[at - 1].text.length : source.length);
  const isOp = (text: string) => peek()?.type === "op" && peek()!.text === text;

  function expression(): Node {
    let node = term();
    while (isOp("+") || isOp("-")) {
      const op = tokens[at++].text as "+" | "-";
      node = { kind: "binary", op, left: node, right: term() };
    }
    return node;
  }

  // Multiplicação sem sinal ("2x", "3(x + 1)", "(x + 1)(x − 1)") vale o mesmo que com o sinal.
  function startsImplicit(): boolean {
    const token = peek();
    if (!token) return false;
    if (token.type === "name") return true;
    if (token.type === "op") return token.text === "(" || (token.text === "|" && bars === 0);
    return false;
  }

  function term(): Node {
    let node = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = tokens[at++].text as "*" | "/";
        node = { kind: "binary", op, left: node, right: unary() };
      } else if (startsImplicit()) {
        node = { kind: "binary", op: "*", left: node, right: power() };
      } else return node;
    }
  }

  // O sinal de menos vale menos que a potência: −2² é −4, como no caderno.
  function unary(): Node {
    if (isOp("-")) {
      at++;
      return { kind: "negative", inner: unary() };
    }
    if (isOp("+")) {
      at++;
      return unary();
    }
    return power();
  }

  // Potência de potência se resolve da direita para a esquerda: 2^3^2 é 2^9.
  function power(): Node {
    const base = postfix();
    if (!isOp("^")) return base;
    at++;
    return { kind: "binary", op: "^", left: base, right: unary() };
  }

  function postfix(): Node {
    let node = atom();
    while (isOp("!") || isOp("%")) node = tokens[at++].text === "!" ? { kind: "factorial", inner: node } : { kind: "percent", inner: node };
    return node;
  }

  function atom(): Node {
    const token = peek();
    if (!token) throw new ExprError("vazio", end());
    if (token.type === "num") {
      at++;
      return { kind: "number", value: Number(token.text), text: token.text };
    }
    if (token.type === "op") {
      if (token.text === "(") {
        at++;
        const node = expression();
        if (!isOp(")")) throw new ExprError("parentese", peek()?.at ?? end());
        at++;
        return node;
      }
      if (token.text === "|" && bars === 0) {
        at++;
        bars++;
        const inner = expression();
        bars--;
        if (!isOp("|")) throw new ExprError("parentese", peek()?.at ?? end());
        at++;
        return { kind: "call", name: "abs", args: [inner] };
      }
      throw new ExprError(token.text === ")" ? "parentese" : "simbolo", token.at);
    }
    at++;
    if (Object.hasOwn(CONSTANTS, token.text)) return { kind: "constant", name: CONSTANTS[token.text] };
    if (variables.has(token.text)) return { kind: "variable", name: token.text };
    const fn = FUNCTIONS[token.text];
    if (!fn) throw new ExprError("nome", token.at);
    // Sem parênteses, a função pega o que vem logo depois: "sen 30", "√2", "log 100".
    if (!isOp("(")) return { kind: "call", name: fn.name, args: [unary()] };
    at++;
    const args = [expression()];
    while (isOp(";")) {
      at++;
      args.push(expression());
    }
    if (!isOp(")")) throw new ExprError("parentese", peek()?.at ?? end());
    at++;
    if (args.length < fn.min || args.length > fn.max) throw new ExprError("argumentos", token.at);
    return { kind: "call", name: fn.name, args };
  }

  const tree = expression();
  if (at < tokens.length) {
    const token = tokens[at];
    throw new ExprError(token.text === ")" ? "parentese" : token.text === ";" ? "argumentos" : "simbolo", token.at);
  }
  return tree;
}

export interface EvalOptions {
  /** Ângulos em graus (o padrão da escola) ou em radianos. */
  degrees?: boolean;
  scope?: Record<string, number>;
  /** Na calculadora, divisão por zero e conta fora do domínio viram erro com nome; nos gráficos, só um buraco na curva. */
  strict?: boolean;
}

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return Number.NaN;
  if (n > 170) return Number.POSITIVE_INFINITY;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

const TURN = 360;

/** Seno e cosseno em graus, exatos nos ângulos notáveis: sen 180° dá 0, não 0,000000000000000122. */
function trig(name: "sin" | "cos" | "tan", value: number, degrees: boolean): number {
  if (degrees) {
    const angle = ((value % TURN) + TURN) % TURN;
    if (Number.isInteger(angle) && angle % 90 === 0) {
      const quarter = angle / 90;
      const sin = [0, 1, 0, -1][quarter];
      const cos = [1, 0, -1, 0][quarter];
      if (name === "sin") return sin;
      if (name === "cos") return cos;
      return cos === 0 ? Number.NaN : sin / cos || 0;
    }
    value = (value * Math.PI) / 180;
  }
  const result = name === "sin" ? Math.sin(value) : name === "cos" ? Math.cos(value) : Math.tan(value);
  // Restos de arredondamento da máquina (sen π = 1,2·10⁻¹⁶) viram o zero que a conta de verdade dá.
  return Math.abs(result) < 1e-15 ? 0 : result;
}

function inverse(value: number, degrees: boolean): number {
  return degrees ? (value * 180) / Math.PI : value;
}

function root(value: number, index: number): number {
  if (!Number.isInteger(index) || index === 0) return index === 0 ? Number.NaN : value ** (1 / index);
  // Raiz de índice ímpar de número negativo existe nos reais: ∛−8 = −2.
  if (value < 0) return index % 2 !== 0 ? -((-value) ** (1 / index)) : Number.NaN;
  const result = value ** (1 / index);
  // Corrige o arredondamento da máquina quando a raiz é exata (∛27 = 3, não 3,0000000000000004).
  const rounded = Math.round(result);
  return rounded ** index === value ? rounded : result;
}

function call(name: string, args: number[], degrees: boolean): number {
  const [a, b] = args;
  switch (name) {
    case "sqrt":
      return args.length === 2 ? root(a, b) : a < 0 ? Number.NaN : Math.sqrt(a);
    case "cbrt":
      return root(a, 3);
    case "sin":
    case "cos":
    case "tan":
      return trig(name, a, degrees);
    case "asin":
      return a < -1 || a > 1 ? Number.NaN : inverse(Math.asin(a), degrees);
    case "acos":
      return a < -1 || a > 1 ? Number.NaN : inverse(Math.acos(a), degrees);
    case "atan":
      return inverse(Math.atan(a), degrees);
    case "sinh":
      return Math.sinh(a);
    case "cosh":
      return Math.cosh(a);
    case "tanh":
      return Math.tanh(a);
    case "log":
      if (args.length === 2) return a <= 0 || b <= 0 || b === 1 ? Number.NaN : Math.log(a) / Math.log(b);
      return a <= 0 ? Number.NaN : Math.log10(a);
    case "ln":
      return a <= 0 ? Number.NaN : Math.log(a);
    case "exp":
      return Math.exp(a);
    case "abs":
      return Math.abs(a);
  }
  throw new ExprError("funcao");
}

/** Calcula a árvore. Fora do modo estrito, conta impossível devolve NaN (para os gráficos deixarem um buraco). */
export function evaluate(node: Node, options: EvalOptions = {}): number {
  const degrees = options.degrees ?? false;
  const scope = options.scope ?? {};
  const strict = options.strict ?? false;
  const check = (value: number) => {
    if (strict && Number.isNaN(value)) throw new ExprError("dominio");
    return value;
  };

  function run(node: Node): number {
    switch (node.kind) {
      case "number":
        return node.value;
      case "constant":
        return node.name === "pi" ? Math.PI : Math.E;
      case "variable":
        return scope[node.name] ?? Number.NaN;
      case "negative":
        return -run(node.inner);
      case "factorial":
        return check(factorial(run(node.inner)));
      case "percent":
        return run(node.inner) / 100;
      case "call":
        return check(call(node.name, node.args.map(run), degrees));
      case "binary": {
        const a = run(node.left);
        const b = run(node.right);
        if (node.op === "+") return a + b;
        if (node.op === "-") return a - b;
        if (node.op === "*") return a * b;
        if (node.op === "/") {
          if (b === 0 && strict) throw new ExprError("divisao");
          return b === 0 ? Number.NaN : a / b;
        }
        // Potência de base negativa com expoente fracionário não existe nos reais, a não ser em raízes ímpares
        // escritas como fração: (−8)^(1/3) = −2 e (−8)^(2/3) = 4.
        if (a < 0 && !Number.isInteger(b)) {
          if (node.right.kind === "binary" && node.right.op === "/") {
            const p = run(node.right.left);
            const q = run(node.right.right);
            if (Number.isInteger(p) && Number.isInteger(q) && Math.abs(q) % 2 === 1) {
              const magnitude = (-a) ** b;
              return Math.abs(p) % 2 === 1 ? -magnitude : magnitude;
            }
          }
          return check(Number.NaN);
        }
        if (a === 0 && b < 0 && strict) throw new ExprError("divisao");
        // Zero elevado a zero é indeterminado na matemática da escola, mesmo que a máquina diga 1.
        if (a === 0 && b === 0) return check(Number.NaN);
        return a ** b;
      }
    }
  }

  const result = run(node);
  if (strict && !Number.isFinite(result)) throw new ExprError(Number.isNaN(result) ? "dominio" : "grande");
  // −0 aparece como "−0" na tela; é o mesmo zero.
  return result === 0 ? 0 : result;
}

/** Lê e calcula de uma vez, no modo estrito: o resultado é sempre um número finito ou um erro com nome. */
export function calculate(source: string, options: EvalOptions & ParseOptions = {}): number {
  return evaluate(parse(source, { variables: options.variables ?? Object.keys(options.scope ?? {}) }), { ...options, strict: true });
}

/** Prepara uma função de uma variável para desenhar: lê uma vez, calcula muitas. */
export function compile(source: string, variable = "x", degrees = false): (value: number) => number {
  const tree = parse(source, { variables: [variable] });
  return (value: number) => evaluate(tree, { degrees, scope: { [variable]: value } });
}

/** As variáveis que aparecem na árvore. */
export function variablesOf(node: Node, found = new Set<string>()): Set<string> {
  if (node.kind === "variable") found.add(node.name);
  else if (node.kind === "binary") {
    variablesOf(node.left, found);
    variablesOf(node.right, found);
  } else if (node.kind === "call") node.args.forEach((arg) => variablesOf(arg, found));
  else if (node.kind === "negative" || node.kind === "factorial" || node.kind === "percent") variablesOf(node.inner, found);
  return found;
}
