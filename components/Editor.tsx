// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { htmlLang } from "@/i18n/config";
import { cleanImage, sendFile, UploadError, uploadMessages } from "@/lib/upload";
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
  video: string;
  videoPrompt: string;
  math: string;
  image: string;
  imageAlt: string;
  imageCredit: string;
  sending: string;
  check: string;
  checking: string;
  /** Conferir sozinho enquanto a pessoa escreve (opcional: sem o texto, "Conferir enquanto escrevo"). */
  checkLive?: string;
  checkNone: string;
  checkNote: string;
  checkFailed: string;
  checkStale: string;
}

/** Um apontamento da conferência de texto: onde está, o que diz e o que sugere. */
interface Issue {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
  before: string;
  wrong: string;
  after: string;
}

interface CheckResponse {
  matches: { offset: number; length: number; message: string; replacements: { value: string }[] }[];
}

/** Trechos entre cercas de código (exemplos de programa, pautas, contas) não passam pela conferência. */
function fenced(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const fence = /^```.*$/gm;
  let open = -1;
  for (let match = fence.exec(text); match; match = fence.exec(text)) {
    if (open < 0) open = match.index;
    else {
      ranges.push([open, match.index + match[0].length]);
      open = -1;
    }
  }
  return ranges;
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

/**
 * Editor de texto com barra de ferramentas (negrito, itálico, títulos, citação, listas, link, vídeo, conta),
 * pré-visualização e conferência de ortografia e gramática. Com `upload`, a equipe também envia imagens.
 */
export function MarkdownEditor({ id, value, onChange, labels, rows = 16, placeholder = "", upload = false }: { id: string; value: string; onChange: (value: string) => void; labels: EditorLabels; rows?: number; placeholder?: string; upload?: boolean }) {
  const { lang } = useI18n();
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [checking, setChecking] = useState(false);
  // Conferência ao vivo: alguns segundos depois de parar de digitar, o texto é conferido de novo e os apontamentos
  // ficam sublinhados por trás do texto. Preferência deste aparelho.
  const [live, setLive] = useState(() => {
    try {
      return window.localStorage.getItem("lucia:conferir-ao-vivo") === "1";
    } catch {
      return false;
    }
  });
  const lastChecked = useRef("");
  const checkRef = useRef<() => Promise<void>>(async () => undefined);
  const fundo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!live || preview || value.trim().length < 20 || value === lastChecked.current) return;
    const marca = window.setTimeout(() => void checkRef.current(), 2500);
    return () => window.clearTimeout(marca);
  }, [live, preview, value]);

  /** Insere um bloco em linhas próprias, no ponto do cursor. */
  function insertBlock(block: string) {
    const el = area.current;
    const at = el ? el.selectionStart : value.length;
    const before = value.slice(0, at).replace(/\n*$/, "");
    const after = value.slice(at).replace(/^\n*/, "");
    onChange(`${before}${before ? "\n\n" : ""}${block}\n\n${after}`);
    requestAnimationFrame(() => el?.focus());
  }

  function video() {
    const url = window.prompt(labels.videoPrompt, "https://");
    if (!url || !/^https:\/\/[^\s]+$/.test(url.trim())) return;
    insertBlock(["```video", url.trim(), "```"].join("\n"));
  }

  async function image(file: File | undefined) {
    if (!file) return;
    setNotice(labels.sending);
    try {
      const { blob, extension } = await cleanImage(file);
      const path = await sendFile(blob, extension);
      const alt = (window.prompt(labels.imageAlt, "") ?? "").replace(/[\[\]\n]/g, " ").trim() || labels.image;
      const credit = (window.prompt(labels.imageCredit, "") ?? "").replace(/["\n]/g, " ").trim();
      insertBlock(`![${alt}](envio:${path}${credit ? ` "${credit}"` : ""})`);
      setNotice("");
    } catch (error) {
      setNotice(uploadMessages[error instanceof UploadError ? error.message : "envio"] ?? uploadMessages.envio);
    } finally {
      if (picker.current) picker.current.value = "";
    }
  }

  /** Confere ortografia e gramática no serviço aberto LanguageTool. Nada é mudado sozinho: a pessoa escolhe cada correção. */
  async function check() {
    setChecking(true);
    setNotice("");
    try {
      const text = value.slice(0, 20000);
      lastChecked.current = value;
      // Pelo próprio site (app/api/gramatica), que fala com o LanguageTool do instituto ou, sem ele, com o serviço público.
      const response = await fetch("/api/gramatica", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, language: lang === "pt" ? "pt-BR" : "auto" }) });
      if (!response.ok) throw new Error("conferencia");
      const data = (await response.json()) as CheckResponse;
      const skip = fenced(text);
      setIssues(
        data.matches
          .filter((match) => !skip.some(([from, to]) => match.offset >= from && match.offset < to))
          .map((match) => ({
            offset: match.offset,
            length: match.length,
            message: match.message,
            replacements: match.replacements.slice(0, 3).map((item) => item.value),
            before: text.slice(Math.max(0, match.offset - 30), match.offset),
            wrong: text.slice(match.offset, match.offset + match.length),
            after: text.slice(match.offset + match.length, match.offset + match.length + 30),
          }))
          // Marcas do próprio formato do texto (asteriscos, cerquilhas, colchetes) não são erro de escrita.
          .filter((issue) => !/[*_#`>|\[\]()]/.test(issue.wrong) && !/^https?:/.test(issue.wrong))
          .slice(0, 40),
      );
    } catch {
      setIssues(null);
      setNotice(labels.checkFailed);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkRef.current = check;
  });

  /** O texto repetido por trás da caixa, invisível, só para sublinhar os apontamentos no lugar certo. */
  function marcado() {
    if (!issues?.length) return null;
    const partes: React.ReactNode[] = [];
    let pos = 0;
    for (const issue of [...issues].sort((a, b) => a.offset - b.offset)) {
      if (issue.offset < pos) continue;
      partes.push(value.slice(pos, issue.offset));
      partes.push(<mark key={issue.offset} className="bg-oxblood/15 text-transparent underline decoration-oxblood decoration-wavy">{value.slice(issue.offset, issue.offset + issue.length)}</mark>);
      pos = issue.offset + issue.length;
    }
    partes.push(value.slice(pos));
    return partes;
  }

  function fix(issue: Issue, replacement: string) {
    // Se o texto mudou desde a conferência, as posições não valem mais: melhor conferir de novo.
    if (value.slice(issue.offset, issue.offset + issue.length) !== issue.wrong) {
      setIssues(null);
      setNotice(labels.checkStale);
      return;
    }
    onChange(value.slice(0, issue.offset) + replacement + value.slice(issue.offset + issue.length));
    const delta = replacement.length - issue.length;
    setIssues((list) => (list ?? []).filter((item) => item !== issue).map((item) => (item.offset > issue.offset ? { ...item, offset: item.offset + delta } : item)));
  }

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
    ["▶", labels.video, "video"],
    ["∑", labels.math, "conta"],
    ...(upload ? [["▣", labels.image, "imagem"] as [string, string, string]] : []),
  ];

  function apply(name: string, mark: string) {
    if (mark === "link") link();
    else if (mark === "video") video();
    else if (mark === "conta") insertBlock(["```conta", "2 + 3 × (4 − 1)²", "= 2 + 3 × 3²", "= 2 + 3 × 9", "= 2 + 27", "= 29", "```"].join("\n"));
    else if (mark === "imagem") picker.current?.click();
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
        <div className="relative">
          <div ref={fundo} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border-2 border-transparent bg-parchment-deep px-3 py-2 font-mono text-transparent">
            {marcado()}
          </div>
          <textarea
            ref={area}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => { if (fundo.current) fundo.current.scrollTop = e.currentTarget.scrollTop; }}
            rows={rows}
            placeholder={placeholder}
            spellCheck
            lang={htmlLang[lang]}
            className="relative w-full border-2 border-ink bg-transparent px-3 py-2 font-mono"
          />
        </div>
      )}
      {upload && <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void image(e.target.files?.[0])} />}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" onClick={check} disabled={checking || value.trim().length < 20} className="cursor-pointer border-2 border-ink px-3 py-1.5 text-sm font-medium hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50">
          {checking ? labels.checking : labels.check}
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="checkbox" checked={live} onChange={(e) => { setLive(e.target.checked); try { window.localStorage.setItem("lucia:conferir-ao-vivo", e.target.checked ? "1" : "0"); } catch { /* sem armazenamento */ } }} />
          {labels.checkLive ?? (lang === "pt" ? "Conferir enquanto escrevo" : "Check as I write")}
        </label>
        <span className="text-sm text-ink-soft">{labels.checkNote}</span>
      </div>
      <p role="status" className="mt-1 min-h-5 text-sm text-oxblood">
        {notice}
        {issues?.length === 0 && labels.checkNone}
      </p>
      {issues && issues.length > 0 && (
        <ul className="mt-1 max-h-80 divide-y divide-rule overflow-y-auto border border-rule bg-parchment text-sm">
          {issues.map((issue) => (
            <li key={`${issue.offset}-${issue.wrong}`} className="p-3">
              <p className="font-mono text-xs">
                …{issue.before}
                <mark className="bg-oxblood px-0.5 text-parchment">{issue.wrong}</mark>
                {issue.after}…
              </p>
              <p className="mt-1">{issue.message}</p>
              <p className="mt-1 flex flex-wrap gap-2">
                {issue.replacements.map((replacement) => (
                  <button key={replacement} type="button" onClick={() => fix(issue, replacement)} className="cursor-pointer border border-ink px-2 py-0.5 hover:bg-ink hover:text-parchment">
                    {replacement || "∅"}
                  </button>
                ))}
                <button type="button" onClick={() => setIssues((list) => (list ?? []).filter((item) => item !== issue))} aria-label={labels.write} className="cursor-pointer px-2 text-ink-soft hover:text-oxblood">
                  ✕
                </button>
              </p>
            </li>
          ))}
        </ul>
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
