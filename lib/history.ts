// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fill, htmlLang, type Locale, plural } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import type { AreaSlug } from "./areas";
import { getPage, getTracks } from "./content";

type Status = "A" | "M" | "D";

interface Commit {
  hash: string;
  date: string;
  /** Arquivos tocados; numa renomeação, só o caminho novo. */
  files: { status: Status; path: string }[];
}

export type Kind = keyof Dict["history"]["kinds"];
export type Action = "added" | "updated" | "removed";

type Link = { title: string; href: string; translated: boolean };

/** Uma linha do resumo: "12 obras novas no acervo". As aulas novas e as páginas trazem os títulos. */
export interface HistoryPart {
  kind: Kind;
  action: Action;
  count: number;
  area?: AreaSlug;
  links?: Link[];
}

/** O que mudou em um dia, já resumido. Sem assunto de commit, autor, e-mail nem identificador. */
export interface PublicChange {
  date: string;
  parts: HistoryPart[];
}

const git = (args: string[]) =>
  execFileSync("git", ["-c", "core.quotepath=off", ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });

// O histórico do acervo é o próprio histórico do Git, lido na hora do build.
// Em clones rasos (ex.: Vercel sem VERCEL_DEEP_CLONE=true) só aparecem os commits mais recentes, e o mais antigo deles,
// a "fronteira", aparece como se tivesse criado todos os arquivos de uma vez. Ele fica de fora, para o histórico não
// dizer que o acervo inteiro nasceu naquele dia. O código de cada registro só serve para isso e para ler listas antigas.
// Junções de ramos (merge) ficam de fora: o que elas trazem já aparece nos commits de origem.
// Uma leitura do histórico por processo. O cache do React só vale dentro de uma página: no mapa do site (que é rota,
// não página) ele não guardava nada, e cada uma das três mil perguntas rodava o git log de novo; essa rota passava de
// um minuto, travava o processo do build e derrubava junto o ícone, o manifesto e o robots.txt. No desenvolvimento o
// histórico é relido a cada minuto, para os commits novos aparecerem.
function umaVez<R>(ler: () => R): () => R {
  let guardado: { valor: R; quando: number } | null = null;
  const validade = process.env.NODE_ENV === "production" ? Number.POSITIVE_INFINITY : 60_000;
  return () => {
    if (!guardado || Date.now() - guardado.quando > validade) guardado = { valor: ler(), quando: Date.now() };
    return guardado.valor;
  };
}

/**
 * O histórico inteiro, gravado pela rotina do GitHub (que tem o clone completo) em historico/acervo.json. Na Vercel o
 * clone é raso: o que ele enxerga vale primeiro, e este arquivo completa o resto, sem repetir registro.
 */
function historicoGravado(): Commit[] {
  try {
    const caminho = path.join(process.cwd(), "historico", "acervo.json");
    if (!existsSync(caminho)) return [];
    const lista = JSON.parse(readFileSync(caminho, "utf8")) as Commit[];
    return Array.isArray(lista) ? lista.filter((c) => typeof c?.hash === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.date ?? "") && Array.isArray(c.files)) : [];
  } catch {
    return [];
  }
}

const getHistory = umaVez((): Commit[] => {
  const vivo = historicoDoGit();
  const vistos = new Set(vivo.map((c) => c.hash));
  // Os dois já vêm do mais novo para o mais antigo; juntos, ficam na ordem das datas.
  return [...vivo, ...historicoGravado().filter((c) => !vistos.has(c.hash))].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 1000);
});

function historicoDoGit(): Commit[] {
  try {
    let fronteira = new Set<string>();
    try {
      const arquivo = git(["rev-parse", "--git-path", "shallow"]).trim();
      if (existsSync(arquivo)) fronteira = new Set(readFileSync(arquivo, "utf8").split(/\s+/).filter(Boolean));
    } catch {
      // sem essa informação, nada é descartado
    }
    const out = git(["log", "-n", "300", "--no-merges", "--date=short", "--name-status", "--pretty=format:%x1e%H%x1f%ad", "--", "content"]);
    return out
      .split("\x1e")
      .filter(Boolean)
      .map((entry) => {
        const [head, ...lines] = entry.split("\n");
        const [hash, date] = head.split("\x1f");
        const files = lines
          .map((line) => line.split("\t"))
          .filter((cols) => cols.length >= 2)
          .map(([code, ...paths]) => {
            // "R100 velho novo" (renomeado) conta como mudança no arquivo novo; "C" (copiado), como arquivo novo.
            const status: Status = code[0] === "A" || code[0] === "C" ? "A" : code[0] === "D" ? "D" : "M";
            return { status, path: paths[paths.length - 1] };
          });
        return { hash, date, files };
      })
      .filter((commit) => !fronteira.has(commit.hash));
  } catch {
    return [];
  }
}

// O histórico público fala só de ensino e acervo. O que é funcionamento do site (páginas institucionais e
// legais, aviso de abertura, dicionário da busca) fica de fora, e também qualquer arquivo que não esteja nesta lista.
const folders: Record<string, Kind> = {
  acervo: "library",
  autores: "authors",
  memorial: "memorial",
  glossario: "glossary",
  jornal: "journal",
  checagens: "factChecks",
  debates: "debates",
  videos: "videos",
  falacias: "fallacies",
};
const lists: Record<string, Kind> = {
  "galeria.json": "gallery",
  "frases.json": "quotes",
  "perguntas.json": "questions",
  "comecar.json": "start",
  "radios.json": "radios",
  "noticias.json": "news",
  "falacias.json": "fallacies",
};
const studyPages = ["guia", "linha-do-tempo"];

type Unit =
  | { type: "lesson"; track: string }
  | { type: "track"; track: string; head: boolean }
  | { type: "page"; slug: string }
  | { type: "file" | "list"; kind: Kind };

function classify(file: string): Unit | null {
  if (!file.startsWith("content/")) return null;
  // Tradução de algo público ("aula.en.md") conta como tradução; de página institucional, fica de fora.
  const original = file.replace(/\.(en|es|zh|ru|fr)\.md$/, ".md");
  if (original !== file) return classify(original) ? { type: "file", kind: "translations" } : null;
  const parts = file.slice("content/".length).split("/");
  const [dir, name] = parts;
  if (dir === "trilhas" && parts.length === 3) {
    const leaf = parts[2];
    if (leaf === "_trilha.md" || leaf === "plano.json") return { type: "track", track: name, head: leaf === "_trilha.md" };
    return leaf.endsWith(".md") ? { type: "lesson", track: name } : null;
  }
  if (parts.length === 2 && dir === "catalogo" && name.endsWith(".json")) return { type: "list", kind: "catalog" };
  if (parts.length === 2 && dir === "paginas") {
    const slug = name.replace(/\.md$/, "");
    return studyPages.includes(slug) && name.endsWith(".md") ? { type: "page", slug } : null;
  }
  if (parts.length === 2 && folders[dir] && name.endsWith(".md")) return { type: "file", kind: folders[dir] };
  if (parts.length === 1 && lists[dir]) return { type: "list", kind: lists[dir] };
  return null;
}

// Listas em JSON (galeria, rádios, catálogo…) mudam num arquivo só: conta-se item por item, comparando o antes e o depois.
// O conteúdo de uma versão nunca muda, então o que já foi lido fica guardado enquanto o processo dura.
const shown = new Map<string, unknown[]>();
function listAt(rev: string, file: string): unknown[] {
  const key = `${rev}:${file}`;
  let items = shown.get(key);
  if (!items) {
    try {
      const data: unknown = JSON.parse(git(["show", key]));
      items = Array.isArray(data) ? data : [data];
    } catch {
      items = [];
    }
    shown.set(key, items);
  }
  return items;
}

const identity = (item: unknown) => {
  if (item && typeof item === "object") {
    for (const key of ["slug", "id", "u", "url", "feed", "pergunta", "titulo", "t", "texto", "nome"]) {
      const value = (item as Record<string, unknown>)[key];
      if (typeof value === "string" && value) return `${key}:${value}`;
    }
  }
  return JSON.stringify(item);
};

function compare(before: unknown[], after: unknown[]): Record<Action, number> {
  const old = new Map(before.map((item) => [identity(item), JSON.stringify(item)]));
  const now = new Map(after.map((item) => [identity(item), JSON.stringify(item)]));
  const count = { added: 0, updated: 0, removed: 0 };
  for (const [id, json] of now) {
    if (!old.has(id)) count.added++;
    else if (old.get(id) !== json) count.updated++;
  }
  for (const id of old.keys()) if (!now.has(id)) count.removed++;
  return count;
}

const order: Kind[] = ["lessonsIn", "lessons", "tracks", "translations", "library", "catalog", "authors", "memorial", "glossary", "journal", "factChecks", "debates", "fallacies", "videos", "gallery", "pages", "start", "questions", "quotes", "radios", "news"];
const actions: Action[] = ["added", "updated", "removed"];
/** Quantas aulas novas aparecem pelo título em cada linha; o resto vira "e mais N". */
export const TITLES = 4;

/** As mudanças que a página de histórico e a página inicial mostram, dia a dia, a partir da data dada. */
export function publicHistory(from: string, lang: Locale): PublicChange[] {
  if (!from) return [];
  const days = new Map<string, Commit[]>();
  for (const commit of getHistory()) {
    if (commit.date < from) continue;
    days.set(commit.date, [...(days.get(commit.date) ?? []), commit]);
  }

  const tracks = getTracks(lang);
  const areaOf = new Map(tracks.map((track) => [track.slug, track.area]));
  const lessonAt = new Map(tracks.flatMap((track) => track.lessons.map((lesson) => [lesson.file, { title: lesson.title, href: `/trilhas/${track.slug}/${lesson.slug}`, translated: lesson.translated }])));
  const pageAt = (slug: string) => {
    try {
      const page = getPage(slug, lang);
      return { title: page.title, href: `/${slug}`, translated: page.translated };
    } catch {
      return null;
    }
  };

  const changes: PublicChange[] = [];
  for (const [date, commits] of days) {
    // O saldo do dia por arquivo: criado e apagado no mesmo dia não conta; apagado e recriado é mudança.
    const touched = new Map<string, { first: Status; last: Status; oldest: string; newest: string }>();
    for (const commit of [...commits].reverse()) {
      for (const { status, path } of commit.files) {
        const seen = touched.get(path);
        if (seen) Object.assign(seen, { last: status, newest: commit.hash });
        else touched.set(path, { first: status, last: status, oldest: commit.hash, newest: commit.hash });
      }
    }

    const tally = new Map<string, HistoryPart>();
    const add = (kind: Kind, action: Action, count: number, area?: AreaSlug, link?: Link | null) => {
      if (count <= 0) return;
      const key = `${kind}:${action}:${area ?? ""}`;
      const part = tally.get(key) ?? { kind, action, count: 0, ...(area ? { area } : {}) };
      part.count += count;
      if (link) part.links = [...(part.links ?? []), link];
      tally.set(key, part);
    };
    const tracksTouched = new Map<string, Action>();
    const lessonsTouched = new Set<string>();

    for (const [path, { first, last, oldest, newest }] of touched) {
      const unit = classify(path);
      if (!unit) continue;
      const before = first !== "A";
      const after = last !== "D";
      if (!before && !after) continue;
      const action: Action = !before ? "added" : !after ? "removed" : "updated";
      if (unit.type === "lesson") {
        lessonsTouched.add(unit.track);
        const area = areaOf.get(unit.track);
        add(area ? "lessonsIn" : "lessons", action, 1, area, action === "added" ? lessonAt.get(path) : null);
      } else if (unit.type === "track") {
        // Trilha nova ou retirada vem do _trilha.md; mexer no roteiro (plano.json) é atualizar a trilha.
        const now = unit.head ? action : "updated";
        if (tracksTouched.get(unit.track) !== "added" && tracksTouched.get(unit.track) !== "removed") tracksTouched.set(unit.track, now);
      } else if (unit.type === "page") {
        add("pages", action, 1, undefined, action === "removed" ? null : pageAt(unit.slug));
      } else if (unit.type === "list") {
        const count = compare(before ? listAt(`${oldest}^`, path) : [], after ? listAt(newest, path) : []);
        for (const each of actions) add(unit.kind, each, count[each]);
      } else {
        add(unit.kind, action, 1);
      }
    }
    // Roteiro mexido junto com aulas da mesma trilha já está dito nas aulas: não vira "trilha atualizada".
    for (const [track, action] of tracksTouched) {
      if (action === "updated" && lessonsTouched.has(track)) continue;
      add("tracks", action, 1);
    }

    const parts = [...tally.values()].sort(
      (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || actions.indexOf(a.action) - actions.indexOf(b.action) || b.count - a.count,
    );
    if (parts.length > 0) changes.push({ date, parts });
  }
  return changes.sort((a, b) => b.date.localeCompare(a.date));
}

/** O resumo curto da página inicial: as aulas de todas as disciplinas viram uma linha só ("59 aulas novas"). */
export function overview(parts: HistoryPart[]): HistoryPart[] {
  const lessons = actions
    .map((action): HistoryPart => ({ kind: "lessons", action, count: parts.filter((p) => p.action === action && (p.kind === "lessons" || p.kind === "lessonsIn")).reduce((sum, p) => sum + p.count, 0) }))
    .filter((part) => part.count > 0);
  return [...lessons, ...parts.filter((p) => p.kind !== "lessons" && p.kind !== "lessonsIn")];
}

/** O texto de uma linha do resumo, no idioma da página: "2 aulas novas em Geografia". */
export function describePart(part: HistoryPart, lang: Locale, t: Dict): string {
  // plural() devolve "3145 obras…": o número ganha o separador de milhar do idioma ("3.145").
  const text = plural(lang, part.count, t.history.kinds[part.kind][part.action]).slice(String(part.count).length);
  const count = new Intl.NumberFormat(htmlLang[lang]).format(part.count);
  return count + (part.area ? fill(text, { area: t.areas[part.area][0] }) : text);
}

// Um índice arquivo → (última alteração, quantas versões), montado numa só passada pelo histórico. O mapa do site
// pergunta por dezesseis mil páginas: filtrar o histórico a cada pergunta passava de um minuto no build.
const porArquivo = umaVez((): Map<string, { updated: string; revisions: number }> => {
  const mapa = new Map<string, { updated: string; revisions: number }>();
  for (const commit of getHistory()) {
    for (const f of commit.files) {
      const atual = mapa.get(f.path);
      if (atual) atual.revisions++;
      else mapa.set(f.path, { updated: commit.date, revisions: 1 });
    }
  }
  return mapa;
});

export function fileHistory(file: string): { updated?: string; revisions: number } {
  return porArquivo().get(file) ?? { revisions: 0 };
}
