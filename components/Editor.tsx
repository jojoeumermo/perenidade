// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { htmlLang } from "@/i18n/config";
import { cleanImage, sendFile, UploadError, uploadMessages } from "@/lib/upload";
import { EditorPorBlocos } from "./EditorPorBlocos";
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
  /** Aviso de que o conferidor do instituto não respondeu e o serviço público entrou de reserva. */
  checkFallback?: string;
  checkNone: string;
  checkNote: string;
  checkFailed: string;
  checkStale: string;
}

/** Um apontamento da conferência de texto: onde está, o que diz e o que sugere. */
type Categoria = "grafia" | "gramatica" | "pontuacao" | "estilo";

interface Issue {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
  before: string;
  wrong: string;
  after: string;
  categoria: Categoria;
}

interface CheckResponse {
  matches: { offset: number; length: number; message: string; replacements: { value: string }[]; rule?: { id?: string; issueType?: string; category?: { id?: string } } }[];
  fonte?: "proprio" | "publico";
  reserva?: boolean;
}

const NOMES_DAS_CATEGORIAS: Record<Categoria, string> = { grafia: "Ortografia", gramatica: "Gramática", pontuacao: "Pontuação", estilo: "Estilo e clareza" };
function categoriaDe(rule?: { id?: string; issueType?: string; category?: { id?: string } }): Categoria {
  const tipo = (rule?.issueType ?? "").toLowerCase();
  const cat = (rule?.category?.id ?? "").toUpperCase();
  if (tipo === "misspelling" || cat === "TYPOS") return "grafia";
  if (tipo === "typographical" || cat === "PUNCTUATION" || cat === "TYPOGRAPHY") return "pontuacao";
  if (tipo === "style" || tipo === "register" || tipo === "locale-violation" || cat === "STYLE" || cat === "REDUNDANCY" || cat === "PLAIN_ENGLISH" || cat === "SEMANTICS") return "estilo";
  return "gramatica";
}
const CHAVE_DICIONARIO_PESSOAL = "lucia:dicionario-pessoal";
function dicionarioPessoal(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_DICIONARIO_PESSOAL) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Só prosa passa pela conferência: ficam de fora os blocos de código (programas, pautas, contas), as fórmulas entre
 * cifrões, as linhas de tabela, os endereços e as citações diretas entre aspas.
 */
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
  for (const re of [/\$\$[\s\S]*?\$\$/g, /^\|.*$/gm, /https?:\/\/\S+/g, /“[^”]{12,}”/g, /"[^"\n]{12,}"/g]) {
    for (let m = re.exec(text); m; m = re.exec(text)) ranges.push([m.index, m.index + m[0].length]);
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
export function MarkdownEditor({ id, value, onChange, labels, rows = 16, placeholder = "", upload = false, blocos: comBlocos = false }: { id: string; value: string; onChange: (value: string) => void; labels: EditorLabels; rows?: number; placeholder?: string; upload?: boolean; /** Oferece o modo por blocos (painel). */ blocos?: boolean }) {
  const { lang } = useI18n();
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  // Texto ou blocos: preferência deste aparelho, lembrada entre as aulas.
  const [porBlocos, setPorBlocos] = useState(() => {
    try {
      return comBlocos && window.localStorage.getItem("lucia:editor-por-blocos") === "1";
    } catch {
      return false;
    }
  });
  const escolherBlocos = (sim: boolean) => {
    setPorBlocos(sim);
    setPreview(false);
    try {
      window.localStorage.setItem("lucia:editor-por-blocos", sim ? "1" : "0");
    } catch {
      // sem armazenamento
    }
  };
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
  const [ativa, setAtiva] = useState<number | null>(null);
  const [reserva, setReserva] = useState(false);
  const [termosDoInstituto, setTermosDoInstituto] = useState<string[]>([]);
  const [pessoal, setPessoal] = useState<string[]>(() => (typeof window === "undefined" ? [] : dicionarioPessoal()));
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<string[]>("dicionario_termos")
      .then((lista) => {
        if (vivo && Array.isArray(lista)) setTermosDoInstituto(lista);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const checkRef = useRef<() => Promise<void>>(async () => undefined);
  const fundo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!live || preview || value.trim().length < 20 || value === lastChecked.current) return;
    const marca = window.setTimeout(() => void checkRef.current(), 1200);
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

  async function anexo(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setNotice("O anexo precisa ser um PDF.");
      return;
    }
    setNotice(labels.sending);
    try {
      const path = await sendFile(file, "pdf");
      const nome = (window.prompt("Nome do anexo (o que a pessoa vai baixar)", "Material da aula") ?? "").replace(/[[\]\n]/g, " ").trim() || "Anexo";
      insertBlock(`[📎 ${nome}](envio:${path})`);
      setNotice("");
    } catch (error) {
      setNotice(uploadMessages[error instanceof UploadError ? error.message : "envio"] ?? uploadMessages.envio);
    } finally {
      if (pdf.current) pdf.current.value = "";
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
      setReserva(Boolean(data.reserva));
      const skip = fenced(text);
      const aceitas = new Set([...termosDoInstituto, ...pessoal].map((t) => t.toLowerCase()));
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
            categoria: categoriaDe(match.rule),
          }))
          // Marcas do próprio formato do texto (asteriscos, cerquilhas, colchetes) não são erro de escrita; termos dos dicionários também não.
          .filter((issue) => !/[*_#`>|\[\]()]/.test(issue.wrong) && !/^https?:/.test(issue.wrong) && !aceitas.has(issue.wrong.toLowerCase()))
          .slice(0, 60),
      );
      setAtiva(null);
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
      // Vermelho ondulado para grafia; azul pontilhado para gramática, pontuação e estilo (não só a cor distingue).
      partes.push(<mark key={issue.offset} className={issue.categoria === "grafia" ? "bg-oxblood/15 text-transparent underline decoration-oxblood decoration-wavy decoration-2" : "bg-[#1d4ed8]/10 text-transparent underline decoration-[#1d4ed8] decoration-dotted decoration-2"}>{value.slice(issue.offset, issue.offset + issue.length)}</mark>);
      pos = issue.offset + issue.length;
    }
    partes.push(value.slice(pos));
    return partes;
  }

  /** Clicar numa marcação (ou pôr o cursor sobre ela) abre o apontamento correspondente na lista. */
  function apontarNoCursor() {
    const pos = area.current?.selectionStart ?? -1;
    if (pos < 0 || !issues?.length) return;
    const i = issues.findIndex((issue) => pos >= issue.offset && pos <= issue.offset + issue.length);
    if (i >= 0) {
      setAtiva(i);
      document.getElementById(`${id}-apontamento-${i}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  /** Leva o cursor ao apontamento escolhido (navegação por teclado entre os problemas). */
  function irPara(i: number) {
    const issue = issues?.[i];
    if (!issue || !area.current) return;
    setAtiva(i);
    area.current.focus();
    area.current.setSelectionRange(issue.offset, issue.offset + issue.length);
  }
  function ignorar(issue: Issue) {
    setIssues((list) => (list ?? []).filter((item) => item !== issue));
  }
  function aoDicionario(issue: Issue) {
    const lista = [...new Set([...pessoal, issue.wrong])];
    setPessoal(lista);
    try {
      window.localStorage.setItem(CHAVE_DICIONARIO_PESSOAL, JSON.stringify(lista));
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
    setIssues((list) => (list ?? []).filter((item) => item.wrong.toLowerCase() !== issue.wrong.toLowerCase()));
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
    ...(upload ? [["▣", labels.image, "imagem"] as [string, string, string], ["📎", "Anexo em PDF", "anexo"] as [string, string, string]] : []),
  ];

  function apply(name: string, mark: string) {
    if (mark === "link") link();
    else if (mark === "video") video();
    else if (mark === "conta") insertBlock(["```conta", "2 + 3 × (4 − 1)²", "= 2 + 3 × 3²", "= 2 + 3 × 9", "= 2 + 27", "= 29", "```"].join("\n"));
    else if (mark === "imagem") picker.current?.click();
    else if (mark === "anexo") pdf.current?.click();
    else if (mark === "**" || mark === "*") wrap(mark, mark, name);
    else if (mark === "1. ") prefix((i) => `${i + 1}. `);
    else prefix(mark);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-2 border-b-0 border-ink bg-parchment px-2 py-1.5">
        {comBlocos && (
          <span role="group" aria-label="Modo do editor" className="mr-2 flex">
            <button type="button" aria-pressed={!porBlocos} onClick={() => escolherBlocos(false)} className={`cursor-pointer border px-2 py-1 text-xs ${!porBlocos ? "border-ink bg-ink text-parchment" : "border-rule"}`}>Texto</button>
            <button type="button" aria-pressed={porBlocos} onClick={() => escolherBlocos(true)} className={`cursor-pointer border px-2 py-1 text-xs ${porBlocos ? "border-ink bg-ink text-parchment" : "border-rule"}`}>Blocos</button>
          </span>
        )}
        {tools.map(([symbol, name, mark, style]) => (
          <button key={name} type="button" title={name} aria-label={name} disabled={preview} onClick={() => apply(name, mark)} className={`min-w-9 cursor-pointer border border-rule px-2 py-1 text-sm hover:border-gold disabled:opacity-40 ${porBlocos ? "hidden" : ""} ${style ?? ""}`}>
            {symbol}
          </button>
        ))}
        <button type="button" onClick={() => setPreview((p) => !p)} className="ml-auto cursor-pointer px-2 text-sm underline hover:text-oxblood">
          {preview ? labels.write : labels.preview}
        </button>
      </div>
      {porBlocos && !preview ? (
        <EditorPorBlocos value={value} onChange={onChange} upload={upload} />
      ) : preview ? (
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
            onClick={apontarNoCursor}
            onKeyUp={(e) => { if (/^Arrow/.test(e.key)) apontarNoCursor(); }}
            rows={rows}
            placeholder={placeholder}
            spellCheck
            lang={htmlLang[lang]}
            className="relative w-full border-2 border-ink bg-transparent px-3 py-2 font-mono"
          />
        </div>
      )}
      {upload && <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void image(e.target.files?.[0])} />}
      {upload && <input ref={pdf} type="file" accept="application/pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void anexo(e.target.files?.[0])} />}
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
        {reserva && issues && <span className="block text-ink-soft">{labels.checkFallback ?? (lang === "pt" ? "O conferidor do instituto não respondeu: esta conferência foi feita pelo serviço público do LanguageTool." : "The institute's checker did not respond: this check used the public LanguageTool service.")}</span>}
      </p>
      {issues && issues.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border border-b-0 border-rule bg-parchment-deep px-3 py-2 text-xs">
          {(Object.keys(NOMES_DAS_CATEGORIAS) as Categoria[]).map((c) => {
            const n = issues.filter((i) => i.categoria === c).length;
            return n > 0 ? (
              <span key={c}>
                <span aria-hidden className={`mr-1 inline-block h-2.5 w-2.5 align-middle ${c === "grafia" ? "bg-oxblood" : "bg-[#1d4ed8]"}`} />
                {NOMES_DAS_CATEGORIAS[c]}: {n}
              </span>
            ) : null;
          })}
          <span className="ml-auto flex gap-1">
            <button type="button" aria-label="Apontamento anterior" onClick={() => irPara(((ativa ?? 0) - 1 + issues.length) % issues.length)} className="cursor-pointer border border-rule px-2 py-0.5 hover:border-ink">↑</button>
            <button type="button" aria-label="Próximo apontamento" onClick={() => irPara(ativa === null ? 0 : (ativa + 1) % issues.length)} className="cursor-pointer border border-rule px-2 py-0.5 hover:border-ink">↓</button>
          </span>
        </div>
      )}
      {issues && issues.length > 0 && (
        <ul className="max-h-80 divide-y divide-rule overflow-y-auto border border-rule bg-parchment text-sm">
          {issues.map((issue, i) => (
            <li key={`${issue.offset}-${issue.wrong}`} id={`${id}-apontamento-${i}`} className={`p-3 ${ativa === i ? "bg-parchment-deep outline outline-2 -outline-offset-2 outline-oxblood" : ""}`}>
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ink-soft">{NOMES_DAS_CATEGORIAS[issue.categoria]}</p>
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
                <button type="button" onClick={() => irPara(i)} className="cursor-pointer px-2 text-ink-soft underline hover:text-oxblood">{lang === "pt" ? "Ir ao trecho" : "Go to text"}</button>
                <button type="button" onClick={() => ignorar(issue)} className="cursor-pointer px-2 text-ink-soft underline hover:text-oxblood">{lang === "pt" ? "Ignorar" : "Ignore"}</button>
                {issue.categoria === "grafia" && /^[\p{L}\p{N}'’-]+$/u.test(issue.wrong) && (
                  <button type="button" onClick={() => aoDicionario(issue)} className="cursor-pointer px-2 text-ink-soft underline hover:text-oxblood">{lang === "pt" ? "Adicionar ao meu dicionário" : "Add to my dictionary"}</button>
                )}
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
