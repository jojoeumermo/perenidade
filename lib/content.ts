import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { areaSlugs, levels, licenses, type AreaSlug, type Level, type License } from "./areas";
import { plainText } from "./text";

// Todo o acervo vive em arquivos Markdown dentro de content/. O Git é a fonte da verdade:
// cada mudança é um commit, revisado por Pull Request e revertível.

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

export interface Lesson {
  slug: string;
  order: number;
  title: string;
  summary: string;
  authors: string[];
  reviewed: boolean;
  body: string;
  quiz: QuizQuestion[];
  minutes: number;
  /** Caminho no repositório, usado nos links de histórico e correção. */
  file: string;
}

export interface Track {
  slug: string;
  title: string;
  area: AreaSlug;
  level: Level;
  summary: string;
  intro: string;
  lessons: Lesson[];
  file: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  area: AreaSlug;
  license: License;
  source: string;
  url: string;
  language: string;
  year?: string;
  synopsis: string;
  file: string;
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

function oneOf<T extends string>(data: Data, key: string, allowed: readonly T[], file: string): T {
  const value = text(data, key, file);
  if (!allowed.includes(value as T)) fail(file, `"${key}" deve ser um de: ${allowed.join(", ")}`);
  return value as T;
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

function read(file: string) {
  // O caminho fica preso a content/ para o build não rastrear o projeto inteiro.
  const parsed = matter(fs.readFileSync(path.join(CONTENT_DIR, file.slice("content/".length)), "utf8"));
  return { data: parsed.data as Data, body: parsed.content.trim() };
}

// ativo: false tira o item do ar sem apagar o histórico (quarentena de denúncias).
const isActive = (data: Data) => data.ativo !== false;

function loadLesson(file: string, name: string): Lesson | null {
  const match = /^(\d+)-([a-z0-9-]+)\.md$/.exec(name);
  if (!match) fail(file, `nome de arquivo deve ser "NN-slug.md", com letras minúsculas, números e hífens`);
  const { data, body } = read(file);
  if (!isActive(data)) return null;
  if (!body) fail(file, "a aula está sem conteúdo");
  const authors = Array.isArray(data.autores) ? data.autores.map(String) : [];
  return {
    slug: match[2],
    order: Number(match[1]),
    title: text(data, "titulo", file),
    summary: text(data, "resumo", file),
    authors,
    reviewed: data.revisada === true,
    body,
    quiz: parseQuiz(data.quiz, file),
    minutes: Math.max(1, Math.ceil(plainText(body).split(" ").length / 180)),
    file,
  };
}

export const getTracks = cache((): Track[] => {
  const root = path.join(CONTENT_DIR, "trilhas");
  if (!fs.existsSync(root)) return [];
  const tracks: Track[] = [];
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const base = `content/trilhas/${dir.name}`;
    const file = `${base}/_trilha.md`;
    if (!fs.existsSync(path.join(root, dir.name, "_trilha.md"))) fail(base, "falta o arquivo _trilha.md");
    const { data, body } = read(file);
    if (!isActive(data)) continue;
    const lessons = fs
      .readdirSync(path.join(root, dir.name))
      .filter((name) => name.endsWith(".md") && name !== "_trilha.md")
      .map((name) => loadLesson(`${base}/${name}`, name))
      .filter((lesson): lesson is Lesson => lesson !== null)
      .sort((a, b) => a.order - b.order);
    const slugs = new Set(lessons.map((l) => l.slug));
    if (slugs.size !== lessons.length) fail(base, "há duas aulas com o mesmo slug");
    tracks.push({
      slug: dir.name,
      title: text(data, "titulo", file),
      area: oneOf(data, "area", areaSlugs, file) as AreaSlug,
      level: oneOf(data, "nivel", levels, file),
      summary: text(data, "resumo", file),
      intro: body,
      lessons,
      file,
    });
  }
  return tracks.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
});

export const getBooks = cache((): Book[] => {
  const root = path.join(CONTENT_DIR, "acervo");
  if (!fs.existsSync(root)) return [];
  const books: Book[] = [];
  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith(".md")) continue;
    const file = `content/acervo/${name}`;
    if (!/^[a-z0-9-]+\.md$/.test(name)) fail(file, "use apenas letras minúsculas, números e hífens no nome");
    const { data, body } = read(file);
    if (!isActive(data)) continue;
    const url = text(data, "url", file);
    if (!/^https:\/\//.test(url)) fail(file, `"url" deve começar com https://`);
    if (/\.pdf($|\?)/i.test(url)) fail(file, `"url" deve apontar para a página da obra na fonte, não para um PDF`);
    if (!body) fail(file, "falta a sinopse (o texto depois do cabeçalho)");
    books.push({
      id: name.replace(/\.md$/, ""),
      title: text(data, "titulo", file),
      author: text(data, "autor", file),
      area: oneOf(data, "area", areaSlugs, file) as AreaSlug,
      license: oneOf(data, "licenca", licenses, file),
      source: text(data, "fonte", file),
      url,
      language: text(data, "idioma", file),
      year: data.ano === undefined ? undefined : String(data.ano),
      synopsis: body,
      file,
    });
  }
  return books.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
});

export function getTrack(slug: string): Track | undefined {
  return getTracks().find((t) => t.slug === slug);
}

export function getBook(id: string): Book | undefined {
  return getBooks().find((b) => b.id === id);
}
