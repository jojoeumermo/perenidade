// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O HTML de um post de fora vira uma ÁRVORE de nós por lista permitida, que components/rede/fediverso/HtmlDeFora.tsx desenha com
// elementos React (nunca dangerouslySetInnerHTML). O servidor já limpou o HTML (lib/rede/fediverso/entrada/nota.ts); aqui a tela
// não confia nisso e confere de novo. O analisador é pequeno e conservador, sem DOM (roda no Node nos testes): na dúvida, vira
// texto. Nenhum atributo passa, a não ser o href de <a>, e só se for https://.

export const TAGS_DE_FORA = ["p", "br", "a", "span", "strong", "b", "em", "i", "u", "del", "s", "ul", "ol", "li", "blockquote", "code", "pre"] as const;
export type TagDeFora = (typeof TAGS_DE_FORA)[number];

/** Um nó da árvore: texto puro, ou um elemento permitido com os filhos. `href` só existe em "a" e é sempre https://. */
export type NoDeFora = string | { tag: TagDeFora; href?: string; filhos: NoDeFora[] };

const PERMITIDAS: ReadonlySet<string> = new Set(TAGS_DE_FORA);
// O conteúdo destas some inteiro (é código, estilo ou outro documento, não texto para ler).
const SOME_COM_O_CONTEUDO = new Set(["script", "style", "iframe", "noscript", "template", "textarea", "title", "head", "svg", "math", "object", "embed", "applet", "select", "xmp", "noembed", "noframes", "frameset", "canvas", "audio", "video"]);
// Tag desconhecida que separa blocos: os filhos ficam, com um espaço no lugar da quebra.
const DE_BLOCO = new Set(["div", "section", "article", "header", "footer", "aside", "nav", "main", "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "td", "th", "dl", "dt", "dd", "hr", "figure", "figcaption", "address", "details", "summary"]);
// Abrir um destes fecha um <p> aberto (como o navegador faz).
const FECHA_PARAGRAFO = new Set(["p", "ul", "ol", "blockquote", "pre"]);

export const LIMITE_DE_HTML = 20_000;
export const LIMITE_DE_NOS = 1_500;
export const LIMITE_DE_PROFUNDIDADE = 12;

const NOMES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", copy: "©" };

/** Troca as entidades (&amp; &#60; &#x3c;) pelo caractere. O resultado é só TEXTO: quem desenha é o React, que escapa tudo. */
export function semEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]{1,6}(?=;|[^0-9a-f]|$)|#[0-9]{1,7}(?=;|[^0-9]|$)|[a-z]{2,8}(?=;));?/gi, (inteiro, nome: string) => {
    if (nome[0] !== "#") return NOMES[nome.toLowerCase()] ?? inteiro;
    const n = /^#x/i.test(nome) ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
    // Sem caracteres de controle (fora quebra de linha e tabulação), sem metades de par e nada além do Unicode.
    if (!Number.isFinite(n) || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff) || (n < 32 && n !== 9 && n !== 10) || (n >= 127 && n < 160)) return "";
    return String.fromCodePoint(n);
  });
}

/** O href de um link de fora: só https://, sem usuário e senha, sem espaço nem caractere de controle. Senão, nulo. */
export function hrefSeguro(valor: string | null | undefined): string | null {
  if (!valor) return null;
  // O navegador ignora tabulação e quebra de linha dentro do endereço ("java\tscript:"): aqui isso já reprova.
  const limpo = semEntidades(valor).trim();
  if (limpo.length > 2000 || !/^https:\/\/[^\s<>"'`\\\u0000-\u001f\u007f]+$/i.test(limpo)) return null;
  try {
    const u = new URL(limpo);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

// Uma tag bem formada: <nome atributos> ou </nome>. Aspas dentro dos atributos podem conter ">".
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
// Um atributo por vez (nome, ou nome=valor com ou sem aspas), como o navegador lê: um "href=" escrito DENTRO do valor de outro
// atributo não conta.
const ATRIBUTO = /([^\s"'=<>/`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?|"[^"]*"|'[^']*'/g;

/** O valor do PRIMEIRO atributo de nome exatamente "href" (nulo se não há). */
function hrefDosAtributos(atributos: string): string | null {
  for (const a of atributos.matchAll(ATRIBUTO)) {
    if (a[1]?.toLowerCase() === "href") return a[2] ?? a[3] ?? a[4] ?? "";
  }
  return null;
}

// Caracteres de direção de texto (viram o texto ao contrário para disfarçar um endereço). O de junção (U+200D) fica: é dele
// que são feitos vários emojis.
const DE_DIRECAO = /[؜‎‏‪-‮⁦-⁩]/g;

/** Tira os caracteres de direção de um texto de fora. */
export function semDirecao(texto: string): string {
  return texto.replace(DE_DIRECAO, "");
}

interface Aberto {
  tag: TagDeFora | null;
  filhos: NoDeFora[];
}

/**
 * Converte o HTML de fora na árvore de nós permitidos. Tag fora da lista: fica só o texto dos filhos (ou nada, se é script,
 * estilo, iframe, svg…). Atributo nenhum passa (classe, estilo, on*), só o href https de <a>; link com outro endereço vira texto.
 * Tamanho, número de nós e profundidade têm teto; o que não fecha é fechado no fim; "<" solto é texto.
 */
export function htmlParaArvore(html: string | null | undefined): NoDeFora[] {
  if (typeof html !== "string" || !html) return [];
  const fonte = html.slice(0, LIMITE_DE_HTML);
  // Só A–Z muda de caixa: o tamanho do texto não muda e os índices continuam valendo.
  const minuscula = fonte.replace(/[A-Z]+/g, (x) => x.toLowerCase());
  const raiz: Aberto = { tag: null, filhos: [] };
  const pilha: Aberto[] = [raiz];
  let nos = 0;
  const topo = () => pilha[pilha.length - 1];
  const texto = (bruto: string) => {
    const t = semDirecao(semEntidades(bruto));
    if (!t) return;
    const filhos = topo().filhos;
    const ultimo = filhos[filhos.length - 1];
    if (typeof ultimo === "string") filhos[filhos.length - 1] = ultimo + t;
    else if (nos++ < LIMITE_DE_NOS) filhos.push(t);
  };
  const fecharAte = (tag: string) => {
    for (let k = pilha.length - 1; k > 0; k--) {
      if (pilha[k].tag === tag) {
        pilha.length = k;
        return;
      }
    }
  };
  const aberta = (tag: string) => pilha.some((a) => a.tag === tag);

  let i = 0;
  while (i < fonte.length && nos < LIMITE_DE_NOS) {
    const menor = fonte.indexOf("<", i);
    if (menor < 0) {
      texto(fonte.slice(i));
      break;
    }
    if (menor > i) texto(fonte.slice(i, menor));
    i = menor;
    // Comentário, <!DOCTYPE>, <?…>: somem (sem fim, some o resto).
    if (fonte.startsWith("<!--", i)) {
      const fim = fonte.indexOf("-->", i + 4);
      i = fim < 0 ? fonte.length : fim + 3;
      continue;
    }
    if (fonte[i + 1] === "!" || fonte[i + 1] === "?") {
      const fim = fonte.indexOf(">", i);
      i = fim < 0 ? fonte.length : fim + 1;
      continue;
    }
    TAG.lastIndex = i;
    const m = TAG.exec(fonte);
    if (!m) {
      // Parece o começo de uma tag que nunca fecha ("<script src=…" até o fim): some o resto. Senão é um "<" solto: texto.
      if (/^<\/?[a-zA-Z]/.test(fonte.slice(i, i + 3))) break;
      texto("<");
      i += 1;
      continue;
    }
    i = TAG.lastIndex;
    const fecha = m[1] === "/";
    const nome = m[2].toLowerCase();
    if (SOME_COM_O_CONTEUDO.has(nome)) {
      if (!fecha && !/\/\s*$/.test(m[3])) {
        const fim = minuscula.indexOf(`</${nome}`, i);
        const depois = fim < 0 ? -1 : fonte.indexOf(">", fim);
        i = depois < 0 ? fonte.length : depois + 1;
      }
      continue;
    }
    if (!PERMITIDAS.has(nome)) {
      if (DE_BLOCO.has(nome)) texto(" ");
      continue;
    }
    const tag = nome as TagDeFora;
    if (fecha) {
      if (tag !== "br") fecharAte(tag);
      continue;
    }
    if (tag === "br") {
      if (nos++ < LIMITE_DE_NOS) topo().filhos.push({ tag: "br", filhos: [] });
      continue;
    }
    if (FECHA_PARAGRAFO.has(tag) && aberta("p")) fecharAte("p");
    if (tag === "li") {
      // Item de lista só dentro de lista; um <li> aberto antes, na mesma lista, fecha.
      if (!aberta("ul") && !aberta("ol")) continue;
      if (topo().tag === "li") pilha.pop();
    }
    if (tag === "a" && aberta("a")) fecharAte("a");
    // Fundo demais: a tag some e os filhos ficam onde estão.
    if (pilha.length > LIMITE_DE_PROFUNDIDADE) continue;
    let no: Exclude<NoDeFora, string>;
    if (tag === "a") {
      const href = hrefSeguro(hrefDosAtributos(m[3]));
      // Link sem endereço que sirva: fica só o texto (a tag não entra na pilha).
      if (!href) continue;
      no = { tag, href, filhos: [] };
    } else {
      no = { tag, filhos: [] };
    }
    if (nos++ >= LIMITE_DE_NOS) break;
    topo().filhos.push(no);
    pilha.push({ tag, filhos: no.filhos });
  }
  return raiz.filhos;
}

const servidorDe = (endereco: string): string | null => {
  try {
    return new URL(endereco).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};
// Algo com cara de domínio no meio de um texto ("institutolucia.org", "https://exemplo.org/entrar"), em qualquer alfabeto.
const COM_CARA_DE_DOMINIO = /(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,62}[\p{L}\p{N}])?\.)+\p{L}{2,24}(?![\p{L}\p{N}-])/gu;

/**
 * O link engana? Se o TEXTO do link mostra um endereço ou domínio que não é o do destino de verdade
 * (<a href="https://mau.teste/login">https://institutolucia.org/entrar</a>), devolve o servidor real, para a tela escrever ao
 * lado. Texto comum ("clique aqui", "@tiao", "#moradia") ou que mostra o próprio destino: nulo.
 */
export function destinoQueEngana(href: string | null | undefined, texto: string): string | null {
  const real = href ? servidorDe(href) : null;
  if (!real) return null;
  for (const achado of semDirecao(texto).slice(0, 2000).matchAll(COM_CARA_DE_DOMINIO)) {
    if (servidorDe(`https://${achado[0]}/`) !== real) return real;
  }
  return null;
}

/**
 * O endereço "abrir no original" de um post ou perfil de fora. `url` (a página que a origem diz ter) só vale se passa por
 * hrefSeguro (https, sem usuário e senha) e fica no MESMO servidor de `referencia` (o id da nota ou do ator, que o servidor daqui
 * já conferiu contra o autor); senão vale a própria referência. Nulo se nem ela serve.
 */
export function linkDaOrigem(url: string | null | undefined, referencia: string | null | undefined): string | null {
  const base = hrefSeguro(referencia);
  const pagina = hrefSeguro(url);
  if (!base) return null;
  return pagina && servidorDe(pagina) === servidorDe(base) ? pagina : base;
}

/** O texto de uma árvore (para leitores de tela, resumos e testes). */
export function textoDaArvore(nos: readonly NoDeFora[]): string {
  return nos.map((n) => (typeof n === "string" ? n : n.tag === "br" ? "\n" : textoDaArvore(n.filhos) + (n.tag === "p" || n.tag === "li" || n.tag === "blockquote" || n.tag === "pre" ? "\n" : ""))).join("");
}
