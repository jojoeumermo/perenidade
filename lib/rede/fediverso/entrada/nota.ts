// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Uma nota de fora (Note, Article, Page ou Question) lida no formato que o banco guarda (ação nota_recebida, PLANO-FEDIVERSO 3.1):
//   • HTML LIMPO por lista permitida (as marcas que o Mastodon 4.2+ mantém: parágrafo, quebra, link, ênfase, lista, citação e código;
//     links só http/https, sempre com rel="nofollow noopener noreferrer"), e o texto puro ao lado;
//   • a visibilidade vem de to/cc como no Mastodon: Public em "to" = público; Public em "cc" = não listado; a coleção de seguidores
//     do autor sem Public = só-seguidores. O resto (mensagem direta, "limitado") NUNCA é guardado: a Alumia não tem DM federada;
//   • a mídia guarda só o endereço https e os metadados (alt, tamanho, blurhash): a imagem é buscada pela rota-proxy, nunca pelo
//     navegador de quem lê (a instância de fora não vê o IP de ninguém);
//   • as menções a gente daqui (tag Mention ou o ator daqui em to/cc).
// Lógica pura (menos o `fed`, que só lê variáveis), sem "@/".
import { ID_DE_POST, HANDLE_FED } from "../enderecos";
import { fed } from "../servidor";
import { escaparHtml, htmlParaTexto, textoCurto } from "../texto";

export const PUBLICOS = new Set(["https://www.w3.org/ns/activitystreams#Public", "as:Public", "Public"]);
export const TIPOS_DE_NOTA = new Set(["Note", "Article", "Page", "Question"]);
export const TIPOS_DE_ATOR = new Set(["Person", "Service", "Application", "Group", "Organization"]);

export type Visibilidade = "publico" | "nao_listado" | "seguidores" | "direto";

export interface MidiaRecebida {
  url: string;
  tipo: string;
  alt: string;
  largura: number | null;
  altura: number | null;
  blurhash: string | null;
}

/** O que vai para a ação nota_recebida (contrato 3.1). */
export interface NotaRecebida {
  id: string;
  ator: string;
  url: string | null;
  html_limpo: string;
  texto: string;
  aviso: string;
  sensivel: boolean;
  publicado: string | null;
  em_resposta_a: string | null;
  contexto: string | null;
  visibilidade: Exclude<Visibilidade, "direto">;
  mencoes_locais: string[];
  midia: MidiaRecebida[];
}

// ── Ajudas de endereço ──

export const idDe = (v: unknown): string | null => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  return null;
};
export const dominio = (u: string | null | undefined) => {
  try {
    return u ? new URL(u).host : "";
  } catch {
    return "";
  }
};
export const urlHttps = (v: unknown, max = 1000): string | null => (typeof v === "string" && v.length <= max && /^https:\/\/[^\s<>"']+$/.test(v) ? v : null);
/** Uma lista de endereços (to, cc, object de uma Flag…): aceita texto, objeto com id ou lista dos dois. Até 200. */
export const listaDeIds = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v])
    .slice(0, 200)
    .map(idDe)
    .filter((x): x is string => Boolean(x));

const API = () => `${fed.base}/api/fediverso`;

/** O @nome local de um endereço de ator daqui (…/api/fediverso/u/<nome>), ou nulo. */
export function handleLocal(url: string | null): string | null {
  if (!url || !url.startsWith(`${API()}/u/`)) return null;
  const h = url.slice(`${API()}/u/`.length);
  return HANDLE_FED.test(h) ? h : null;
}

/** O id de um post daqui (…/api/fediverso/p/<uuid>), ou nulo. */
export function postLocal(url: string | null): string | null {
  if (!url || !url.startsWith(`${API()}/p/`)) return null;
  const id = url.slice(`${API()}/p/`.length);
  return ID_DE_POST.test(id) ? id : null;
}

/** O slug de uma comunidade daqui como Group (…/api/fediverso/c/<slug>), ou nulo. */
export function comunidadeLocal(url: string | null): string | null {
  if (!url || !url.startsWith(`${API()}/c/`)) return null;
  const slug = url.slice(`${API()}/c/`.length);
  return /^[a-z0-9-]{2,60}$/.test(slug) ? slug : null;
}

// ── HTML limpo por lista permitida ──

const PERMITIDAS = new Set(["p", "br", "span", "a", "abbr", "del", "s", "pre", "blockquote", "code", "b", "strong", "u", "i", "em", "ul", "ol", "li", "ruby", "rt", "rp"]);
const VAZIAS = new Set(["br"]);
// Estas some com tudo o que têm dentro (o texto delas não é conteúdo de quem escreveu).
const SEM_CONTEUDO = new Set(["script", "style", "template", "iframe", "object", "embed", "svg", "math", "noscript", "textarea", "select", "title", "head", "frameset", "noembed", "xmp", "plaintext"]);
// As classes que o Mastodon usa para menção, hashtag e link encurtado (o resto some).
const CLASSES = new Set(["h-card", "u-url", "mention", "hashtag", "ellipsis", "invisible"]);
const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
// Caracteres de controle e de direção de texto (servem para disfarçar link): fora.
const INVISIVEIS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;

function decodificar(texto: string): string {
  return texto
    .replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z0-9]{2,8});?/gi, (inteira, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 31 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
      }
      return ENTIDADES[e.toLowerCase()] ?? inteira;
    })
    .replace(INVISIVEIS, "");
}

function atributos(texto: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of texto.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const nome = a[1].toLowerCase();
    if (!m.has(nome)) m.set(nome, decodificar(a[2] ?? a[3] ?? a[4] ?? ""));
  }
  return m;
}

function abrir(nome: string, attrs: Map<string, string>): string {
  const saida: string[] = [];
  const classes = (attrs.get("class") ?? "").split(/\s+/).filter((c) => CLASSES.has(c));
  if (nome === "a") {
    const href = (attrs.get("href") ?? "").trim();
    if (/^https?:\/\/[^\s<>"']{1,2000}$/i.test(href)) saida.push(`href="${escaparHtml(href)}"`);
    saida.push('rel="nofollow noopener noreferrer"', 'target="_blank"');
  }
  if ((nome === "a" || nome === "span") && classes.length) saida.push(`class="${classes.join(" ")}"`);
  if (nome === "ol") {
    const inicio = attrs.get("start");
    if (inicio && /^-?\d{1,6}$/.test(inicio)) saida.push(`start="${inicio}"`);
    if (attrs.has("reversed")) saida.push("reversed");
  }
  if (nome === "li") {
    const valor = attrs.get("value");
    if (valor && /^-?\d{1,6}$/.test(valor)) saida.push(`value="${valor}"`);
  }
  if (nome === "abbr" && attrs.get("title")) saida.push(`title="${escaparHtml(attrs.get("title")!.slice(0, 200))}"`);
  return `<${nome}${saida.length ? ` ${saida.join(" ")}` : ""}>`;
}

/**
 * HTML de outra instância → HTML que a Alumia pode mostrar. Lista PERMITIDA: só as marcas acima, só os atributos acima, links só
 * http/https; todo texto é decodificado e escapado de novo (nada de entidade esquisita passando); marcas abertas são fechadas no fim.
 * Tudo o que não está na lista some, mas o texto de dentro fica (menos script, style e afins, que somem inteiros).
 */
export function limparHtml(html: string, max = 20_000): string {
  const entrada = html.slice(0, 60_000);
  const pilha: string[] = [];
  let saida = "";
  let i = 0;
  while (i < entrada.length) {
    const lt = entrada.indexOf("<", i);
    const ate = lt === -1 ? entrada.length : lt;
    if (ate > i) saida += escaparHtml(decodificar(entrada.slice(i, ate)));
    if (lt === -1) break;
    i = lt;
    if (entrada.startsWith("<!--", i)) {
      const fim = entrada.indexOf("-->", i + 4);
      i = fim === -1 ? entrada.length : fim + 3;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]{0,30})((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(entrada.slice(i, i + 4000));
    if (!m) {
      // "<" solto ou marca estranha (<!doctype>, <?xml>): vira texto, escapado.
      if (/^<[!?]/.test(entrada.slice(i, i + 2))) {
        const fim = entrada.indexOf(">", i);
        i = fim === -1 ? entrada.length : fim + 1;
      } else {
        saida += "&lt;";
        i++;
      }
      continue;
    }
    i += m[0].length;
    const fechando = m[1] === "/";
    let nome = m[2].toLowerCase();
    if (/^h[1-6]$/.test(nome)) nome = "p";
    if (!fechando && SEM_CONTEUDO.has(nome)) {
      const fim = new RegExp(`</${nome}\\s*>`, "i").exec(entrada.slice(i));
      i = fim ? i + fim.index + fim[0].length : entrada.length;
      continue;
    }
    if (!PERMITIDAS.has(nome)) continue;
    if (VAZIAS.has(nome)) {
      if (!fechando) saida += `<${nome}>`;
      continue;
    }
    if (!fechando) {
      if (pilha.length >= 40) continue;
      pilha.push(nome);
      saida += abrir(nome, atributos(m[3]));
      continue;
    }
    const pos = pilha.lastIndexOf(nome);
    if (pos === -1) continue;
    while (pilha.length > pos) saida += `</${pilha.pop()}>`;
  }
  while (pilha.length) saida += `</${pilha.pop()}>`;
  // Grande demais: fica só o texto, em parágrafos escapados (nunca um HTML cortado no meio de uma marca).
  if (saida.length > max) return textoEmHtml(htmlParaTexto(html, Math.floor(max / 2)));
  return saida;
}

/** Texto puro em HTML escapado (parágrafos e quebras). */
export function textoEmHtml(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escaparHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ── Visibilidade, menções e mídia ──

/**
 * A visibilidade de uma nota pelos destinatários, como o Mastodon: Public em "to" = público; em "cc" = não listado; a coleção de
 * seguidores do autor (sem Public) = só-seguidores; o resto = direto. Só vale como coleção de seguidores a que o ator declara
 * (`seguidores`) ou "<ator>/followers": um endereço qualquer terminado em /followers não basta (na dúvida, é direto e não entra).
 */
export function visibilidadeDe(nota: Record<string, unknown>, autor: string, seguidores?: string | null): Visibilidade {
  const para = listaDeIds(nota.to);
  const copia = listaDeIds(nota.cc);
  if (para.some((x) => PUBLICOS.has(x))) return "publico";
  if (copia.some((x) => PUBLICOS.has(x))) return "nao_listado";
  const colecoes = new Set([`${autor}/followers`, ...(seguidores ? [seguidores] : [])]);
  if ([...para, ...copia].some((x) => colecoes.has(x))) return "seguidores";
  return "direto";
}

/** Os @nomes daqui mencionados (tag Mention com href de ator daqui, ou o ator daqui em to/cc). Sem repetir, até 20. */
export function mencoesLocais(nota: Record<string, unknown>): string[] {
  const vistos = new Set<string>();
  const tags = Array.isArray(nota.tag) ? nota.tag : nota.tag ? [nota.tag] : [];
  for (const t of tags.slice(0, 100)) {
    if (!t || typeof t !== "object" || (t as { type?: unknown }).type !== "Mention") continue;
    const h = handleLocal(typeof (t as { href?: unknown }).href === "string" ? (t as { href: string }).href : null);
    if (h) vistos.add(h);
  }
  for (const x of [...listaDeIds(nota.to), ...listaDeIds(nota.cc)]) {
    const h = handleLocal(x);
    if (h) vistos.add(h);
  }
  return [...vistos].slice(0, 20);
}

const BLURHASH = /^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{6,100}$/;
const inteiro = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 20_000 ? v : null);

/** Os anexos (até 4, como o Mastodon): só endereço https e metadados. */
export function midiaDe(nota: Record<string, unknown>): MidiaRecebida[] {
  const anexos = Array.isArray(nota.attachment) ? nota.attachment : nota.attachment ? [nota.attachment] : [];
  const saida: MidiaRecebida[] = [];
  for (const a of anexos.slice(0, 20)) {
    if (!a || typeof a !== "object") continue;
    const anexo = a as Record<string, unknown>;
    if (!["Image", "Document", "Video", "Audio"].includes(String(anexo.type))) continue;
    // "url" pode ser texto, um Link ({href}) ou uma lista de Links.
    const bruto = Array.isArray(anexo.url) ? anexo.url[0] : anexo.url;
    const url = urlHttps(typeof bruto === "object" && bruto ? (bruto as { href?: unknown }).href : bruto);
    if (!url) continue;
    const tipoDeclarado = typeof anexo.mediaType === "string" ? anexo.mediaType.toLowerCase() : "";
    const tipo = /^(image|video|audio)\/[a-z0-9.+-]{1,40}$/.test(tipoDeclarado) ? tipoDeclarado : anexo.type === "Image" ? "image" : "";
    if (!tipo) continue;
    saida.push({
      url,
      tipo,
      alt: textoCurto(anexo.name ?? anexo.summary, 1500),
      largura: inteiro(anexo.width),
      altura: inteiro(anexo.height),
      blurhash: typeof anexo.blurhash === "string" && BLURHASH.test(anexo.blurhash) ? anexo.blurhash : null,
    });
    if (saida.length >= 4) break;
  }
  return saida;
}

/** As opções de uma enquete (Question), como texto: o voto federado não existe na Alumia, então ela entra como texto + opções. */
function opcoesDaEnquete(nota: Record<string, unknown>): string[] {
  const opcoes = Array.isArray(nota.oneOf) ? nota.oneOf : Array.isArray(nota.anyOf) ? nota.anyOf : [];
  return opcoes
    .slice(0, 10)
    .map((o) => (o && typeof o === "object" ? textoCurto((o as { name?: unknown }).name, 200) : ""))
    .filter(Boolean);
}

const autorDe = (nota: Record<string, unknown>): string | null => {
  const a = nota.attributedTo;
  if (Array.isArray(a)) {
    const pessoas = a.map(idDe).filter((x): x is string => Boolean(x));
    return pessoas.length ? pessoas[0] : null;
  }
  return idDe(a);
};

/**
 * Lê uma nota de fora. Recusa (com o motivo) quando: não é nota; o id não é https ou mora em outro domínio que o autor; o autor
 * declarado não é quem mandou; é direta/limitada (nunca guardada); ou está vazia.
 */
export function lerNota(
  nota: Record<string, unknown>,
  autor: string,
  { seguidores }: { seguidores?: string | null } = {},
): { ok: true; nota: NotaRecebida } | { ok: false; motivo: string } {
  const tipo = String(nota.type ?? "");
  if (!TIPOS_DE_NOTA.has(tipo)) return { ok: false, motivo: "ignorado" };
  const id = urlHttps(idDe(nota), 500);
  if (!id || dominio(id) !== dominio(autor) || autorDe(nota) !== autor) return { ok: false, motivo: "nota_de_outro" };
  const visibilidade = visibilidadeDe(nota, autor, seguidores);
  // Mensagem direta ou limitada: a Alumia não tem DM federada; nada é guardado, e quem mandou recebe 202 como sempre.
  if (visibilidade === "direto") return { ok: false, motivo: "direto" };
  const conteudo = typeof nota.content === "string" ? nota.content : "";
  const titulo = tipo === "Article" || tipo === "Page" ? textoCurto(nota.name, 300) : "";
  const opcoes = tipo === "Question" ? opcoesDaEnquete(nota) : [];
  let texto = htmlParaTexto(conteudo, 5000);
  let html = limparHtml(conteudo);
  if (titulo) {
    texto = `${titulo}\n\n${texto}`.trim();
    html = `<p><strong>${escaparHtml(titulo)}</strong></p>${html}`;
  }
  if (opcoes.length) {
    texto = `${texto}\n\n${opcoes.map((o) => `• ${o}`).join("\n")}`.trim();
    html = `${html}<ul>${opcoes.map((o) => `<li>${escaparHtml(o)}</li>`).join("")}</ul>`;
  }
  const midia = midiaDe(nota);
  if (!texto && !midia.length) return { ok: false, motivo: "vazio" };
  const publicado = typeof nota.published === "string" && Number.isFinite(Date.parse(nota.published)) ? new Date(nota.published).toISOString() : null;
  // "url" pode ser texto, um Link ({href}) ou uma lista deles.
  const urlBruta: unknown = Array.isArray(nota.url) ? nota.url[0] : nota.url;
  const url = urlHttps(urlBruta && typeof urlBruta === "object" ? ((urlBruta as { href?: unknown }).href ?? idDe(urlBruta)) : urlBruta, 500);
  const contexto = urlHttps(nota.context, 500) ?? urlHttps(nota.conversation, 500) ?? (typeof nota.conversation === "string" && /^tag:[^\s]{1,300}$/.test(nota.conversation) ? nota.conversation : null);
  return {
    ok: true,
    nota: {
      id,
      ator: autor,
      url,
      html_limpo: html,
      texto,
      aviso: textoCurto(nota.summary, 200),
      sensivel: nota.sensitive === true,
      publicado,
      em_resposta_a: urlHttps(idDe(nota.inReplyTo), 500),
      contexto,
      visibilidade,
      mencoes_locais: mencoesLocais(nota),
      midia,
    },
  };
}
