// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { L, useI18n } from "./I18n";

type S = Dict["mural"];

export const muralCategories = ["cooperativa", "servico", "produto", "arte", "iniciativa"] as const;
const STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

interface Ad {
  id: string;
  categoria: (typeof muralCategories)[number];
  titulo: string;
  descricao: string;
  cidade: string;
  uf: string;
  contato: string;
  link: string;
  nome: string;
  status?: "pendente" | "aprovado" | "recusado";
  nota?: string;
  validade?: string | null;
  vencido?: boolean;
}

const emptyDraft = { id: "", categoria: "cooperativa", titulo: "", descricao: "", cidade: "", uf: "", contato: "", link: "" };
const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const link = "cursor-pointer underline hover:text-oxblood";

/** Mural dos Trabalhadores: anúncios de cooperativas, ofícios, arte e iniciativas, lidos por todos e enviados por quem tem conta. */
export function Mural({ s }: { s: S }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [mine, setMine] = useState<Ad[]>([]);
  const [draft, setDraft] = useState<typeof emptyDraft | null>(null);
  const [notice, setNotice] = useState("");
  const [tick, setTick] = useState(0);
  const logged = me.status === "in";
  const categories = s.categories as Record<string, string>;
  const statuses = s.status as Record<string, string>;
  const date = new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC" });

  useEffect(() => {
    if (!hasBackend) return;
    let cancelled = false;
    rpc<Ad[]>("mural_listar", { p_categoria: category || null, p_uf: state || null })
      .then((list) => !cancelled && setAds(list))
      .catch(() => !cancelled && setAds([]));
    return () => {
      cancelled = true;
    };
  }, [category, state, tick]);

  useEffect(() => {
    if (!logged) return;
    let cancelled = false;
    rpc<Ad[]>("mural_meus")
      .then((list) => !cancelled && setMine(list))
      .catch(() => !cancelled && setMine([]));
    return () => {
      cancelled = true;
    };
  }, [logged, tick]);

  if (!hasBackend) return <p className="mt-10 text-lg text-ink-soft">{s.offline}</p>;

  async function act(fn: string, args: Record<string, unknown>, done: string) {
    setNotice("");
    try {
      await rpc(fn, args);
      setNotice(done);
      setTick((value) => value + 1);
      return true;
    } catch (error) {
      setNotice(errorText(t, error instanceof BackendError ? error.code : "falha"));
      return false;
    }
  }

  const ready = draft !== null && draft.titulo.trim().length >= 4 && draft.descricao.trim().length >= 20 && draft.cidade.trim().length >= 2 && draft.contato.trim().length >= 4 && (!draft.link || /^https:\/\/\S+$/.test(draft.link.trim()));
  const input = (key: "titulo" | "cidade" | "contato" | "link", label: string, max: number, extra = {}) => (
    <label className="block">
      {label}
      <input value={draft?.[key] ?? ""} onChange={(e) => setDraft((prev) => prev && { ...prev, [key]: e.target.value })} maxLength={max} className={field} {...extra} />
    </label>
  );

  return (
    <div className="mt-10 font-sans text-sm">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          {s.category}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            <option value="">{s.allCategories}</option>
            {muralCategories.map((id) => (
              <option key={id} value={id}>
                {categories[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          {s.state}
          <select value={state} onChange={(e) => setState(e.target.value)} className={field}>
            <option value="">{s.allStates}</option>
            {STATES.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto">
          {logged ? (
            <button type="button" onClick={() => setDraft(draft ? null : emptyDraft)} className="cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood">
              {draft ? s.cancel : s.newAd}
            </button>
          ) : (
            me.status === "out" && <L href="/entrar" className={link}>{s.signIn}</L>
          )}
        </span>
      </div>

      {draft && (
        <form
          className="mt-6 space-y-4 border border-rule bg-parchment-deep p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act("mural_enviar", { p: { ...draft, link: draft.link.trim() } }, s.sent)) setDraft(null);
          }}
        >
          <h2 className="font-serif text-2xl font-semibold">{s.formTitle}</h2>
          <label className="block">
            {s.category}
            <select value={draft.categoria} onChange={(e) => setDraft({ ...draft, categoria: e.target.value })} className={field}>
              {muralCategories.map((id) => (
                <option key={id} value={id}>
                  {categories[id]}
                </option>
              ))}
            </select>
          </label>
          {input("titulo", s.fields.title, 100)}
          <label className="block">
            {s.fields.description}
            <textarea value={draft.descricao} onChange={(e) => setDraft({ ...draft, descricao: e.target.value })} maxLength={1200} rows={5} className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            {input("cidade", s.fields.city, 80)}
            <label className="block">
              {s.fields.state}
              <select value={draft.uf} onChange={(e) => setDraft({ ...draft, uf: e.target.value })} className={field}>
                <option value="">—</option>
                {STATES.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </select>
            </label>
          </div>
          {input("contato", s.fields.contact, 160)}
          <p className="text-ink-soft">{s.contactHint}</p>
          {input("link", s.fields.link, 300, { type: "url", placeholder: "https://" })}
          <button type="submit" disabled={!ready} className="cursor-pointer bg-oxblood px-6 py-2.5 font-medium text-parchment hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
            {s.send}
          </button>
        </form>
      )}

      <p role="status" className="mt-3 min-h-5 text-oxblood">{notice}</p>

      {logged && mine.length > 0 && (
        <section className="mt-4 border-l-2 border-gold pl-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-gold">{s.mine}</h2>
          <ul className="mt-2 divide-y divide-rule">
            {mine.map((ad) => (
              <li key={ad.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                <strong>{ad.titulo}</strong>
                <span className="text-ink-soft">
                  {statuses[ad.vencido ? "vencido" : (ad.status ?? "pendente")]}
                  {ad.status === "aprovado" && !ad.vencido && ad.validade && ` · ${fill(s.validUntil, { date: date.format(new Date(ad.validade)) })}`}
                  {ad.nota && ` · ${ad.nota}`}
                </span>
                <span className="ml-auto flex gap-4">
                  {ad.status === "aprovado" && <button type="button" className={link} onClick={() => act("mural_renovar", { p_id: ad.id }, s.renewed)}>{s.renew}</button>}
                  <button type="button" className={link} onClick={() => setDraft({ id: ad.id, categoria: ad.categoria, titulo: ad.titulo, descricao: ad.descricao, cidade: ad.cidade, uf: ad.uf, contato: ad.contato, link: ad.link })}>{s.edit}</button>
                  <button type="button" className={link} onClick={() => act("mural_remover", { p_id: ad.id }, s.removed)}>{s.remove}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ads === null ? (
        <p className="mt-8 font-mono text-xs text-ink-soft">{t.common.loading}</p>
      ) : ads.length === 0 ? (
        <p className="mt-8 text-lg text-ink-soft">{s.empty}</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {ads.map((ad) => (
            <li key={ad.id} id={ad.id} className="flex flex-col border border-rule bg-parchment-deep p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-gold">
                {categories[ad.categoria]} · {ad.cidade}
                {ad.uf && `, ${ad.uf}`}
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold">{ad.titulo}</h2>
              <p className="mt-2 whitespace-pre-line font-serif text-lg">{ad.descricao}</p>
              <p className="mt-3">
                <span className="text-ink-soft">{s.contact}:</span> {ad.contato}
              </p>
              {ad.link && (
                <p className="mt-1 break-all">
                  <a href={ad.link} target="_blank" rel="noopener noreferrer nofollow" className={link}>{ad.link}</a>
                </p>
              )}
              <p className="mt-auto flex flex-wrap justify-between gap-3 pt-4 text-ink-soft">
                <span>{ad.nome && fill(s.by, { name: ad.nome })}</span>
                <L href={`/denunciar?item=${encodeURIComponent(`/mural#${ad.id}`)}`} className={link}>{t.common.report}</L>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
