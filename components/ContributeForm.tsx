"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/pt";
import { areaSlugs, licenses } from "@/lib/areas";
import { github, MAX_PREFILL_LENGTH } from "@/lib/site";
import { KEYS, getItem, parse, setItem, useHydrated } from "@/lib/storage";
import { slugify } from "@/lib/text";
import { licenseName } from "./Cards";
import { useI18n } from "./I18n";
import { Markdown } from "./Markdown";

interface TrackOption {
  slug: string;
  title: string;
  nextOrder: number;
}

interface Draft {
  kind: "aula" | "obra";
  track: string;
  title: string;
  summary: string;
  credit: string;
  body: string;
  author: string;
  area: string;
  license: string;
  source: string;
  url: string;
  language: string;
}

const emptyDraft: Draft = {
  kind: "aula",
  track: "",
  title: "",
  summary: "",
  credit: "",
  body: "",
  author: "",
  area: areaSlugs[0],
  license: licenses[0],
  source: "",
  url: "",
  language: "Português",
};

const loadDraft = (firstTrack: string): Draft => ({
  ...emptyDraft,
  track: firstTrack,
  ...parse<Partial<Draft>>(getItem(KEYS.draft), {}),
});

// JSON.stringify produz uma string entre aspas que também é YAML válido.
const yaml = (value: string) => JSON.stringify(value.trim());

function buildFile(draft: Draft, tracks: TrackOption[]): { path: string; content: string } {
  const slug = slugify(draft.title) || "sem-titulo";
  if (draft.kind === "obra") {
    return {
      path: `content/acervo/${slug}.md`,
      content: [
        "---",
        `titulo: ${yaml(draft.title)}`,
        `autor: ${yaml(draft.author)}`,
        `area: ${draft.area}`,
        `licenca: ${yaml(draft.license)}`,
        `fonte: ${yaml(draft.source)}`,
        `url: ${yaml(draft.url)}`,
        `idioma: ${yaml(draft.language)}`,
        "---",
        "",
        draft.body.trim(),
        "",
      ].join("\n"),
    };
  }
  const track = tracks.find((t) => t.slug === draft.track);
  const order = String(track?.nextOrder ?? 1).padStart(2, "0");
  const head = ["---", `titulo: ${yaml(draft.title)}`, `resumo: ${yaml(draft.summary)}`];
  if (draft.credit.trim()) head.push(`autores: [${yaml(draft.credit)}]`);
  return {
    path: `content/trilhas/${draft.track}/${order}-${slug}.md`,
    content: [...head, "---", "", draft.body.trim(), ""].join("\n"),
  };
}

function problems(draft: Draft, declared: boolean, p: Dict["contribute"]["problems"]): string[] {
  const list: string[] = [];
  if (draft.title.trim().length < 3) list.push(p.title);
  if (draft.kind === "aula") {
    if (!draft.track) list.push(p.track);
    if (!draft.summary.trim()) list.push(p.summary);
    if (draft.body.trim().length < 200) list.push(p.body);
  } else {
    if (!draft.author.trim()) list.push(p.author);
    if (!draft.source.trim()) list.push(p.source);
    if (!/^https:\/\/\S+$/.test(draft.url.trim())) list.push(p.https);
    else if (/\.pdf($|\?)/i.test(draft.url.trim())) list.push(p.pdf);
    if (draft.body.trim().length < 40) list.push(p.synopsis);
  }
  if (!declared) list.push(p.declare);
  return list;
}

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const action = "cursor-pointer border-2 border-ink px-5 py-2.5 font-medium hover:border-oxblood hover:text-oxblood";

export function ContributeForm({ tracks }: { tracks: TrackOption[] }) {
  // O rascunho mora no localStorage, então o formulário só é montado no navegador.
  const hydrated = useHydrated();
  const { t } = useI18n();
  if (!hydrated) return <p className="mt-10 font-mono text-xs text-ink-soft">{t.contribute.loading}</p>;
  return <Editor tracks={tracks} />;
}

function Editor({ tracks }: { tracks: TrackOption[] }) {
  const { lang, t } = useI18n();
  const c = t.contribute;
  const [draft, setDraft] = useState<Draft>(() => loadDraft(tracks[0]?.slug ?? ""));
  const [declared, setDeclared] = useState(false);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setItem(KEYS.draft, JSON.stringify(draft));
  }, [draft]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const file = buildFile(draft, tracks);
  const issues = problems(draft, declared, c.problems);
  const isLesson = draft.kind === "aula";

  async function copy(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(file.content);
      setNotice(c.notices.copied);
      return true;
    } catch {
      setNotice(c.notices.copyFailed);
      return false;
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([file.content], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.path.split("/").pop() ?? "contribuicao.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function openOnGitHub() {
    const fits = encodeURIComponent(file.content).length <= MAX_PREFILL_LENGTH;
    // A cópia começa antes de abrir a aba: depois disso a página perde o foco e o navegador a recusaria.
    const copying = fits ? null : copy();
    window.open(github.newFile(file.path, fits ? file.content : undefined), "_blank", "noopener");
    if (!copying) {
      setNotice(c.notices.opened);
      return;
    }
    setNotice((await copying) ? c.notices.longCopied : c.notices.longFailed);
  }

  function reset() {
    setDraft({ ...emptyDraft, kind: draft.kind, track: tracks[0]?.slug ?? "" });
    setDeclared(false);
    setNotice(c.notices.cleared);
  }

  const input = (key: "title" | "summary" | "credit" | "author" | "language" | "source" | "url", label: string, extra = {}) => (
    <label className="block">
      {label}
      <input value={draft[key]} onChange={(e) => update(key, e.target.value)} className={field} {...extra} />
    </label>
  );

  return (
    <form className="mt-10 space-y-5 font-sans text-sm" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="sr-only">{c.kindLegend}</legend>
        {(["aula", "obra"] as const).map((kind) => (
          <label
            key={kind}
            className={`cursor-pointer border-2 px-5 py-2.5 font-medium ${
              draft.kind === kind ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"
            }`}
          >
            <input type="radio" name="kind" value={kind} checked={draft.kind === kind} onChange={() => update("kind", kind)} className="sr-only" />
            {kind === "aula" ? c.kindLesson : c.kindWork}
          </label>
        ))}
      </fieldset>

      {isLesson && (
        <label className="block">
          {c.track}
          <select value={draft.track} onChange={(e) => update("track", e.target.value)} className={field}>
            {tracks.map((track) => (
              <option key={track.slug} value={track.slug}>
                {track.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {input("title", isLesson ? c.lessonTitle : c.workTitle, { maxLength: 120 })}

      {isLesson ? (
        <>
          {input("summary", c.summary, { maxLength: 200 })}
          {input("credit", c.credit, { maxLength: 80 })}
        </>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {input("author", c.author)}
          {input("language", c.language)}
          <label className="block">
            {c.area}
            <select value={draft.area} onChange={(e) => update("area", e.target.value)} className={field}>
              {areaSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {t.areas[slug][0]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {c.license}
            <select value={draft.license} onChange={(e) => update("license", e.target.value)} className={field}>
              {licenses.map((l) => (
                <option key={l} value={l}>
                  {licenseName(t, l)}
                </option>
              ))}
            </select>
          </label>
          {input("source", c.source, { placeholder: "Project Gutenberg" })}
          {input("url", c.url, { type: "url", placeholder: "https://…" })}
        </div>
      )}

      <div>
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="conteudo-md">{isLesson ? c.body : c.synopsis}</label>
          {isLesson && (
            <button type="button" onClick={() => setPreview((p) => !p)} className="cursor-pointer underline hover:text-oxblood">
              {preview ? c.write : c.preview}
            </button>
          )}
        </div>
        {preview && isLesson ? (
          <div className="mt-1 min-h-64 border-2 border-rule bg-parchment p-5 font-serif">
            <Markdown lang={lang}>{draft.body || c.emptyPreview}</Markdown>
          </div>
        ) : (
          <textarea
            id="conteudo-md"
            value={draft.body}
            onChange={(e) => update("body", e.target.value)}
            rows={isLesson ? 16 : 5}
            placeholder={isLesson ? c.bodyPlaceholder : ""}
            className={`${field} font-mono`}
          />
        )}
        <p className="mt-1 font-mono text-xs text-ink-soft">{c.autosave}</p>
      </div>

      <label className="flex items-start gap-2">
        <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-1" />
        <span>{isLesson ? c.declareLesson : c.declareWork}</span>
      </label>

      <div className="border border-rule bg-parchment-deep p-5">
        <p className="font-mono text-xs text-ink-soft">
          {c.file} {file.path}
        </p>
        {issues.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-oxblood">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ok">{c.ready}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={issues.length > 0}
            onClick={openOnGitHub}
            className="cursor-pointer bg-oxblood px-6 py-2.5 font-medium text-parchment hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {c.send} ↗
          </button>
          <button type="button" onClick={copy} className={action}>
            {c.copy}
          </button>
          <button type="button" onClick={download} className={action}>
            {c.download}
          </button>
          <button type="button" onClick={reset} className="cursor-pointer px-2 text-ink-soft underline hover:text-oxblood">
            {c.clear}
          </button>
        </div>
        <p role="status" className="mt-3 min-h-5 text-ink-soft">
          {notice}
        </p>
      </div>
    </form>
  );
}
