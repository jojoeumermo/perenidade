// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fill, localePath, plural } from "@/i18n/config";
import { areaSlugs, essential, groups, licenses } from "@/lib/areas";
import type { Book, CatalogEntry } from "@/lib/content";
import { normalize } from "@/lib/text";
import { licenseName } from "./Cards";
import { L, useI18n } from "./I18n";

const field = "border-2 border-ink bg-parchment-deep px-3 py-2";
const POR_VEZ = 24;
const CHAVE_ESTANTE = "lucia:minha-estante";
const CHAVE_VISTA = "lucia:acervo-vista";
type Estado = "want" | "reading" | "read";
type Estante = Record<string, Estado>;
const TONS = ["#17130e", "#6e1f1a", "#c21f16", "#4a4032", "#8a5a16", "#1f3a2d", "#2b3a55"];
const tomDe = (s: string) => TONS[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % TONS.length];

function lerEstante(): Estante {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_ESTANTE) ?? "{}") as Estante;
  } catch {
    return {};
  }
}

/** Capa tipográfica, gerada aqui: título e autor sobre a cor da área. Nenhuma imagem de terceiros. */
function Capa({ book, pequena = false }: { book: Book; pequena?: boolean }) {
  return (
    <div aria-hidden className={`flex shrink-0 flex-col justify-between border-2 border-ink p-2 text-[#f4ecd8] ${pequena ? "h-20 w-14" : "h-36 w-24"}`} style={{ background: tomDe(book.area) }}>
      <span className="h-1 w-6 bg-[#d4a24c]" />
      <span className={`font-serif font-semibold leading-tight ${pequena ? "line-clamp-3 text-[0.55rem]" : "line-clamp-4 text-xs"}`}>{book.title}</span>
      <span className={`truncate font-mono uppercase tracking-wider opacity-80 ${pequena ? "text-[0.4rem]" : "text-[0.5rem]"}`}>{book.author}</span>
    </div>
  );
}

/**
 * O acervo como biblioteca: busca em destaque, áreas com contagem, estantes (novidades, domínio público, por onde
 * começar, a sua estante) e, só quando a pessoa pede, a lista completa, por partes, com filtros à vista e endereço
 * compartilhável. Nada some: as 1.400 obras continuam todas acessíveis.
 */
export function AcervoBrowser({ books, novidades }: { books: Book[]; /** Ids das obras acrescentadas por último (do histórico do Git). */ novidades: string[] }) {
  const { lang, t } = useI18n();
  const s = t.library;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [area, setArea] = useState(params.get("area") ?? "");
  const [license, setLicense] = useState(params.get("licenca") ?? "");
  const [lista, setLista] = useState(params.get("lista") === "1" || Boolean(params.get("q")) || Boolean(params.get("area")) || Boolean(params.get("licenca")));
  const [vista, setVista] = useState<"cartoes" | "lista">("cartoes");
  const [limite, setLimite] = useState(POR_VEZ);
  const [estante, setEstante] = useState<Estante>({});
  const [catalog, setCatalog] = useState<{ key: string; entries: CatalogEntry[] }>({ key: "", entries: [] });
  const importar = useRef<HTMLInputElement>(null);
  // A estante e a vista preferida vivem no navegador: lidas depois da hidratação, numa tarefa à parte, para o HTML do servidor bater com o primeiro desenho.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setEstante(lerEstante());
      try {
        if (window.localStorage.getItem(CHAVE_VISTA) === "lista") setVista("lista");
      } catch {
        // sem armazenamento
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  // O endereço guarda busca e filtros: dá para compartilhar um resultado e o voltar funciona.
  useEffect(() => {
    const q = new URLSearchParams();
    if (query) q.set("q", query);
    if (area) q.set("area", area);
    if (license) q.set("licenca", license);
    if (lista && !query && !area && !license) q.set("lista", "1");
    const alvo = q.toString() ? `${pathname}?${q}` : pathname;
    if (alvo !== `${pathname}${window.location.search}`) router.replace(alvo, { scroll: false });
  }, [query, area, license, lista, pathname, router]);

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const results = books.filter((book) => {
    if (area && book.area !== area) return false;
    if (license && book.license !== license) return false;
    const haystack = normalize(`${book.title} ${book.author} ${book.synopsis} ${book.source}`);
    return terms.every((term) => haystack.includes(term));
  });
  const porArea = useMemo(() => { const m = new Map<string, number>(); for (const b of books) m.set(b.area, (m.get(b.area) ?? 0) + 1); return m; }, [books]);
  const porId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const minhas = Object.keys(estante).map((id) => porId.get(id)).filter((b): b is Book => Boolean(b));
  const mostrando = results.slice(0, limite);

  // Os catálogos abertos são grandes: só são baixados quando a pessoa escolhe uma disciplina ou busca algo.
  const wanted = area || (terms.join("").length >= 3 ? "todos" : "");
  useEffect(() => {
    if (!wanted || wanted === catalog.key) return;
    let cancelled = false;
    fetch(localePath(lang, `/catalogo/${wanted}`))
      .then((response) => (response.ok ? (response.json() as Promise<CatalogEntry[]>) : []))
      .then((entries) => {
        if (!cancelled) setCatalog({ key: wanted, entries });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wanted, catalog.key, lang]);
  const fromCatalog = wanted && catalog.key === wanted && !license ? catalog.entries.filter((entry) => terms.every((term) => normalize(`${entry.t} ${entry.a}`).includes(term))).slice(0, 200) : [];

  const guardarEstante = (nova: Estante) => {
    setEstante(nova);
    try {
      window.localStorage.setItem(CHAVE_ESTANTE, JSON.stringify(nova));
    } catch {
      // sem armazenamento
    }
  };
  const alternarVista = (v: "cartoes" | "lista") => { setVista(v); try { window.localStorage.setItem(CHAVE_VISTA, v); } catch { /* sem armazenamento */ } };
  const surpresa = () => { const b = books[Math.floor(Math.random() * books.length)]; if (b) router.push(localePath(lang, `/acervo/${b.id}`)); };
  const abrirLista = (filtros: { area?: string; license?: string } = {}) => { setArea(filtros.area ?? ""); setLicense(filtros.license ?? ""); setQuery(""); setLimite(POR_VEZ); setLista(true); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const cartao = (book: Book) => (
    <article key={book.id} className="flex gap-4 border border-rule bg-parchment-deep p-4">
      <L href={`/acervo/${book.id}`} tabIndex={-1} aria-hidden><Capa book={book} /></L>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-gold">{t.areas[book.area][0]} · {licenseName(t, book.license)} · {book.language}</p>
        <h3 className="mt-1 text-xl font-semibold leading-tight"><L href={`/acervo/${book.id}`} className="hover:text-oxblood">{book.title}</L></h3>
        <p className="italic text-ink-soft">{book.author}{book.year && `, ${book.year}`}</p>
        <p className="mt-2 line-clamp-2 text-sm">{book.synopsis}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs">
          <a href={book.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{fill(t.common.readAt, { source: book.source })} ↗</a>
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => { const n = { ...estante }; if (n[book.id]) delete n[book.id]; else n[book.id] = "want"; guardarEstante(n); }}>{estante[book.id] ? s.shelfRemove : s.shelfAdd}</button>
        </p>
      </div>
    </article>
  );
  const linha = (book: Book) => (
    <li key={book.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b border-rule py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem_auto]">
      <span className="min-w-0"><L href={`/acervo/${book.id}`} className="font-semibold hover:text-oxblood">{book.title}</L><span className="text-ink-soft"> · {book.author}{book.year && `, ${book.year}`}</span></span>
      <span className="hidden truncate text-xs text-ink-soft sm:block">{t.areas[book.area][0]}</span>
      <span className="hidden text-xs text-ink-soft sm:block">{licenseName(t, book.license)}</span>
      <a href={book.url} target="_blank" rel="noopener noreferrer" className="text-xs underline hover:text-oxblood">↗</a>
    </li>
  );

  const estanteDe = (titulo: string, obras: Book[], verTodas?: () => void) => obras.length > 0 && (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <h2 className="text-2xl font-semibold">{titulo}</h2>
        {verTodas && <button type="button" className="cursor-pointer font-sans text-sm underline hover:text-oxblood" onClick={verTodas}>{s.allWorks} →</button>}
      </div>
      <ul className="mt-4 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {obras.slice(0, 8).map((b) => (
          <li key={b.id} className="w-36 shrink-0">
            <L href={`/acervo/${b.id}`} className="group block">
              <Capa book={b} />
              <span className="mt-2 block line-clamp-2 font-serif text-sm font-semibold leading-tight group-hover:text-oxblood">{b.title}</span>
              <span className="block truncate font-sans text-xs text-ink-soft">{b.author}</span>
            </L>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <div role="search" className="mt-8 flex flex-wrap gap-3 font-sans text-sm">
        <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimite(POR_VEZ); if (e.target.value) setLista(true); }} aria-label={s.searchLabel} placeholder={s.searchPlaceholder} className={`${field} min-w-60 flex-1 font-mono outline-none`} />
        <button type="button" className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood" onClick={surpresa}>{s.surprise}</button>
      </div>

      {!lista ? (
        <>
          <section className="mt-10">
            <h2 className="border-b border-rule pb-2 text-2xl font-semibold">{s.areasTitle}</h2>
            {groups.map((g) => {
              const areas = g.areas.filter((a) => (porArea.get(a) ?? 0) > 0);
              return areas.length > 0 && (
                <div key={g.id} className="mt-5">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gold">{t.groups[g.id]}</p>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {areas.map((a) => (
                      <li key={a}>
                        <button type="button" onClick={() => abrirLista({ area: a })} className="flex w-full cursor-pointer items-center gap-3 border border-rule bg-parchment-deep p-3 text-left hover:border-oxblood">
                          <span aria-hidden className="h-10 w-2 shrink-0 ring-1 ring-rule" style={{ background: tomDe(a) }} />
                          <span className="min-w-0"><span className="block font-semibold">{t.areas[a][0]}</span><span className="block truncate font-sans text-xs text-ink-soft">{plural(lang, porArea.get(a) ?? 0, t.common.works)}</span></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
          {estanteDe(s.newTitle, novidades.map((id) => porId.get(id)).filter((b): b is Book => Boolean(b)))}
          {estanteDe(s.startTitle, books.filter((b) => (essential as readonly string[]).includes(b.area) && b.license === "Domínio público").slice(0, 8))}
          {estanteDe(s.pdTitle, books.filter((b) => b.license === "Domínio público").slice(0, 8), () => abrirLista({ license: "Domínio público" }))}
          {minhas.length > 0 && (
            <section className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
                <h2 className="text-2xl font-semibold">{s.mineTitle}</h2>
                <span className="flex gap-3 font-sans text-xs">
                  <button type="button" className="cursor-pointer underline" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(estante, null, 2)], { type: "application/json" })); a.download = "minha-estante.json"; a.click(); }}>{s.shelfExport}</button>
                  <button type="button" className="cursor-pointer underline" onClick={() => importar.current?.click()}>{s.shelfImport}</button>
                  <input ref={importar} type="file" accept="application/json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f || f.size > 200_000) return; try { const d = JSON.parse(await f.text()) as Record<string, string>; const ok: Estante = {}; for (const [k, v] of Object.entries(d)) if (porId.has(k) && (v === "want" || v === "reading" || v === "read")) ok[k] = v; guardarEstante({ ...estante, ...ok }); } catch { /* arquivo inválido */ } }} />
                </span>
              </div>
              <ul className="mt-4 space-y-2 font-sans text-sm">
                {minhas.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 border border-rule bg-parchment-deep p-2">
                    <Capa book={b} pequena />
                    <span className="min-w-0 flex-1"><L href={`/acervo/${b.id}`} className="font-serif text-base font-semibold hover:text-oxblood">{b.title}</L><span className="block text-xs text-ink-soft">{b.author}</span></span>
                    <select value={estante[b.id]} onChange={(e) => guardarEstante({ ...estante, [b.id]: e.target.value as Estado })} className="border border-rule bg-parchment px-2 py-1 text-xs"><option value="want">{s.want}</option><option value="reading">{s.reading}</option><option value="read">{s.read}</option></select>
                    <button type="button" className="cursor-pointer text-xs underline" onClick={() => { const n = { ...estante }; delete n[b.id]; guardarEstante(n); }}>✕</button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-sans text-xs text-ink-soft">{s.shelfNote}</p>
            </section>
          )}
          <p className="mt-10 flex flex-wrap gap-3 font-sans text-sm">
            <button type="button" className="cursor-pointer bg-ink px-6 py-3 font-semibold text-parchment hover:bg-oxblood" onClick={() => abrirLista()}>{fill(s.seeAll, { n: books.length })}</button>
            <L href="/contribuir?tipo=obra" className="border-2 border-ink px-5 py-3 font-semibold hover:border-oxblood hover:text-oxblood">{s.suggest}</L>
          </p>
        </>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2 font-sans text-sm">
            <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => { setLista(false); setArea(""); setLicense(""); setQuery(""); }}>{s.backShelves}</button>
            <span className="mx-1 h-5 w-px bg-rule" />
            <select value={area} onChange={(e) => { setArea(e.target.value); setLimite(POR_VEZ); }} aria-label={s.area} className={field}>
              <option value="">{s.allAreas}</option>
              {areaSlugs.filter((a) => (porArea.get(a) ?? 0) > 0).map((slug) => <option key={slug} value={slug}>{t.areas[slug][0]} ({porArea.get(slug)})</option>)}
            </select>
            <select value={license} onChange={(e) => { setLicense(e.target.value); setLimite(POR_VEZ); }} aria-label={s.license} className={field}>
              <option value="">{s.allLicenses}</option>
              {licenses.map((l) => <option key={l} value={l}>{licenseName(t, l)} ({books.filter((b) => b.license === l && (!area || b.area === area)).length})</option>)}
            </select>
            {(area || license || query) && <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => { setArea(""); setLicense(""); setQuery(""); setLimite(POR_VEZ); }}>{s.clear}</button>}
            <span className="ml-auto flex gap-1" role="group" aria-label={`${s.viewCards} / ${s.viewList}`}>
              <button type="button" aria-pressed={vista === "cartoes"} onClick={() => alternarVista("cartoes")} className={`cursor-pointer border px-2 py-1 ${vista === "cartoes" ? "border-ink bg-ink text-parchment" : "border-rule"}`}>{s.viewCards}</button>
              <button type="button" aria-pressed={vista === "lista"} onClick={() => alternarVista("lista")} className={`cursor-pointer border px-2 py-1 ${vista === "lista" ? "border-ink bg-ink text-parchment" : "border-rule"}`}>{s.viewList}</button>
            </span>
          </div>
          <p role="status" className="mt-4 font-mono text-xs text-ink-soft">{fill(s.showing, { a: mostrando.length, b: results.length })}{fromCatalog.length > 0 ? ` · +${plural(lang, fromCatalog.length, t.common.works)}` : ""}</p>
          {vista === "cartoes" ? <div className="mt-4 grid gap-4 md:grid-cols-2">{mostrando.map(cartao)}</div> : <ul className="mt-4 font-sans text-sm">{mostrando.map(linha)}</ul>}
          {results.length > mostrando.length && (
            <p className="mt-6 text-center">
              <button type="button" className="cursor-pointer border-2 border-ink px-6 py-2.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood" onClick={() => setLimite((n) => n + POR_VEZ)}>{s.loadMore} ({results.length - mostrando.length})</button>
            </p>
          )}
          {fromCatalog.length > 0 && (
            <section className="mt-10">
              <h2 className="border-b border-rule pb-3 text-2xl font-semibold">{s.catalogTitle}</h2>
              <p className="mt-3 font-sans text-sm text-ink-soft">{s.catalogLead}</p>
              <ul className="mt-4 space-y-1.5 font-sans text-sm">
                {fromCatalog.map((entry) => (
                  <li key={entry.u}><a href={entry.u} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{entry.t}</a><span className="text-ink-soft"> · {entry.a} · {entry.i} · {entry.f}</span></li>
                ))}
              </ul>
            </section>
          )}
          {results.length + fromCatalog.length === 0 && (
            <div className="mt-8 border-2 border-ink bg-parchment-deep p-6">
              <p className="text-xl text-ink-soft">{s.nothing}</p>
              <p className="mt-3 flex flex-wrap gap-3 font-sans text-sm">
                <button type="button" className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold" onClick={() => { setArea(""); setLicense(""); setLimite(POR_VEZ); }}>{s.clear}</button>
                <L href="/contribuir?tipo=obra" className="border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood">{s.suggest}</L>
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
