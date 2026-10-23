// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fill, htmlLang, localePath, plural } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { BackendError, evaluatePost, hasBackend, rpc, useMe } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import { errorText } from "@/i18n/core";
import { compartilhar, quente, usePreferencias } from "./comunidade/preferencias";
import { L, useI18n } from "./I18n";
import { Markdown } from "./Markdown";
import { Selo } from "./Selo";

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
  /** A resposta é de quem abriu a conversa (o selo "autor"). */
  do_autor?: boolean;
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
const POR_PAGINA = 30;
const isSala = (x: string) => (areaSlugs as readonly string[]).includes(x);

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

/** A bolinha da sala, com a inicial: o "ícone" de cada sala na lista. */
function Bolinha({ slug, nome, grande = false }: { slug: string; nome: string; grande?: boolean }) {
  const tons = ["#7A1F1F", "#1e56c8", "#2e7d32", "#b8860b", "#7b3fa0", "#c2410c", "#0f766e", "#be185d"];
  const cor = tons[[...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % tons.length];
  return <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-serif font-bold text-white ${grande ? "h-16 w-16 border-4 border-parchment text-3xl" : "h-5 w-5 text-[0.65rem]"}`} style={{ background: cor }}>{nome.slice(0, 1)}</span>;
}

/** Voto "útil", em pé como as setas de um fórum: um clique marca, outro tira. Os votos contra de antes continuam contados. */
function Util({ kind, id, points, mine, s, disabled, deitado = false }: { kind: "topico" | "resposta"; id: string; points: number; mine: number; s: S; disabled: boolean; deitado?: boolean }) {
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
      className={`flex shrink-0 cursor-pointer items-center rounded-md font-mono leading-tight disabled:cursor-not-allowed disabled:opacity-60 ${deitado ? "gap-1.5 px-2 py-0.5 text-xs" : "w-11 flex-col py-1 text-xs"} ${marcado ? "bg-oxblood/10 text-oxblood" : "text-ink-soft hover:bg-parchment-deep hover:text-oxblood"}`}
    >
      <span aria-hidden className={deitado ? "" : "text-base"}>{marcado ? "▲" : "△"}</span>
      <span className="text-sm font-semibold">{state.points}</span>
      {!deitado && <span className="text-[0.55rem] uppercase">{s.useful}</span>}
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

/** Escrever com a pré-visualização ao lado: o mesmo Markdown que a conversa vai mostrar. */
function Escrita({ valor, mudar, s, linhas, minimo, rotulo, foco = false }: { valor: string; mudar: (v: string) => void; s: S; linhas: number; minimo: number; rotulo: string; foco?: boolean }) {
  const { lang } = useI18n();
  const [ver, setVer] = useState(false);
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <span>{rotulo}</span>
        <span role="tablist" className="flex text-xs">
          <button type="button" role="tab" aria-selected={!ver} onClick={() => setVer(false)} className={`cursor-pointer border-b-2 px-2 py-1 ${!ver ? "border-oxblood font-semibold" : "border-transparent text-ink-soft"}`}>{s.write}</button>
          <button type="button" role="tab" aria-selected={ver} onClick={() => setVer(true)} className={`cursor-pointer border-b-2 px-2 py-1 ${ver ? "border-oxblood font-semibold" : "border-transparent text-ink-soft"}`}>{s.preview}</button>
        </span>
      </div>
      {ver ? (
        <div className="mt-1 min-h-24 border-2 border-dashed border-ink/40 bg-parchment px-3 py-2 font-serif">{valor.trim() ? <Markdown lang={lang}>{valor}</Markdown> : <p className="font-sans text-ink-soft">{s.nothingToPreview}</p>}</div>
      ) : (
        <textarea value={valor} onChange={(e) => mudar(e.target.value)} rows={linhas} maxLength={8000} required minLength={minimo} aria-label={rotulo} className={field} autoFocus={foco} />
      )}
      <p className="mt-0.5 text-right font-mono text-[0.65rem] text-ink-soft">{valor.length}/8000</p>
    </div>
  );
}

function TopicList({ s }: { s: S }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const [pref, mudarPref] = usePreferencias();
  const alvoDoLink = params.get("alvo") ?? "";
  const alvo = ALVO.test(alvoDoLink) ? alvoDoLink : "";
  const alvoTitulo = (params.get("titulo") ?? "").slice(0, 200);
  const salaDoLink = params.get("sala") ?? "";
  const [feed, setFeed] = useState<"todas" | "minhas" | "salvas">("todas");
  const [order, setOrder] = useState("alta");
  const [periodo, setPeriodo] = useState("sempre");
  const [area, setArea] = useState(isSala(salaDoLink) ? salaDoLink : "");
  const [kind, setKind] = useState("");
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [pagina, setPagina] = useState(0);
  const [fim, setFim] = useState(false);
  const [list, setList] = useState<TopicRow[] | null>(null);
  const [salas, setSalas] = useState<Salas | null>(null);
  const [aviso, setAviso] = useState<{ id: string; texto: string } | null>(null);
  const [escondidaAgora, setEscondidaAgora] = useState<string[]>([]);
  const trechoDoLink = (params.get("trecho") ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  const [draft, setDraft] = useState({ title: "", body: trechoDoLink ? `> ${trechoDoLink}\n\n` : "", area, kind: "duvida", alvo, alvoTitulo });
  const [open, setOpen] = useState(params.get("nova") === "1");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);
  const cadastro = useCadastro();
  const logged = me.status === "in";
  const seguidas = pref.seguidas.join(",");

  /** Mudar um filtro volta para a primeira página. */
  const filtrar = (f: () => void) => {
    f();
    setPagina(0);
    setFim(false);
  };

  useEffect(() => {
    if (feed === "salvas") return;
    let cancelled = false;
    const base = { p_ordem: order, p_pagina: pagina, p_tipo: kind || null, p_busca: query || null, p_alvo: alvo || null, p_periodo: order === "melhores" && periodo !== "sempre" ? periodo : null };
    const salasDoFeed = feed === "minhas" ? (seguidas ? seguidas.split(",") : []) : [area || null];
    Promise.all(salasDoFeed.map((sala) => rpc<TopicRow[]>("topicos_listar", { ...base, p_disciplina: sala })))
      .then((partes) => {
        if (cancelled) return;
        // No feed das salas seguidas, as listas de cada sala se juntam na mesma ordem que o servidor usa.
        const agora = Date.now();
        const juntas = feed === "minhas"
          ? partes.flat().sort((a, b) => (order === "melhores" ? b.pontos - a.pontos : order === "alta" ? quente(b.pontos, b.criado_em, agora) - quente(a.pontos, a.criado_em, agora) : b.criado_em.localeCompare(a.criado_em)))
          : partes.flat();
        setFim(partes.every((p) => p.length < POR_PAGINA));
        setList((antes) => {
          if (pagina === 0 || !antes) return juntas;
          const vistos = new Set(antes.map((r) => r.id));
          return [...antes, ...juntas.filter((r) => !vistos.has(r.id))];
        });
      })
      .catch(() => {
        if (!cancelled && pagina === 0) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [feed, order, periodo, area, kind, query, tick, alvo, pagina, seguidas]);

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
        filtrar(() => setTick((value) => value + 1));
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
  const orders: [string, string, string][] = [["alta", "fogo", s.hot], ["novos", "estrela", s.new], ["melhores", "trofeu", s.top], ["sem_resposta", "pergunta", s.unanswered]];
  const kinds: [string, string][] = [["", s.kinds.all], ["duvida", s.kinds.question], ["conversa", s.kinds.talk]];
  const nomeDaSala = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const segue = (slug: string) => pref.seguidas.includes(slug);
  const seguir = (slug: string) => mudarPref((p) => ({ ...p, seguidas: p.seguidas.includes(slug) ? p.seguidas.filter((x) => x !== slug) : [...p.seguidas, slug].slice(0, 30) }));
  const salva = (id: string) => pref.salvas.some((x) => x.id === id);
  const salvar = (row: TopicRow) => mudarPref((p) => ({ ...p, salvas: p.salvas.some((x) => x.id === row.id) ? p.salvas.filter((x) => x.id !== row.id) : [{ id: row.id, titulo: row.titulo, sala: row.disciplina, tipo: row.tipo, em: new Date().toISOString() }, ...p.salvas].slice(0, 300) }));
  const esconder = (id: string) => { mudarPref((p) => ({ ...p, escondidas: [...p.escondidas.filter((x) => x !== id), id].slice(-500) })); setEscondidaAgora((l) => [...l, id]); };
  const desfazer = (id: string) => { mudarPref((p) => ({ ...p, escondidas: p.escondidas.filter((x) => x !== id) })); setEscondidaAgora((l) => l.filter((x) => x !== id)); };
  const linkDe = (id: string) => `${window.location.origin}${localePath(lang, `/comunidade?t=${id}`)}`;
  const dividir = async (row: TopicRow) => {
    if (await compartilhar(linkDe(row.id), row.titulo)) {
      setAviso({ id: row.id, texto: s.copied });
      window.setTimeout(() => setAviso((a) => (a?.id === row.id ? null : a)), 2000);
    }
  };
  const [buscaSala, setBuscaSala] = useState("");
  const todasAsSalas = useMemo(() => {
    const q = buscaSala.trim().toLocaleLowerCase(lang);
    return (areaSlugs as readonly string[])
      .map((slug) => [slug, nomeDaSala(slug)] as [string, string])
      .filter(([slug, nome]) => !q || nome.toLocaleLowerCase(lang).includes(q) || slug.includes(q))
      .sort((x, y) => x[1].localeCompare(y[1], lang));
    // nomeDaSala só muda com o idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaSala, lang]);
  const ranking = useMemo(() => Object.entries(salas?.salas ?? {}).filter(([slug, n]) => n > 0 && isSala(slug)).sort((a, b) => b[1] - a[1]), [salas]);
  const visiveis = feed === "salvas" ? null : (list ?? []).filter((r) => !pref.escondidas.includes(r.id) || escondidaAgora.includes(r.id));
  const compacto = pref.vista === "compacto";

  const botaoNova = logged ? (
    <button type="button" onClick={() => (open ? setOpen(false) : abrirNova())} className="cursor-pointer rounded-full bg-oxblood px-5 py-2 font-medium text-parchment hover:bg-ink">
      ＋ {s.newTopic}
    </button>
  ) : (
    <span className="flex flex-wrap gap-x-4">
      <L href="/entrar" className="underline hover:text-oxblood">{s.signInToPost}</L>
      {cadastro.aberto && <L href="/entrar?criar=1" className="font-medium underline hover:text-oxblood">{s.signUp}</L>}
    </span>
  );
  const chipSala = (slug: string | null) => slug ? (
    <button type="button" className="flex cursor-pointer items-center gap-1 font-semibold text-ink hover:text-oxblood hover:underline" onClick={() => filtrar(() => { setFeed("todas"); setArea(slug); })}>
      <Bolinha slug={slug} nome={nomeDaSala(slug)} />{s.roomOf}/{nomeDaSala(slug)}
    </button>
  ) : null;
  const acao = "flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 hover:bg-parchment-deep hover:text-oxblood";

  return (
    <div className="mt-6 font-sans text-sm">
      <details className="mb-4 border border-rule p-3 lg:hidden">
        <summary className="cursor-pointer">
          <span className="font-semibold">{s.rulesTitle}:</span> {s.rulesSummary}
        </summary>
        <Regras s={s} />
      </details>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[13rem_minmax(0,1fr)_18rem]">
        {/* A coluna das comunidades, como a do Reddit: os feeds e todas as salas, mesmo as que ainda estão vazias. */}
        <nav aria-label={s.rooms} className="hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
          <ul className="space-y-0.5 border-b border-rule pb-3">
            {([["todas", s.feedAll], ["minhas", s.feedMine], ["salvas", s.feedSaved]] as const).map(([id, nome]) => (
              <li key={id}>
                <button type="button" onClick={() => filtrar(() => { setFeed(id); setArea(""); })} className={`w-full cursor-pointer rounded-md px-3 py-1.5 text-left ${feed === id && !area ? "bg-parchment-deep font-semibold" : "hover:bg-parchment-deep"}`}>{nome}</button>
              </li>
            ))}
          </ul>
          <p className="mt-3 px-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-soft">{s.rooms}</p>
          <input type="search" value={buscaSala} onChange={(e) => setBuscaSala(e.target.value)} placeholder={`${s.rooms}…`} aria-label={s.rooms} className="mx-1 mt-2 w-[calc(100%-0.5rem)] rounded-md border border-rule bg-parchment px-2 py-1 text-sm" />
          <ul className="mt-2 space-y-0.5">
            {todasAsSalas.map(([slug, nome]) => (
              <li key={slug}>
                <button type="button" onClick={() => filtrar(() => { setFeed("todas"); setArea(slug); })} aria-current={area === slug ? "page" : undefined} className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left ${area === slug ? "bg-parchment-deep font-semibold" : "hover:bg-parchment-deep"}`}>
                  <Bolinha slug={slug} nome={nome} />
                  <span className="min-w-0 flex-1 truncate">{nome}</span>
                  {(salas?.salas[slug] ?? 0) > 0 && <span className="font-mono text-[0.65rem] text-ink-soft">{salas?.salas[slug]}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {/* Os três feeds: tudo, as salas que a pessoa segue e o que ela salvou. */}
          <div role="tablist" aria-label={s.rooms} className="flex gap-1 border-b border-rule">
            {([["todas", s.feedAll], ["minhas", s.feedMine], ["salvas", s.feedSaved]] as const).map(([id, nome]) => (
              <button key={id} type="button" role="tab" aria-selected={feed === id} onClick={() => filtrar(() => { setFeed(id); if (id !== "todas") setArea(""); })} className={`cursor-pointer border-b-2 px-3 py-2 text-base ${feed === id ? "border-oxblood font-semibold text-oxblood" : "border-transparent text-ink-soft hover:text-oxblood"}`}>
                {nome}{id === "salvas" && pref.salvas.length ? <span className="ml-1 font-mono text-xs">{pref.salvas.length}</span> : null}{id === "minhas" && pref.seguidas.length ? <span className="ml-1 font-mono text-xs">{pref.seguidas.length}</span> : null}
              </button>
            ))}
          </div>

          {/* A sala aberta ganha a capa: nome, contagem, seguir e o caminho para a disciplina. */}
          {feed === "todas" && area && (
            <section className="mt-4 overflow-hidden rounded-md border-2 border-ink">
              <div className="h-16 bg-[linear-gradient(120deg,#7A1F1F,#c21f16_60%,#b8860b)]" />
              <div className="-mt-8 flex flex-wrap items-start gap-3 px-4">
                <Bolinha slug={area} nome={nomeDaSala(area)} grande />
                <div className="min-w-0 pt-9 pb-1">
                  <h2 className="font-serif text-2xl font-semibold leading-tight">{nomeDaSala(area)}</h2>
                  <p className="text-xs text-ink-soft">{s.roomOf}/{area} · {plural(lang, salas?.salas[area] ?? 0, s.roomPosts)}</p>
                </div>
                <div className="ml-auto flex flex-wrap gap-2 pt-9 pb-1">
                  <button type="button" onClick={() => seguir(area)} aria-pressed={segue(area)} className={`cursor-pointer rounded-full px-4 py-1.5 font-semibold ${segue(area) ? "border-2 border-ink" : "bg-ink text-parchment hover:bg-oxblood"}`}>{segue(area) ? `✓ ${s.following}` : s.follow}</button>
                  <L href={`/estantes/${area}`} className="rounded-full border-2 border-ink/30 px-4 py-1.5 hover:border-ink">{s.goToDiscipline} →</L>
                </div>
              </div>
              <p className="px-4 pt-2 pb-3 text-ink-soft">{t.areas[area as keyof typeof t.areas]?.[1]}</p>
            </section>
          )}

          {/* Barra de ferramentas presa no alto da lista: ordem, período, tipo, busca, jeito de ver e "Nova conversa". */}
          {feed !== "salvas" && (
            <div className="sticky top-0 z-20 -mx-2 mt-3 border-b border-rule bg-parchment px-2 pt-2 pb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {orders.map(([value, icone, label]) => (
                  <button key={value} type="button" onClick={() => filtrar(() => setOrder(value))} aria-pressed={order === value} className={`flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 font-semibold ${order === value ? "bg-ink text-parchment" : "text-ink-soft hover:bg-parchment-deep"}`}>
                    <Selo nome={icone} className="h-4 w-4" />{label}
                  </button>
                ))}
                {order === "melhores" && (
                  <select value={periodo} onChange={(e) => filtrar(() => setPeriodo(e.target.value))} aria-label={s.period} className="rounded-full border-2 border-ink/30 bg-parchment px-2 py-1">
                    {(["dia", "semana", "mes", "ano", "sempre"] as const).map((p) => <option key={p} value={p}>{s.periods[p]}</option>)}
                  </select>
                )}
                <span className="ml-auto flex rounded-full border border-rule p-0.5 text-xs" role="group" aria-label={s.order}>
                  {([["cartoes", "▤", s.viewCards], ["compacto", "☰", s.viewCompact]] as const).map(([v, icone, nome]) => (
                    <button key={v} type="button" aria-pressed={pref.vista === v} title={nome} onClick={() => mudarPref((p) => ({ ...p, vista: v }))} className={`cursor-pointer rounded-full px-2 py-0.5 ${pref.vista === v ? "bg-ink text-parchment" : ""}`}><span aria-hidden>{icone}</span> <span className="max-sm:sr-only">{nome}</span></button>
                  ))}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label={s.kindLabel} className="flex gap-1">
                  {kinds.map(([value, label]) => (
                    <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => filtrar(() => setKind(value))} className={`cursor-pointer border-b-2 px-2 py-1 ${kind === value ? "border-oxblood font-semibold text-oxblood" : "border-transparent text-ink-soft hover:text-oxblood"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {feed === "todas" && (
                  <select value={area} onChange={(e) => filtrar(() => setArea(e.target.value))} aria-label={s.room} className="max-w-48 border-2 border-ink/30 bg-parchment-deep px-2 py-1">
                    <option value="">{s.allRooms}</option>
                    {areaSlugs.map((slug) => (
                      <option key={slug} value={slug}>
                        {t.areas[slug][0]}
                      </option>
                    ))}
                  </select>
                )}
                <form role="search" className="ml-auto flex min-w-0 gap-2 max-sm:w-full" onSubmit={(e) => { e.preventDefault(); filtrar(() => setQuery(typed.trim())); }}>
                  <input type="search" value={typed} onChange={(e) => { setTyped(e.target.value); if (!e.target.value) filtrar(() => setQuery("")); }} maxLength={80} aria-label={s.search} placeholder={s.search} className="min-w-0 flex-1 rounded-full border-2 border-ink/40 bg-parchment-deep px-3 py-1.5 sm:w-52" />
                  <button type="submit" className="cursor-pointer rounded-full border-2 border-ink px-3 py-1.5 hover:border-oxblood hover:text-oxblood">{t.nav.search}</button>
                </form>
                <div className="hidden md:block">{botaoNova}</div>
              </div>
            </div>
          )}

          {alvo && (
            <p className="mt-3 flex flex-wrap items-center gap-2">
              <span className="border border-gold px-2 py-1">
                {s.about}: <L href={alvo} className="font-semibold underline hover:text-oxblood">{alvoTitulo || alvo}</L>
              </span>
              <L href="/comunidade" className="underline hover:text-oxblood">{s.clearAbout}</L>
            </p>
          )}

          {open && logged && (
            <form id="nova-conversa" className="mt-5 scroll-mt-28 space-y-3 rounded-md border-2 border-ink bg-parchment-deep p-5" onSubmit={(e) => { e.preventDefault(); void create(); }}>
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
              <label className="block">
                {s.titleLabel}
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={140} required minLength={5} className={field} />
              </label>
              <Escrita valor={draft.body} mudar={(body) => setDraft({ ...draft, body })} s={s} linhas={6} minimo={10} rotulo={s.bodyLabel} />
              <p className="flex flex-wrap gap-3">
                <button type="submit" className="cursor-pointer rounded-full bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood">{s.post}</button>
                <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setOpen(false)}>{s.cancel}</button>
              </p>
              <p role="alert" className="min-h-5 text-oxblood">{message}</p>
            </form>
          )}
          {!open && message && <p role="status" className="mt-3 text-ink-soft">{message}</p>}

          {feed === "salvas" ? (
            pref.salvas.length === 0 ? <p className="mt-8 text-lg text-ink-soft">{s.noSaved}</p> : (
              <ul className="mt-3 space-y-2">
                {pref.salvas.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 rounded-md border border-rule bg-parchment p-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">{chipSala(x.sala)}<span>{x.tipo === "duvida" ? s.kinds.question : s.kinds.talk}</span></p>
                      <L href={`/comunidade?t=${x.id}`} className="font-serif text-lg font-semibold hover:text-oxblood">{x.titulo}</L>
                    </div>
                    <button type="button" onClick={() => mudarPref((p) => ({ ...p, salvas: p.salvas.filter((y) => y.id !== x.id) }))} className="cursor-pointer text-xs underline hover:text-oxblood">{s.savedDone} ✕</button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              {feed === "minhas" && pref.seguidas.length === 0 && <p className="mt-8 text-lg text-ink-soft">{s.noFollowed}</p>}
              {list === null && <p className="mt-6 font-mono text-xs text-ink-soft">{t.common.loading}</p>}
              {list?.length === 0 && (feed === "todas" || pref.seguidas.length > 0) && <p className="mt-8 text-lg text-ink-soft">{s.empty}</p>}
              <ul className={compacto ? "mt-2 divide-y divide-rule" : "mt-3 space-y-2.5"}>
                {visiveis?.map((row) => {
                  if (escondidaAgora.includes(row.id)) {
                    return (
                      <li key={row.id} className="flex items-center gap-3 rounded-md border border-dashed border-rule px-3 py-2 text-ink-soft">
                        {s.hiddenByYou} <button type="button" onClick={() => desfazer(row.id)} className="cursor-pointer font-semibold underline hover:text-oxblood">{s.undo}</button>
                      </li>
                    );
                  }
                  const respostas = (
                    <L href={`/comunidade?t=${row.id}`} className={acao}><Selo nome="balao" className="h-4 w-4" />{plural(lang, row.respostas, s.replies)}</L>
                  );
                  if (compacto) {
                    return (
                      <li key={row.id} className={`flex items-center gap-2 py-2 ${row.oculto ? "opacity-60" : ""}`}>
                        <Util kind="topico" id={row.id} points={row.pontos} mine={row.meu_voto} s={s} disabled={!logged} deitado />
                        <div className="min-w-0 flex-1">
                          <L href={`/comunidade?t=${row.id}`} className="font-semibold hover:text-oxblood">{row.titulo}</L>
                          {row.tipo === "duvida" && row.resolvida && <span className="ml-2 rounded-full bg-ok/15 px-1.5 text-xs font-semibold text-ok">✓ {s.solved}</span>}
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">{chipSala(row.disciplina)}<span>{row.autor || "—"}</span><span>· {plural(lang, row.respostas, s.replies)}</span><span>· {relativo(row.ultima ?? row.criado_em, lang)}</span>{row.oculto && <span>· {row.retido ? s.pending : s.hidden}</span>}</p>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={row.id} className={`flex gap-2 rounded-md border border-rule bg-parchment p-2 pr-3 transition-colors hover:border-ink/50 ${row.oculto ? "opacity-60" : ""}`}>
                      <Util kind="topico" id={row.id} points={row.pontos} mine={row.meu_voto} s={s} disabled={!logged} />
                      <div className="min-w-0 flex-1 py-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
                          {chipSala(row.disciplina)}
                          <span>{row.disciplina ? "· " : ""}{row.autor || "—"}<SeloDoAutor selo={row.autor_selo} s={s} /></span>
                          <span>· <time dateTime={row.criado_em}>{relativo(row.criado_em, lang)}</time></span>
                        </p>
                        <L href={`/comunidade?t=${row.id}`} className="mt-1 block font-serif text-xl font-semibold leading-snug hover:text-oxblood">{row.titulo}</L>
                        <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${row.tipo === "duvida" ? "bg-oxblood/10 text-oxblood" : "bg-parchment-deep"}`}>{row.tipo === "duvida" ? s.kinds.question : s.kinds.talk}</span>
                          {row.tipo === "duvida" && row.resolvida && <span className="rounded-full bg-ok/15 px-2 py-0.5 font-semibold text-ok">✓ {s.solved}</span>}
                          {row.alvo && row.alvo_titulo && <L href={row.alvo} className="rounded-full border border-gold px-2 py-0.5 hover:text-oxblood">{s.about}: {row.alvo_titulo}</L>}
                          {row.trancado && <span className="rounded-full bg-parchment-deep px-2 py-0.5">{s.locked}</span>}
                          {row.oculto && <span className="rounded-full bg-parchment-deep px-2 py-0.5">{row.retido ? s.pending : s.hidden}</span>}
                        </p>
                        {row.trecho && <p className="mt-1.5 line-clamp-3 text-ink-soft">{row.trecho}</p>}
                        <p className="-ml-2 mt-1.5 flex flex-wrap items-center gap-0.5 text-xs font-semibold text-ink-soft">
                          {respostas}
                          <button type="button" onClick={() => void dividir(row)} className={acao}><span aria-hidden>↗</span>{aviso?.id === row.id ? aviso.texto : s.share}</button>
                          <button type="button" onClick={() => salvar(row)} aria-pressed={salva(row.id)} className={acao}><Selo nome="alfinete" className="h-4 w-4" />{salva(row.id) ? s.savedDone : s.save}</button>
                          <button type="button" onClick={() => esconder(row.id)} className={acao}><Selo nome="mudo" className="h-4 w-4" />{s.hidePost}</button>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {list && list.length > 0 && (fim ? <p className="mt-6 text-center text-ink-soft">{s.theEnd}</p> : <p className="mt-6 text-center"><button type="button" onClick={() => setPagina((p) => p + 1)} className="cursor-pointer rounded-full border-2 border-ink px-6 py-2 font-semibold hover:border-oxblood hover:text-oxblood">{s.loadMore}</button></p>)}
            </>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          {ranking.length > 0 && (
            <section aria-labelledby="salas-titulo" className="overflow-hidden rounded-md border-2 border-ink">
              <h2 id="salas-titulo" className="bg-ink px-3 py-2 font-serif text-lg font-semibold text-parchment">{s.trendingRooms}</h2>
              <ol className="divide-y divide-rule">
                {ranking.slice(0, 8).map(([slug, n], i) => (
                  <li key={slug} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-4 font-mono text-xs text-ink-soft">{i + 1}</span>
                    <Bolinha slug={slug} nome={nomeDaSala(slug)} />
                    <button type="button" onClick={() => filtrar(() => { setFeed("todas"); setArea(slug); })} className="min-w-0 flex-1 cursor-pointer truncate text-left font-semibold hover:text-oxblood">{nomeDaSala(slug)}<span className="block text-xs font-normal text-ink-soft">{plural(lang, n, s.roomPosts)}</span></button>
                    <button type="button" onClick={() => seguir(slug)} aria-pressed={segue(slug)} className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-semibold ${segue(slug) ? "border border-ink" : "bg-ink text-parchment hover:bg-oxblood"}`}>{segue(slug) ? "✓" : s.follow.split(" ")[0]}</button>
                  </li>
                ))}
              </ol>
              <button type="button" onClick={() => filtrar(() => { setFeed("todas"); setArea(""); })} className="w-full cursor-pointer border-t border-rule px-3 py-2 text-left text-xs underline hover:text-oxblood">{s.allRooms}{salas ? ` · ${salas.total}` : ""}</button>
            </section>
          )}
          {pref.seguidas.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-semibold">{s.feedMine}</h2>
              <p className="mt-2 flex flex-wrap gap-1.5">{pref.seguidas.filter(isSala).map((slug) => <button key={slug} type="button" onClick={() => filtrar(() => { setFeed("todas"); setArea(slug); })} className="flex cursor-pointer items-center gap-1 rounded-full border border-rule px-2 py-0.5 hover:border-ink"><Bolinha slug={slug} nome={nomeDaSala(slug)} />{nomeDaSala(slug)}</button>)}</p>
            </section>
          )}
          <p className="text-xs text-ink-soft">{s.followHint}</p>
          {salas && salas.sem_resposta > 0 && (
            <section className="border-l-4 border-oxblood bg-parchment-deep p-3">
              <p>{plural(lang, salas.sem_resposta, s.unansweredHelp)}</p>
              <button type="button" className="mt-1 cursor-pointer font-semibold underline hover:text-oxblood" onClick={() => filtrar(() => { setFeed("todas"); setKind("duvida"); setOrder("sem_resposta"); })}>{s.helpOut} →</button>
            </section>
          )}
          <section className="hidden lg:block" aria-labelledby="regras-titulo">
            <h2 id="regras-titulo" className="font-serif text-lg font-semibold">{s.rulesTitle}</h2>
            <Regras s={s} />
          </section>
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

type OrdemRespostas = "melhores" | "novas" | "antigas";

/** Monta a árvore das respostas: cada uma com as filhas logo abaixo, na ordem escolhida, e quantas descendentes tem. */
function arvore(lista: Reply[], ordem: OrdemRespostas): { item: Reply; nivel: number; descendentes: number; acima: string[] }[] {
  const filhas = new Map<string, Reply[]>();
  const ids = new Set(lista.map((r) => r.id));
  const raiz: Reply[] = [];
  for (const r of lista) {
    if (r.pai && ids.has(r.pai)) filhas.set(r.pai, [...(filhas.get(r.pai) ?? []), r]);
    else raiz.push(r);
  }
  const ordenar = (l: Reply[]) => [...l].sort((a, b) => (ordem === "melhores" ? Number(b.aceita) - Number(a.aceita) || b.pontos - a.pontos || a.criado_em.localeCompare(b.criado_em) : ordem === "novas" ? b.criado_em.localeCompare(a.criado_em) : a.criado_em.localeCompare(b.criado_em)));
  const contar = (r: Reply): number => (filhas.get(r.id) ?? []).reduce((n, f) => n + 1 + contar(f), 0);
  const saida: { item: Reply; nivel: number; descendentes: number; acima: string[] }[] = [];
  const andar = (r: Reply, nivel: number, acima: string[]) => {
    saida.push({ item: r, nivel, descendentes: contar(r), acima });
    for (const f of ordenar(filhas.get(r.id) ?? [])) andar(f, Math.min(nivel + 1, 4), [...acima, r.id]);
  };
  for (const r of ordenar(raiz)) andar(r, 1, []);
  return saida;
}

function TopicView({ id, s }: { id: string; s: S }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [pref, mudarPref] = usePreferencias();
  const [topic, setTopic] = useState<(Topic & { respostas: Reply[] | number }) | null>(null);
  const [missing, setMissing] = useState(false);
  const [reply, setReply] = useState("");
  const [paraQuem, setParaQuem] = useState<Reply | null>(null);
  const [resposta, setResposta] = useState("");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);
  const [ordem, setOrdem] = useState<OrdemRespostas | null>(null);
  const [recolhidas, setRecolhidas] = useState<string[]>([]);
  const [destaque, setDestaque] = useState("");
  const [copiado, setCopiado] = useState("");
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

  // Link direto para uma resposta (#r-…): rola até ela e a destaca por um instante.
  const carregou = topic !== null;
  useEffect(() => {
    if (!carregou) return;
    const alvo = window.location.hash.slice(1);
    if (!/^r-[0-9a-f-]{36}$/.test(alvo)) return;
    const el = document.getElementById(alvo);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    void Promise.resolve().then(() => setDestaque(alvo));
    const fim = window.setTimeout(() => setDestaque(""), 2500);
    return () => window.clearTimeout(fim);
  }, [carregou]);

  if (missing) return <p className="mt-10 text-lg text-ink-soft">{t.errors.nao_encontrado}</p>;
  if (!topic) return <p className="mt-10 font-mono text-xs text-ink-soft">{t.common.loading}</p>;
  const replies = Array.isArray(topic.respostas) ? topic.respostas : [];
  const logged = me.status === "in";
  const podeResponder = logged && !topic.retido && !topic.trancado;
  const ordemAtual: OrdemRespostas = ordem ?? (topic.tipo === "duvida" ? "melhores" : "antigas");
  const salva = pref.salvas.some((x) => x.id === topic.id);
  const nomeDaSala = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;

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
  const dividir = async (chave: string, url: string, titulo: string) => {
    if (await compartilhar(url, titulo)) {
      setCopiado(chave);
      window.setTimeout(() => setCopiado((c) => (c === chave ? "" : c)), 2000);
    }
  };
  const linkDaConversa = () => `${window.location.origin}${localePath(lang, `/comunidade?t=${topic.id}`)}`;
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
  const acao = "flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 font-semibold hover:bg-parchment-deep hover:text-oxblood";
  const lista = arvore(replies, ordemAtual).filter((x) => !x.acima.some((a) => recolhidas.includes(a)));

  return (
    <div className="mt-8 font-sans text-sm">
      <p className="flex flex-wrap items-center gap-3">
        <L href="/comunidade" className="text-ink-soft hover:text-oxblood">← {s.back}</L>
        {topic.disciplina && <L href={`/comunidade?sala=${topic.disciplina}`} className="flex items-center gap-1 font-semibold hover:text-oxblood"><Bolinha slug={topic.disciplina} nome={nomeDaSala(topic.disciplina)} />{s.roomOf}/{nomeDaSala(topic.disciplina)}</L>}
      </p>
      <article className={`mt-4 flex gap-2 rounded-md border-2 border-ink bg-parchment p-3 ${topic.oculto ? "opacity-60" : ""}`}>
        <Util key={`${topic.id}${topic.pontos}`} kind="topico" id={topic.id} points={topic.pontos} mine={topic.meu_voto} s={s} disabled={!logged} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-soft">
            {topic.autor || "—"}<SeloDoAutor selo={topic.autor_selo} s={s} /> · {date.format(new Date(topic.criado_em))}
            {topic.trancado && ` · ${s.locked}`}
            {topic.oculto && ` · ${topic.retido ? s.pending : s.hidden}`}
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold leading-tight">{topic.titulo}</h2>
          <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
            {topic.tipo === "duvida" ? <span className={`rounded-full px-2 py-0.5 font-semibold ${topic.aceita ? "bg-ok/15 text-ok" : "bg-oxblood/10 text-oxblood"}`}>{topic.aceita ? `✓ ${s.solved}` : s.kinds.question}</span> : <span className="rounded-full bg-parchment-deep px-2 py-0.5 font-semibold">{s.kinds.talk}</span>}
            {topic.alvo && <L href={topic.alvo} className="rounded-full border border-gold px-2 py-0.5 hover:text-oxblood">{s.about}: {topic.alvo_titulo || topic.alvo}</L>}
          </p>
          <div className="mt-3 font-serif">
            <Markdown lang={lang}>{topic.corpo}</Markdown>
          </div>
          <p className="-ml-2 mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-ink-soft">
            <span className={acao.replace("cursor-pointer ", "")}><Selo nome="balao" className="h-4 w-4" />{plural(lang, replies.length, s.replies)}</span>
            <button type="button" onClick={() => void dividir(topic.id, linkDaConversa(), topic.titulo)} className={acao}><span aria-hidden>↗</span>{copiado === topic.id ? s.copied : s.share}</button>
            <button type="button" aria-pressed={salva} onClick={() => mudarPref((p) => ({ ...p, salvas: salva ? p.salvas.filter((x) => x.id !== topic.id) : [{ id: topic.id, titulo: topic.titulo, sala: topic.disciplina, tipo: topic.tipo, em: new Date().toISOString() }, ...p.salvas].slice(0, 300) }))} className={acao}><span aria-hidden>{salva ? "🔖" : "🏷️"}</span>{salva ? s.savedDone : s.save}</button>
            <L href={`/denunciar?item=${encodeURIComponent(`/comunidade?t=${topic.id}`)}`} className={acao}><span aria-hidden>⚑</span>{t.common.report}</L>
            {topic.pode_cuidar && care("topico", topic.id, topic.oculto ? "mostrar" : "ocultar", topic.oculto ? s.show : s.hide)}
            {topic.pode_cuidar && care("topico", topic.id, topic.trancado ? "destrancar" : "trancar", topic.trancado ? s.unlock : s.lock)}
            {!topic.meu && ban(topic.id, topic.autor_id)}
          </p>
        </div>
      </article>

      {topic.retido ? (
        <p className="mt-6 text-ink-soft">{s.held}</p>
      ) : topic.trancado ? (
        <p className="mt-6 text-ink-soft">{s.locked}</p>
      ) : logged ? (
        <form
          className="mt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act("responder", { p_topico: topic.id, p_corpo: reply })) setReply("");
          }}
        >
          <Escrita valor={reply} mudar={setReply} s={s} linhas={4} minimo={2} rotulo={s.replyPlaceholder} />
          <button type="submit" className="mt-1 cursor-pointer rounded-full bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood">{s.reply}</button>
        </form>
      ) : (
        <p className="mt-6 flex flex-wrap gap-x-4">
          <L href="/entrar" className="underline hover:text-oxblood">{s.signInToPost}</L>
          {cadastro.aberto && <L href="/entrar?criar=1" className="font-medium underline hover:text-oxblood">{s.signUp}</L>}
        </p>
      )}
      <p role="alert" className="mt-2 min-h-5 text-oxblood">{message}</p>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-rule pb-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-gold">{plural(lang, replies.length, s.replies)}</h3>
        {replies.length > 1 && (
          <label className="ml-auto flex items-center gap-2 text-xs">
            {s.sortReplies}
            <select value={ordemAtual} onChange={(e) => setOrdem(e.target.value as OrdemRespostas)} className="rounded-full border border-rule bg-parchment px-2 py-0.5">
              <option value="melhores">{s.repliesBest}</option>
              <option value="novas">{s.repliesNew}</option>
              <option value="antigas">{s.repliesOld}</option>
            </select>
          </label>
        )}
      </div>
      <ul className="mt-2">
        {lista.map(({ item, nivel, descendentes }) => {
          const fechada = recolhidas.includes(item.id);
          return (
            <li key={item.id} id={`r-${item.id}`} className={`scroll-mt-24 ${item.oculto ? "opacity-60" : ""}`} style={{ paddingLeft: `${(nivel - 1) * 1.25}rem` }}>
              <div className={`flex gap-2 rounded-md py-2 transition-colors ${nivel > 1 ? "border-l-2 border-rule pl-3" : ""} ${destaque === `r-${item.id}` ? "bg-[#ffd27a]/40" : ""} ${item.aceita ? "border-l-4 !border-ok pl-3" : ""}`}>
                <button type="button" onClick={() => setRecolhidas((l) => (fechada ? l.filter((x) => x !== item.id) : [...l, item.id]))} aria-expanded={!fechada} title={fechada ? undefined : s.collapse} className="h-6 w-6 shrink-0 cursor-pointer rounded-full border border-rule font-mono text-xs leading-none text-ink-soft hover:border-ink">{fechada ? "+" : "−"}</button>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
                    <span className="font-semibold text-ink">{item.autor || "—"}</span>
                    {item.do_autor && <span title={s.opTitle} className="rounded bg-[#1e56c8] px-1 font-mono text-[0.6rem] font-bold uppercase text-white">{s.op}</span>}
                    {item.autor_selo ? <SeloDoAutor selo={item.autor_selo} s={s} /> : item.da_equipe && ` (${s.staff})`}
                    <span>· <time dateTime={item.criado_em}>{relativo(item.criado_em, lang)}</time></span>
                    {item.oculto && <span>· {item.retido ? s.pending : s.hidden}</span>}
                    {fechada && <span>· {item.pontos} ▲{descendentes ? ` · +${plural(lang, descendentes, s.replies)}` : ""}</span>}
                  </p>
                  {!fechada && (
                    <>
                      {item.aceita && <p className="mt-1 font-mono text-xs uppercase tracking-widest text-ok">✓ {s.accepted}</p>}
                      <div className="mt-1 font-serif">
                        <Markdown lang={lang}>{item.corpo}</Markdown>
                      </div>
                      <p className="-ml-2 mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-ink-soft">
                        <Util kind="resposta" id={item.id} points={item.pontos} mine={item.meu_voto} s={s} disabled={!logged} deitado />
                        {podeResponder && !item.oculto && (
                          <button type="button" className={acao} onClick={() => { setParaQuem(item); setResposta(""); }}><Selo nome="balao" className="h-4 w-4" />{s.replyHere}</button>
                        )}
                        <button type="button" className={acao} onClick={() => void dividir(item.id, `${linkDaConversa()}#r-${item.id}`, topic.titulo)}><Selo nome="clipe" className="h-4 w-4" />{copiado === item.id ? s.copied : s.linkToReply}</button>
                        {topic.tipo === "duvida" && (topic.meu || topic.pode_cuidar) && !item.oculto && (
                          <button type="button" className={acao} onClick={() => act("resposta_aceitar", { p_topico: topic.id, p_resposta: item.aceita ? null : item.id })}>
                            <span aria-hidden>✓</span>{item.aceita ? s.unaccept : s.accept}
                          </button>
                        )}
                        {topic.pode_cuidar && care("resposta", item.id, item.oculto ? "mostrar" : "ocultar", item.oculto ? s.show : s.hide)}
                        {!item.da_equipe && ban(item.id, item.autor_id)}
                      </p>
                      {paraQuem?.id === item.id && (
                        <form
                          className="mt-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (await act("responder", { p_topico: topic.id, p_corpo: resposta, p_pai: item.id })) {
                              setResposta("");
                              setParaQuem(null);
                            }
                          }}
                        >
                          <Escrita valor={resposta} mudar={setResposta} s={s} linhas={3} minimo={2} rotulo={fill(s.replyingTo, { nome: item.autor || "—" })} foco />
                          <p className="mt-1 flex gap-3">
                            <button type="submit" className="cursor-pointer rounded-full bg-ink px-4 py-1.5 font-medium text-parchment hover:bg-oxblood">{s.reply}</button>
                            <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setParaQuem(null)}>{s.cancel}</button>
                          </p>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
