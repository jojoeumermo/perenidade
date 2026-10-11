// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { areaSlugs, licenses } from "@/lib/areas";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { KEYS, getItem, parse, setItem, useHydrated } from "@/lib/storage";
import { licenseName } from "./Cards";
import { cleanSources, fieldClass as field, MarkdownEditor, SourcesField, type SourceDraft } from "./Editor";
import { errorText } from "@/i18n/core";
import { useI18n } from "./I18n";
import { useTrackOptions } from "./useTrackOptions";

type Kind = "aula" | "obra" | "correcao" | "sugestao";

interface Draft {
  kind: Kind;
  track: string;
  planned: string;
  title: string;
  summary: string;
  name: string;
  body: string;
  author: string;
  area: string;
  license: string;
  source: string;
  url: string;
  language: string;
  target: string;
  sources: SourceDraft[];
}

const emptyDraft: Draft = {
  kind: "aula",
  track: "",
  planned: "",
  title: "",
  summary: "",
  name: "",
  body: "",
  author: "",
  area: areaSlugs[0],
  license: licenses[0],
  source: "",
  url: "",
  language: "Português",
  target: "",
  sources: [{ titulo: "", autor: "", url: "" }],
};

export function ContributeForm({ s }: { s: Dict["contribute"] }) {
  // O rascunho mora no navegador, então o formulário só é montado depois de carregar.
  const hydrated = useHydrated();
  if (!hydrated) return <p className="mt-10 font-mono text-xs text-ink-soft">{s.loading}</p>;
  return <Form s={s} />;
}

function Form({ s }: { s: Dict["contribute"] }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const params = useSearchParams();
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = { ...emptyDraft, ...parse<Partial<Draft>>(getItem(KEYS.draft), {}) };
    // Veio de "Sugerir correção" ou de "escrever esta aula": começa já no lugar certo.
    const fix = params.get("corrigir");
    const track = params.get("trilha");
    if (fix && /^\/[a-z0-9/_-]{1,200}$/.test(fix)) return { ...saved, kind: "correcao", target: fix };
    if (track && /^[a-z0-9-]{2,80}$/.test(track)) return { ...saved, kind: "aula", track };
    return saved;
  });
  const [declared, setDeclared] = useState(false);
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" | "error"; message?: string }>({ status: "idle" });

  useEffect(() => {
    setItem(KEYS.draft, JSON.stringify(draft));
  }, [draft]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  // Enquanto a lista de trilhas não chega (ou se a trilha do rascunho não existe mais), vale a primeira.
  const track = tracks.find((option) => option.slug === draft.track) ?? tracks[0];
  const kind = draft.kind;
  const isLesson = kind === "aula";
  const isWork = kind === "obra";
  const sources = cleanSources(draft.sources);

  const p = s.problems;
  const issues: string[] = [];
  if (draft.title.trim().length < 3) issues.push(p.title);
  if (isLesson) {
    if (!track) issues.push(p.track);
    if (!draft.summary.trim()) issues.push(p.summary);
    if (draft.body.trim().length < 200) issues.push(p.body);
    if (sources.length === 0) issues.push(p.sources);
  } else if (isWork) {
    if (!draft.author.trim()) issues.push(p.author);
    if (!draft.source.trim()) issues.push(p.source);
    if (!/^https:\/\/\S+$/.test(draft.url.trim())) issues.push(p.https);
    else if (/\.pdf($|\?)/i.test(draft.url.trim())) issues.push(p.pdf);
    if (draft.body.trim().length < 40) issues.push(p.synopsis);
  } else if (draft.body.trim().length < 20) issues.push(p.details);
  if (!declared && (isLesson || isWork)) issues.push(p.declare);

  async function send() {
    setState({ status: "sending" });
    const payload: Record<string, unknown> = { tipo: kind, titulo: draft.title, corpo: draft.body, nome: draft.name, site: trap };
    if (isLesson) {
      payload.disciplina = track?.area;
      payload.fontes = sources;
      payload.dados = { trilha: track?.slug, slug: draft.planned, resumo: draft.summary.trim() };
    } else if (isWork) {
      payload.disciplina = draft.area;
      payload.dados = { autor: draft.author.trim(), licenca: draft.license, fonte: draft.source.trim(), url: draft.url.trim(), idioma: draft.language.trim() };
    } else if (kind === "correcao") {
      payload.alvo = draft.target;
    }
    try {
      await rpc("contribuir", { p: payload });
      setDraft({ ...emptyDraft, kind, track: draft.track, name: draft.name });
      setDeclared(false);
      setState({ status: "sent" });
    } catch (error) {
      setState({ status: "error", message: errorText(t, error instanceof BackendError ? error.code : "falha") });
    }
  }

  const input = (key: "title" | "summary" | "name" | "author" | "language" | "source" | "url" | "target", label: string, extra = {}) => (
    <label className="block">
      {label}
      <input value={draft[key]} onChange={(e) => update(key, e.target.value)} className={field} {...extra} />
    </label>
  );
  const kinds: [Kind, string][] = [
    ["aula", s.kindLesson],
    ["obra", s.kindWork],
    ["correcao", s.kindFix],
    ["sugestao", s.kindIdea],
  ];

  return (
    <form className="mt-10 space-y-5 font-sans text-sm" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="sr-only">{s.kindLegend}</legend>
        {kinds.map(([value, label]) => (
          <label key={value} className={`cursor-pointer border-2 px-5 py-2.5 font-medium ${kind === value ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
            <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => update("kind", value)} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>

      {isLesson && (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            {s.track}
            <select value={track?.slug ?? ""} onChange={(e) => setDraft((prev) => ({ ...prev, track: e.target.value, planned: "" }))} className={field}>
              {areaSlugs.map((area) => {
                const inArea = tracks.filter((option) => option.area === area);
                return inArea.length > 0 ? (
                  <optgroup key={area} label={t.areas[area][0]}>
                    {inArea.map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </label>
          <label className="block">
            {s.planned}
            <select
              value={draft.planned}
              onChange={(e) => {
                const chosen = track?.planned.find((item) => item.slug === e.target.value);
                setDraft((prev) => ({ ...prev, planned: e.target.value, title: chosen ? chosen.title : prev.title }));
              }}
              className={field}
            >
              <option value="">{s.plannedOther}</option>
              {track?.planned.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {kind === "correcao" && input("target", s.target, { placeholder: "/trilhas/…", className: `${field} font-mono` })}
      {input("title", isLesson ? s.lessonTitle : isWork ? s.workTitle : s.subject, { maxLength: 160 })}

      {isLesson && input("summary", s.summary, { maxLength: 200 })}
      {isWork && (
        <div className="grid gap-5 sm:grid-cols-2">
          {input("author", s.author)}
          {input("language", s.language)}
          <label className="block">
            {s.area}
            <select value={draft.area} onChange={(e) => update("area", e.target.value)} className={field}>
              {areaSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {t.areas[slug][0]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {s.license}
            <select value={draft.license} onChange={(e) => update("license", e.target.value)} className={field}>
              {licenses.map((l) => (
                <option key={l} value={l}>
                  {licenseName(t, l)}
                </option>
              ))}
            </select>
          </label>
          {input("source", s.source, { placeholder: "Project Gutenberg" })}
          {input("url", s.url, { type: "url", placeholder: "https://…" })}
        </div>
      )}

      <div>
        <label htmlFor="conteudo-md">{isLesson ? s.body : isWork ? s.synopsis : s.details}</label>
        <div className="mt-1">
          {isLesson ? (
            <MarkdownEditor id="conteudo-md" value={draft.body} onChange={(value) => update("body", value)} labels={s.editor} placeholder={s.bodyPlaceholder} />
          ) : (
            <textarea id="conteudo-md" value={draft.body} onChange={(e) => update("body", e.target.value)} rows={6} className="w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
          )}
        </div>
        <p className="mt-1 font-mono text-xs text-ink-soft">{s.autosave}</p>
      </div>

      {isLesson && <SourcesField value={draft.sources} onChange={(value) => update("sources", value)} labels={s.sourcesField} />}
      {input("name", s.credit, { maxLength: 80 })}

      {/* Campo-isca: fica fora da tela e ninguém preenche; robôs de spam preenchem e são descartados. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
      </div>

      {(isLesson || isWork) && (
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-1" />
          <span>{isLesson ? s.declareLesson : s.declareWork}</span>
        </label>
      )}

      <div className="border border-rule bg-parchment-deep p-5">
        {state.status === "sent" ? (
          <p role="status" className="text-ok">{s.sent}</p>
        ) : issues.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-oxblood">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="text-ok">{s.ready}</p>
        )}
        {!hasBackend && <p className="mt-3 text-ink-soft">{s.offline}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={issues.length > 0 || !hasBackend || state.status === "sending"}
            onClick={send}
            className="cursor-pointer bg-oxblood px-6 py-2.5 font-medium text-parchment hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.status === "sending" ? t.common.loading : s.send}
          </button>
          <button type="button" onClick={() => setDraft({ ...emptyDraft, kind })} className="cursor-pointer px-2 text-ink-soft underline hover:text-oxblood">
            {s.clear}
          </button>
        </div>
        {state.status === "error" && <p role="alert" className="mt-3 text-oxblood">{state.message}</p>}
      </div>
    </form>
  );
}
