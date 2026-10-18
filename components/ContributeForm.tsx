// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
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
  /** Disciplina da aula (escolhida antes da trilha; nada vem marcado de antemão). */
  lessonArea: string;
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
  lessonArea: "",
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

/** Os envios feitos deste aparelho, para acompanhar sem conta: o código (id) é a chave. */
interface Enviada {
  id: string;
  titulo: string;
  tipo: string;
  em: string;
}
interface Situacao {
  id: string;
  tipo: string;
  titulo: string;
  criado_em: string;
  situacao: "triagem" | "revisao" | "aprovada" | "publicada" | "recusada" | "resolvida";
  decidido_em: string | null;
  nota: string;
}
const ENVIADAS = "lucia:enviadas";
const CODIGO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const lerEnviadas = (): Enviada[] => parse<Enviada[]>(getItem(ENVIADAS), []).filter((x) => x && CODIGO.test(x.id)).slice(0, 30);
const guardarEnviadas = (lista: Enviada[]) => setItem(ENVIADAS, JSON.stringify(lista.slice(0, 30)));

export function ContributeForm({ s }: { s: Dict["contribute"] }) {
  // O rascunho mora no navegador, então o formulário só é montado depois de carregar.
  const hydrated = useHydrated();
  if (!hydrated) return <p className="font-mono text-xs text-ink-soft">{s.loading}</p>;
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
    if (track && /^[a-z0-9-]{2,80}$/.test(track)) return { ...saved, kind: "aula", track, lessonArea: "" };
    return saved;
  });
  const [declared, setDeclared] = useState(false);
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" | "error"; message?: string; code?: string }>({ status: "idle" });
  const [enviadas, setEnviadas] = useState<Enviada[]>(lerEnviadas);

  useEffect(() => {
    setItem(KEYS.draft, JSON.stringify(draft));
  }, [draft]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const track = tracks.find((option) => option.slug === draft.track);
  // A disciplina vem da trilha quando a pessoa chegou por um link de trilha (ou de um rascunho antigo).
  const lessonArea = draft.lessonArea || track?.area || "";
  const inArea = tracks.filter((option) => option.area === lessonArea);
  const kind = draft.kind;
  const isLesson = kind === "aula";
  const isWork = kind === "obra";
  const sources = cleanSources(draft.sources);

  const p = s.problems;
  const issues: string[] = [];
  if (draft.title.trim().length < 3) issues.push(p.title);
  if (isLesson) {
    if (!lessonArea) issues.push(p.area);
    else if (!track) issues.push(p.track);
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
      const resposta = await rpc<{ id?: string }>("contribuir", { p: payload });
      const code = typeof resposta?.id === "string" && CODIGO.test(resposta.id) ? resposta.id : undefined;
      if (code) {
        const lista = [{ id: code, titulo: draft.title.trim(), tipo: kind, em: new Date().toISOString() }, ...enviadas.filter((x) => x.id !== code)];
        guardarEnviadas(lista);
        setEnviadas(lista);
      }
      setDraft({ ...emptyDraft, kind, lessonArea: draft.lessonArea, track: draft.track, name: draft.name });
      setDeclared(false);
      setState({ status: "sent", code });
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

  if (state.status === "sent") {
    return (
      <>
        <Recebido s={s} code={state.code} again={() => setState({ status: "idle" })} />
        <EnviosDesteAparelho s={s} enviadas={enviadas} mudar={(lista) => { guardarEnviadas(lista); setEnviadas(lista); }} />
      </>
    );
  }

  return (
    <>
      <form className="space-y-5 font-sans text-sm" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">{s.kindLegend}</legend>
          {kinds.map(([value, label]) => (
            <label key={value} className={`cursor-pointer border-2 px-5 py-2.5 font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${kind === value ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => update("kind", value)} className="sr-only" />
              {label}
            </label>
          ))}
        </fieldset>

        {isLesson && (
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block">
              {s.area}
              <select value={lessonArea} onChange={(e) => setDraft((prev) => ({ ...prev, lessonArea: e.target.value, track: "", planned: "" }))} className={field}>
                <option value="">{s.chooseArea}</option>
                {areaSlugs
                  .filter((area) => tracks.some((option) => option.area === area))
                  .map((area) => (
                    <option key={area} value={area}>
                      {t.areas[area][0]}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              {s.track}
              <select value={track?.slug ?? ""} disabled={!lessonArea} onChange={(e) => setDraft((prev) => ({ ...prev, lessonArea, track: e.target.value, planned: "" }))} className={`${field} disabled:opacity-50`}>
                <option value="">{s.chooseTrack}</option>
                {inArea.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {s.planned}
              <select
                value={draft.planned}
                disabled={!track}
                onChange={(e) => {
                  const chosen = track?.planned.find((item) => item.slug === e.target.value);
                  setDraft((prev) => ({ ...prev, planned: e.target.value, title: chosen ? chosen.title : prev.title }));
                }}
                className={`${field} disabled:opacity-50`}
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
              // O mesmo editor do Escrever do painel, em modo público (sem envio de arquivos). Os blocos só em português,
              // a língua em que os rótulos dele existem.
              <MarkdownEditor id="conteudo-md" value={draft.body} onChange={(value) => update("body", value)} labels={s.editor} placeholder={s.bodyPlaceholder} blocos={lang === "pt"} />
            ) : (
              <textarea id="conteudo-md" value={draft.body} onChange={(e) => update("body", e.target.value)} rows={6} className="w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-ink-soft">{s.autosave}</p>
          {isLesson && lang === "pt" && <p className="mt-1 text-xs text-ink-soft">{s.blocksNote}</p>}
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
          {issues.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-oxblood" aria-live="polite">
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
      <EnviosDesteAparelho s={s} enviadas={enviadas} mudar={(lista) => { guardarEnviadas(lista); setEnviadas(lista); }} />
    </>
  );
}

/** Depois de enviar: o recado de recebido e o código para acompanhar. */
function Recebido({ s, code, again }: { s: Dict["contribute"]; code?: string; again: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="border-2 border-ok bg-parchment-deep p-6 font-sans" role="status">
      <p className="font-serif text-2xl font-semibold text-ok">{s.sentTitle}</p>
      <p className="mt-2">{s.sent}</p>
      {code && (
        <div className="mt-4">
          <p className="text-sm">{s.trackingCode}</p>
          <p className="mt-1 flex flex-wrap items-center gap-3">
            <code className="border border-rule bg-parchment px-2 py-1 font-mono text-sm">{code}</code>
            <button
              type="button"
              className="cursor-pointer text-sm underline hover:text-oxblood"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopiado(true);
                } catch {
                  /* sem área de transferência: o código continua na tela */
                }
              }}
            >
              {copiado ? s.copied : s.copyCode}
            </button>
          </p>
          <p className="mt-2 text-xs text-ink-soft">{s.trackingHint}</p>
        </div>
      )}
      <button type="button" onClick={again} className="mt-5 cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood">
        {s.sendAnother}
      </button>
    </div>
  );
}

/** "Seus envios deste aparelho": a situação de cada envio, lida pelo código. Também aceita um código de outro aparelho. */
function EnviosDesteAparelho({ s, enviadas, mudar }: { s: Dict["contribute"]; enviadas: Enviada[]; mudar: (lista: Enviada[]) => void }) {
  const { lang } = useI18n();
  const [situacoes, setSituacoes] = useState<Map<string, Situacao>>(new Map());
  const [carregado, setCarregado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const ids = enviadas.map((x) => x.id).join(",");
  useEffect(() => {
    if (!hasBackend || !ids) return;
    let vivo = true;
    rpc<Situacao[]>("contribuicao_situacao", { p_ids: ids.split(",") })
      .then((lista) => {
        if (!vivo) return;
        setSituacoes(new Map((Array.isArray(lista) ? lista : []).map((x) => [x.id, x])));
        setCarregado(true);
      })
      // Sem resposta do serviço, não dá para dizer que o envio sumiu: a situação só não aparece agora.
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [ids]);
  if (!hasBackend) return null;
  const tipos: Record<string, string> = { aula: s.kindLesson, obra: s.kindWork, correcao: s.kindFix, sugestao: s.kindIdea };
  const quando = (iso: string) => new Date(iso).toLocaleDateString(lang === "pt" ? "pt-BR" : lang, { dateStyle: "medium" });
  const cor: Record<string, string> = { publicada: "border-ok text-ok", aprovada: "border-ok text-ok", resolvida: "border-ok text-ok", recusada: "border-oxblood text-oxblood" };
  return (
    <section className="mt-12 border-t border-rule pt-6 font-sans text-sm" aria-labelledby="envios-titulo">
      {enviadas.length > 0 && (
        <>
          <h2 id="envios-titulo" className="font-serif text-2xl font-semibold">{s.mineTitle}</h2>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {enviadas.map((x) => {
              const sit = situacoes.get(x.id);
              const estado = sit?.situacao ?? (carregado ? "sumida" : null);
              return (
                <li key={x.id} className="py-3">
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-semibold">{sit?.titulo ?? x.titulo}</span>
                    <span className="text-xs text-ink-soft">{tipos[sit?.tipo ?? x.tipo] ?? x.tipo} · {fill(s.sentOn, { data: quando(sit?.criado_em ?? x.em) })}</span>
                  </p>
                  {estado && <p className={`mt-1 inline-block border px-2 py-0.5 text-xs ${cor[estado] ?? "border-gold text-gold"}`}>{s.statuses[estado as keyof typeof s.statuses]}</p>}
                  {sit?.nota && <p className="mt-1 border-l-4 border-gold pl-2"><span className="text-ink-soft">{s.noteLabel}: </span>{sit.nota}</p>}
                  <p className="mt-1 text-xs"><code className="font-mono text-ink-soft">{x.id}</code> · <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => mudar(enviadas.filter((y) => y.id !== x.id))}>{s.forget}</button></p>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const limpo = codigo.trim().toLowerCase();
          if (!CODIGO.test(limpo)) {
            setErro(s.badCode);
            return;
          }
          setErro("");
          setCodigo("");
          if (!enviadas.some((x) => x.id === limpo)) mudar([{ id: limpo, titulo: "…", tipo: "", em: new Date().toISOString() }, ...enviadas]);
        }}
      >
        <label className="block min-w-64 flex-1">
          {s.addCode}
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={s.addCodePlaceholder} className={`${field} font-mono`} spellCheck={false} autoComplete="off" />
        </label>
        <button type="submit" className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood">{s.addCodeButton}</button>
        {erro && <p role="alert" className="w-full text-oxblood">{erro}</p>}
      </form>
    </section>
  );
}
