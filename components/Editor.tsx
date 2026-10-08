// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useRef, useState } from "react";
import { useI18n } from "./I18n";
import { Markdown } from "./Markdown";

export interface EditorLabels {
  bold: string;
  italic: string;
  heading: string;
  subheading: string;
  quote: string;
  list: string;
  numbered: string;
  link: string;
  linkPrompt: string;
  preview: string;
  write: string;
  empty: string;
}

export interface SourceDraft {
  titulo: string;
  autor: string;
  url: string;
}

export interface SourceLabels {
  title: string;
  hint: string;
  name: string;
  author: string;
  url: string;
  add: string;
  remove: string;
}

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";

/** Editor de texto com barra de ferramentas (negrito, itálico, títulos, citação, listas, link) e pré-visualização. */
export function MarkdownEditor({ id, value, onChange, labels, rows = 16, placeholder = "" }: { id: string; value: string; onChange: (value: string) => void; labels: EditorLabels; rows?: number; placeholder?: string }) {
  const { lang } = useI18n();
  const area = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  /** Envolve a seleção (ou insere um modelo) e devolve o cursor ao lugar certo. */
  function wrap(before: string, after: string, sample: string) {
    const el = area.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const chosen = value.slice(start, end) || sample;
    onChange(value.slice(0, start) + before + chosen + after + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + chosen.length);
    });
  }

  /** Põe um prefixo no começo de cada linha selecionada (título, citação, lista). */
  function prefix(mark: string | ((i: number) => string)) {
    const el = area.current;
    if (!el) return;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const end = el.selectionEnd;
    const block = value.slice(start, end) || "";
    const lines = block.split("\n").map((line, i) => (typeof mark === "string" ? mark : mark(i)) + line.replace(/^(#{1,3} |> |- |\d+\. )/, ""));
    onChange(value.slice(0, start) + lines.join("\n") + value.slice(end));
    requestAnimationFrame(() => el.focus());
  }

  function link() {
    const url = window.prompt(labels.linkPrompt, "https://");
    if (!url || !/^https?:\/\//.test(url)) return;
    wrap("[", `](${url})`, labels.link);
  }

  // Cada botão é descrito por dados; a ação só é montada na hora do clique.
  const tools: [symbol: string, name: string, mark: string, style?: string][] = [
    ["N", labels.bold, "**", "font-bold"],
    ["I", labels.italic, "*", "italic font-serif"],
    ["T1", labels.heading, "## "],
    ["T2", labels.subheading, "### "],
    ["❝", labels.quote, "> "],
    ["•", labels.list, "- "],
    ["1.", labels.numbered, "1. "],
    ["↗", labels.link, "link"],
  ];

  function apply(name: string, mark: string) {
    if (mark === "link") link();
    else if (mark === "**" || mark === "*") wrap(mark, mark, name);
    else if (mark === "1. ") prefix((i) => `${i + 1}. `);
    else prefix(mark);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-2 border-b-0 border-ink bg-parchment px-2 py-1.5">
        {tools.map(([symbol, name, mark, style]) => (
          <button key={name} type="button" title={name} aria-label={name} disabled={preview} onClick={() => apply(name, mark)} className={`min-w-9 cursor-pointer border border-rule px-2 py-1 text-sm hover:border-gold disabled:opacity-40 ${style ?? ""}`}>
            {symbol}
          </button>
        ))}
        <button type="button" onClick={() => setPreview((p) => !p)} className="ml-auto cursor-pointer px-2 text-sm underline hover:text-oxblood">
          {preview ? labels.write : labels.preview}
        </button>
      </div>
      {preview ? (
        <div className="min-h-64 border-2 border-ink bg-parchment p-5 font-serif">
          <Markdown lang={lang}>{value || labels.empty}</Markdown>
        </div>
      ) : (
        <textarea ref={area} id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-mono" />
      )}
    </div>
  );
}

/** Lista de fontes. Todo material de ensino precisa de pelo menos uma. */
export function SourcesField({ value, onChange, labels }: { value: SourceDraft[]; onChange: (value: SourceDraft[]) => void; labels: SourceLabels }) {
  const set = (i: number, key: keyof SourceDraft, text: string) => onChange(value.map((source, j) => (j === i ? { ...source, [key]: text } : source)));
  return (
    <fieldset className="border border-rule bg-parchment-deep p-4">
      <legend className="px-1 font-semibold">{labels.title}</legend>
      <p className="text-ink-soft">{labels.hint}</p>
      {value.map((source, i) => (
        <div key={i} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
          <input aria-label={labels.name} placeholder={labels.name} value={source.titulo} onChange={(e) => set(i, "titulo", e.target.value)} maxLength={300} className={field.replace("mt-1 ", "")} />
          <input aria-label={labels.author} placeholder={labels.author} value={source.autor} onChange={(e) => set(i, "autor", e.target.value)} maxLength={160} className={field.replace("mt-1 ", "")} />
          <input aria-label={labels.url} placeholder="https://…" type="url" value={source.url} onChange={(e) => set(i, "url", e.target.value)} maxLength={500} className={`${field.replace("mt-1 ", "")} font-mono`} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={labels.remove} title={labels.remove} className="cursor-pointer px-2 text-ink-soft hover:text-oxblood">
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { titulo: "", autor: "", url: "" }])} className="mt-3 cursor-pointer underline hover:text-oxblood">
        + {labels.add}
      </button>
    </fieldset>
  );
}

export const cleanSources = (sources: SourceDraft[]) =>
  sources.filter((source) => source.titulo.trim()).map((source) => ({ titulo: source.titulo.trim(), autor: source.autor.trim(), url: source.url.trim() }));

export { field as fieldClass };
