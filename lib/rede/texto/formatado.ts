// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O TEXTO FORMATADO da Alumia (onda 11, frente 11A): um pedaço pequeno e fechado de markdown, lido aqui em nós conhecidos. A tela só
// desenha esses nós (lib/rede/texto/desenhar.ts): HTML escrito no texto aparece como texto, nunca vira elemento. O que existe:
//
//   blocos   ## Título e ### Subtítulo · parágrafo · lista com "- " ou "1. " · citação com "> " · separador "---"
//            bloco de código entre ``` (com o nome da linguagem, opcional) · fórmula entre $$ em linhas sozinhas
//            imagem do próprio post numa linha sozinha: ![descrição](imagem:1) (até 4, as que a pessoa anexou)
//   trechos  **negrito** · _itálico_ (ou *itálico*) · ~~riscado~~ · `código` · $$fórmula$$ · [texto](https://…)
//            uma quebra de linha simples continua sendo quebra (como no post de sempre); "\" na frente de um sinal o deixa literal.
//
// Um cifrão sozinho não abre fórmula ("R$ 10" continua dinheiro). Asterisco e sublinhado no meio de palavra não viram itálico
// (nome_de_arquivo, 2*3*4). Antes de ler, passa pela mesma limpeza do banco (./limpar). Sem "@/": roda no Node dos testes.
import { formulaCabe } from "./formula";
import { limparFonte, MAXIMO_DO_TEXTO, urlSegura } from "./limpar";

export type Trecho =
  | { t: "texto"; v: string }
  | { t: "negrito"; filhos: Trecho[] }
  | { t: "italico"; filhos: Trecho[] }
  | { t: "riscado"; filhos: Trecho[] }
  | { t: "codigo"; v: string }
  | { t: "formula"; v: string }
  | { t: "link"; url: string; filhos: Trecho[] }
  | { t: "quebra" };

export type Bloco =
  | { t: "paragrafo"; trechos: Trecho[] }
  | { t: "titulo"; nivel: 2 | 3; trechos: Trecho[] }
  | { t: "lista"; ordenada: boolean; inicio: number; itens: Trecho[][] }
  | { t: "citacao"; paragrafos: Trecho[][] }
  | { t: "codigo"; lingua: string; v: string }
  | { t: "formula"; v: string }
  | { t: "imagem"; n: number; alt: string }
  | { t: "separador" };

/** "completo" no texto longo e na questão; "minimo" no post curto de sempre (só `código` e $$fórmula$$: asterisco antigo não muda). */
export type Alcance = "completo" | "minimo";

const MAX_BLOCOS = 400;
const MAX_ITENS = 200;
const MAX_PROFUNDIDADE = 3;
const ESCAPAVEIS = "\\`*_{}[]()#+-.!$~>|@";
const letraOuNumero = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
const espaco = (c: string | undefined) => !c || /\s/.test(c);

/** Junta textos vizinhos (a tela desenha menos pedaços). */
function juntar(trechos: Trecho[]): Trecho[] {
  const saida: Trecho[] = [];
  for (const x of trechos) {
    const ultimo = saida[saida.length - 1];
    if (x.t === "texto" && ultimo?.t === "texto") ultimo.v += x.v;
    else if (x.t !== "texto" || x.v) saida.push(x);
  }
  return saida;
}

/** Acha o fecho de um marcador de ênfase: colado em letra (sem espaço antes) e, para * e _, sem letra logo depois. */
function acharFecho(s: string, de: number, marca: string): number {
  for (let j = de; j <= s.length - marca.length; j++) {
    if (s[j] === "\n" && s[j + 1] === "\n") return -1;
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s.startsWith(marca, j) && !espaco(s[j - 1]) && j > de) {
      if (marca.length === 1 && (letraOuNumero(s[j + 1]) || s[j + 1] === marca)) continue;
      return j;
    }
  }
  return -1;
}

/** Onde fecha o endereço de um link: o ")" que casa, aceitando um par de parênteses dentro (como nos endereços de enciclopédia). */
function fechoDoEndereco(s: string, de: number): number {
  let dentro = false;
  for (let j = de; j < s.length && j - de <= 600; j++) {
    const c = s[j];
    if (c === "\n") return -1;
    if (c === "(") {
      if (dentro) return -1;
      dentro = true;
    } else if (c === ")") {
      if (!dentro) return j;
      dentro = false;
    }
  }
  return -1;
}

/** Lê os trechos de um parágrafo (ou de um item, título, citação). */
export function lerTrechos(s: string, alcance: Alcance = "completo", profundidade = 0, dentroDeLink = false): Trecho[] {
  const saida: Trecho[] = [];
  let buffer = "";
  const soltar = () => {
    if (buffer) saida.push({ t: "texto", v: buffer });
    buffer = "";
  };
  const completo = alcance === "completo";
  const podeAninhar = profundidade < MAX_PROFUNDIDADE;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    // Sinal escapado: fica literal.
    if (completo && c === "\\" && i + 1 < s.length && ESCAPAVEIS.includes(s[i + 1])) {
      buffer += s[i + 1];
      i += 2;
      continue;
    }
    if (c === "\n") {
      soltar();
      saida.push({ t: "quebra" });
      i++;
      continue;
    }
    // `código`
    if (c === "`") {
      const fim = s.indexOf("`", i + 1);
      if (fim > i + 1 && fim - i <= 1000 && !s.slice(i + 1, fim).includes("\n")) {
        soltar();
        saida.push({ t: "codigo", v: s.slice(i + 1, fim) });
        i = fim + 1;
        continue;
      }
    }
    // $$fórmula$$
    if (c === "$" && s[i + 1] === "$") {
      const fim = s.indexOf("$$", i + 2);
      const dentro = fim > i + 2 ? s.slice(i + 2, fim) : "";
      if (fim > 0 && formulaCabe(dentro) && !dentro.includes("\n\n")) {
        soltar();
        saida.push({ t: "formula", v: dentro.trim() });
        i = fim + 2;
        continue;
      }
    }
    if (completo && podeAninhar) {
      // **negrito** e ~~riscado~~
      const dupla = s.startsWith("**", i) ? "negrito" : s.startsWith("~~", i) ? "riscado" : null;
      if (dupla && !espaco(s[i + 2])) {
        const fim = acharFecho(s, i + 2, s.slice(i, i + 2));
        if (fim > 0) {
          soltar();
          saida.push({ t: dupla, filhos: lerTrechos(s.slice(i + 2, fim), alcance, profundidade + 1, dentroDeLink) });
          i = fim + 2;
          continue;
        }
      }
      // _itálico_ e *itálico*: o marcador abre fora de palavra e fecha antes de algo que não é letra.
      if ((c === "_" || c === "*") && s[i + 1] !== c && !letraOuNumero(s[i - 1]) && !espaco(s[i + 1])) {
        const fim = acharFecho(s, i + 1, c);
        if (fim > 0) {
          soltar();
          saida.push({ t: "italico", filhos: lerTrechos(s.slice(i + 1, fim), alcance, profundidade + 1, dentroDeLink) });
          i = fim + 1;
          continue;
        }
      }
      // [texto](endereço): só endereço seguro vira link; o resto fica só o texto.
      if (c === "[" && !dentroDeLink) {
        const fimTexto = s.indexOf("]", i + 1);
        const rotulo = fimTexto > i ? s.slice(i + 1, fimTexto) : "";
        if (fimTexto > i + 1 && !rotulo.includes("[") && !rotulo.includes("\n") && s[fimTexto + 1] === "(") {
          const fimUrl = fechoDoEndereco(s, fimTexto + 2);
          const alvo = fimUrl > 0 ? s.slice(fimTexto + 2, fimUrl) : "";
          if (fimUrl > 0 && !/\s/.test(alvo.trim()) && !alvo.includes("\n")) {
            soltar();
            const filhos = lerTrechos(rotulo, alcance, profundidade + 1, true);
            const url = urlSegura(alvo);
            if (url) saida.push({ t: "link", url, filhos });
            else saida.push(...filhos);
            i = fimUrl + 1;
            continue;
          }
        }
      }
    }
    buffer += c;
    i++;
  }
  soltar();
  return juntar(saida);
}

// ── Blocos ──

const CERCA = /^ {0,3}```\s*([A-Za-z0-9+#._-]{0,20})\s*$/;
const CERCA_FIM = /^ {0,3}```\s*$/;
const FORMULA_ABRE = /^ {0,3}\$\$\s*$/;
const FORMULA_LINHA = /^ {0,3}\$\$(.+)\$\$\s*$/;
const TITULO = /^ {0,3}(#{1,3})\s+(.+?)\s*#*\s*$/;
const SEPARADOR = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGEM = /^ {0,3}!\[([^\]\n]{0,255})\]\(imagem:([1-4])\)\s*$/;
const CITACAO = /^ {0,3}>\s?(.*)$/;
const ITEM = /^ {0,3}([-*•])\s+(.*)$/;
const ITEM_NUMERO = /^ {0,3}(\d{1,3})[.)]\s+(.*)$/;
const vazia = (l: string) => l.trim() === "";

/** Lê o texto formatado inteiro em blocos. Nunca lança: o que não casa com nada vira parágrafo. */
export function lerTextoFormatado(fonte: string): Bloco[] {
  const linhas = limparFonte(fonte).slice(0, MAXIMO_DO_TEXTO).split("\n");
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ t: "paragrafo", trechos: lerTrechos(paragrafo.join("\n")) });
    paragrafo = [];
  };
  let i = 0;
  while (i < linhas.length && blocos.length < MAX_BLOCOS) {
    const linha = linhas[i];
    const cerca = CERCA.exec(linha);
    if (cerca) {
      fecharParagrafo();
      const corpo: string[] = [];
      i++;
      while (i < linhas.length && !CERCA_FIM.test(linhas[i])) corpo.push(linhas[i++]);
      i++; // o fecho (ou o fim do texto)
      blocos.push({ t: "codigo", lingua: cerca[1].toLowerCase(), v: corpo.join("\n") });
      continue;
    }
    if (FORMULA_ABRE.test(linha)) {
      let j = i + 1;
      const corpo: string[] = [];
      while (j < linhas.length && !FORMULA_ABRE.test(linhas[j])) corpo.push(linhas[j++]);
      const expressao = corpo.join("\n").trim();
      if (j < linhas.length && formulaCabe(expressao)) {
        fecharParagrafo();
        blocos.push({ t: "formula", v: expressao });
        i = j + 1;
        continue;
      }
    }
    const umaLinha = FORMULA_LINHA.exec(linha);
    if (umaLinha && !umaLinha[1].includes("$$") && formulaCabe(umaLinha[1].trim())) {
      fecharParagrafo();
      blocos.push({ t: "formula", v: umaLinha[1].trim() });
      i++;
      continue;
    }
    const titulo = TITULO.exec(linha);
    if (titulo) {
      fecharParagrafo();
      blocos.push({ t: "titulo", nivel: titulo[1].length <= 2 ? 2 : 3, trechos: lerTrechos(titulo[2]) });
      i++;
      continue;
    }
    if (SEPARADOR.test(linha)) {
      fecharParagrafo();
      blocos.push({ t: "separador" });
      i++;
      continue;
    }
    const imagem = IMAGEM.exec(linha);
    if (imagem) {
      fecharParagrafo();
      blocos.push({ t: "imagem", n: Number(imagem[2]), alt: imagem[1].trim() });
      i++;
      continue;
    }
    if (CITACAO.test(linha)) {
      fecharParagrafo();
      const dentro: string[] = [];
      while (i < linhas.length && CITACAO.test(linhas[i])) dentro.push(CITACAO.exec(linhas[i++])![1]);
      const paragrafos = dentro.join("\n").split(/\n\s*\n/).filter((p) => p.trim()).map((p) => lerTrechos(p));
      blocos.push({ t: "citacao", paragrafos });
      continue;
    }
    const item = ITEM.exec(linha) ?? ITEM_NUMERO.exec(linha);
    if (item) {
      fecharParagrafo();
      const ordenada = /^\d/.test(item[1]);
      const padrao = ordenada ? ITEM_NUMERO : ITEM;
      const itens: string[] = [];
      const inicio = ordenada ? Number(item[1]) : 1;
      while (i < linhas.length && itens.length < MAX_ITENS) {
        const m = padrao.exec(linhas[i]);
        if (m) itens.push(m[2]);
        else if (itens.length && /^ {2,}\S/.test(linhas[i])) itens[itens.length - 1] += `\n${linhas[i].trim()}`;
        else break;
        i++;
      }
      blocos.push({ t: "lista", ordenada, inicio, itens: itens.map((x) => lerTrechos(x)) });
      continue;
    }
    if (vazia(linha)) fecharParagrafo();
    else paragrafo.push(linha);
    i++;
  }
  fecharParagrafo();
  return blocos;
}

// ── Para ler sem marcas ──

function textoDosTrechos(trechos: Trecho[]): string {
  return trechos
    .map((x) => (x.t === "texto" || x.t === "codigo" || x.t === "formula" ? x.v : x.t === "quebra" ? "\n" : textoDosTrechos(x.filhos)))
    .join("");
}

/** O texto sem as marcas (para resumo, leitor de tela, busca no aparelho). Imagem vira a descrição; fórmula, a expressão. */
export function textoSemMarcas(fonte: string): string {
  return lerTextoFormatado(fonte)
    .map((b) => {
      switch (b.t) {
        case "paragrafo":
        case "titulo":
          return textoDosTrechos(b.trechos);
        case "lista":
          return b.itens.map((x) => textoDosTrechos(x)).join("\n");
        case "citacao":
          return b.paragrafos.map((x) => textoDosTrechos(x)).join("\n");
        case "codigo":
        case "formula":
          return b.v;
        case "imagem":
          return b.alt;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** O texto usa alguma marca de formatação? (O cartão só troca para o leitor formatado quando precisa.) */
export function temFormatacao(fonte: string): boolean {
  return /```|\$\$|`[^`\n]+`|\*\*|~~|(^|\n) {0,3}(#{1,3}\s|>\s?|[-*•]\s|\d{1,3}[.)]\s|-{3,}\s*($|\n))|!\[[^\]]*\]\(imagem:[1-4]\)|\[[^\]\n]+\]\([^)\s]+\)|(^|[^\p{L}\p{N}])[_*][^\s_*]/u.test(fonte);
}

/** Os números das imagens do post que o texto põe no meio (as outras aparecem embaixo, como sempre). */
export function imagensNoMeio(fonte: string): number[] {
  return [...new Set(lerTextoFormatado(fonte).flatMap((b) => (b.t === "imagem" ? [b.n] : [])))];
}
