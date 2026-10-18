// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { safeLink } from "@/lib/text";
import { EstadoVazio } from "./EstadoVazio";
import { L, useI18n } from "./I18n";

type S = Dict["mural"];

export const muralCategories = ["servico", "produto", "cooperativa", "arte", "iniciativa"] as const;
const STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

interface Ad {
  id: string;
  categoria: (typeof muralCategories)[number];
  oficio: string;
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
interface City {
  cidade: string;
  uf: string;
  total: number;
}

// "site" é um campo-isca: gente não vê, robô preenche, e o envio é descartado sem aviso.
const emptyDraft = { id: "", categoria: "servico", oficio: "", titulo: "", descricao: "", cidade: "", uf: "", contato: "", link: "", site: "" };
const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const link = "cursor-pointer underline hover:text-oxblood";
const primary = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Mural dos Trabalhadores: quem procura um serviço escolhe o estado e a cidade e escreve o que precisa;
 * quem oferece anuncia sem precisar de conta. Nada vai ao ar sem a coordenação ler.
 */
export function Mural({ s }: { s: S }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [mine, setMine] = useState<Ad[]>([]);
  const [draft, setDraft] = useState<typeof emptyDraft | null>(null);
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [withdraw, setWithdraw] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const logged = me.status === "in";
  const categories = s.categories as Record<string, string>;
  const statuses = s.status as Record<string, string>;
  const date = new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC" });

  useEffect(() => {
    if (!hasBackend) return;
    let cancelled = false;
    rpc<Ad[]>("mural_listar", { p_categoria: category || null, p_uf: state || null, p_cidade: city || null, p_busca: search || null })
      .then((list) => !cancelled && setAds(list))
      .catch(() => !cancelled && setAds([]));
    return () => {
      cancelled = true;
    };
  }, [category, state, city, search, tick]);

  useEffect(() => {
    if (!hasBackend) return;
    let cancelled = false;
    rpc<City[]>("mural_cidades", { p_uf: state || null })
      .then((list) => !cancelled && setCities(list))
      .catch(() => !cancelled && setCities([]));
    return () => {
      cancelled = true;
    };
  }, [state, tick]);

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

  async function act<T>(fn: string, args: Record<string, unknown>, done: string): Promise<T | null> {
    setNotice("");
    try {
      const result = await rpc<T>(fn, args);
      setNotice(done);
      setTick((value) => value + 1);
      return result;
    } catch (error) {
      setNotice(errorText(t, error instanceof BackendError ? error.code : "falha"));
      return null;
    }
  }

  const ready =
    draft !== null && draft.titulo.trim().length >= 4 && draft.descricao.trim().length >= 20 && draft.cidade.trim().length >= 2 && draft.uf !== "" && draft.contato.trim().length >= 4 && (!draft.link || /^https:\/\/\S+$/.test(draft.link.trim()));
  const input = (key: "titulo" | "oficio" | "cidade" | "contato" | "link", label: string, max: number, extra = {}) => (
    <label className="block">
      {label}
      <input value={draft?.[key] ?? ""} onChange={(e) => setDraft((prev) => prev && { ...prev, [key]: e.target.value })} maxLength={max} className={field} {...extra} />
    </label>
  );

  return (
    <div className="mt-10 font-sans text-sm">
      {/* A busca: o que a pessoa procura, onde. */}
      <form
        className="border-2 border-ink bg-parchment-deep p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(typed.trim());
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="font-serif text-xl font-semibold">{s.search}</span>
            <input type="search" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={80} placeholder={s.searchPlaceholder} className={field} />
          </label>
          <button type="submit" className={`${primary} self-end`}>{t.nav.search}</button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            {s.state}
            <select value={state} onChange={(e) => { setState(e.target.value); setCity(""); }} className={field}>
              <option value="">{s.allStates}</option>
              {STATES.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </label>
          <label className="block">
            {s.city}
            <select value={city} onChange={(e) => setCity(e.target.value)} className={field}>
              <option value="">{s.allCities}</option>
              {cities.map((item) => (
                <option key={`${item.uf}-${item.cidade}`} value={item.cidade}>
                  {item.cidade}{state ? "" : `, ${item.uf}`} ({item.total})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {s.category}
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
              <option value="">{s.allCategories}</option>
              {muralCategories.map((id) => (
                <option key={id} value={id}>{categories[id]}</option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" onClick={() => { setDraft(draft ? null : emptyDraft); setCode(""); }} className="cursor-pointer bg-oxblood px-6 py-3 text-base font-semibold text-parchment hover:bg-ink">
          {draft ? s.cancel : s.newAd}
        </button>
        <button type="button" onClick={() => setWithdraw(withdraw === null ? "" : null)} className={link}>{s.withdraw}</button>
      </div>
      <p className="mt-3 max-w-2xl font-sans text-sm text-ink-soft">{t.lists.muralNew}</p>

      {withdraw !== null && (
        <form
          className="mt-4 flex max-w-md flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act("mural_retirar", { p_codigo: withdraw }, s.removed)) setWithdraw(null);
          }}
        >
          <label className="block grow">
            {s.withdrawLabel}
            <input value={withdraw} onChange={(e) => setWithdraw(e.target.value)} required minLength={10} maxLength={12} autoCapitalize="characters" className={`${field} font-mono uppercase`} />
          </label>
          <button type="submit" className={primary}>{s.remove}</button>
        </form>
      )}

      {draft && (
        <form
          className="mt-6 space-y-4 border border-rule bg-parchment-deep p-5 sm:p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await act<{ codigo: string | null }>("mural_enviar", { p: { ...draft, link: draft.link.trim() } }, s.sent);
            if (result) {
              setCode(result.codigo ?? "");
              setDraft(null);
            }
          }}
        >
          <h2 className="font-serif text-2xl font-semibold">{s.formTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              {s.category}
              <select value={draft.categoria} onChange={(e) => setDraft({ ...draft, categoria: e.target.value })} className={field}>
                {muralCategories.map((id) => (
                  <option key={id} value={id}>{categories[id]}</option>
                ))}
              </select>
            </label>
            {input("oficio", s.fields.trade, 60)}
          </div>
          {input("titulo", s.fields.title, 100, { required: true })}
          <label className="block">
            {s.fields.description}
            <textarea value={draft.descricao} onChange={(e) => setDraft({ ...draft, descricao: e.target.value })} required minLength={20} maxLength={1200} rows={5} className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            {input("cidade", s.fields.city, 80, { required: true, autoComplete: "address-level2" })}
            <label className="block">
              {s.fields.state}
              <select value={draft.uf} onChange={(e) => setDraft({ ...draft, uf: e.target.value })} required className={field}>
                <option value="">—</option>
                {STATES.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </select>
            </label>
          </div>
          {input("contato", s.fields.contact, 160, { required: true })}
          <p className="text-ink-soft">{s.contactHint}</p>
          {input("link", s.fields.link, 300, { type: "url", placeholder: "https://" })}
          <label className="sr-only" aria-hidden>
            Site
            <input tabIndex={-1} autoComplete="off" value={draft.site} onChange={(e) => setDraft({ ...draft, site: e.target.value })} />
          </label>
          <button type="submit" disabled={!ready} className="cursor-pointer bg-oxblood px-6 py-2.5 font-medium text-parchment hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
            {s.send}
          </button>
        </form>
      )}

      <p role="status" className="mt-3 min-h-5 text-oxblood">{notice}</p>
      {code && (
        <div role="status" className="mt-2 max-w-xl border-2 border-ink bg-parchment p-4">
          <p className="font-serif text-xl font-semibold">{s.codeTitle}</p>
          <p className="mt-1">{s.codeText}</p>
          <p className="mt-2 select-all font-mono text-2xl font-bold tracking-widest">{code}</p>
        </div>
      )}

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
                  <button type="button" className={link} onClick={() => setDraft({ ...emptyDraft, id: ad.id, categoria: ad.categoria, oficio: ad.oficio, titulo: ad.titulo, descricao: ad.descricao, cidade: ad.cidade, uf: ad.uf, contato: ad.contato, link: ad.link })}>{s.edit}</button>
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
        search || state || city || category ? <p className="mt-8 text-lg text-ink-soft">{s.none}</p> : <EstadoVazio textos={t.lists.empty.mural} aoAgir={() => { setDraft(emptyDraft); setCode(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} relacionadoHref="/gaveta" />
      ) : (
        <>
          <p className="mt-8 font-mono text-xs uppercase tracking-widest text-ink-soft">{fill(s.found, { n: ads.length })}</p>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {ads.map((ad) => (
              <li key={ad.id} id={ad.id} className="flex flex-col border border-rule bg-parchment-deep p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-gold">
                  {ad.oficio || categories[ad.categoria]} · {ad.cidade}, {ad.uf}
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold">{ad.titulo}</h2>
                <p className="mt-2 whitespace-pre-line font-serif text-lg">{ad.descricao}</p>
                <p className="mt-3 text-base">
                  <span className="text-ink-soft">{s.contact}:</span> <strong>{ad.contato}</strong>
                </p>
                {safeLink(ad.link) && (
                  <p className="mt-1 break-all">
                    <a href={ad.link} target="_blank" rel="noopener noreferrer nofollow" className={link}>{ad.link}</a>
                  </p>
                )}
                <p className="mt-auto flex flex-wrap justify-between gap-3 pt-4 text-ink-soft">
                  <span>{ad.oficio ? categories[ad.categoria] : ""}</span>
                  <L href={`/denunciar?item=${encodeURIComponent(`/mural#${ad.id}`)}`} className={link}>{t.common.report}</L>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
