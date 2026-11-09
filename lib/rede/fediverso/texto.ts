// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Texto na fronteira com o Fediverso. Para fora: o texto do post vira HTML simples e escapado (parágrafos, quebras, hashtags e
// menções como link). Para dentro: o HTML de outra instância vira texto puro (sem marcação, sem imagem, sem script) ou HTML limpo
// por lista permitida (limparHtml: só as marcas que o Mastodon 4.2+ mantém), antes de ser guardado ou mostrado. Lógica pura, sem "@/".

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** Escapa para HTML. */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Uma menção a ligar no HTML: a chave é "nome@instancia" (ou "nome", para alguém daqui), em minúsculas; o valor é o endereço. */
export type LinksDeMencao = ReadonlyMap<string, string>;

const MENCAO_NO_TEXTO = /(^|[\s(])@([a-z0-9_.-]{1,64})(?:@([a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{1,5})?))?(?![a-z0-9_@-])/gi;

/**
 * O texto de um post em HTML: parágrafos por linha em branco, <br> por quebra simples, #tag como link para a página da tag e, quando
 * vem a lista, @nome@instancia como menção (o h-card que o Mastodon 4.2+ mantém). Menção fora da lista fica texto puro.
 */
export function textoParaHtml(texto: string, linkDaTag: (tag: string) => string, mencoes?: LinksDeMencao): string {
  return texto
    .trim()
    .split(/\n{2,}/)
    .map((paragrafo) => {
      let html = escaparHtml(paragrafo)
        .replace(/\n/g, "<br>")
        .replace(/(^|\s)#([\p{L}\p{N}_]{2,40})/gu, (_, antes: string, tag: string) => `${antes}<a href="${escaparHtml(linkDaTag(tag.toLowerCase()))}" class="mention hashtag" rel="tag">#<span>${tag}</span></a>`);
      if (mencoes && mencoes.size > 0) {
        html = html.replace(MENCAO_NO_TEXTO, (inteira: string, antes: string, bruto: string, dominio: string | undefined) => {
          // "@ana." no fim da frase: o ponto não é do nome.
          const nome = dominio ? bruto : bruto.replace(/[.-]+$/, "");
          const href = nome ? mencoes.get((dominio ? `${nome}@${dominio}` : nome).toLowerCase()) : undefined;
          if (!href) return inteira;
          return `${antes}<span class="h-card" translate="no"><a href="${escaparHtml(href)}" class="u-url mention">@<span>${nome}</span></a></span>${bruto.slice(nome.length)}`;
        });
      }
      return `<p>${html}</p>`;
    })
    .join("");
}

/** As hashtags do texto (minúsculas, sem repetir, até 10). */
export function hashtagsDe(texto: string): string[] {
  const vistas = new Set<string>();
  for (const m of texto.matchAll(/(^|\s)#([\p{L}\p{N}_]{2,40})/gu)) {
    vistas.add(m[2].toLowerCase());
    if (vistas.size >= 10) break;
  }
  return [...vistas];
}

/** Decodifica as entidades HTML (as nomeadas comuns e as numéricas válidas). */
function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z0-9]{2,8});/gi, (inteira, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 31 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
    }
    return ENTIDADES[e.toLowerCase()] ?? inteira;
  });
}

/** Caracteres de controle e de direção de texto (que servem para disfarçar link). */
const INVISIVEIS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;

/** HTML de fora vira texto puro: quebras e parágrafos viram linhas, o resto da marcação some, as entidades são decodificadas. */
export function htmlParaTexto(html: string, max = 3000): string {
  const semBlocos = html
    .slice(0, 50_000)
    .replace(/<(script|style|template|iframe|object|svg|math)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|blockquote|h[1-6])\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  const decodificado = decodificarEntidades(semBlocos);
  const limpo = decodificado
    // Caracteres de controle e de direção de texto (que servem para disfarçar link) saem.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return Array.from(limpo).slice(0, max).join("");
}

/** Um texto curto de fora (nome, @nome, aviso de conteúdo): uma linha, sem marcação. */
export function textoCurto(valor: unknown, max = 200): string {
  if (typeof valor !== "string") return "";
  return htmlParaTexto(valor, max).replace(/\s+/g, " ").trim();
}

// ── HTML limpo por lista permitida ──
//
// As marcas e atributos que o Mastodon 4.2+ mantém no HTML de um post ([M-AP], "HTML sanitization"). Tudo o que não está aqui sai:
// a marca some e o texto de dentro fica (escapado); script, style e afins saem com o conteúdo. Nenhum atributo de evento, estilo ou
// imagem passa. O link só vale em http(s) e sempre sai com rel="nofollow noopener noreferrer" (sem "Referer", sem acesso à janela).
// A leitura é por fichas: o que não se lê como marca bem formada vira texto escapado, nunca marca.

const MARCAS_PERMITIDAS = new Set(["p", "br", "span", "a", "del", "s", "pre", "blockquote", "code", "b", "strong", "u", "i", "em", "ul", "ol", "li"]);
const MARCAS_VAZIAS = new Set(["br"]);
/** Saem com tudo o que têm dentro. */
const MARCAS_COM_CONTEUDO_FORA = new Set(["script", "style", "template", "iframe", "object", "embed", "svg", "math", "noscript", "textarea", "title", "head", "select", "xmp", "noembed", "noframes", "frameset", "plaintext"]);
/** As classes dos microformatos e das menções, como o Mastodon mantém. */
const CLASSE_PERMITIDA = /^(?:h|p|u|dt|e)-[a-z0-9-]{1,40}$|^(?:mention|hashtag|ellipsis|invisible)$/;

const MARCA = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]{0,20})((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/;
const ATRIBUTO = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function linkSeguro(valor: string): string | null {
  const limpo = decodificarEntidades(valor).replace(INVISIVEIS, "").trim();
  if (!/^https?:\/\//i.test(limpo) || limpo.length > 2000) return null;
  try {
    const u = new URL(limpo);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function atributosPermitidos(marca: string, brutos: string): string {
  const saida = new Map<string, string>();
  for (const m of brutos.matchAll(ATRIBUTO)) {
    const nome = m[1].toLowerCase();
    // Atributo repetido (dois href): vale o primeiro, como no navegador.
    if (saida.has(nome)) continue;
    const valor = m[2] ?? m[3] ?? m[4] ?? "";
    if (marca === "a" && nome === "href") {
      const href = linkSeguro(valor);
      if (href) saida.set(nome, `href="${escaparHtml(href)}"`);
    } else if ((marca === "a" || marca === "span") && nome === "class") {
      const classes = decodificarEntidades(valor).split(/\s+/).filter((c) => CLASSE_PERMITIDA.test(c)).slice(0, 6);
      if (classes.length) saida.set(nome, `class="${escaparHtml(classes.join(" "))}"`);
    } else if ((marca === "a" || marca === "span") && nome === "translate" && /^no$/i.test(valor)) {
      saida.set(nome, 'translate="no"');
    } else if (marca === "ol" && nome === "start" && /^-?\d{1,6}$/.test(valor)) {
      saida.set(nome, `start="${valor}"`);
    } else if (marca === "ol" && nome === "reversed") {
      saida.set(nome, "reversed");
    } else if (marca === "li" && nome === "value" && /^-?\d{1,6}$/.test(valor)) {
      saida.set(nome, `value="${valor}"`);
    }
  }
  if (marca === "a") {
    saida.set("rel", 'rel="nofollow noopener noreferrer"');
    saida.set("target", 'target="_blank"');
  }
  return [...saida.values()].map((a) => ` ${a}`).join("");
}

/**
 * HTML de fora limpo por lista permitida (a lista do Mastodon 4.2+). Devolve HTML seguro para mostrar: marcas fechadas na ordem,
 * texto sempre escapado, links só http(s) com rel="nofollow noopener noreferrer". `max` limita a entrada lida (em caracteres).
 */
export function limparHtml(html: string, max = 50_000): string {
  const fonte = html.slice(0, max);
  const pilha: string[] = [];
  let saida = "";
  let i = 0;
  const texto = (t: string) => {
    saida += escaparHtml(decodificarEntidades(t).replace(INVISIVEIS, ""));
  };
  while (i < fonte.length) {
    const lt = fonte.indexOf("<", i);
    if (lt < 0) {
      texto(fonte.slice(i));
      break;
    }
    if (lt > i) texto(fonte.slice(i, lt));
    const resto = fonte.slice(lt);
    if (resto.startsWith("<!--")) {
      const fim = fonte.indexOf("-->", lt + 4);
      i = fim < 0 ? fonte.length : fim + 3;
      continue;
    }
    if (/^<[!?]/.test(resto)) {
      const fim = fonte.indexOf(">", lt);
      i = fim < 0 ? fonte.length : fim + 1;
      continue;
    }
    const m = MARCA.exec(resto);
    if (!m) {
      // Não é marca bem formada: o "<" fica como texto (escapado).
      texto("<");
      i = lt + 1;
      continue;
    }
    i = lt + m[0].length;
    const fecha = m[1] === "/";
    const nome = m[2].toLowerCase();
    if (MARCAS_COM_CONTEUDO_FORA.has(nome)) {
      if (!fecha && m[4] !== "/") {
        const fim = new RegExp(`</${nome}\\s*>`, "i").exec(fonte.slice(i));
        i = fim ? i + fim.index + fim[0].length : fonte.length;
      }
      continue;
    }
    if (!MARCAS_PERMITIDAS.has(nome)) continue;
    if (MARCAS_VAZIAS.has(nome)) {
      if (!fecha) saida += `<${nome}>`;
      continue;
    }
    if (fecha) {
      const onde = pilha.lastIndexOf(nome);
      if (onde < 0) continue;
      while (pilha.length > onde) saida += `</${pilha.pop()}>`;
      continue;
    }
    if (pilha.length >= 40) continue;
    // Link dentro de link não existe em HTML: o de dentro sai (o texto fica).
    if (nome === "a" && pilha.includes("a")) continue;
    saida += `<${nome}${atributosPermitidos(nome, m[3])}>`;
    pilha.push(nome);
  }
  while (pilha.length) saida += `</${pilha.pop()}>`;
  return saida;
}
