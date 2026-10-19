// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fill, htmlLang, plural } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { BackendError, evaluatePost, hasBackend, rpc, useMe } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import { errorText } from "@/i18n/core";
import { L, useI18n } from "./I18n";
import { Markdown } from "./Markdown";

type S = Dict["community"];
type Selo = keyof S["badges"];

interface TopicRow {
  id: string;
  titulo: string;
  disciplina: string | null;
  pontos: number;
  respostas: number;
  trancado: boolean;
  oculto: boolean;
  /** Ainda espera a leitura da mediação: só quem escreveu e quem cuida a veem. */
  retido?: boolean;
  criado_em: string;
  autor: string;
  autor_selo?: Selo | null;
  trecho?: string;
  alvo?: string | null;
  alvo_titulo?: string;
  ultima?: string;
  meu_voto: number;
  tipo: "conversa" | "duvida";
  resolvida?: boolean;
}

interface Reply {
  id: string;
  corpo: string;
  pontos: number;
  oculto: boolean;
  retido?: boolean;
  criado_em: string;
  autor: string;
  autor_selo?: Selo | null;
  pai?: string | null;
  meu_voto: number;
  aceita: boolean;
  da_equipe: boolean;
  autor_id?: string | null;
}

interface Topic extends TopicRow {
  corpo: string;
  pode_cuidar: boolean;
  /** Quem media pode banir a conta de quem escreveu; autor_id só vem para essas pessoas. */
  pode_banir?: boolean;
  autor_id?: string | null;
  meu: boolean;
  aceita: string | null;
}

interface Salas {
  total: number;
  salas: Record<string, number>;
  sem_resposta: number;
}

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const ALVO = /^\/(trilhas|acervo)\/[a-z0-9/-]{2,200}$/;

/** "há 3 horas", "ontem", no idioma da página. */
function relativo(iso: string, lang: string): string {
  const segundos = (new Date(iso).getTime() - Date.now()) / 1000;
  const fmt = new Intl.RelativeTimeFormat(htmlLang[lang as keyof typeof htmlLang] ?? lang, { numeric: "auto" });
  const passos: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unidade, s] of passos) if (Math.abs(segundos) >= s) return fmt.format(Math.round(segundos / s), unidade);
  return fmt.format(0, "minute");
}

/** O selo de quem escreveu: a função mais próxima do estudo, escrita por extenso (não depende só de cor). */
function SeloDoAutor({ selo, s }: { selo?: Selo | null; s: S }) {
  if (!selo) return null;
  return <span className="ml-1 border border-gold px-1 font-mono text-[0.65rem] uppercase tracking-wider text-gold">{s.badges[selo]}</span>;
}

/** Voto "útil": um clique marca, outro tira. Os votos contra de antes continuam contados nos pontos. */
function Util({ kind, id, points, mine, s, disabled }: { kind: "topico" | "resposta"; id: string; points: number; mine: number; s: S; disabled: boolean }) {
  const [state, setState] = useState({ points, mine });
  const marcado = state.mine === 1;
  async function vote() {
    try {
      const result = await rpc<{ pontos: number; meu_voto: number }>("votar", { p_tipo: kind, p_alvo: id, p_valor: marcado ? 0 : 1 });
      setState({ points: result.pontos, mine: result.meu_voto });
    } catch {
      // Sem conta ou sem conexão: o voto simplesmente não entra.
    }
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={vote}
      aria-pressed={marcado}
      title={marcado ? s.usefulUnmark : s.usefulMark}
      aria-label={`${marcado ? s.usefulUnmark : s.usefulMark} (${state.points})`}
      className={`flex w-12 shrink-0 cursor-pointer flex-col items-center border px-1 py-1 font-mono text-xs leading-tight disabled:cursor-not-allowed disabled:opacity-60 ${marcado ? "border-oxblood text-oxblood" : "border-rule text-ink-soft hover:border-oxblood hover:text-oxblood"}`}
    >
      <span aria-hidden>▲</span>
      <span className="text-sm font-semibold">{state.points}</span>
      <span className="text-[0.6rem] uppercase">{s.useful}</span>
    </button>
  );
}

export function Forum({ s }: { s: S }) {
  const params = useSearchParams();
  const topic = params.get("t");
  if (!hasBackend) return <p className="mt-10 text-lg text-ink-soft">{s.offline}</p>;
  return topic && /^[0-9a-f-]{36}$/.test(topic) ? <TopicView id={topic} s={s} /> : <TopicList s={s} />;
}

function Regras({ s }: { s: S }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
      {s.rules.map((rule) => (
        <li key={rule}>{rule}</li>
      ))}
    </ul>
  );
}

function TopicList({ s }: { s: S }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const alvoDoLink = params.get("alvo") ?? "";
  const alvo = ALVO.test(alvoDoLink) ? alvoDoLink : "";
  const alvoTitulo = (params.get("titulo") ?? "").slice(0, 200);
  const salaDoLink = params.get("sala") ?? "";
  const [order, setOrder] = useState("alta");
  const [area, setArea] = useState((areaSlugs as readonly string[]).includes(salaDoLink) ? salaDoLink : "");
  const [kind, setKind] = useState("");
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<TopicRow[] | null>(null);
  const [salas, setSalas] = useState<Salas | null>(null);
  const trechoDoLink = (params.get("trecho") ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  const [draft, setDraft] = useState({ title: "", body: trechoDoLink ? `> ${trechoDoLink}\n\n` : "", area, kind: "duvida", alvo, alvoTitulo });
  const [open, setOpen] = useState(params.get("nova") === "1");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);
  const cadastro = useCadastro();
  const logged = me.status === "in";

  useEffect(() => {
    let cancelled = false;
    rpc<TopicRow[]>("topicos_listar", { p_ordem: order, p_disciplina: area || null, p_pagina: 0, p_tipo: kind || null, p_busca: query || null, p_alvo: alvo || null })
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [order, area, kind, query, tick, alvo]);

  useEffect(() => {
    let cancelled = false;
    rpc<Salas>("comunidade_salas")
      .then((data) => {
        if (!cancelled && data && typeof data.total === "number") setSalas(data);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  async function create() {
    try {
      const created = await rpc<{ id: string; retido: boolean; bloqueado?: boolean; avaliando?: boolean }>("topico_criar", {
        p_titulo: draft.title,
        p_corpo: draft.body,
        p_disciplina: draft.area || null,
        p_tipo: draft.kind,
        p_alvo: draft.alvo || null,
        p_alvo_titulo: draft.alvo ? draft.alvoTitulo : "",
      });
      // Quando o serviço faz uma segunda avaliação, a mensagem espera por ela; a resposta chega em instantes.
      const verdict = created.avaliando ? await evaluatePost("topico", created.id) : "";
      // Violação clara das regras não vai ao ar: o texto fica no formulário para a pessoa reescrever.
      if (created.bloqueado || verdict === "bloquear") {
        setMessage(errorText(t, "conteudo_recusado"));
        return;
      }
      // Caso de dúvida espera a mediação: quem enviou vê a própria mensagem na lista, marcada como aguardando.
      if (created.retido && verdict !== "publicar") {
        setMessage(s.held);
        setDraft({ ...draft, title: "", body: "" });
        setTick((value) => value + 1);
        return;
      }
      router.push(`/${lang}/comunidade?t=${created.id}`);
    } catch (error) {
      setMessage(errorText(t, error instanceof BackendError ? error.code : "falha"));
    }
  }

  const abrirNova = () => {
    setOpen(true);
    setDraft((d) => ({ ...d, area: d.area || area }));
    requestAnimationFrame(() => document.getElementById("nova-conversa")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const orders: [string, string][] = [["alta", s.hot], ["novos", s.new], ["melhores", s.top], ["sem_resposta", s.unanswered]];
  const kinds: [string, string][] = [["", s.kinds.all], ["duvida", s.kinds.question], ["conversa", s.kinds.talk]];
  const nomeDaSala = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const botaoNova = logged ? (
    <button type="button" onClick={() => (open ? setOpen(false) : abrirNova())} className="cursor-pointer bg-oxblood px-5 py-2 font-medium text-parchment hover:bg-ink">
      {s.newTopic}
    </button>
  ) : (
    <span className="flex flex-wrap gap-x-4">
      <L href="/entrar" className="underline hover:text-oxblood">{s.signInToPost}</L>
      {cadastro.aberto && <L href="/entrar?criar=1" className="font-medium underline hover:text-oxblood">{s.signUp}</L>}
    </span>
  );

  return (
    <div className="mt-6 font-sans text-sm">
      <details className="mb-4 border border-rule p-3 lg:hidden">
        <summary className="cursor-pointer">
          <span className="font-semibold">{s.rulesTitle}:</span> {s.rulesSummary}
        </summary>
        <Regras s={s} />
      </details>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {/* Barra de ferramentas presa no alto da lista: tipo, ordem, sala, busca e "Nova conversa". */}
          <div className="sticky top-0 z-20 -mx-2 border-b border-rule bg-parchment px-2 pt-2 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label={s.kindLabel} className="flex gap-1">
                {kinds.map(([value, label]) => (
                  <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => setKind(value)} className={`cursor-pointer border-b-2 px-2 py-1 text-base ${kind === value ? "border-oxblood font-semibold text-oxblood" : "border-transparent text-ink-soft hover:text-oxblood"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <form role="search" className="ml-auto flex min-w-0 gap-2 max-sm:w-full" onSubmit={(e) => { e.preventDefault(); setQuery(typed.trim()); }}>
                <input type="search" value={typed} onChange={(e) => { setTyped(e.target.value); if (!e.target.value) setQuery(""); }} maxLength={80} aria-label={s.search} placeholder={s.search} className="min-w-0 flex-1 border-2 border-ink bg-parchment-deep px-3 py-1.5 sm:w-56" />
                <button type="submit" className="cursor-pointer border-2 border-ink px-3 py-1.5 hover:border-oxblood hover:text-oxblood">{t.nav.search}</button>
              </form>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="sr-only">{s.order}</span>
              {orders.map(([value, label]) => (
                <button key={value} type="button" onClick={() => setOrder(value)} aria-pressed={order === value} className={`cursor-pointer border px-2.5 py-1 ${order === value ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
                  {label}
                </button>
              ))}
              <select value={area} onChange={(e) => setArea(e.target.value)} aria-label={s.room} className="border-2 border-ink bg-parchment-deep px-2 py-1 lg:hidden">
                <option value="">{s.allRooms}</option>
                {areaSlugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {t.areas[slug][0]}
                  </option>
                ))}
              </select>
              <div className="ml-auto hidden md:block">{botaoNova}</div>
            </div>
          </div>

          {alvo && (
            <p className="mt-3 flex flex-wrap items-center gap-2">
              <span className="border border-gold px-2 py-1">
                {s.about}: <L href={alvo} className="font-semibold underline hover:text-oxblood">{alvoTitulo || alvo}</L>
              </span>
              <L href="/comunidade" className="underline hover:text-oxblood">{s.clearAbout}</L>
            </p>
          )}

          {open && logged && (
            <form id="nova-conversa" className="mt-5 scroll-mt-28 space-y-3 border border-rule bg-parchment-deep p-5" onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <fieldset className="flex flex-wrap gap-x-6 gap-y-1">
                <legend className="sr-only">{s.kindLabel}</legend>
                {([["duvida", s.kinds.askQuestion], ["conversa", s.kinds.startTalk]] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input type="radio" name="tipo" value={value} checked={draft.kind === value} onChange={() => setDraft({ ...draft, kind: value })} className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </fieldset>
              {draft.alvo && (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="border border-gold px-2 py-0.5">{s.about}: {draft.alvoTitulo || draft.alvo}</span>
                  <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setDraft({ ...draft, alvo: "", alvoTitulo: "" })}>{s.cancel}</button>
                </p>
              )}
              <label className="block">
                {s.titleLabel}
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={140} required minLength={5} className={field} />
              </label>
              <label className="block">
                {s.bodyLabel}
                <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={5} maxLength={8000} required minLength={10} className={field} />
              </label>
              <label className="block">
                {s.room}
                <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className={field}>
                  <option value="">{s.allRooms}</option>
                  {areaSlugs.map((slug) => (
                    <option key={slug} value={slug}>
                      {t.areas[slug][0]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="flex flex-wrap gap-3">
                <button type="submit" className="cursor-pointer bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood">{s.post}</button>
                <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setOpen(false)}>{s.cancel}</button>
              </p>
              <p role="alert" className="min-h-5 text-oxblood">{message}</p>
            </form>
          )}
          {!open && message && <p role="status" className="mt-3 text-ink-soft">{message}</p>}

          {list === null && <p className="mt-6 font-mono text-xs text-ink-soft">{t.common.loading}</p>}
          {list?.length === 0 && <p className="mt-8 text-lg text-ink-soft">{s.empty}</p>}
          <ul className="mt-2 divide-y divide-rule">
            {list?.map((row) => (
              <li key={row.id} className={`flex gap-3 py-3 ${row.oculto ? "opacity-60" : ""}`}>
                <Util kind="topico" id={row.id} points={row.pontos} mine={row.meu_voto} s={s} disabled={!logged} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <L href={`/comunidade?t=${row.id}`} className="font-serif text-xl font-semibold leading-snug hover:text-oxblood">{row.titulo}</L>
                    {row.tipo === "duvida" && row.resolvida && <span className="border border-ok px-1.5 text-xs font-semibold text-ok">✓ {s.solved}</span>}
                  </p>
                  {row.trecho && <p className="mt-0.5 line-clamp-2 text-ink-soft">{row.trecho}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
                    <span className={row.tipo === "duvida" ? "font-semibold text-oxblood" : ""}>{row.tipo === "duvida" ? s.kinds.question : s.kinds.talk}</span>
                    {row.disciplina && <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setArea(row.disciplina ?? "")}>{nomeDaSala(row.disciplina)}</button>}
                    <span>· {row.autor || "—"}<SeloDoAutor selo={row.autor_selo} s={s} /></span>
                    <span>· {plural(lang, row.respostas, s.replies)}</span>
                    <span>· <time dateTime={row.ultima ?? row.criado_em}>{relativo(row.ultima ?? row.criado_em, lang)}</time></span>
                    {row.alvo && row.alvo_titulo && <span>· {s.about}: <L href={row.alvo} className="underline hover:text-oxblood">{row.alvo_titulo}</L></span>}
                    {row.trancado && <span>· {s.locked}</span>}
                    {row.oculto && <span>· {row.retido ? s.pending : s.hidden}</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          <section className="hidden lg:block" aria-labelledby="regras-titulo">
            <h2 id="regras-titulo" className="font-serif text-lg font-semibold">{s.rulesTitle}</h2>
            <Regras s={s} />
          </section>
          <section aria-labelledby="salas-titulo" className="hidden lg:block">
            <h2 id="salas-titulo" className="font-serif text-lg font-semibold">{s.rooms}</h2>
            <ul className="mt-2 space-y-0.5">
              <li>
                <button type="button" onClick={() => setArea("")} aria-pressed={area === ""} className={`flex w-full cursor-pointer justify-between px-2 py-1 text-left ${area === "" ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}>
                  <span>{s.allRooms}</span>
                  {salas && <span className="font-mono text-xs">{salas.total}</span>}
                </button>
              </li>
              {areaSlugs
                .filter((slug) => (salas?.salas[slug] ?? 0) > 0 || slug === area)
                .map((slug) => (
                  <li key={slug}>
                    <button type="button" onClick={() => setArea(slug)} aria-pressed={area === slug} className={`flex w-full cursor-pointer justify-between px-2 py-1 text-left ${area === slug ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}>
                      <span>{t.areas[slug][0]}</span>
                      <span className="font-mono text-xs">{salas?.salas[slug] ?? 0}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
          {salas && salas.sem_resposta > 0 && (
            <section className="border-l-4 border-oxblood bg-parchment-deep p-3">
              <p>{plural(lang, salas.sem_resposta, s.unansweredHelp)}</p>
              <button type="button" className="mt-1 cursor-pointer font-semibold underline hover:text-oxblood" onClick={() => { setKind("duvida"); setOrder("sem_resposta"); }}>{s.helpOut} →</button>
            </section>
          )}
          <section className="border border-rule p-3">
            <p className="font-semibold">{s.tutoringTitle}</p>
            <p className="mt-1 text-ink-soft">{s.tutoringText}</p>
            <L href="/reforco" className="mt-1 inline-block underline hover:text-oxblood">{s.tutoringLink} →</L>
          </section>
        </aside>
      </div>

      {/* No celular, "Nova conversa" fica sempre à mão, acima da barra de baixo. */}
      {logged && !open && (
        <button type="button" onClick={abrirNova} className="fixed right-4 bottom-24 z-30 cursor-pointer rounded-full bg-oxblood px-5 py-3 font-semibold text-parchment shadow-lg hover:bg-ink md:hidden">
          + {s.newTopic}
        </button>
      )}
    </div>
  );
}

/** Monta a árvore das respostas: cada uma com as filhas logo abaixo, na ordem em que chegaram. */
function arvore(lista: Reply[]): { item: Reply; nivel: number }[] {
  const filhas = new Map<string, Reply[]>();
  const ids = new Set(lista.map((r) => r.id));
  const raiz: Reply[] = [];
  for (const r of lista) {
    if (r.pai && ids.has(r.pai)) filhas.set(r.pai, [...(filhas.get(r.pai) ?? []), r]);
    else raiz.push(r);
  }
  const saida: { item: Reply; nivel: number }[] = [];
  const andar = (r: Reply, nivel: number) => {
    saida.push({ item: r, nivel });
    for (const f of [...(filhas.get(r.id) ?? [])].sort((a, b) => a.criado_em.localeCompare(b.criado_em))) andar(f, Math.min(nivel + 1, 3));
  };
  for (const r of raiz) andar(r, 1);
  return saida;
}

function TopicView({ id, s }: { id: string; s: S }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [topic, setTopic] = useState<(Topic & { respostas: Reply[] | number }) | null>(null);
  const [missing, setMissing] = useState(false);
  const [reply, setReply] = useState("");
  const [paraQuem, setParaQuem] = useState<Reply | null>(null);
  const [resposta, setResposta] = useState("");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);
  /** Banir pede dois cliques: o primeiro arma, o segundo confirma. */
  const [arming, setArming] = useState("");
  const cadastro = useCadastro();
  const date = new Intl.DateTimeFormat(htmlLang[lang]);
  const reload = () => setTick((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    rpc<Topic & { respostas: Reply[] }>("topico_ver", { p_id: id })
      .then((data) => {
        if (!cancelled) setTopic(data);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  if (missing) return <p className="mt-10 text-lg text-ink-soft">{t.errors.nao_encontrado}</p>;
  if (!topic) return <p className="mt-10 font-mono text-xs text-ink-soft">{t.common.loading}</p>;
  const replies = Array.isArray(topic.respostas) ? topic.respostas : [];
  const logged = me.status === "in";
  const podeResponder = logged && !topic.retido && !topic.trancado;

  async function act(fn: string, args: Record<string, unknown>) {
    try {
      const result = await rpc<{ id?: string; retido?: boolean; bloqueado?: boolean; avaliando?: boolean } | null>(fn, args);
      const verdict = fn === "responder" && result?.avaliando && result.id ? await evaluatePost("resposta", result.id) : "";
      // Resposta bloqueada não foi ao ar: o texto continua no campo para a pessoa reescrever.
      if (result?.bloqueado || verdict === "bloquear") {
        setMessage(errorText(t, "conteudo_recusado"));
        return false;
      }
      setMessage(result?.retido && verdict !== "publicar" ? s.held : "");
      reload();
      return true;
    } catch (error) {
      setMessage(errorText(t, error instanceof BackendError ? error.code : "falha"));
      return false;
    }
  }
  // Gente da equipe não se bane por aqui (o serviço recusa); o botão nem aparece para as respostas marcadas como da equipe.
  const ban = (key: string, author: string | null | undefined) =>
    topic?.pode_banir && author ? (
      <button
        type="button"
        className="cursor-pointer text-oxblood underline"
        onClick={async () => {
          if (arming !== key) return setArming(key);
          setArming("");
          try {
            await rpc("mediacao_banir", { p_usuario: author, p_motivo: `Banimento a partir da conversa ${id}`, p_origem: false });
            setMessage(s.banned);
            reload();
          } catch (error) {
            setMessage(errorText(t, error instanceof BackendError ? error.code : "falha"));
          }
        }}
      >
        {arming === key ? s.banConfirm : s.ban}
      </button>
    ) : null;
  const care = (kind: "topico" | "resposta", target: string, action: string, label: string) => (
    <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => act("comunidade_cuidar", { p_tipo: kind, p_alvo: target, p_acao: action })}>
      {label}
    </button>
  );
  const recuo = ["", "ml-6 border-l-2 border-rule pl-4 sm:ml-10", "ml-12 border-l-2 border-rule pl-4 sm:ml-20"];

  return (
    <div className="mt-8 font-sans text-sm">
      <L href="/comunidade" className="text-ink-soft hover:text-oxblood">← {s.back}</L>
      <article className={`mt-5 flex gap-3 ${topic.oculto ? "opacity-60" : ""}`}>
        <Util key={`${topic.id}${topic.pontos}`} kind="topico" id={topic.id} points={topic.pontos} mine={topic.meu_voto} s={s} disabled={!logged} />
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-3xl font-semibold">{topic.titulo}</h2>
          <p className="mt-1 text-ink-soft">
            {topic.tipo === "duvida" && <span className={topic.aceita ? "font-medium text-ok" : "font-medium text-oxblood"}>{topic.aceita ? `✓ ${s.solved}` : s.kinds.question} · </span>}
            {topic.autor || "—"}<SeloDoAutor selo={topic.autor_selo} s={s} /> · {date.format(new Date(topic.criado_em))}
            {topic.disciplina && ` · ${t.areas[topic.disciplina as keyof typeof t.areas]?.[0] ?? topic.disciplina}`}
            {topic.trancado && ` · ${s.locked}`}
            {topic.oculto && ` · ${topic.retido ? s.pending : s.hidden}`}
          </p>
          {topic.alvo && (
            <p className="mt-2">
              <span className="border border-gold px-2 py-0.5">
                {s.about}: <L href={topic.alvo} className="font-semibold underline hover:text-oxblood">{topic.alvo_titulo || topic.alvo}</L>
              </span>
            </p>
          )}
          <div className="mt-3 font-serif">
            <Markdown lang={lang}>{topic.corpo}</Markdown>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
            <L href={`/denunciar?item=${encodeURIComponent(`/comunidade?t=${topic.id}`)}`} className="underline hover:text-oxblood">{t.common.report}</L>
            {topic.pode_cuidar && care("topico", topic.id, topic.oculto ? "mostrar" : "ocultar", topic.oculto ? s.show : s.hide)}
            {topic.pode_cuidar && care("topico", topic.id, topic.trancado ? "destrancar" : "trancar", topic.trancado ? s.unlock : s.lock)}
            {!topic.meu && ban(topic.id, topic.autor_id)}
          </p>
        </div>
      </article>

      <h3 className="mt-8 border-b border-rule pb-2 font-mono text-xs uppercase tracking-widest text-gold">{plural(lang, replies.length, s.replies)}</h3>
      <ul>
        {arvore(replies).map(({ item, nivel }) => (
          <li key={item.id} className={`border-b border-rule py-4 ${recuo[nivel - 1] ?? recuo[2]} ${item.oculto ? "opacity-60" : ""}`}>
            <div className={`flex gap-3 ${item.aceita ? "border-l-4 border-ok pl-3" : ""}`}>
              <Util kind="resposta" id={item.id} points={item.pontos} mine={item.meu_voto} s={s} disabled={!logged} />
              <div className="min-w-0 flex-1">
                {item.aceita && <p className="mb-1 font-mono text-xs uppercase tracking-widest text-ok">✓ {s.accepted}</p>}
                <div className="font-serif">
                  <Markdown lang={lang}>{item.corpo}</Markdown>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
                  <span>
                    {item.autor || "—"}
                    {item.autor_selo ? <SeloDoAutor selo={item.autor_selo} s={s} /> : item.da_equipe && ` (${s.staff})`} · <time dateTime={item.criado_em}>{relativo(item.criado_em, lang)}</time>
                    {item.oculto && ` · ${item.retido ? s.pending : s.hidden}`}
                  </span>
                  {podeResponder && !item.oculto && (
                    <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => { setParaQuem(item); setResposta(""); }}>{s.replyHere}</button>
                  )}
                  {topic.tipo === "duvida" && (topic.meu || topic.pode_cuidar) && !item.oculto && (
                    <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => act("resposta_aceitar", { p_topico: topic.id, p_resposta: item.aceita ? null : item.id })}>
                      {item.aceita ? s.unaccept : s.accept}
                    </button>
                  )}
                  {topic.pode_cuidar && care("resposta", item.id, item.oculto ? "mostrar" : "ocultar", item.oculto ? s.show : s.hide)}
                  {!item.da_equipe && ban(item.id, item.autor_id)}
                </p>
                {paraQuem?.id === item.id && (
                  <form
                    className="mt-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await act("responder", { p_topico: topic.id, p_corpo: resposta, p_pai: item.id })) {
                        setResposta("");
                        setParaQuem(null);
                      }
                    }}
                  >
                    <label className="block text-ink-soft">
                      {fill(s.replyingTo, { nome: item.autor || "—" })}
                      <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} maxLength={8000} required minLength={2} className={field} autoFocus />
                    </label>
                    <p className="mt-2 flex gap-3">
                      <button type="submit" className="cursor-pointer bg-ink px-4 py-1.5 font-medium text-parchment hover:bg-oxblood">{s.reply}</button>
                      <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setParaQuem(null)}>{s.cancel}</button>
                    </p>
                  </form>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {topic.retido ? (
        <p className="mt-6 text-ink-soft">{s.held}</p>
      ) : topic.trancado ? (
        <p className="mt-6 text-ink-soft">{s.locked}</p>
      ) : logged ? (
        <form
          className="mt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act("responder", { p_topico: topic.id, p_corpo: reply })) setReply("");
          }}
        >
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={8000} required minLength={2} placeholder={s.replyPlaceholder} aria-label={s.reply} className={field} />
          <button type="submit" className="mt-2 cursor-pointer bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood">{s.reply}</button>
        </form>
      ) : (
        <p className="mt-6 flex flex-wrap gap-x-4">
          <L href="/entrar" className="underline hover:text-oxblood">{s.signInToPost}</L>
          {cadastro.aberto && <L href="/entrar?criar=1" className="font-medium underline hover:text-oxblood">{s.signUp}</L>}
        </p>
      )}
      <p role="alert" className="mt-2 min-h-5 text-oxblood">{message}</p>
    </div>
  );
}
