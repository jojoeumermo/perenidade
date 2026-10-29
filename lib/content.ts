// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import { cache as perPage } from "react";
import { defaultLocale, type Locale, locales } from "@/i18n/config";
import { areaSlugs, licenses, stages, tools, type AreaSlug, type License, type Stage, type ToolId } from "./areas";
import { parseFrontmatter } from "./frontmatter";
import { type Exercicio, validarPratica } from "./pratica";
import { plainText } from "./text";
import { type Acontecimento, lugaresDaLinha, type LugarDaLinha, temasDaLinha, type TemaDaLinha } from "./linha-do-tempo";
import { regiaoDoLocal, type RegiaoDoMemorial } from "./memorial";

// O cache do React vale para uma página só. Na montagem do site, cada uma das milhares de páginas relia e conferia
// o acervo inteiro. Ali o conteúdo não muda no meio do caminho, então o que foi lido fica guardado enquanto o
// processo vive. No desenvolvimento segue como era, para a aula editada aparecer ao recarregar a página.
function perProcess<A extends (string | undefined)[], R>(load: (...args: A) => R): (...args: A) => R {
  const kept = new Map<string, R>();
  return (...args) => {
    const key = JSON.stringify(args);
    if (!kept.has(key)) kept.set(key, load(...args));
    return kept.get(key) as R;
  };
}
const cache = process.env.NODE_ENV === "production" ? (perProcess as unknown as typeof perPage) : perPage;

// Todo o conteúdo vive em arquivos dentro de content/. Cada mudança fica no histórico de versões,
// então qualquer alteração indevida se desfaz voltando à versão anterior.
//
// Tradução: ao lado de "arquivo.md" (português) pode existir "arquivo.en.md", "arquivo.es.md" etc.
// A tradução só precisa repetir os campos de texto; o resto vem do original. Sem tradução,
// o conteúdo aparece em português, com um aviso.

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface Source {
  title: string;
  author?: string;
  url?: string;
  year?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  /** Aula de onde a questão veio, quando ela aparece fora da aula (prova da trilha). */
  href?: string;
}

interface Localized {
  /** false quando o texto exibido é o original em português por falta de tradução. */
  translated: boolean;
  /** Caminho do original dentro de content/. */
  file: string;
}

export interface Lesson extends Localized {
  slug: string;
  title: string;
  summary: string;
  authors: string[];
  reviewed: boolean;
  body: string;
  quiz: QuizQuestion[];
  sources: Source[];
  minutes: number;
  /** Termos que a própria aula define (campo "glossario" do cabeçalho): entram sozinhos no glossário do site. */
  terms: { term: string; summary: string }[];
  /** A prática lúdica das aulas de idioma (campo "pratica" do cabeçalho): os exercícios que o site joga no fim da aula. */
  practice: Exercicio[];
  /** Ferramentas que a aula sugere (campo "ferramentas"): vêm primeiro na caixa de ferramentas da aula. */
  tools: ToolId[];
  /** O que é bom ter visto antes (campo "requisitos"): "slug-da-aula" (mesma trilha) ou "trilha/slug-da-aula". */
  requires: string[];
  /** Aulas de outras disciplinas sobre o mesmo assunto, escolhidas por quem escreveu (campo "veja_tambem"). */
  related: string[];
}

/** Item do roteiro de uma trilha: aula já escrita ou ainda em preparação. */
export interface PlanItem {
  slug: string;
  title: string;
  ready: boolean;
}

export interface Track extends Localized {
  slug: string;
  title: string;
  area: AreaSlug;
  stage: Stage;
  /** Posição da trilha dentro da etapa (campo "ordem" do _trilha.md). */
  order: number;
  summary: string;
  intro: string;
  lessons: Lesson[];
  plan: PlanItem[];
}

export interface Book extends Localized {
  id: string;
  title: string;
  author: string;
  authorSlugs: string[];
  area: AreaSlug;
  license: License;
  source: string;
  url: string;
  language: string;
  year?: string;
  synopsis: string;
  /** A capa guardada no próprio site (public/capas, montada por scripts/capas.mjs), quando a fonte tem uma aberta. */
  cover?: string;
  /** De onde veio a capa e a licença dela (content/capas.json). */
  coverCredit?: string;
}

/** Obra vinda dos catálogos abertos (content/catalogo): só os dados que a fonte publica. */
export interface CatalogEntry {
  t: string;
  a: string;
  u: string;
  f: string;
  l: string;
  i: string;
}

export interface Author extends Localized {
  slug: string;
  name: string;
  years: string;
  place: string;
  archiveUrl?: string;
  archiveSource?: string;
  bio: string;
}

export interface Tribute extends Localized {
  slug: string;
  name: string;
  born: string;
  died: string;
  place: string;
  body: string;
  photo?: string;
  photoCredit?: string;
  photoSource?: string;
  /** Onde a pessoa tombou, pelo país do "local" da ficha original (lib/memorial.ts). */
  region?: RegiaoDoMemorial;
}

export interface ContentPage extends Localized {
  title: string;
  eyebrow: string;
  lead: string;
  body: string;
}

export interface Term extends Localized {
  slug: string;
  term: string;
  summary: string;
  body: string;
}

/** Verbete do glossário completo: sabe em quais disciplinas e aulas o termo aparece. */
export interface IndexedTerm extends Term {
  areas: AreaSlug[];
  lessons: { href: string; title: string }[];
}

export interface Article extends Localized {
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  date: string;
  section: string;
  /** Foto ou cartaz da matéria, guardado no próprio site (começa com "/"), e o crédito dela. */
  image: string;
  imageCredit: string;
  sources: Source[];
  body: string;
  minutes: number;
}

export interface FactCheck extends Localized {
  slug: string;
  claim: string;
  verdict: string;
  date: string;
  sources: Source[];
  body: string;
}

export interface DebateCard extends Localized {
  slug: string;
  claim: string;
  answer: string;
  /** Falácias que a frase do cartão usa (slugs de content/falacias). */
  fallacies: string[];
  sources: Source[];
  body: string;
}

/** Os quatro selos da checagem de fatos, na ordem em que a página os explica. */
export const verdicts = ["Falso", "Enganoso", "Falta contexto", "Verdadeiro"] as const;

/** Famílias do guia das falácias: razões que não vêm ao caso, provas fracas, premissas escondidas, desvios e confusões de sentido. */
export const fallacyFamilies = ["relevancia", "provas", "premissas", "desvio", "sentido"] as const;
export type FallacyFamily = (typeof fallacyFamilies)[number];

export interface Fallacy extends Localized {
  slug: string;
  name: string;
  /** Nome em latim ou em inglês, quando há um consagrado. */
  original?: string;
  summary: string;
  family: FallacyFamily;
  what: string;
  everyday: string;
  publicDebate: string;
  reply: string;
  related: string[];
  sources: Source[];
  body: string;
}

/** Ferramenta da caixa de checagem: só o nome e o link; a explicação fica nos dicionários (factCheck.toolbox). */
export interface CheckTool {
  id: string;
  name: string;
  url: string;
}

export const checkToolGroups = ["imagem", "video", "arquivo", "agencias", "buscador", "dados", "dominio", "guias"] as const;
export type CheckToolGroup = (typeof checkToolGroups)[number];

export interface Video extends Localized {
  slug: string;
  title: string;
  channel: string;
  url: string;
  area: AreaSlug;
  language: string;
  description: string;
}

/** Formatos de material avulso, como o painel oferece. O texto guardado é o português; cada idioma traduz na tela. */
export const looseFormats = ["Aula avulsa", "Lista de exercícios", "Resumo", "Roteiro de estudo", "Material para imprimir", "Indicação comentada", "Mapa mental", "Arquivo para baixar (PDF)"] as const;
export type LooseFormat = (typeof looseFormats)[number];

/** Material avulso de uma disciplina: feito pelos educadores secundários, fora das trilhas. */
export interface LooseMaterial extends Localized {
  slug: string;
  title: string;
  summary: string;
  format: LooseFormat;
  area: AreaSlug;
  authors: string[];
  sources: Source[];
  body: string;
  minutes: number;
}

export interface Quote {
  texto: string;
  autor: string;
  fonte: string;
}

export interface Question {
  pergunta: string;
  resposta: string;
  links: { titulo: string; href: string }[];
}

type Data = Record<string, unknown>;

function fail(file: string, message: string): never {
  throw new Error(`Conteúdo inválido em ${file}: ${message}`);
}

function text(data: Data, key: string, file: string): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) fail(file, `o campo "${key}" é obrigatório`);
  return value.trim();
}

function optional(data: Data, key: string): string | undefined {
  const value = data[key];
  return value === undefined || value === null ? undefined : String(value).trim();
}

function oneOf<T extends string>(data: Data, key: string, allowed: readonly T[], file: string): T {
  const value = text(data, key, file);
  if (!allowed.includes(value as T)) fail(file, `"${key}" deve ser um de: ${allowed.join(", ")}`);
  return value as T;
}

function httpsUrl(data: Data, key: string, file: string): string {
  const url = text(data, key, file);
  if (!/^https:\/\/\S+$/.test(url)) fail(file, `"${key}" deve começar com https://`);
  return url;
}

function dateOf(data: Data, key: string, file: string): string {
  const raw = data[key];
  const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(file, `"${key}" deve ser uma data no formato AAAA-MM-DD`);
  return value;
}

/** Fontes: lista de { titulo, autor, url, ano }. Todo material de ensino precisa de ao menos uma. */
function parseSources(raw: unknown, file: string, required: boolean): Source[] {
  if (raw === undefined || raw === null) {
    if (required) fail(file, `falta o campo "fontes": todo material precisa citar ao menos uma fonte`);
    return [];
  }
  if (!Array.isArray(raw)) fail(file, `"fontes" deve ser uma lista`);
  const sources = raw.map((item: Data | string, i) => {
    if (typeof item === "string") return { title: item };
    const url = optional(item, "url");
    if (url && !/^https?:\/\/\S+$/.test(url)) fail(file, `fontes[${i}]: o endereço deve começar com http:// ou https://`);
    return { title: text(item, "titulo", file), author: optional(item, "autor"), url, year: optional(item, "ano") };
  });
  if (required && sources.length === 0) fail(file, `"fontes" precisa de ao menos um item`);
  return sources;
}

function parseQuiz(raw: unknown, file: string): QuizQuestion[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail(file, `"quiz" deve ser uma lista`);
  return raw.map((item: Data, i) => {
    const where = `quiz[${i}]`;
    const options = item?.opcoes;
    if (!Array.isArray(options) || options.length < 2) fail(file, `${where} precisa de ao menos 2 "opcoes"`);
    const answer = item.resposta;
    if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      fail(file, `${where}: "resposta" deve ser o índice (começando em 0) da opção correta`);
    }
    return {
      question: text(item, "pergunta", file),
      options: options.map(String),
      answer,
      explanation: typeof item.explicacao === "string" ? item.explicacao : undefined,
    };
  });
}

// O caminho fica preso a content/ para o build não rastrear o projeto inteiro.
const absolute = (file: string) => path.join(CONTENT_DIR, file.slice("content/".length));

function parse(file: string) {
  const parsed = parseFrontmatter(fs.readFileSync(absolute(file), "utf8"));
  return { data: parsed.data as Data, body: parsed.content.trim() };
}

/** Os idiomas em que o texto de um arquivo existe de verdade: o original (pt) e as traduções que estão em content/. */
export function idiomasDe(file: string): Locale[] {
  return locales.filter((code) => code === defaultLocale || fs.existsSync(absolute(file.replace(/\.md$/, `.${code}.md`))));
}

/** Lê o original e, se existir, sobrepõe a tradução para o idioma pedido. */
function read(file: string, lang: Locale) {
  const base = parse(file);
  const localized = file.replace(/\.md$/, `.${lang}.md`);
  if (lang === defaultLocale || !fs.existsSync(absolute(localized))) {
    return { ...base, translated: lang === defaultLocale };
  }
  const translation = parse(localized);
  return { data: { ...base.data, ...translation.data }, body: translation.body || base.body, translated: true };
}

function readJson<T>(file: string, fallback: T): T {
  const full = absolute(file);
  if (!fs.existsSync(full)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(full, "utf8")) as T;
  } catch (error) {
    fail(file, `JSON inválido (${(error as Error).message})`);
  }
}

// ativo: false tira o item do ar sem apagar o histórico (quarentena de denúncias).
const isActive = (data: Data) => data.ativo !== false;

/** Arquivos originais de uma pasta, sem as traduções ("x.en.md"). */
function originals(dir: string): string[] {
  const full = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((name) => name.endsWith(".md") && !/\.[a-z]{2}\.md$/.test(name));
}

function slugOf(name: string, file: string): string {
  if (!/^[a-z0-9-]+\.md$/.test(name)) fail(file, "use apenas letras minúsculas, números e hífens no nome do arquivo");
  return name.replace(/\.md$/, "");
}

const minutesOf = (body: string) => Math.max(1, Math.ceil(plainText(body).split(" ").length / 180));

/** Lê uma coleção simples: uma pasta de arquivos .md, um item por arquivo. */
function collection<T>(dir: string, lang: Locale, build: (entry: { slug: string; file: string; data: Data; body: string; translated: boolean }) => T): T[] {
  const items: T[] = [];
  for (const name of originals(dir)) {
    const file = `content/${dir}/${name}`;
    const slug = slugOf(name, file);
    const { data, body, translated } = read(file, lang);
    if (!isActive(data)) continue;
    items.push(build({ slug, file, data, body, translated }));
  }
  return items;
}

/** "requisitos: [fracoes, matematica-fundamental/porcentagem]": uma aula da mesma trilha ou "trilha/aula". */
function parseCaminhos(value: unknown, campo: string, file: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(file, `"${campo}" precisa ser uma lista, por exemplo [fracoes, matematica-fundamental/porcentagem]`);
  return value.map((item) => {
    if (typeof item !== "string" || !/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(item)) fail(file, `item inválido em "${campo}": ${String(item)} (use slug-da-aula ou trilha/slug-da-aula)`);
    return item as string;
  });
}

/** "ferramentas: [resolvedor, graficos]": cada nome precisa existir em lib/areas.ts, senão a montagem do site para. */
function parseTools(value: unknown, file: string): ToolId[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(file, `"ferramentas" precisa ser uma lista, por exemplo [resolvedor, graficos]`);
  return value.map((id) => {
    if (typeof id !== "string" || !(tools as readonly string[]).includes(id)) fail(file, `ferramenta desconhecida em "ferramentas": ${String(id)} (a lista está em lib/areas.ts)`);
    return id as ToolId;
  });
}

function loadLesson(file: string, name: string, lang: Locale): (Lesson & { number: number }) | null {
  // "03-fracoes.md" (aulas iniciais, numeradas) ou "fracoes.md" (aulas vindas do painel).
  const match = /^(?:(\d+)-)?([a-z0-9-]+)\.md$/.exec(name);
  if (!match) fail(file, `nome de arquivo deve ser "slug.md" ou "NN-slug.md", com letras minúsculas, números e hífens`);
  const { data, body, translated } = read(file, lang);
  if (!isActive(data)) return null;
  if (!body) fail(file, "a aula está sem conteúdo");
  return {
    slug: match[2],
    number: match[1] ? Number(match[1]) : 9999,
    title: text(data, "titulo", file),
    summary: text(data, "resumo", file),
    authors: Array.isArray(data.autores) ? data.autores.map(String) : [],
    terms: (Array.isArray(data.glossario) ? (data.glossario as Data[]) : []).map((item) => {
      const term = typeof item?.termo === "string" ? item.termo.trim() : "";
      const summary = typeof item?.definicao === "string" ? item.definicao.trim() : "";
      if (!term || !summary) fail(file, `cada item de "glossario" precisa de "termo" e "definicao"`);
      return { term, summary };
    }),
    reviewed: data.revisada === true,
    tools: parseTools(data.ferramentas, file),
    requires: parseCaminhos(data.requisitos, "requisitos", file),
    related: parseCaminhos(data.veja_tambem, "veja_tambem", file),
    body,
    quiz: parseQuiz(data.quiz, file),
    practice: validarPratica(data.pratica, file),
    sources: parseSources(data.fontes, file, true),
    minutes: minutesOf(body),
    translated,
    file,
  };
}

export const getTracks = cache((lang: Locale): Track[] => {
  const root = path.join(CONTENT_DIR, "trilhas");
  if (!fs.existsSync(root)) return [];
  const tracks: Track[] = [];
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const base = `content/trilhas/${dir.name}`;
    const file = `${base}/_trilha.md`;
    if (!fs.existsSync(absolute(file))) fail(base, "falta o arquivo _trilha.md");
    const { data, body, translated } = read(file, lang);
    if (!isActive(data)) continue;

    const written = originals(`trilhas/${dir.name}`)
      .filter((name) => name !== "_trilha.md")
      .map((name) => loadLesson(`${base}/${name}`, name, lang))
      .filter((lesson) => lesson !== null);
    if (new Set(written.map((l) => l.slug)).size !== written.length) fail(base, "há duas aulas com o mesmo slug");

    // plano.json é o roteiro da trilha, na ordem de estudo. Aula do roteiro sem arquivo fica "em preparação".
    // Aulas fora do roteiro (enviadas por voluntários sobre um tema novo) entram no fim, sem duplicar nada.
    const roteiro = readJson<{ slug: string; titulo: string }[]>(`${base}/plano.json`, []);
    const position = new Map(roteiro.map((item, i) => [item.slug, i]));
    written.sort((a, b) => (position.get(a.slug) ?? 5000 + a.number) - (position.get(b.slug) ?? 5000 + b.number) || a.slug.localeCompare(b.slug));
    const bySlug = new Map(written.map((lesson) => [lesson.slug, lesson]));
    const plan: PlanItem[] = roteiro.map((item) => ({ slug: item.slug, title: bySlug.get(item.slug)?.title ?? item.titulo, ready: bySlug.has(item.slug) }));
    for (const lesson of written) if (!position.has(lesson.slug)) plan.push({ slug: lesson.slug, title: lesson.title, ready: true });

    tracks.push({
      slug: dir.name,
      title: text(data, "titulo", file),
      area: oneOf(data, "area", areaSlugs, file),
      stage: oneOf(data, "etapa", stages, file),
      order: typeof data.ordem === "number" ? data.ordem : 999,
      summary: text(data, "resumo", file),
      intro: body,
      lessons: written,
      plan,
      translated,
      file,
    });
  }
  // Dentro de cada etapa, a ordem de estudo é a do campo "ordem" (quando há) e depois o título.
  return tracks.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, lang));
});

/** As capas que existem em public/capas e o crédito de cada uma. Lido uma vez por processo. */
let capas: { ids: Set<string>; creditos: Record<string, { fonte: string }> } | null = null;
function capasDoSite() {
  if (!capas) {
    const pasta = path.join(process.cwd(), "public", "capas");
    const ids = new Set(fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)) : []);
    capas = { ids, creditos: readJson<Record<string, { fonte: string }>>("content/capas.json", {}) };
  }
  return capas;
}

/** As obras escondidas por pedido de retirada ou dúvida de direitos (content/acervo-ocultas.json): não aparecem em lugar nenhum. */
export const obrasOcultas = cache((): Set<string> => {
  const lista = readJson<{ ocultas: { id: string; motivo: string; data: string }[] }>("content/acervo-ocultas.json", { ocultas: [] });
  for (const o of lista.ocultas) if (!o.id || !o.motivo || !/^\d{4}-\d{2}-\d{2}$/.test(o.data ?? "")) fail("content/acervo-ocultas.json", `"${o.id}" precisa de id, motivo e data (AAAA-MM-DD)`);
  return new Set(lista.ocultas.map((o) => o.id));
});

export const getBooks = cache((lang: Locale): Book[] =>
  collection("acervo", lang, ({ slug, file, data, body, translated }) => {
    const url = httpsUrl(data, "url", file);
    if (/\.pdf($|\?)/i.test(url)) fail(file, `"url" deve apontar para a página da obra na fonte, não para um PDF`);
    if (!body) fail(file, "falta a sinopse (o texto depois do cabeçalho)");
    return {
      id: slug,
      title: text(data, "titulo", file),
      author: text(data, "autor", file),
      authorSlugs: Array.isArray(data.autores) ? data.autores.map(String) : [],
      area: oneOf(data, "area", areaSlugs, file),
      license: oneOf(data, "licenca", licenses, file),
      source: text(data, "fonte", file),
      url,
      language: text(data, "idioma", file),
      year: optional(data, "ano"),
      synopsis: body,
      ...(capasDoSite().ids.has(slug) ? { cover: `/capas/${slug}.webp`, coverCredit: capasDoSite().creditos[slug]?.fonte } : {}),
      translated,
      file,
    };
  })
    .filter((book) => !obrasOcultas().has(book.id))
    .sort((a, b) => a.title.localeCompare(b.title, lang)),
);

/** Obras importadas dos catálogos abertos para uma disciplina (pode não existir). */
export const getCatalog = cache((area: AreaSlug): CatalogEntry[] => readJson<CatalogEntry[]>(`content/catalogo/${area}.json`, []));

export const getAuthors = cache((lang: Locale): Author[] => {
  const authors = collection("autores", lang, ({ slug, file, data, body, translated }) => {
    if (!body) fail(file, "falta a biografia (o texto depois do cabeçalho)");
    return {
      slug,
      name: text(data, "nome", file),
      years: text(data, "anos", file),
      place: text(data, "origem", file),
      archiveUrl: data.arquivo === undefined ? undefined : httpsUrl(data, "arquivo", file),
      archiveSource: optional(data, "arquivo_fonte"),
      bio: body,
      translated,
      file,
    };
  });
  const known = new Set(authors.map((a) => a.slug));
  for (const book of getBooks(lang)) {
    for (const slug of book.authorSlugs) {
      if (!known.has(slug)) fail(book.file, `o autor "${slug}" não existe em content/autores`);
    }
  }
  return authors.sort((a, b) => a.name.localeCompare(b.name, lang));
});

/** Retrato opcional: só imagem guardada no próprio site, sempre com o crédito e o endereço de onde veio. */
function portrait(data: Data, file: string): { photo?: string; photoCredit?: string; photoSource?: string } {
  const photo = optional(data, "foto");
  if (!photo) return {};
  if (!/^\/imagens\/memorial\/[a-z0-9-]+\.webp$/.test(photo)) fail(file, `"foto" precisa ser uma imagem de /imagens/memorial`);
  const photoCredit = text(data, "foto_credito", file);
  const photoSource = httpsUrl(data, "foto_fonte", file);
  return { photo, photoCredit, photoSource };
}

export const getTributes = cache((lang: Locale): Tribute[] =>
  collection("memorial", lang, ({ slug, file, data, body, translated }) => {
    if (!body) fail(file, "falta o texto de homenagem");
    return {
      slug,
      name: text(data, "nome", file),
      born: text(data, "nascimento", file),
      died: text(data, "morte", file),
      place: text(data, "local", file),
      // O país sai do original em português: a tradução troca o nome ("Brazil", "Бразилия").
      region: regiaoDoLocal(String(parse(file).data.local ?? "")),
      ...portrait(data, file),
      body,
      translated,
      file,
    };
  }).sort((a, b) => Number(b.died) - Number(a.died)),
);

export const getGlossary = cache((lang: Locale): Term[] =>
  collection("glossario", lang, ({ slug, file, data, body, translated }) => ({
    slug,
    term: text(data, "termo", file),
    summary: text(data, "resumo", file),
    body,
    translated,
    file,
  })).sort((a, b) => a.term.localeCompare(b.term, lang)),
);

/**
 * O glossário inteiro, refeito a cada montagem do site: os verbetes da curadoria mais os termos que as aulas
 * definem no próprio cabeçalho. Para cada termo, a lista das disciplinas e das aulas em que ele aparece
 * (procurado no título e no texto de todas as aulas), para a página poder filtrar por disciplina.
 */
export const getGlossaryIndex = cache((lang: Locale): IndexedTerm[] => {
  const plain = (value: string) => ` ${value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const terms = new Map<string, IndexedTerm>(getGlossary(lang).map((term) => [plain(term.term), { ...term, areas: [], lessons: [] }]));
  const tracks = getTracks(lang);
  for (const track of tracks) {
    for (const lesson of track.lessons) {
      for (const own of lesson.terms) {
        const key = plain(own.term);
        if (terms.has(key)) continue;
        const slug = key.trim().replace(/ /g, "-");
        terms.set(key, { slug, term: own.term, summary: own.summary, body: "", translated: lesson.translated, file: lesson.file, areas: [], lessons: [] });
      }
    }
  }
  // Onde cada termo aparece: o texto de cada aula vira uma lista de palavras uma vez só, e cada posição consulta os
  // termos que começam por aquela palavra (o resto da sequência é conferido depois). Antes era cada termo contra o
  // texto inteiro de cada aula, milhões de buscas em texto longo: a página do glossário passava de 5 minutos no build
  // e segurava as outras páginas do mesmo processo (a /guia caía junto), o que levou a publicação aos 45 minutos.
  const porPrimeira = new Map<string, { partes: string[]; term: IndexedTerm }[]>();
  for (const [key, term] of terms) {
    const partes = key.trim().split(" ");
    if (!partes[0]) continue;
    const lista = porPrimeira.get(partes[0]);
    if (lista) lista.push({ partes, term });
    else porPrimeira.set(partes[0], [{ partes, term }]);
  }
  for (const track of tracks) {
    for (const lesson of track.lessons) {
      const palavras = plain(`${lesson.title} ${lesson.summary} ${lesson.body}`).trim().split(" ");
      const achados = new Set<IndexedTerm>();
      for (let i = 0; i < palavras.length; i++) {
        const candidatos = porPrimeira.get(palavras[i]);
        if (!candidatos) continue;
        for (const { partes, term } of candidatos) {
          if (achados.has(term)) continue;
          let k = 1;
          while (k < partes.length && palavras[i + k] === partes[k]) k++;
          if (k === partes.length) achados.add(term);
        }
      }
      for (const term of achados) {
        if (!term.areas.includes(track.area)) term.areas.push(track.area);
        if (term.lessons.length < 5) term.lessons.push({ href: `/trilhas/${track.slug}/${lesson.slug}`, title: lesson.title });
      }
    }
  }
  return [...terms.values()].sort((a, b) => a.term.localeCompare(b.term, lang));
});

export const getArticles = cache((lang: Locale): Article[] =>
  collection("jornal", lang, ({ slug, file, data, body, translated }) => {
    if (!body) fail(file, "o texto está vazio");
    return {
      slug,
      title: text(data, "titulo", file),
      subtitle: optional(data, "subtitulo") ?? "",
      author: text(data, "autor", file),
      date: dateOf(data, "data", file),
      section: optional(data, "editoria") ?? "",
      image: (() => {
        const imagem = optional(data, "imagem") ?? "";
        if (imagem && !/^\/[a-z0-9/_.-]+\.(webp|jpg|jpeg|png|avif)$/i.test(imagem)) fail(file, `"imagem" deve ser um arquivo do próprio site, como /imagens/jornal/foto.webp`);
        if (imagem && !optional(data, "credito_imagem")) fail(file, `com "imagem", diga de quem é em "credito_imagem"`);
        return imagem;
      })(),
      imageCredit: optional(data, "credito_imagem") ?? "",
      sources: parseSources(data.fontes, file, true),
      body,
      minutes: minutesOf(body),
      translated,
      file,
    };
  }).sort((a, b) => b.date.localeCompare(a.date)),
);

export const getFactChecks = cache((lang: Locale): FactCheck[] =>
  collection("checagens", lang, ({ slug, file, data, body, translated }) => ({
    slug,
    claim: text(data, "alegacao", file),
    verdict: oneOf(data, "veredito", verdicts, file),
    date: dateOf(data, "data", file),
    sources: parseSources(data.fontes, file, true),
    body,
    translated,
    file,
  })).sort((a, b) => b.date.localeCompare(a.date)),
);

/**
 * Lista de slugs de outra coleção ("falacias: [espantalho]"). Slug sem arquivo quebra a montagem;
 * o de um item em quarentena (ativo: false) só some da lista, para a quarentena não derrubar o site.
 */
function slugList(raw: unknown, key: string, dir: string, active: Set<string>, file: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail(file, `"${key}" deve ser uma lista`);
  const files = new Set(originals(dir).map((name) => name.replace(/\.md$/, "")));
  return raw
    .map((item) => {
      const slug = String(item).trim();
      if (!files.has(slug)) fail(file, `"${key}": "${slug}" não existe em content/${dir}`);
      return slug;
    })
    .filter((slug) => active.has(slug));
}

/** Guia das falácias: uma ficha por arquivo, com definição, exemplo do dia a dia, exemplo do debate público e resposta. */
export const getFallacies = cache((lang: Locale): Fallacy[] => {
  const items = collection("falacias", lang, ({ slug, file, data, body, translated }) => {
    const summary = text(data, "resumo", file);
    if (/\n/.test(summary) || summary.length > 200) fail(file, `"resumo" deve ter uma linha só, de até 200 caracteres`);
    return {
      slug,
      name: text(data, "nome", file),
      original: optional(data, "original"),
      summary,
      family: oneOf(data, "familia", fallacyFamilies, file),
      what: text(data, "o_que_e", file),
      everyday: text(data, "dia_a_dia", file),
      publicDebate: text(data, "debate_publico", file),
      reply: text(data, "como_responder", file),
      related: data.parecidas,
      sources: parseSources(data.fontes, file, true),
      body,
      translated,
      file,
    };
  });
  const active = new Set(items.map((item) => item.slug));
  return items
    .map((item) => {
      const related = slugList(item.related, "parecidas", "falacias", active, item.file);
      if (related.includes(item.slug)) fail(item.file, `"parecidas" não pode citar a própria falácia`);
      return { ...item, related };
    })
    .sort((a, b) => a.name.localeCompare(b.name, lang));
});

export const getDebates = cache((lang: Locale): DebateCard[] => {
  const fallacies = new Set(getFallacies(lang).map((item) => item.slug));
  return collection("debates", lang, ({ slug, file, data, body, translated }) => ({
    slug,
    claim: text(data, "afirmacao", file),
    answer: text(data, "resposta", file),
    fallacies: slugList(data.falacias, "falacias", "falacias", fallacies, file),
    sources: parseSources(data.fontes, file, true),
    body,
    translated,
    file,
  })).sort((a, b) => a.claim.localeCompare(b.claim, lang));
});

/** Caixa de ferramentas da checagem de fatos (content/ferramentas-de-checagem.json): só links simples, que "npm run conferir:links" também testa. */
export const getCheckTools = cache((): { group: CheckToolGroup; tools: CheckTool[] }[] => {
  const file = "content/ferramentas-de-checagem.json";
  const groups = readJson<{ grupo: string; ferramentas: { id: string; nome: string; url: string }[] }[]>(file, []);
  const seen = new Set<string>();
  return groups.map((entry) => {
    if (!(checkToolGroups as readonly string[]).includes(entry.grupo)) fail(file, `grupo "${entry.grupo}" desconhecido; use um de: ${checkToolGroups.join(", ")}`);
    if (!Array.isArray(entry.ferramentas) || entry.ferramentas.length === 0) fail(file, `o grupo "${entry.grupo}" precisa de "ferramentas"`);
    return {
      group: entry.grupo as CheckToolGroup,
      tools: entry.ferramentas.map((tool) => {
        if (!/^[a-z0-9-]+$/.test(tool.id ?? "") || seen.has(tool.id)) fail(file, `"${tool.id}": o id precisa ser único, com letras minúsculas, números e hífens`);
        seen.add(tool.id);
        if (!tool.nome?.trim()) fail(file, `"${tool.id}" precisa de "nome"`);
        if (!/^https:\/\/\S+$/.test(tool.url ?? "") || /\.pdf($|\?)/i.test(tool.url)) fail(file, `"${tool.id}": o endereço deve começar com https:// e não pode ser um PDF`);
        return { id: tool.id, name: tool.nome.trim(), url: tool.url };
      }),
    };
  });
});

export const getVideos = cache((lang: Locale): Video[] =>
  collection("videos", lang, ({ slug, file, data, body, translated }) => ({
    slug,
    title: text(data, "titulo", file),
    channel: text(data, "canal", file),
    url: httpsUrl(data, "url", file),
    area: oneOf(data, "area", areaSlugs, file),
    language: text(data, "idioma", file),
    description: body,
    translated,
    file,
  })).sort((a, b) => a.title.localeCompare(b.title, lang)),
);

export const getLooseMaterials = cache((lang: Locale): LooseMaterial[] =>
  collection("avulsos", lang, ({ slug, file, data, body, translated }) => {
    const authors = Array.isArray(data.autores) ? data.autores.map((nome) => String(nome).trim()).filter(Boolean) : [];
    if (authors.length === 0) fail(file, `"autores" precisa de ao menos um nome`);
    return {
      slug,
      title: text(data, "titulo", file),
      summary: text(data, "resumo", file),
      format: oneOf(data, "formato", looseFormats, file),
      area: oneOf(data, "area", areaSlugs, file),
      authors,
      sources: parseSources(data.fontes, file, true),
      body,
      minutes: minutesOf(body),
      translated,
      file,
    };
  }).sort((a, b) => a.title.localeCompare(b.title, lang)),
);

/** Frases com fonte conferida; a página inicial mostra uma por dia. */
export const getQuotes = cache((): Quote[] => {
  const quotes = readJson<Quote[]>("content/frases.json", []);
  for (const [i, quote] of quotes.entries()) {
    if (!quote.texto || !quote.autor || !quote.fonte) fail("content/frases.json", `a frase ${i + 1} precisa de "texto", "autor" e "fonte"`);
  }
  return quotes;
});

/** Um passo da lista "Por onde começar": aulas e obras do próprio site, já com título e endereço. */
export interface StartStep {
  title: string;
  text: string;
  lessons: { href: string; title: string; track: string }[];
  books: { href: string; title: string; author: string; reference: boolean }[];
}

/** A lista de leitura de quem está chegando. Cada aula e cada obra citada precisa existir de verdade. */
export const getStartSteps = cache((lang: Locale): StartStep[] => {
  const file = "content/comecar.json";
  const steps = readJson<{ titulo: string; texto: string; aulas: string[]; obras: string[] }[]>(file, []);
  const tracks = getTracks(lang);
  const books = getBooks(lang);
  return steps.map((step) => ({
    title: step.titulo,
    text: step.texto,
    lessons: step.aulas.map((ref) => {
      const [trackSlug, lessonSlug] = ref.split("/");
      const track = tracks.find((item) => item.slug === trackSlug);
      const lesson = track?.lessons.find((item) => item.slug === lessonSlug);
      if (!track || !lesson) fail(file, `a aula "${ref}" não existe`);
      return { href: `/trilhas/${track.slug}/${lesson.slug}`, title: lesson.title, track: track.title };
    }),
    books: step.obras.map((id) => {
      const book = books.find((item) => item.id === id);
      if (!book) fail(file, `a obra "${id}" não existe no acervo`);
      return { href: `/acervo/${book.id}`, title: book.title, author: book.author, reference: book.license === "Direitos reservados" };
    }),
  }));
});

export interface GalleryPiece {
  slug: string;
  titulo: string;
  autor: string;
  ano: string;
  lugar: string;
  texto: string;
  imagem: string;
  largura: number;
  altura: number;
  fonte: string;
}

/** Cartazes e imagens históricas em domínio público, guardados no próprio site, cada um com contexto e fonte. */
export const getGallery = cache((): GalleryPiece[] => {
  const file = "content/galeria.json";
  const pieces = readJson<GalleryPiece[]>(file, []);
  for (const piece of pieces) {
    if (!piece.titulo || !piece.autor || !piece.ano || !piece.texto) fail(file, `"${piece.slug}" precisa de título, autor, ano e texto`);
    if (!/^\/imagens\/galeria\/[a-z0-9-]+\.webp$/.test(piece.imagem)) fail(file, `"${piece.slug}": a imagem precisa estar em /imagens/galeria`);
    if (!/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(piece.fonte)) fail(file, `"${piece.slug}": falta o endereço da fonte`);
  }
  // Pelo primeiro ano escrito: "c. 1834", "17 de maio de 1888" e "1921–1922" entram na ordem certa.
  const anoDe = (texto: string) => Number(texto.match(/\d{4}/)?.[0] ?? 9999);
  return pieces.sort((a, b) => anoDe(a.ano) - anoDe(b.ano) || a.ano.localeCompare(b.ano));
});

/** Perguntas do dia a dia ("por que o aluguel é tão caro?") com os materiais que ajudam a responder. */
export const getQuestions = cache((): Question[] => readJson<Question[]>("content/perguntas.json", []));

/** Os acontecimentos da linha do tempo das lutas, do mais antigo ao mais recente (no mesmo ano, na ordem do arquivo). */
export const getTimeline = cache((): Acontecimento[] => {
  const file = "content/linha-do-tempo.json";
  const items = readJson<unknown>(file, []);
  if (!Array.isArray(items)) fail(file, "precisa ser uma lista de acontecimentos");
  return items
    .map((item, i): Acontecimento => {
      const { ano, onde, temas, texto } = (item ?? {}) as Record<string, unknown>;
      const onde_ = onde as LugarDaLinha;
      if (!Number.isInteger(ano)) fail(file, `item ${i + 1}: "ano" precisa ser um número inteiro`);
      if (!lugaresDaLinha.includes(onde_)) fail(file, `item ${i + 1}: "onde" precisa ser ${lugaresDaLinha.join(", ")}`);
      if (!Array.isArray(temas) || temas.some((tema) => !temasDaLinha.includes(tema as TemaDaLinha))) fail(file, `item ${i + 1}: "temas" só aceita ${temasDaLinha.join(", ")}`);
      if (typeof texto !== "string" || !texto.trim()) fail(file, `item ${i + 1}: falta o "texto"`);
      return { ano: ano as number, onde: onde_, temas: temas as TemaDaLinha[], texto: (texto as string).trim() };
    })
    .sort((a, b) => a.ano - b.ano);
});

/** Páginas de texto corrido (sobre, voluntários, linha do tempo, guia de fontes…), em content/paginas. */
export const getPage = cache((slug: string, lang: Locale): ContentPage => {
  const file = `content/paginas/${slug}.md`;
  if (!fs.existsSync(absolute(file))) fail(file, "página não encontrada");
  const { data, body, translated } = read(file, lang);
  return {
    title: text(data, "titulo", file),
    eyebrow: text(data, "sobretitulo", file),
    lead: optional(data, "resumo") ?? "",
    body,
    translated,
    file,
  };
});

// ───────────── Aulas ligadas: pré-requisitos e "também em outra disciplina" ─────────────

export interface AulaLigada {
  id: string;
  path: string;
  title: string;
  track: string;
  area: AreaSlug;
}

/** Palavras que não dizem o assunto de uma aula (pt, en, es): ficam fora da comparação. */
const VAZIAS = new Set(
  "sobre entre como quando onde porque para pelos pelas pela pelo depois antes ainda mesmo muito muita muitos muitas outro outra outros outras todos todas cada sendo seria serem fazer feito feita parte partes forma formas modo coisa coisas tempo vida primeiro primeira segunda segundo introducao nocoes basico basica basicos basicas conceito conceitos aula aulas trilha estudo estudos pratica praticas exemplo exemplos geral simples historia brasil brasileira brasileiro mundo social sociais what with from that this your about como para entre sobre desde hasta sobre entre cuando donde".split(" "),
);
const palavrasDe = (texto: string) => new Set(plainText(texto).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((p) => p.length >= 5 && !VAZIAS.has(p)));

const indiceDeAulas = cache((lang: Locale) =>
  getTracks(lang).flatMap((track) =>
    track.lessons.map((lesson) => ({
      id: `${track.slug}/${lesson.slug}`,
      path: `/trilhas/${track.slug}/${lesson.slug}`,
      title: lesson.title,
      track: track.title,
      area: track.area,
      palavras: palavrasDe(`${lesson.title} ${lesson.title} ${lesson.summary}`),
    })),
  ),
);

/** As aulas que esta pede antes: as do campo "requisitos" e, se ela não disser nada, a aula anterior da trilha. */
export function requisitosDaAula(lang: Locale, track: Track, lessonSlug: string): AulaLigada[] {
  const indice = new Map(indiceDeAulas(lang).map((a) => [a.id, a]));
  const posicao = track.lessons.findIndex((l) => l.slug === lessonSlug);
  const lesson = track.lessons[posicao];
  if (!lesson) return [];
  const pedidos = lesson.requires.length ? lesson.requires.map((r) => (r.includes("/") ? r : `${track.slug}/${r}`)) : posicao > 0 ? [`${track.slug}/${track.lessons[posicao - 1].slug}`] : [];
  return pedidos.map((id) => indice.get(id)).filter((a): a is NonNullable<typeof a> => Boolean(a)).map(({ id, path, title, track, area }) => ({ id, path, title, track, area }));
}

/**
 * "Também em outras disciplinas": as escolhidas por quem escreveu (campo "veja_tambem") e, para completar até três,
 * as aulas de outras disciplinas que mais dividem palavras com o título e o resumo desta (pelo menos duas palavras de
 * assunto em comum). Nada é inventado: só aulas que existem no site.
 */
export function tambemEmOutras(lang: Locale, track: Track, lessonSlug: string, maximo = 3): AulaLigada[] {
  const indice = indiceDeAulas(lang);
  const porId = new Map(indice.map((a) => [a.id, a]));
  const lesson = track.lessons.find((l) => l.slug === lessonSlug);
  if (!lesson) return [];
  const escolhidas = lesson.related.map((r) => porId.get(r.includes("/") ? r : `${track.slug}/${r}`)).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const minhas = porId.get(`${track.slug}/${lessonSlug}`)?.palavras ?? new Set<string>();
  const parecidas = minhas.size
    ? indice
        .filter((a) => a.area !== track.area && !escolhidas.some((e) => e.id === a.id))
        .map((a) => {
          let comum = 0;
          for (const p of a.palavras) if (minhas.has(p)) comum++;
          return { a, comum, nota: comum / Math.sqrt(a.palavras.size * minhas.size || 1) };
        })
        .filter((x) => x.comum >= 2 && x.nota >= 0.3)
        .sort((x, y) => y.nota - x.nota)
        .map((x) => x.a)
    : [];
  // Uma por disciplina, para a lista mostrar disciplinas diferentes.
  const vistas = new Set<string>();
  return [...escolhidas, ...parecidas]
    .filter((a) => (vistas.has(a.area) ? false : (vistas.add(a.area), true)))
    .slice(0, maximo)
    .map(({ id, path, title, track, area }) => ({ id, path, title, track, area }));
}

export function getTrack(slug: string, lang: Locale): Track | undefined {
  return getTracks(lang).find((t) => t.slug === slug);
}

export function getBook(id: string, lang: Locale): Book | undefined {
  return getBooks(lang).find((b) => b.id === id);
}
