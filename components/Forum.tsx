// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { htmlLang, plural } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { errorText } from "@/i18n/core";
import { L, useI18n } from "./I18n";
import { Markdown } from "./Markdown";

type S = Dict["community"];

interface TopicRow {
  id: string;
  titulo: string;
  disciplina: string | null;
  pontos: number;
  respostas: number;
  trancado: boolean;
  oculto: boolean;
  criado_em: string;
  autor: string;
  meu_voto: number;
}

interface Reply {
  id: string;
  corpo: string;
  pontos: number;
  oculto: boolean;
  criado_em: string;
  autor: string;
  meu_voto: number;
}

interface Topic extends TopicRow {
  corpo: string;
  pode_cuidar: boolean;
  respostas_lista?: never;
}

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";

/** Setas de voto, como nos fóruns: para cima, para baixo, e clicar de novo retira. */
function Votes({ kind, id, points, mine, onChange, s, disabled }: { kind: "topico" | "resposta"; id: string; points: number; mine: number; onChange: () => void; s: S; disabled: boolean }) {
  const [state, setState] = useState({ points, mine });
  async function vote(value: number) {
    const next = state.mine === value ? 0 : value;
    try {
      const result = await rpc<{ pontos: number; meu_voto: number }>("votar", { p_tipo: kind, p_alvo: id, p_valor: next });
      setState({ points: result.pontos, mine: result.meu_voto });
      onChange();
    } catch {
      // Sem conta ou sem conexão: o voto simplesmente não entra.
    }
  }
  const arrow = (value: number, label: string, symbol: string) => (
    <button type="button" disabled={disabled} aria-label={label} title={label} aria-pressed={state.mine === value} onClick={() => vote(value)}
      className={`cursor-pointer px-1 leading-none disabled:cursor-not-allowed disabled:opacity-40 ${state.mine === value ? "text-oxblood" : "text-ink-soft hover:text-oxblood"}`}>
      {symbol}
    </button>
  );
  return (
    <div className="flex w-10 shrink-0 flex-col items-center font-mono text-sm">
      {arrow(1, s.up, "▲")}
      <span aria-label={s.points}>{state.points}</span>
      {arrow(-1, s.down, "▼")}
    </div>
  );
}

export function Forum({ s }: { s: S }) {
  const params = useSearchParams();
  const topic = params.get("t");
  if (!hasBackend) return <p className="mt-10 text-lg text-ink-soft">{s.offline}</p>;
  return topic && /^[0-9a-f-]{36}$/.test(topic) ? <TopicView id={topic} s={s} /> : <TopicList s={s} />;
}

function TopicList({ s }: { s: S }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const me = useMe();
  const [order, setOrder] = useState("alta");
  const [area, setArea] = useState("");
  const [list, setList] = useState<TopicRow[] | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", area: "" });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const date = new Intl.DateTimeFormat(htmlLang[lang]);

  useEffect(() => {
    let cancelled = false;
    rpc<TopicRow[]>("topicos_listar", { p_ordem: order, p_disciplina: area || null, p_pagina: 0 })
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [order, area]);

  async function create() {
    try {
      const created = await rpc<{ id: string }>("topico_criar", { p_titulo: draft.title, p_corpo: draft.body, p_disciplina: draft.area || null });
      router.push(`/${lang}/comunidade?t=${created.id}`);
    } catch (error) {
      setMessage(errorText(t, error instanceof BackendError ? error.code : "falha"));
    }
  }

  const orders: [string, string][] = [["alta", s.hot], ["novos", s.new], ["melhores", s.top]];
  return (
    <div className="mt-8 font-sans text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {orders.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setOrder(value)} aria-pressed={order === value} className={`cursor-pointer border-2 px-3 py-1.5 ${order === value ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
            {label}
          </button>
        ))}
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label={s.discipline} className="border-2 border-ink bg-parchment-deep px-3 py-1.5">
          <option value="">{s.all}</option>
          {areaSlugs.map((slug) => (
            <option key={slug} value={slug}>
              {t.areas[slug][0]}
            </option>
          ))}
        </select>
        {me.status === "in" ? (
          <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto cursor-pointer bg-oxblood px-5 py-2 font-medium text-parchment hover:bg-ink">
            {s.newTopic}
          </button>
        ) : (
          <L href="/entrar" className="ml-auto underline hover:text-oxblood">{s.signInToPost}</L>
        )}
      </div>

      {open && (
        <form className="mt-5 space-y-3 border border-rule bg-parchment-deep p-5" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <label className="block">
            {s.titleLabel}
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={140} required minLength={5} className={field} />
          </label>
          <label className="block">
            {s.bodyLabel}
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={5} maxLength={8000} required minLength={10} className={field} />
          </label>
          <label className="block">
            {s.discipline}
            <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className={field}>
              <option value="">{s.all}</option>
              {areaSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {t.areas[slug][0]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="cursor-pointer bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood">{s.post}</button>
          <p role="alert" className="min-h-5 text-oxblood">{message}</p>
        </form>
      )}

      {list?.length === 0 && <p className="mt-8 text-lg text-ink-soft">{s.empty}</p>}
      <ul className="mt-6 divide-y divide-rule border-y border-rule">
        {list?.map((row) => (
          <li key={row.id} className={`flex gap-3 py-4 ${row.oculto ? "opacity-60" : ""}`}>
            <Votes kind="topico" id={row.id} points={row.pontos} mine={row.meu_voto} onChange={() => {}} s={s} disabled={me.status !== "in"} />
            <div className="min-w-0">
              <L href={`/comunidade?t=${row.id}`} className="font-serif text-2xl font-semibold hover:text-oxblood">{row.titulo}</L>
              <p className="mt-1 text-ink-soft">
                {row.autor || "—"} · {date.format(new Date(row.criado_em))} · {plural(lang, row.respostas, s.replies)}
                {row.disciplina && ` · ${t.areas[row.disciplina as keyof typeof t.areas]?.[0] ?? row.disciplina}`}
                {row.trancado && ` · ${s.locked}`}
                {row.oculto && ` · ${s.hidden}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopicView({ id, s }: { id: string; s: S }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [topic, setTopic] = useState<(Topic & { respostas: Reply[] | number }) | null>(null);
  const [missing, setMissing] = useState(false);
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);
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

  async function act(fn: string, args: Record<string, unknown>) {
    try {
      await rpc(fn, args);
      setMessage("");
      reload();
      return true;
    } catch (error) {
      setMessage(errorText(t, error instanceof BackendError ? error.code : "falha"));
      return false;
    }
  }
  const care = (kind: "topico" | "resposta", target: string, action: string, label: string) => (
    <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => act("comunidade_cuidar", { p_tipo: kind, p_alvo: target, p_acao: action })}>
      {label}
    </button>
  );

  return (
    <div className="mt-8 font-sans text-sm">
      <L href="/comunidade" className="text-ink-soft hover:text-oxblood">← {s.back}</L>
      <article className={`mt-5 flex gap-3 ${topic.oculto ? "opacity-60" : ""}`}>
        <Votes key={`${topic.id}${topic.pontos}`} kind="topico" id={topic.id} points={topic.pontos} mine={topic.meu_voto} onChange={() => {}} s={s} disabled={!logged} />
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-3xl font-semibold">{topic.titulo}</h2>
          <p className="mt-1 text-ink-soft">
            {topic.autor || "—"} · {date.format(new Date(topic.criado_em))}
            {topic.disciplina && ` · ${t.areas[topic.disciplina as keyof typeof t.areas]?.[0] ?? topic.disciplina}`}
            {topic.trancado && ` · ${s.locked}`}
            {topic.oculto && ` · ${s.hidden}`}
          </p>
          <div className="mt-3 font-serif">
            <Markdown lang={lang}>{topic.corpo}</Markdown>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
            <L href={`/denunciar?item=${encodeURIComponent(`/comunidade?t=${topic.id}`)}`} className="underline hover:text-oxblood">{t.common.report}</L>
            {topic.pode_cuidar && care("topico", topic.id, topic.oculto ? "mostrar" : "ocultar", topic.oculto ? s.show : s.hide)}
            {topic.pode_cuidar && care("topico", topic.id, topic.trancado ? "destrancar" : "trancar", topic.trancado ? s.unlock : s.lock)}
          </p>
        </div>
      </article>

      <h3 className="mt-8 border-b border-rule pb-2 font-mono text-xs uppercase tracking-widest text-gold">{plural(lang, replies.length, s.replies)}</h3>
      <ul className="divide-y divide-rule">
        {replies.map((item) => (
          <li key={item.id} className={`flex gap-3 py-4 ${item.oculto ? "opacity-60" : ""}`}>
            <Votes kind="resposta" id={item.id} points={item.pontos} mine={item.meu_voto} onChange={() => {}} s={s} disabled={!logged} />
            <div className="min-w-0 flex-1">
              <div className="font-serif">
                <Markdown lang={lang}>{item.corpo}</Markdown>
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 text-ink-soft">
                <span>
                  {item.autor || "—"} · {date.format(new Date(item.criado_em))}
                  {item.oculto && ` · ${s.hidden}`}
                </span>
                {topic.pode_cuidar && care("resposta", item.id, item.oculto ? "mostrar" : "ocultar", item.oculto ? s.show : s.hide)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {topic.trancado ? (
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
        <p className="mt-6">
          <L href="/entrar" className="underline hover:text-oxblood">{s.signInToPost}</L>
        </p>
      )}
      <p role="alert" className="mt-2 min-h-5 text-oxblood">{message}</p>
    </div>
  );
}
