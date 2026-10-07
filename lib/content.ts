import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { defaultLocale, type Locale } from "@/i18n/config";
import { areaSlugs, levels, licenses, type AreaSlug, type Level, type License } from "./areas";
import { plainText } from "./text";

// Todo o acervo vive em arquivos Markdown dentro de content/. O Git é a fonte da verdade:
// cada mudança é um commit, revisado por Pull Request e revertível.
//
// Tradução: ao lado de "arquivo.md" (português) pode existir "arquivo.en.md", "arquivo.es.md" etc.
// A tradução só precisa repetir os campos de texto; o resto vem do original. Sem tradução,
// o conteúdo aparece em português, com um aviso.

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

interface Localized {
  /** false quando o texto exibido é o original em português por falta de tradução. */
  translated: boolean;
  /** Caminho do original no repositório, usado nos links de histórico e correção. */
  file: string;
}

export interface Lesson extends Localized {
  slug: string;
  order: number;
  title: string;
  summary: string;
  authors: string[];
  reviewed: boolean;
  body: string;
  quiz: QuizQuestion[];
  minutes: number;
}

export interface Track extends Localized {
  slug: string;
  title: string;
  area: AreaSlug;
  level: Level;
  summary: string;
  intro: string;
  lessons: Lesson[];
}

export interface Book extends Localized {
  id: string;
  title: string;
  author: string;
  /** Slugs de content/autores, quando o autor tem página própria. */
  authorSlugs: string[];
  area: AreaSlug;
  license: License;
  source: string;
  url: string;
  language: string;
  year?: string;
  synopsis: string;
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
}

export interface ContentPage extends Localized {
  title: string;
  eyebrow: string;
  lead: string;
  body: string;
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
  if (!/^https:\/\//.test(url)) fail(file, `"${key}" deve começar com https://`);
  return url;
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
  const parsed = matter(fs.readFileSync(absolute(file), "utf8"));
  return { data: parsed.data as Data, body: parsed.content.trim() };
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

function loadLesson(file: string, name: string, lang: Locale): Lesson | null {
  const match = /^(\d+)-([a-z0-9-]+)\.md$/.exec(name);
  if (!match) fail(file, `nome de arquivo deve ser "NN-slug.md", com letras minúsculas, números e hífens`);
  const { data, body, translated } = read(file, lang);
  if (!isActive(data)) return null;
  if (!body) fail(file, "a aula está sem conteúdo");
  return {
    slug: match[2],
    order: Number(match[1]),
    title: text(data, "titulo", file),
    summary: text(data, "resumo", file),
    authors: Array.isArray(data.autores) ? data.autores.map(String) : [],
    reviewed: data.revisada === true,
    body,
    quiz: parseQuiz(data.quiz, file),
    minutes: Math.max(1, Math.ceil(plainText(body).split(" ").length / 180)),
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
    const lessons = originals(`trilhas/${dir.name}`)
      .filter((name) => name !== "_trilha.md")
      .map((name) => loadLesson(`${base}/${name}`, name, lang))
      .filter((lesson): lesson is Lesson => lesson !== null)
      .sort((a, b) => a.order - b.order);
    if (new Set(lessons.map((l) => l.slug)).size !== lessons.length) fail(base, "há duas aulas com o mesmo slug");
    tracks.push({
      slug: dir.name,
      title: text(data, "titulo", file),
      area: oneOf(data, "area", areaSlugs, file),
      level: oneOf(data, "nivel", levels, file),
      summary: text(data, "resumo", file),
      intro: body,
      lessons,
      translated,
      file,
    });
  }
  return tracks.sort((a, b) => a.title.localeCompare(b.title, lang));
});

export const getBooks = cache((lang: Locale): Book[] => {
  const books: Book[] = [];
  for (const name of originals("acervo")) {
    const file = `content/acervo/${name}`;
    const id = slugOf(name, file);
    const { data, body, translated } = read(file, lang);
    if (!isActive(data)) continue;
    const url = httpsUrl(data, "url", file);
    if (/\.pdf($|\?)/i.test(url)) fail(file, `"url" deve apontar para a página da obra na fonte, não para um PDF`);
    if (!body) fail(file, "falta a sinopse (o texto depois do cabeçalho)");
    books.push({
      id,
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
      translated,
      file,
    });
  }
  return books.sort((a, b) => a.title.localeCompare(b.title, lang));
});

export const getAuthors = cache((lang: Locale): Author[] => {
  const authors: Author[] = [];
  for (const name of originals("autores")) {
    const file = `content/autores/${name}`;
    const slug = slugOf(name, file);
    const { data, body, translated } = read(file, lang);
    if (!isActive(data)) continue;
    if (!body) fail(file, "falta a biografia (o texto depois do cabeçalho)");
    authors.push({
      slug,
      name: text(data, "nome", file),
      years: text(data, "anos", file),
      place: text(data, "origem", file),
      archiveUrl: data.arquivo === undefined ? undefined : httpsUrl(data, "arquivo", file),
      archiveSource: optional(data, "arquivo_fonte"),
      bio: body,
      translated,
      file,
    });
  }
  const known = new Set(authors.map((a) => a.slug));
  for (const book of getBooks(lang)) {
    for (const slug of book.authorSlugs) {
      if (!known.has(slug)) fail(book.file, `o autor "${slug}" não existe em content/autores`);
    }
  }
  return authors.sort((a, b) => a.name.localeCompare(b.name, lang));
});

export const getTributes = cache((lang: Locale): Tribute[] => {
  const tributes: Tribute[] = [];
  for (const name of originals("memorial")) {
    const file = `content/memorial/${name}`;
    const slug = slugOf(name, file);
    const { data, body, translated } = read(file, lang);
    if (!isActive(data)) continue;
    if (!body) fail(file, "falta o texto de homenagem");
    tributes.push({
      slug,
      name: text(data, "nome", file),
      born: text(data, "nascimento", file),
      died: text(data, "morte", file),
      place: text(data, "local", file),
      body,
      translated,
      file,
    });
  }
  // Do mais recente para o mais antigo.
  return tributes.sort((a, b) => Number(b.died) - Number(a.died));
});

/** Páginas de texto corrido (sobre, voluntários, glossário…), em content/paginas. */
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

export function getTrack(slug: string, lang: Locale): Track | undefined {
  return getTracks(lang).find((t) => t.slug === slug);
}

export function getBook(id: string, lang: Locale): Book | undefined {
  return getBooks(lang).find((b) => b.id === id);
}
