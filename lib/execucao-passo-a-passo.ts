// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Visualizador de execução passo a passo: um interpretador MUITO pequeno de JavaScript e de Python simples, escrito aqui,
// que roda o programa de quem estuda e guarda uma "fotografia" a cada passo (linha, variáveis, pilha de chamadas e saída).
// Nada é executado pelo navegador (sem eval, sem Function, sem Worker) e nada sai do aparelho: o código é só lido e
// interpretado como dado. Sem os atalhos "@/" de propósito: `npm run testar:simuladores-aulas` roda este arquivo no Node.
//
// O que entende (o suficiente para as primeiras aulas de programação):
//   - números, textos, verdadeiro/falso, nulo, listas; + - * / % ** e (Python) //; comparações; e/ou/não;
//   - variáveis e atribuição (também +=, -=, *=, /=, %=, i++ e i-- em JS, e lista[i] = x);
//   - if / elif / else, while, for (range e lista em Python; for clássico e for...of em JS), break, continue;
//   - funções com parâmetros e return, inclusive recursão (a pilha aparece), print / console.log, len, str, int, float,
//     abs, min, max, sum, range, Math.floor/round/max/min/abs, lista.append / lista.push.
// O que NÃO entende (e diz isso em vez de errar em silêncio): classes, objetos, importações, f-strings, funções anônimas,
// try/except, leitura de teclado. Simplificações: variável dentro de função é local; o resto é global; blocos não criam
// escopo próprio (como o `var` do JS e o Python).

export type Linguagem = "js" | "python";

export const MAX_PASSOS = 300;
export const MAX_CHAMADAS = 40;
export const MAX_CODIGO = 2000;

export interface Passo {
  /** Linha (1, 2, 3…) que acabou de ser executada. */
  linha: number;
  /** O que aconteceu nesse passo, em uma frase. */
  nota: string;
  /** Variáveis do quadro de cima da pilha (o que está "à vista" agora). */
  vars: { nome: string; valor: string }[];
  /** A pilha de chamadas, do fundo (programa) para o topo (a função que está rodando). */
  pilha: { nome: string; vars: { nome: string; valor: string }[] }[];
  /** Tudo o que o programa escreveu até aqui. */
  saida: string[];
}

export interface Execucao {
  passos: Passo[];
  /** Erro de leitura (sem passos) ou de execução (com os passos até o erro). */
  erro: { linha: number; mensagem: string } | null;
  /** Parou por ter passado de MAX_PASSOS (laço sem fim, por exemplo). */
  truncado: boolean;
}

// ───────────── Valores ─────────────

/** Um decimal de Python cujo valor é inteiro (5.0): a única forma de distinguir 5 de 5.0 usando números do JS. */
class Flt {
  v: number;
  constructor(v: number) {
    this.v = v;
  }
}
type Val = number | string | boolean | null | undefined | Flt | Val[];

const num = (x: Val): number => (x instanceof Flt ? x.v : (x as number));
const ehNumero = (x: Val) => typeof x === "number" || x instanceof Flt;
const ehFloat = (x: Val) => x instanceof Flt || (typeof x === "number" && !Number.isInteger(x));
const flutuante = (n: number): Val => (Number.isInteger(n) ? new Flt(n) : n);

/** Quantos itens, no máximo, uma listagem de valor mostra (listas dentro de listas crescem rápido: a[a, a] dobra a cada volta). */
const MAX_ITENS_NO_TEXTO = 200;
/** Tamanho máximo de um texto ou lista criado por conta de + (impede dobrar para sempre até travar o aparelho). */
const MAX_TAMANHO = 5000;

function texto(v: Val, lg: Linguagem, dentro = false, orc = { n: MAX_ITENS_NO_TEXTO }): string {
  if (v instanceof Flt) return Number.isFinite(v.v) ? `${v.v}.0` : String(v.v);
  if (typeof v === "string") return dentro ? `'${v}'` : v;
  if (typeof v === "boolean") return lg === "python" ? (v ? "True" : "False") : String(v);
  if (v === null) return lg === "python" ? "None" : "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) {
    const partes: string[] = [];
    for (const x of v) {
      if (--orc.n < 0) {
        partes.push("…");
        break;
      }
      partes.push(texto(x, lg, true, orc));
    }
    return `[${partes.join(", ")}]`;
  }
  return String(v);
}

const verdadeiro = (v: Val, lg: Linguagem): boolean => {
  if (Array.isArray(v)) return lg === "js" ? true : v.length > 0;
  if (v instanceof Flt) return v.v !== 0;
  return !!v;
};

// ───────────── Erros ─────────────

class ErroDoPrograma extends Error {
  linha: number;
  constructor(linha: number, mensagem: string) {
    super(mensagem);
    this.linha = linha;
  }
}
class Limite extends Error {}

// ───────────── Leitura: símbolos ─────────────

interface Tok {
  k: "num" | "str" | "nome" | "op" | "fim";
  v: string;
  linha: number;
}

const OPS3 = ["===", "!=="];
const OPS2 = ["**", "//", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%="];
const OPS1 = "+-*/%<>=()[],:.;{}!";

function simbolos(src: string, lg: Linguagem, linhaInicial: number): Tok[] {
  const t: Tok[] = [];
  let i = 0;
  let linha = linhaInicial;
  const erro = (m: string) => new ErroDoPrograma(linha, m);
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") {
      linha++;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (lg === "python" && c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (lg === "js" && c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (lg === "js" && c === "/" && src[i + 1] === "*") {
      const fim = src.indexOf("*/", i + 2);
      if (fim < 0) throw erro("comentário /* sem o */ no final");
      linha += (src.slice(i, fim).match(/\n/g) ?? []).length;
      i = fim + 2;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      if (src[j] === "." && /[0-9]/.test(src[j + 1] ?? "")) {
        j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      t.push({ k: "num", v: src.slice(i, j), linha });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\n") throw erro("texto sem aspas de fechamento na mesma linha");
        if (src[j] === "\\") {
          const n = src[j + 1];
          s += n === "n" ? "\n" : n === "t" ? "\t" : (n ?? "");
          j += 2;
        } else s += src[j++];
      }
      if (j >= src.length) throw erro("texto sem aspas de fechamento");
      t.push({ k: "str", v: s, linha });
      i = j + 1;
      continue;
    }
    if (/[\p{L}_$]/u.test(c)) {
      let j = i;
      while (j < src.length && /[\p{L}\p{N}_$]/u.test(src[j])) j++;
      const nome = src.slice(i, j);
      // f"..." e outros prefixos de texto: o visualizador não entende e avisa.
      if ((src[j] === '"' || src[j] === "'") && /^[fFrRbB]$/.test(nome)) throw erro(`texto com prefixo ${nome}"…" ainda não é entendido aqui (use aspas comuns e +)`);
      if (lg === "python" && ["and", "or", "not", "in"].includes(nome)) t.push({ k: "op", v: nome, linha });
      else t.push({ k: "nome", v: nome, linha });
      i = j;
      continue;
    }
    if (c === "`") throw erro("texto com crase (template) ainda não é entendido aqui; use aspas e +");
    const tres = src.slice(i, i + 3);
    const dois = src.slice(i, i + 2);
    let op = "";
    if (lg === "js" && OPS3.includes(tres)) op = tres;
    else if (OPS2.includes(dois) && !(lg === "python" && ["&&", "||", "++", "--"].includes(dois))) op = dois;
    else if (lg === "python" && (c === "{" || c === "}")) throw erro("chaves { } (dicionário ou conjunto) ainda não são entendidas aqui");
    else if (OPS1.includes(c) && !(lg === "python" && (c === ";" || c === "!"))) op = c;
    if (!op) throw erro(`o símbolo “${c}” ainda não é entendido aqui`);
    i += op.length;
    // Os operadores do JS que têm irmão em Python viram a mesma coisa por dentro.
    const norm = op === "&&" ? "and" : op === "||" ? "or" : op === "!" ? "not" : op === "===" ? "==" : op === "!==" ? "!=" : op;
    t.push({ k: "op", v: norm, linha });
  }
  return t;
}

// ───────────── Leitura: árvore ─────────────

type Expr =
  | { t: "val"; v: Val }
  | { t: "var"; n: string }
  | { t: "un"; op: string; e: Expr }
  | { t: "bin"; op: string; a: Expr; b: Expr }
  | { t: "lista"; itens: Expr[] }
  | { t: "idx"; e: Expr; i: Expr }
  | { t: "attr"; e: Expr; n: string }
  | { t: "call"; f: Expr; args: Expr[] };

type Stmt = { linha: number } & (
  | { t: "expr"; e: Expr }
  | { t: "atrib"; alvo: Expr; op: string; e: Expr | null }
  | { t: "se"; ramos: { c: Expr; corpo: Stmt[]; linha: number }[]; senao: Stmt[] | null }
  | { t: "enquanto"; c: Expr; corpo: Stmt[] }
  | { t: "para"; n: string; de: Expr; corpo: Stmt[] }
  | { t: "para3"; init: Stmt | null; c: Expr | null; passo: Stmt | null; corpo: Stmt[] }
  | { t: "def"; n: string; params: string[]; corpo: Stmt[] }
  | { t: "ret"; e: Expr | null }
  | { t: "quebra" }
  | { t: "continua" }
  | { t: "nada" }
);

const PREC: Record<string, number> = { or: 1, and: 2, "==": 4, "!=": 4, "<": 4, ">": 4, "<=": 4, ">=": 4, in: 4, "+": 5, "-": 5, "*": 6, "/": 6, "//": 6, "%": 6, "**": 8 };
const OPS_ATRIB = ["=", "+=", "-=", "*=", "/=", "%=", "++", "--"];

class Leitor {
  p = 0;
  t: Tok[];
  lg: Linguagem;
  fimLinha: number;
  constructor(t: Tok[], lg: Linguagem, fimLinha: number) {
    this.t = t;
    this.lg = lg;
    this.fimLinha = fimLinha;
  }
  get at(): Tok {
    return this.t[this.p] ?? { k: "fim", v: "", linha: this.fimLinha };
  }
  eOp(v: string) {
    return this.at.k === "op" && this.at.v === v;
  }
  eNome(v: string) {
    return this.at.k === "nome" && this.at.v === v;
  }
  erro(m: string): ErroDoPrograma {
    return new ErroDoPrograma(this.at.linha, m);
  }
  descreve(): string {
    return this.at.k === "fim" ? "o fim do código" : `“${this.at.v}”`;
  }
  esperaOp(v: string, para = "") {
    if (!this.eOp(v)) throw this.erro(`esperava “${v}”${para ? ` ${para}` : ""}, mas achei ${this.descreve()}`);
    this.p++;
  }
  nome(para: string): string {
    if (this.at.k !== "nome") throw this.erro(`esperava um nome ${para}, mas achei ${this.descreve()}`);
    return this.t[this.p++].v;
  }

  expr(min = 0): Expr {
    let a = this.unario();
    for (;;) {
      const op = this.at.k === "op" ? this.at.v : "";
      const pr = PREC[op];
      if (pr === undefined || pr < min) break;
      this.p++;
      const b = this.expr(op === "**" ? pr : pr + 1);
      a = { t: "bin", op, a, b };
    }
    return a;
  }
  unario(): Expr {
    if (this.eOp("-") || this.eOp("+")) {
      const op = this.at.v;
      this.p++;
      return { t: "un", op, e: this.expr(7) };
    }
    if (this.eOp("not")) {
      this.p++;
      return { t: "un", op: "not", e: this.expr(3) };
    }
    return this.posfixo(this.primario());
  }
  primario(): Expr {
    const k = this.at;
    if (k.k === "num") {
      this.p++;
      const n = Number(k.v);
      return { t: "val", v: this.lg === "python" && k.v.includes(".") ? flutuante(n) : n };
    }
    if (k.k === "str") {
      this.p++;
      return { t: "val", v: k.v };
    }
    if (k.k === "nome") {
      this.p++;
      const py = this.lg === "python";
      if (py && k.v === "True") return { t: "val", v: true };
      if (py && k.v === "False") return { t: "val", v: false };
      if (py && k.v === "None") return { t: "val", v: null };
      if (!py && k.v === "true") return { t: "val", v: true };
      if (!py && k.v === "false") return { t: "val", v: false };
      if (!py && k.v === "null") return { t: "val", v: null };
      if (!py && k.v === "undefined") return { t: "val", v: undefined };
      if (["lambda", "class", "import", "from", "new", "async", "await", "yield", "try", "with"].includes(k.v) || (!py && k.v === "function")) throw new ErroDoPrograma(k.linha, `“${k.v}” ainda não é entendido aqui`);
      return { t: "var", n: k.v };
    }
    if (this.eOp("(")) {
      this.p++;
      const e = this.expr();
      this.esperaOp(")", "para fechar o parêntese");
      return e;
    }
    if (this.eOp("[")) {
      this.p++;
      const itens: Expr[] = [];
      while (!this.eOp("]")) {
        itens.push(this.expr());
        if (this.eOp(",")) this.p++;
        else break;
      }
      this.esperaOp("]", "para fechar a lista");
      return { t: "lista", itens };
    }
    throw this.erro(`esperava um valor, mas achei ${this.descreve()}`);
  }
  posfixo(e: Expr): Expr {
    for (;;) {
      if (this.eOp("(")) {
        this.p++;
        const args: Expr[] = [];
        while (!this.eOp(")")) {
          args.push(this.expr());
          if (this.eOp(",")) this.p++;
          else break;
        }
        this.esperaOp(")", "para fechar a chamada");
        e = { t: "call", f: e, args };
      } else if (this.eOp("[")) {
        this.p++;
        const i = this.expr();
        this.esperaOp("]");
        e = { t: "idx", e, i };
      } else if (this.eOp(".")) {
        this.p++;
        e = { t: "attr", e, n: this.nome("depois do ponto") };
      } else return e;
    }
  }

  /** Atribuição ou expressão (sem consumir o ";"). `decl` é o `let/const/var` do JS já consumido. */
  simples(linha: number, decl = false): Stmt {
    if (decl) {
      const n = this.nome("depois de let/const/var");
      if (this.eOp("=")) {
        this.p++;
        return { t: "atrib", alvo: { t: "var", n }, op: "=", e: this.expr(), linha };
      }
      return { t: "atrib", alvo: { t: "var", n }, op: "=", e: { t: "val", v: undefined }, linha };
    }
    const e = this.expr();
    if (this.at.k === "op" && OPS_ATRIB.includes(this.at.v)) {
      const op = this.at.v;
      if (e.t !== "var" && e.t !== "idx") throw this.erro("só dá para guardar valor em uma variável ou numa posição de lista");
      this.p++;
      if (op === "++" || op === "--") return { t: "atrib", alvo: e, op, e: null, linha };
      return { t: "atrib", alvo: e, op, e: this.expr(), linha };
    }
    return { t: "expr", e, linha };
  }
}

// ── Python: por linhas e recuo ──

interface LinhaPy {
  recuo: number;
  t: Tok[];
  linha: number;
}

function lerPython(src: string): Stmt[] {
  const linhas: LinhaPy[] = [];
  src.split("\n").forEach((bruta, i) => {
    const sem = bruta.replace(/\r$/, "");
    if (!sem.trim() || sem.trim().startsWith("#")) return;
    const recuo = (/^[ \t]*/.exec(sem)?.[0] ?? "").replace(/\t/g, "    ").length;
    const t = simbolos(sem, "python", i + 1);
    if (t.length) linhas.push({ recuo, t, linha: i + 1 });
  });
  let i = 0;
  const bloco = (recuo: number): Stmt[] => {
    const out: Stmt[] = [];
    while (i < linhas.length && linhas[i].recuo >= recuo) {
      if (linhas[i].recuo > recuo) throw new ErroDoPrograma(linhas[i].linha, "recuo (espaços no começo da linha) inesperado");
      out.push(comando(recuo));
    }
    return out;
  };
  const corpo = (recuo: number, linha: number): Stmt[] => {
    if (i >= linhas.length || linhas[i].recuo <= recuo) throw new ErroDoPrograma(linha, "depois dos dois-pontos (:) falta o bloco, com recuo");
    return bloco(linhas[i].recuo);
  };
  const cabeca = (l: LinhaPy, depoisDe: number): Leitor => {
    const ult = l.t[l.t.length - 1];
    if (!(ult.k === "op" && ult.v === ":")) throw new ErroDoPrograma(l.linha, "esta linha deveria terminar com dois-pontos (:)");
    return new Leitor(l.t.slice(depoisDe, -1), "python", l.linha);
  };
  const fim = (r: Leitor) => {
    if (r.at.k !== "fim") throw r.erro(`sobrou ${r.descreve()} no fim da linha`);
  };
  const comando = (recuo: number): Stmt => {
    const l = linhas[i++];
    const p = l.t[0];
    if (p.k === "nome") {
      if (p.v === "if" || p.v === "while") {
        const r = cabeca(l, 1);
        const c = r.expr();
        fim(r);
        const c1 = corpo(recuo, l.linha);
        if (p.v === "while") return { t: "enquanto", c, corpo: c1, linha: l.linha };
        const ramos = [{ c, corpo: c1, linha: l.linha }];
        let senao: Stmt[] | null = null;
        while (i < linhas.length && linhas[i].recuo === recuo && linhas[i].t[0].k === "nome" && (linhas[i].t[0].v === "elif" || linhas[i].t[0].v === "else")) {
          const m = linhas[i++];
          if (m.t[0].v === "elif") {
            const rr = cabeca(m, 1);
            const cc = rr.expr();
            fim(rr);
            ramos.push({ c: cc, corpo: corpo(recuo, m.linha), linha: m.linha });
          } else {
            if (m.t.length !== 2) throw new ErroDoPrograma(m.linha, "else não leva condição: é só “else:”");
            cabeca(m, 1);
            senao = corpo(recuo, m.linha);
            break;
          }
        }
        return { t: "se", ramos, senao, linha: l.linha };
      }
      if (p.v === "elif" || p.v === "else") throw new ErroDoPrograma(l.linha, `“${p.v}” sem um if antes`);
      if (p.v === "for") {
        const r = cabeca(l, 1);
        const n = r.nome("depois de for");
        if (!r.eOp("in")) throw r.erro("esperava “in” (for variavel in …)");
        r.p++;
        const de = r.expr();
        fim(r);
        return { t: "para", n, de, corpo: corpo(recuo, l.linha), linha: l.linha };
      }
      if (p.v === "def") {
        const r = cabeca(l, 1);
        const n = r.nome("da função");
        r.esperaOp("(");
        const params: string[] = [];
        while (!r.eOp(")")) {
          params.push(r.nome("do parâmetro"));
          if (r.eOp(",")) r.p++;
          else break;
        }
        r.esperaOp(")");
        fim(r);
        return { t: "def", n, params, corpo: corpo(recuo, l.linha), linha: l.linha };
      }
      if (p.v === "return") {
        const r = new Leitor(l.t.slice(1), "python", l.linha);
        const e = r.at.k === "fim" ? null : r.expr();
        fim(r);
        return { t: "ret", e, linha: l.linha };
      }
      if (p.v === "break") return { t: "quebra", linha: l.linha };
      if (p.v === "continue") return { t: "continua", linha: l.linha };
      if (p.v === "pass") return { t: "nada", linha: l.linha };
      if (["class", "import", "from", "try", "except", "with", "global", "lambda", "del", "raise", "assert"].includes(p.v)) throw new ErroDoPrograma(l.linha, `“${p.v}” ainda não é entendido aqui`);
    }
    const r = new Leitor(l.t, "python", l.linha);
    const s = r.simples(l.linha);
    fim(r);
    return s;
  };
  return bloco(linhas[0]?.recuo ?? 0);
}

// ── JavaScript: chaves ──

function lerJs(src: string): Stmt[] {
  const t = simbolos(src, "js", 1);
  const total = src.split("\n").length;
  const r = new Leitor(t, "js", total);
  const sc = () => {
    if (r.eOp(";")) r.p++;
  };
  const corpo = (): Stmt[] => {
    if (r.eOp("{")) {
      r.p++;
      const out: Stmt[] = [];
      while (!r.eOp("}")) {
        if (r.at.k === "fim") throw r.erro("falta fechar a chave }");
        out.push(comando());
      }
      r.p++;
      return out;
    }
    return [comando()];
  };
  const cond = (): Expr => {
    r.esperaOp("(", "depois da palavra");
    const c = r.expr();
    r.esperaOp(")", "para fechar a condição");
    return c;
  };
  const comando = (): Stmt => {
    const linha = r.at.linha;
    if (r.eOp(";")) {
      r.p++;
      return { t: "nada", linha };
    }
    if (r.at.k === "nome") {
      const v = r.at.v;
      if (v === "if") {
        r.p++;
        const ramos = [{ c: cond(), corpo: [] as Stmt[], linha }];
        ramos[0].corpo = corpo();
        let senao: Stmt[] | null = null;
        while (r.eNome("else")) {
          r.p++;
          if (r.eNome("if")) {
            const l2 = r.at.linha;
            r.p++;
            const c = cond();
            ramos.push({ c, corpo: corpo(), linha: l2 });
          } else {
            senao = corpo();
            break;
          }
        }
        return { t: "se", ramos, senao, linha };
      }
      if (v === "while") {
        r.p++;
        const c = cond();
        return { t: "enquanto", c, corpo: corpo(), linha };
      }
      if (v === "for") {
        r.p++;
        r.esperaOp("(", "depois de for");
        const decl = r.eNome("let") || r.eNome("const") || r.eNome("var");
        if (decl && r.t[r.p + 2]?.k === "nome" && r.t[r.p + 2].v === "of") {
          r.p++;
          const n = r.nome("do for…of");
          r.p++;
          const de = r.expr();
          r.esperaOp(")");
          return { t: "para", n, de, corpo: corpo(), linha };
        }
        let init: Stmt | null = null;
        if (!r.eOp(";")) {
          if (decl) r.p++;
          init = r.simples(linha, decl);
        }
        r.esperaOp(";", "no for");
        const c = r.eOp(";") ? null : r.expr();
        r.esperaOp(";", "no for");
        const passo = r.eOp(")") ? null : r.simples(linha);
        r.esperaOp(")", "para fechar o for");
        return { t: "para3", init, c, passo, corpo: corpo(), linha };
      }
      if (v === "function") {
        r.p++;
        const n = r.nome("da função");
        r.esperaOp("(");
        const params: string[] = [];
        while (!r.eOp(")")) {
          params.push(r.nome("do parâmetro"));
          if (r.eOp(",")) r.p++;
          else break;
        }
        r.esperaOp(")");
        if (!r.eOp("{")) throw r.erro("esperava { para abrir a função");
        return { t: "def", n, params, corpo: corpo(), linha };
      }
      if (v === "return") {
        r.p++;
        const e = r.eOp(";") || r.eOp("}") || r.t.length <= r.p || r.at.linha !== linha ? null : r.expr();
        sc();
        return { t: "ret", e, linha };
      }
      if (v === "break") {
        r.p++;
        sc();
        return { t: "quebra", linha };
      }
      if (v === "continue") {
        r.p++;
        sc();
        return { t: "continua", linha };
      }
      if (["class", "import", "export", "try", "switch", "do", "throw", "async", "await"].includes(v)) throw r.erro(`“${v}” ainda não é entendido aqui`);
      if (v === "let" || v === "const" || v === "var") {
        r.p++;
        const s = r.simples(linha, true);
        sc();
        return s;
      }
    }
    if (r.eOp("{")) throw r.erro("bloco { } solto (ou objeto) ainda não é entendido aqui");
    const s = r.simples(linha);
    sc();
    return s;
  };
  const out: Stmt[] = [];
  while (r.at.k !== "fim") out.push(comando());
  return out;
}

// ───────────── Execução ─────────────

interface Quadro {
  nome: string;
  vars: Map<string, Val>;
}
interface Funcao {
  params: string[];
  corpo: Stmt[];
}
type Sinal = null | { s: "ret"; v: Val } | { s: "quebra" } | { s: "continua" };

class Maquina {
  passos: Passo[] = [];
  saida: string[] = [];
  pilha: Quadro[] = [{ nome: "programa", vars: new Map() }];
  funcoes = new Map<string, Funcao>();
  linha = 0;
  lg: Linguagem;
  constructor(lg: Linguagem) {
    this.lg = lg;
  }

  erro(m: string): ErroDoPrograma {
    return new ErroDoPrograma(this.linha, m);
  }
  fmt(v: Val, dentro = false) {
    return texto(v, this.lg, dentro);
  }
  vars(q: Quadro) {
    return [...q.vars].map(([nome, valor]) => ({ nome, valor: this.fmt(valor, true) }));
  }
  passo(linha: number, nota: string) {
    if (this.passos.length >= MAX_PASSOS) throw new Limite();
    const topo = this.pilha[this.pilha.length - 1];
    this.passos.push({ linha, nota, vars: this.vars(topo), pilha: this.pilha.map((q) => ({ nome: q.nome, vars: this.vars(q) })), saida: [...this.saida] });
  }
  ler(n: string): Val {
    const topo = this.pilha[this.pilha.length - 1];
    if (topo.vars.has(n)) return topo.vars.get(n);
    const base = this.pilha[0];
    if (base.vars.has(n)) return base.vars.get(n);
    if (this.funcoes.has(n)) throw this.erro(`“${n}” é uma função: para usá-la, escreva ${n}(…) com parênteses`);
    throw this.erro(this.lg === "python" ? `NameError: o nome “${n}” ainda não existe (foi escrito certo? já recebeu valor antes desta linha?)` : `ReferenceError: “${n}” não foi declarada antes desta linha`);
  }
  guardar(n: string, v: Val) {
    this.pilha[this.pilha.length - 1].vars.set(n, v);
  }

  aritmetica(op: string, a: Val, b: Val): Val {
    const py = this.lg === "python";
    if (op === "+") {
      if (typeof a === "string" || typeof b === "string") {
        if (py && !(typeof a === "string" && typeof b === "string")) throw this.erro("TypeError: não dá para somar texto com número; use str(número) para virar texto");
        const s = this.fmt(a) + this.fmt(b);
        if (s.length > MAX_TAMANHO) throw this.erro("o texto ficou grande demais para o visualizador");
        return s;
      }
      if (Array.isArray(a) && Array.isArray(b) && py) {
        if (a.length + b.length > MAX_TAMANHO) throw this.erro("a lista ficou grande demais para o visualizador");
        return [...a, ...b];
      }
    }
    if (op === "*" && py && typeof a === "string" && typeof b === "number") return a.repeat(Math.max(0, Math.min(b, 200)));
    if (!ehNumero(a) && !(typeof a === "boolean") || !ehNumero(b) && !(typeof b === "boolean")) {
      if (py) throw this.erro(`TypeError: o operador ${op} não funciona entre estes tipos de valor`);
    }
    const x = Number(typeof a === "boolean" ? a : num(a));
    const y = Number(typeof b === "boolean" ? b : num(b));
    const f = ehFloat(a) || ehFloat(b);
    let r: number;
    switch (op) {
      case "+": r = x + y; break;
      case "-": r = x - y; break;
      case "*": r = x * y; break;
      case "/":
        if (py && y === 0) throw this.erro("ZeroDivisionError: divisão por zero");
        r = x / y;
        return py ? flutuante(r) : r;
      case "//":
        if (y === 0) throw this.erro("ZeroDivisionError: divisão por zero");
        r = Math.floor(x / y);
        break;
      case "%":
        if (py) {
          if (y === 0) throw this.erro("ZeroDivisionError: resto de divisão por zero");
          r = x - y * Math.floor(x / y);
        } else r = x % y;
        break;
      case "**":
        r = x ** y;
        return py && (f || y < 0) ? flutuante(r) : r;
      default: throw this.erro(`operador ${op} desconhecido`);
    }
    return py && f ? flutuante(r) : r;
  }

  comparar(op: string, a: Val, b: Val): boolean {
    if (op === "in") {
      if (Array.isArray(b)) return b.some((x) => this.igual(x, a));
      if (typeof b === "string" && typeof a === "string") return b.includes(a);
      throw this.erro("TypeError: “in” precisa de uma lista ou de um texto do lado direito");
    }
    if (op === "==") return this.igual(a, b);
    if (op === "!=") return !this.igual(a, b);
    const ok = (ehNumero(a) && ehNumero(b)) || (typeof a === "string" && typeof b === "string");
    if (!ok && this.lg === "python") throw this.erro(`TypeError: não dá para comparar (${op}) estes dois tipos de valor`);
    const x = ehNumero(a) ? num(a) : (a as string);
    const y = ehNumero(b) ? num(b) : (b as string);
    return op === "<" ? x < y : op === ">" ? x > y : op === "<=" ? x <= y : x >= y;
  }
  igual(a: Val, b: Val): boolean {
    if (ehNumero(a) && ehNumero(b)) return num(a) === num(b);
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => this.igual(x, b[i]));
    return a === b;
  }

  aval(e: Expr): Val {
    switch (e.t) {
      case "val": return e.v;
      case "var": return this.ler(e.n);
      case "lista": return e.itens.map((x) => this.aval(x));
      case "un": {
        const v = this.aval(e.e);
        if (e.op === "not") return !verdadeiro(v, this.lg);
        if (!ehNumero(v) && typeof v !== "boolean") throw this.erro("TypeError: sinal de + ou - só funciona com número");
        const n = typeof v === "boolean" ? Number(v) : num(v);
        const r = e.op === "-" ? -n : n;
        return v instanceof Flt ? new Flt(r) : r;
      }
      case "bin": {
        if (e.op === "and") {
          const a = this.aval(e.a);
          return verdadeiro(a, this.lg) ? this.aval(e.b) : a;
        }
        if (e.op === "or") {
          const a = this.aval(e.a);
          return verdadeiro(a, this.lg) ? a : this.aval(e.b);
        }
        const a = this.aval(e.a);
        const b = this.aval(e.b);
        return ["==", "!=", "<", ">", "<=", ">=", "in"].includes(e.op) ? this.comparar(e.op, a, b) : this.aritmetica(e.op, a, b);
      }
      case "idx": {
        const c = this.aval(e.e);
        const i = this.aval(e.i);
        if (!ehNumero(i)) throw this.erro("o índice precisa ser um número inteiro");
        let k = num(i);
        if (typeof c === "string" || Array.isArray(c)) {
          if (k < 0 && this.lg === "python") k += c.length;
          if (!Number.isInteger(k) || k < 0 || k >= c.length) {
            if (this.lg === "js") return undefined;
            throw this.erro(`IndexError: a posição ${num(i)} não existe (a sequência tem ${c.length} item${c.length === 1 ? "" : "s"}, de 0 a ${c.length - 1})`);
          }
          return c[k];
        }
        throw this.erro("só dá para usar [posição] em lista ou texto");
      }
      case "attr": {
        const c = this.aval(e.e);
        if (e.n === "length" && this.lg === "js" && (typeof c === "string" || Array.isArray(c))) return c.length;
        throw this.erro(`“.${e.n}” ainda não é entendido aqui`);
      }
      case "call": return this.chamar(e);
    }
  }

  chamar(e: Extract<Expr, { t: "call" }>): Val {
    const f = e.f;
    const args = (): Val[] => e.args.map((x) => this.aval(x));
    if (f.t === "attr") {
      if (f.e.t === "var" && f.e.n === "console" && this.lg === "js" && f.n === "log") {
        const a = args();
        this.saida.push(a.map((v) => this.fmt(v)).join(" "));
        return undefined;
      }
      if (f.e.t === "var" && f.e.n === "Math" && this.lg === "js") {
        const a = args().map((v) => num(v));
        const m: Record<string, (...n: number[]) => number> = { floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs, max: Math.max, min: Math.min, sqrt: Math.sqrt, pow: Math.pow };
        if (!Object.hasOwn(m, f.n)) throw this.erro(`Math.${f.n} ainda não é entendido aqui`);
        return m[f.n](...a);
      }
      const alvo = this.aval(f.e);
      if (Array.isArray(alvo) && ((this.lg === "python" && f.n === "append") || (this.lg === "js" && f.n === "push"))) {
        const a = args();
        if (a.length !== 1) throw this.erro(`${f.n} recebe um valor só`);
        alvo.push(a[0]);
        return this.lg === "js" ? alvo.length : null;
      }
      throw this.erro(`o método “.${f.n}()” ainda não é entendido aqui`);
    }
    if (f.t !== "var") throw this.erro("só dá para chamar funções pelo nome");
    const nome = f.n;
    const def = this.funcoes.get(nome);
    if (def) {
      const a = args();
      if (a.length !== def.params.length) {
        throw this.erro(this.lg === "python" ? `TypeError: ${nome}() precisa de ${def.params.length} valor(es) e recebeu ${a.length}` : `${nome} espera ${def.params.length} valor(es) e recebeu ${a.length}`);
      }
      if (this.pilha.length > MAX_CHAMADAS) throw this.erro(this.lg === "python" ? "RecursionError: funções chamando funções demais, sem parar (a pilha encheu)" : "RangeError: pilha de chamadas cheia (recursão sem fim?)");
      const q: Quadro = { nome: `${nome}(${a.map((v) => this.fmt(v, true)).join(", ")})`, vars: new Map() };
      def.params.forEach((p, i) => q.vars.set(p, a[i]));
      this.pilha.push(q);
      let r: Sinal = null;
      try {
        r = this.executar(def.corpo);
      } finally {
        this.pilha.pop();
      }
      return r && r.s === "ret" ? r.v : this.lg === "python" ? null : undefined;
    }
    const a = args();
    const py = this.lg === "python";
    switch (nome) {
      case "print":
        if (!py) break;
        this.saida.push(a.map((v) => this.fmt(v)).join(" "));
        return null;
      case "len":
        if (!py) break;
        if (typeof a[0] === "string" || Array.isArray(a[0])) return (a[0] as string | Val[]).length;
        throw this.erro("TypeError: len() só funciona com texto ou lista");
      case "str":
        if (!py) break;
        return this.fmt(a[0]);
      case "int":
        if (!py) break;
        if (typeof a[0] === "string") {
          if (!/^\s*[-+]?\d+\s*$/.test(a[0])) throw this.erro(`ValueError: “${a[0]}” não é um número inteiro`);
          return Number(a[0]);
        }
        return Math.trunc(num(a[0]));
      case "float":
        if (!py) break;
        if (typeof a[0] === "string" && !/^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(a[0])) throw this.erro(`ValueError: “${a[0]}” não é um número`);
        return flutuante(Number(ehNumero(a[0]) ? num(a[0]) : a[0]));
      case "Number":
        if (py) break;
        return Number(ehNumero(a[0]) ? num(a[0]) : a[0]);
      case "String":
        if (py) break;
        return this.fmt(a[0]);
      case "abs": {
        if (!py) break;
        const r = Math.abs(num(a[0]));
        return a[0] instanceof Flt ? new Flt(r) : r;
      }
      case "min":
      case "max": {
        if (!py) break;
        const xs = a.length === 1 && Array.isArray(a[0]) ? a[0] : a;
        if (!xs.length) throw this.erro(`ValueError: ${nome}() sem valores`);
        const r = xs.reduce((m, x) => (nome === "min" ? (num(x) < num(m) ? x : m) : num(x) > num(m) ? x : m));
        return r;
      }
      case "sum": {
        if (!py) break;
        const xs = Array.isArray(a[0]) ? a[0] : [];
        return xs.reduce<Val>((s, x) => this.aritmetica("+", s, x), 0);
      }
      case "range": {
        if (!py) break;
        const n = a.map((v) => num(v));
        const [ini, fim, passo] = n.length === 1 ? [0, n[0], 1] : [n[0], n[1], n[2] ?? 1];
        if (![ini, fim, passo].every(Number.isInteger) || passo === 0) throw this.erro("range() só aceita números inteiros, e o passo não pode ser zero");
        const out: number[] = [];
        for (let k = ini; passo > 0 ? k < fim : k > fim; k += passo) {
          out.push(k);
          if (out.length > 1000) throw this.erro("range() grande demais para o visualizador (limite de 1000 valores)");
        }
        return out;
      }
      case "input":
      case "prompt":
        throw this.erro("a leitura do teclado (input) não funciona aqui: escreva o valor direto no código");
    }
    throw this.erro(py ? `NameError: a função “${nome}” não existe aqui (ainda não foi criada com def e o visualizador não a conhece)` : `ReferenceError: a função “${nome}” não existe aqui`);
  }

  atribuir(s: Extract<Stmt, { t: "atrib" }>) {
    let valor: Val;
    const atual = () => this.aval(s.alvo);
    if (s.op === "=") valor = this.aval(s.e!);
    else if (s.op === "++") valor = this.aritmetica("+", atual(), 1);
    else if (s.op === "--") valor = this.aritmetica("-", atual(), 1);
    else valor = this.aritmetica(s.op.slice(0, -1), atual(), this.aval(s.e!));
    if (s.alvo.t === "var") {
      this.guardar(s.alvo.n, valor);
      this.passo(s.linha, `${s.alvo.n} passa a valer ${this.fmt(valor, true)}`);
    } else if (s.alvo.t === "idx") {
      const c = this.aval(s.alvo.e);
      const i = num(this.aval(s.alvo.i));
      if (!Array.isArray(c)) throw this.erro("só dá para trocar valores dentro de uma lista");
      const k = i < 0 && this.lg === "python" ? i + c.length : i;
      if (!Number.isInteger(k) || k < 0 || k >= c.length) throw this.erro(`IndexError: a posição ${i} não existe na lista (de 0 a ${c.length - 1})`);
      c[k] = valor;
      this.passo(s.linha, `a posição ${i} da lista passa a valer ${this.fmt(valor, true)}`);
    }
  }

  executar(corpo: Stmt[]): Sinal {
    for (const s of corpo) {
      const r = this.um(s);
      if (r) return r;
    }
    return null;
  }

  corpoDeLaco(corpo: Stmt[]): { fim: boolean; sinal: Sinal } {
    const r = this.executar(corpo);
    if (!r) return { fim: false, sinal: null };
    if (r.s === "quebra") return { fim: true, sinal: null };
    if (r.s === "continua") return { fim: false, sinal: null };
    return { fim: true, sinal: r };
  }

  um(s: Stmt): Sinal {
    this.linha = s.linha;
    switch (s.t) {
      case "nada": return null;
      case "expr": {
        const antes = this.saida.length;
        this.aval(s.e);
        this.passo(s.linha, this.saida.length > antes ? `escreve na saída: ${this.saida[this.saida.length - 1]}` : "executa a linha");
        return null;
      }
      case "atrib":
        this.atribuir(s);
        return null;
      case "def":
        this.funcoes.set(s.n, { params: s.params, corpo: s.corpo });
        this.passo(s.linha, `define a função ${s.n}(${s.params.join(", ")}); ela só roda quando for chamada`);
        return null;
      case "ret": {
        const v = s.e ? this.aval(s.e) : this.lg === "python" ? null : undefined;
        if (this.pilha.length === 1) throw this.erro("return só faz sentido dentro de uma função");
        this.passo(s.linha, `a função devolve ${this.fmt(v, true)} e sua chamada termina`);
        return { s: "ret", v };
      }
      case "quebra":
        this.passo(s.linha, "break: sai do laço");
        return { s: "quebra" };
      case "continua":
        this.passo(s.linha, "continue: pula para a próxima volta");
        return { s: "continua" };
      case "se": {
        for (const ramo of s.ramos) {
          this.linha = ramo.linha;
          const v = verdadeiro(this.aval(ramo.c), this.lg);
          this.passo(ramo.linha, v ? "a condição é verdadeira: entra neste bloco" : "a condição é falsa: pula este bloco");
          if (v) return this.executar(ramo.corpo);
        }
        return s.senao ? this.executar(s.senao) : null;
      }
      case "enquanto": {
        for (;;) {
          this.linha = s.linha;
          const v = verdadeiro(this.aval(s.c), this.lg);
          this.passo(s.linha, v ? "a condição é verdadeira: faz mais uma volta" : "a condição é falsa: o laço termina");
          if (!v) return null;
          const { fim, sinal } = this.corpoDeLaco(s.corpo);
          if (sinal) return sinal;
          if (fim) return null;
        }
      }
      case "para": {
        const base = this.aval(s.de);
        const itens = typeof base === "string" ? [...base] : Array.isArray(base) ? [...base] : null;
        if (!itens) throw this.erro("o for precisa de uma lista, um texto ou range(…)");
        for (const item of itens) {
          this.guardar(s.n, item);
          this.passo(s.linha, `${s.n} recebe o próximo item: ${this.fmt(item, true)}`);
          const { fim, sinal } = this.corpoDeLaco(s.corpo);
          if (sinal) return sinal;
          if (fim) return null;
        }
        this.passo(s.linha, "acabaram os itens: o laço termina");
        return null;
      }
      case "para3": {
        if (s.init) this.um(s.init);
        for (;;) {
          this.linha = s.linha;
          const v = s.c ? verdadeiro(this.aval(s.c), this.lg) : true;
          this.passo(s.linha, v ? "a condição é verdadeira: faz mais uma volta" : "a condição é falsa: o laço termina");
          if (!v) return null;
          const { fim, sinal } = this.corpoDeLaco(s.corpo);
          if (sinal) return sinal;
          if (fim) return null;
          if (s.passo) this.um(s.passo);
        }
      }
    }
  }
}

/** Lê e executa o programa, passo a passo. Nunca lança: os erros voltam em `erro`. */
export function executarPassoAPasso(codigo: string, linguagem: Linguagem): Execucao {
  const limpo = codigo.replace(/\r\n?/g, "\n");
  if (!limpo.trim()) return { passos: [], erro: { linha: 1, mensagem: "escreva algum código para ver a execução" }, truncado: false };
  if (limpo.length > MAX_CODIGO) return { passos: [], erro: { linha: 1, mensagem: `o código é grande demais para o visualizador (limite de ${MAX_CODIGO} letras)` }, truncado: false };
  let arvore: Stmt[];
  try {
    arvore = linguagem === "python" ? lerPython(limpo) : lerJs(limpo);
  } catch (e) {
    if (e instanceof ErroDoPrograma) return { passos: [], erro: { linha: e.linha, mensagem: e.message }, truncado: false };
    return { passos: [], erro: { linha: 1, mensagem: "o código é complicado demais para o visualizador ler" }, truncado: false };
  }
  const m = new Maquina(linguagem);
  // Em JS as funções declaradas valem desde o começo (içamento); em Python só depois do def.
  if (linguagem === "js") for (const s of arvore) if (s.t === "def") m.funcoes.set(s.n, { params: s.params, corpo: s.corpo });
  try {
    m.executar(arvore);
    if (m.passos.length === 0) m.passo(1, "nada a executar");
    return { passos: m.passos, erro: null, truncado: false };
  } catch (e) {
    if (e instanceof Limite) return { passos: m.passos, erro: null, truncado: true };
    if (e instanceof ErroDoPrograma) return { passos: m.passos, erro: { linha: e.linha, mensagem: e.message }, truncado: false };
    return { passos: m.passos, erro: { linha: m.linha, mensagem: "o programa pediu mais do que o visualizador aguenta" }, truncado: false };
  }
}
