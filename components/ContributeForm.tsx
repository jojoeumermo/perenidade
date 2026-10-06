"use client";

import { useEffect, useState } from "react";
import { areas, licenses } from "@/lib/areas";
import { useHydrated } from "@/lib/progress";
import { github, MAX_PREFILL_LENGTH } from "@/lib/site";
import { slugify } from "@/lib/text";
import { Markdown } from "./Markdown";

const DRAFT_KEY = "perenidade:rascunho";

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
  area: areas[0].slug,
  license: licenses[0],
  source: "",
  url: "",
  language: "Português",
};

function loadDraft(firstTrack: string): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyDraft, track: firstTrack, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    // Rascunho ilegível ou armazenamento bloqueado: começa em branco.
  }
  return { ...emptyDraft, track: firstTrack };
}

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

function problems(draft: Draft, declared: boolean): string[] {
  const list: string[] = [];
  if (draft.title.trim().length < 3) list.push("Dê um título.");
  if (draft.kind === "aula") {
    if (!draft.track) list.push("Escolha a trilha.");
    if (!draft.summary.trim()) list.push("Escreva um resumo de uma linha.");
    if (draft.body.trim().length < 200) list.push("O conteúdo da aula precisa de pelo menos 200 caracteres.");
  } else {
    if (!draft.author.trim()) list.push("Informe o autor da obra.");
    if (!draft.source.trim()) list.push("Informe a fonte (ex.: Project Gutenberg).");
    if (!/^https:\/\/\S+$/.test(draft.url.trim())) list.push("O link precisa começar com https://.");
    else if (/\.pdf($|\?)/i.test(draft.url.trim())) list.push("Aponte para a página da obra na fonte, não direto para um PDF.");
    if (draft.body.trim().length < 40) list.push("Escreva uma sinopse com suas palavras.");
  }
  if (!declared) list.push("Confirme a declaração de licença.");
  return list;
}

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const action = "cursor-pointer border-2 border-ink px-5 py-2.5 font-medium hover:border-oxblood hover:text-oxblood";

export function ContributeForm({ tracks }: { tracks: TrackOption[] }) {
  // O rascunho mora no localStorage, então o formulário só é montado no navegador.
  const hydrated = useHydrated();
  if (!hydrated) return <p className="mt-10 font-mono text-xs text-ink-soft">Carregando o editor…</p>;
  return <Editor tracks={tracks} />;
}

function Editor({ tracks }: { tracks: TrackOption[] }) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(tracks[0]?.slug ?? ""));
  const [declared, setDeclared] = useState(false);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Sem armazenamento, o rascunho vive só enquanto a aba estiver aberta.
    }
  }, [draft]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const file = buildFile(draft, tracks);
  const issues = problems(draft, declared);
  const isLesson = draft.kind === "aula";

  async function copy(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(file.content);
      setNotice("Arquivo copiado para a área de transferência.");
      return true;
    } catch {
      setNotice("Não foi possível copiar automaticamente. Use o botão de baixar o arquivo.");
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
      setNotice("Abrimos o GitHub em outra aba. Lá, clique em “Commit changes” e depois em “Create pull request”.");
      return;
    }
    setNotice(
      (await copying)
        ? "O texto é longo demais para ir pronto no link, então foi copiado. No GitHub, cole no editor (Ctrl+V), clique em “Commit changes” e depois em “Create pull request”."
        : "O texto é longo demais para ir pronto no link. Baixe o arquivo e cole o conteúdo dele no editor do GitHub.",
    );
  }

  function reset() {
    setDraft({ ...emptyDraft, kind: draft.kind, track: tracks[0]?.slug ?? "" });
    setDeclared(false);
    setNotice("Rascunho apagado.");
  }

  return (
    <form className="mt-10 space-y-5 font-sans text-sm" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="sr-only">O que você quer enviar</legend>
        {(["aula", "obra"] as const).map((kind) => (
          <label
            key={kind}
            className={`cursor-pointer border-2 px-5 py-2.5 font-medium ${
              draft.kind === kind ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"
            }`}
          >
            <input
              type="radio"
              name="kind"
              value={kind}
              checked={draft.kind === kind}
              onChange={() => update("kind", kind)}
              className="sr-only"
            />
            {kind === "aula" ? "Uma aula" : "Uma obra para o acervo"}
          </label>
        ))}
      </fieldset>

      {isLesson && (
        <label className="block">
          Trilha
          <select value={draft.track} onChange={(e) => update("track", e.target.value)} className={field}>
            {tracks.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        {isLesson ? "Título da aula" : "Título da obra"}
        <input value={draft.title} onChange={(e) => update("title", e.target.value)} maxLength={120} className={field} />
      </label>

      {isLesson ? (
        <>
          <label className="block">
            Resumo (uma linha)
            <input value={draft.summary} onChange={(e) => update("summary", e.target.value)} maxLength={200} className={field} />
          </label>
          <label className="block">
            Como você quer ser creditado (opcional)
            <input value={draft.credit} onChange={(e) => update("credit", e.target.value)} maxLength={80} className={field} />
          </label>
        </>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            Autor
            <input value={draft.author} onChange={(e) => update("author", e.target.value)} className={field} />
          </label>
          <label className="block">
            Idioma
            <input value={draft.language} onChange={(e) => update("language", e.target.value)} className={field} />
          </label>
          <label className="block">
            Área
            <select value={draft.area} onChange={(e) => update("area", e.target.value)} className={field}>
              {areas.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Licença
            <select value={draft.license} onChange={(e) => update("license", e.target.value)} className={field}>
              {licenses.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Fonte
            <input
              value={draft.source}
              onChange={(e) => update("source", e.target.value)}
              placeholder="Project Gutenberg"
              className={field}
            />
          </label>
          <label className="block">
            Link da obra na fonte
            <input
              type="url"
              value={draft.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://…"
              className={`${field} font-mono`}
            />
          </label>
        </div>
      )}

      <div>
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="conteudo-md">{isLesson ? "Conteúdo (Markdown)" : "Sinopse, com suas palavras"}</label>
          {isLesson && (
            <button type="button" onClick={() => setPreview((p) => !p)} className="cursor-pointer underline hover:text-oxblood">
              {preview ? "Voltar a escrever" : "Pré-visualizar"}
            </button>
          )}
        </div>
        {preview && isLesson ? (
          <div className="mt-1 min-h-64 border-2 border-rule bg-parchment p-5 font-serif">
            <Markdown>{draft.body || "*Nada para mostrar ainda.*"}</Markdown>
          </div>
        ) : (
          <textarea
            id="conteudo-md"
            value={draft.body}
            onChange={(e) => update("body", e.target.value)}
            rows={isLesson ? 16 : 5}
            placeholder={isLesson ? "## Um subtítulo\n\nEscreva aqui. **Negrito**, *itálico*, listas com - e tabelas funcionam." : ""}
            className={`${field} font-mono`}
          />
        )}
        <p className="mt-1 font-mono text-xs text-ink-soft">Rascunho salvo automaticamente neste navegador.</p>
      </div>

      <label className="flex items-start gap-2">
        <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-1" />
        <span>
          {isLesson
            ? "Declaro que este texto é de minha autoria (ou está em domínio público) e aceito publicá-lo sob a licença CC BY-SA 4.0."
            : "Declaro que conferi a licença na fonte e que o link aponta para uma publicação legítima da obra."}
        </span>
      </label>

      <div className="border border-rule bg-parchment-deep p-5">
        <p className="font-mono text-xs text-ink-soft">Arquivo que será proposto: {file.path}</p>
        {issues.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-oxblood">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ok">Tudo certo. Escolha como enviar:</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={issues.length > 0}
            onClick={openOnGitHub}
            className="cursor-pointer bg-oxblood px-6 py-2.5 font-medium text-parchment hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar pelo GitHub ↗
          </button>
          <button type="button" onClick={copy} className={action}>
            Copiar arquivo
          </button>
          <button type="button" onClick={download} className={action}>
            Baixar .md
          </button>
          <button type="button" onClick={reset} className="cursor-pointer px-2 text-ink-soft underline hover:text-oxblood">
            Apagar rascunho
          </button>
        </div>
        <p role="status" className="mt-3 min-h-5 text-ink-soft">
          {notice}
        </p>
      </div>
    </form>
  );
}
