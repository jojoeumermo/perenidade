// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, type ReactNode } from "react";

type Linguagem = "python" | "php" | "html" | "css" | "js" | "sql" | "texto";

const PALAVRAS: Record<Linguagem, string[]> = {
  python: ["def", "return", "if", "elif", "else", "for", "while", "in", "import", "from", "as", "class", "try", "except", "finally", "with", "lambda", "and", "or", "not", "is", "None", "True", "False", "print", "input", "pass", "break", "continue", "yield", "global", "raise"],
  php: ["echo", "if", "else", "elseif", "for", "foreach", "while", "function", "return", "class", "new", "null", "true", "false", "array", "as", "print", "require", "include", "public", "private", "static", "try", "catch"],
  html: [],
  css: [],
  js: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "of", "in", "new", "class", "import", "export", "from", "async", "await", "try", "catch", "finally", "null", "undefined", "true", "false", "this", "typeof", "switch", "case", "break", "continue", "default", "throw"],
  sql: ["select", "from", "where", "join", "left", "right", "inner", "on", "group", "by", "order", "having", "limit", "insert", "into", "values", "update", "set", "delete", "create", "table", "drop", "alter", "add", "primary", "key", "references", "not", "null", "and", "or", "as", "distinct", "count", "sum", "avg", "min", "max", "round", "case", "when", "then", "else", "end", "desc", "asc", "between", "like", "in", "is", "union", "with"],
  texto: [],
};

export function linguagemDe(nome: string): Linguagem {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  return ext === "py" ? "python" : ext === "php" ? "php" : ext === "html" || ext === "htm" ? "html" : ext === "css" ? "css" : ext === "js" || ext === "mjs" || ext === "ts" ? "js" : ext === "sql" ? "sql" : "texto";
}

/** Realce simples, por trechos: comentário, texto entre aspas, número, palavra reservada, tag. Só para ler; o texto fica no textarea. */
function realcar(codigo: string, lingua: Linguagem): ReactNode[] {
  const partes: ReactNode[] = [];
  const palavras = new Set(PALAVRAS[lingua].map((p) => (lingua === "sql" ? p.toLowerCase() : p)));
  const re = lingua === "html"
    ? /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][^>]*>)|("[^"\n]*"|'[^'\n]*')/g
    : lingua === "css"
      ? /(\/\*[\s\S]*?\*\/)|([.#]?[a-zA-Z_-][\w-]*(?=\s*\{))|("[^"\n]*"|'[^'\n]*')|(\b\d+(?:\.\d+)?(?:px|rem|em|%)?\b)/g
      : /(#.*$|\/\/.*$|--.*$|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/gm;
  let ultimo = 0;
  let k = 0;
  for (let m = re.exec(codigo); m; m = re.exec(codigo)) {
    if (m.index > ultimo) partes.push(codigo.slice(ultimo, m.index));
    const [texto, a, b, c, d] = m;
    let classe = "";
    if (lingua === "html") classe = a ? "text-ink-soft italic" : b ? "text-oxblood" : "text-[#1d4ed8]";
    else if (lingua === "css") classe = a ? "text-ink-soft italic" : b ? "text-oxblood" : c ? "text-[#1d4ed8]" : d ? "text-[#8a5a16]" : "";
    else if (a && !(lingua === "python" && !a.startsWith("#")) && !(lingua !== "python" && lingua !== "sql" && a.startsWith("#")) && !(lingua !== "sql" && a.startsWith("--"))) classe = "text-ink-soft italic";
    else if (b) classe = "text-[#1d4ed8]";
    else if (c) classe = "text-[#8a5a16]";
    else if (d && palavras.has(lingua === "sql" ? d.toLowerCase() : d)) classe = "font-semibold text-oxblood";
    partes.push(classe ? <span key={k++} className={classe}>{texto}</span> : texto);
    ultimo = m.index + texto.length;
  }
  if (ultimo < codigo.length) partes.push(codigo.slice(ultimo));
  return partes;
}

/**
 * Editor de código leve, sem biblioteca: o texto fica num textarea (teclado, leitor de tela e autocorreção do
 * navegador funcionam) e o realce é desenhado por trás. Tab recua, Shift+Tab desfaz o recuo, Ctrl+Enter executa,
 * Ctrl+S guarda o rascunho. Em aparelho fraco, o realce pode ser desligado.
 */
export function EditorDeCodigo({ valor, mudar, nome, aoExecutar, aoGuardar, altura = "24rem", realce = true, tamanho = 14 }: { valor: string; mudar: (v: string) => void; nome: string; aoExecutar?: () => void; aoGuardar?: () => void; altura?: string; realce?: boolean; tamanho?: number }) {
  const fundo = useRef<HTMLPreElement>(null);
  const numeros = useRef<HTMLDivElement>(null);
  const lingua = linguagemDe(nome);
  const linhas = valor.split("\n").length;
  const estilo = { fontSize: `${tamanho}px`, lineHeight: 1.5, tabSize: 4 } as const;
  return (
    <div className="relative flex border-2 border-ink bg-parchment-deep font-mono" style={{ height: altura }}>
      <div ref={numeros} aria-hidden className="w-10 shrink-0 select-none overflow-hidden border-r border-rule bg-parchment px-1 py-2 text-right text-ink-soft" style={estilo}>
        {Array.from({ length: linhas }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <div className="relative min-w-0 flex-1">
        {realce && (
          <pre ref={fundo} aria-hidden className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre px-3 py-2 text-ink" style={estilo}>
            {realcar(valor, lingua)}{"\n"}
          </pre>
        )}
        <textarea
          value={valor}
          onChange={(e) => mudar(e.target.value)}
          onScroll={(e) => {
            if (fundo.current) { fundo.current.scrollTop = e.currentTarget.scrollTop; fundo.current.scrollLeft = e.currentTarget.scrollLeft; }
            if (numeros.current) numeros.current.scrollTop = e.currentTarget.scrollTop;
          }}
          onKeyDown={(e) => {
            const el = e.currentTarget;
            if (e.key === "Tab") {
              e.preventDefault();
              const ini = el.selectionStart;
              const fim = el.selectionEnd;
              if (e.shiftKey) {
                const inicioDaLinha = valor.lastIndexOf("\n", ini - 1) + 1;
                if (valor.slice(inicioDaLinha, inicioDaLinha + 4) === "    ") {
                  mudar(valor.slice(0, inicioDaLinha) + valor.slice(inicioDaLinha + 4));
                  requestAnimationFrame(() => el.setSelectionRange(Math.max(inicioDaLinha, ini - 4), Math.max(inicioDaLinha, fim - 4)));
                }
              } else {
                mudar(valor.slice(0, ini) + "    " + valor.slice(fim));
                requestAnimationFrame(() => el.setSelectionRange(ini + 4, ini + 4));
              }
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              aoExecutar?.();
            } else if (e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              aoGuardar?.();
            } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
              // Mantém o recuo da linha anterior (e aumenta depois de ":" ou "{").
              const ini = el.selectionStart;
              const inicioDaLinha = valor.lastIndexOf("\n", ini - 1) + 1;
              const linha = valor.slice(inicioDaLinha, ini);
              const recuo = /^\s*/.exec(linha)?.[0] ?? "";
              const extra = /[:{(\[]\s*$/.test(linha) ? "    " : "";
              e.preventDefault();
              const novo = `\n${recuo}${extra}`;
              mudar(valor.slice(0, ini) + novo + valor.slice(el.selectionEnd));
              requestAnimationFrame(() => el.setSelectionRange(ini + novo.length, ini + novo.length));
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={nome}
          className={`absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-2 text-ink caret-ink outline-none focus-visible:ring-2 focus-visible:ring-oxblood ${realce ? "text-transparent" : ""}`}
          style={estilo}
        />
      </div>
    </div>
  );
}
