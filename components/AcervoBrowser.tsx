// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fill, localePath, plural } from "@/i18n/config";
import { areaSlugs, essential, groups, licenses } from "@/lib/areas";
import type { Book, CatalogEntry } from "@/lib/content";
import { normalize } from "@/lib/text";
import { licenseName } from "./Cards";
import { useHydrated } from "@/lib/storage";
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

/**
 * A capa: a da própria edição, quando a fonte publica uma aberta (guardada no site por scripts/capas.mjs); senão, uma
 * capa desenhada aqui, como livro de coleção: o autor no alto, o título grande, o fio dourado com a estrela e a faixa
 * da coleção embaixo, na cor da área. Nenhuma imagem de terceiros é carregada do endereço deles.
 */
export function Capa({ book, pequena = false, grande = false }: { book: Book; pequena?: boolean; grande?: boolean }) {
  const tamanho = pequena ? "h-20 w-14" : grande ? "h-72 w-48" : "h-48 w-32";
  if (book.cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={book.cover} alt="" loading="lazy" decoding="async" className={`${tamanho} shrink-0 border border-ink/40 bg-parchment-deep object-cover shadow-[3px_3px_0_0_rgba(23,19,14,0.35)]`} />
    );
  }
  const cor = tomDe(book.area);
  return (
    <div aria-hidden className={`relative flex shrink-0 flex-col overflow-hidden border border-ink/60 text-[#f4ecd8] shadow-[3px_3px_0_0_rgba(23,19,14,0.35)] ${tamanho}`} style={{ background: cor }}>
      {/* A lombada: uma sombra à esquerda, como livro de verdade. */}
      <span className="absolute inset-y-0 left-0 w-2 bg-black/25" />
      <div className={`flex flex-1 flex-col ${pequena ? "p-1.5 pl-2.5" : grande ? "p-5 pl-7" : "p-3 pl-4"}`}>
        <span className={`truncate font-mono uppercase tracking-[0.18em] opacity-85 ${pequena ? "text-[0.38rem]" : grande ? "text-[0.7rem]" : "text-[0.5rem]"}`}>{book.author}</span>
        <span className={`mt-auto font-serif font-semibold leading-[1.05] ${pequena ? "line-clamp-3 text-[0.55rem]" : grande ? "line-clamp-6 text-2xl" : "line-clamp-5 text-[0.95rem]"}`}>{book.title}</span>
        <span className={`flex items-center gap-1.5 ${pequena ? "mt-1" : "mt-3"}`}>
          <span className={`${pequena ? "h-px" : "h-0.5"} flex-1 bg-[#d4a24c]`} />
          <svg viewBox="33 9 54 53" className={pequena ? "h-2 w-2" : "h-3.5 w-3.5"} fill="#d4a24c"><polygon points="60,10 66.29,29.35 86.63,29.35 70.17,41.31 76.46,60.65 60,48.7 43.54,60.65 49.83,41.31 33.37,29.35 53.71,29.35" /></svg>
          <span className={`${pequena ? "h-px" : "h-0.5"} flex-1 bg-[#d4a24c]`} />
        </span>
      </div>
      {!pequena && (
        <span className={`block bg-[#17130e]/80 text-center font-mono uppercase tracking-[0.2em] text-[#d4a24c] ${grande ? "py-2 text-[0.6rem]" : "py-1 text-[0.42rem]"}`}>Instituto Lúcia · Acervo</span>
      )}
    </div>
  );
}

/**
 * A vitrine do acervo: uma fileira de livros que anda sozinha, em loop, e para quando o mouse passa por cima, quando
 * um livro recebe o foco do teclado ou quando a pessoa aperta "Pausar". Com movimento reduzido no aparelho, não anda:
 * vira uma fileira para rolar com o dedo.
 */
function Carrossel({ titulo, obras, verTodas, rotulo }: { titulo: string; obras: Book[]; verTodas?: () => void; rotulo: { pause: string; play: string; all: string } }) {
  const [pausado, setPausado] = useState(false);
  if (obras.length === 0) return null;
  const loop = obras.length >= 6;
  const lista = loop ? [...obras, ...obras] : obras;
  return (
    <section className="carrossel mt-8" data-pausado={pausado ? "1" : undefined} aria-roledescription="carrossel" aria-label={titulo}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
        <h2 className="text-2xl font-semibold">{titulo} <span className="font-mono text-xs font-normal text-ink-soft">{obras.length}</span></h2>
        <span className="flex items-center gap-4 font-sans text-sm">
          {loop && <button type="button" aria-pressed={pausado} onClick={() => setPausado((p) => !p)} className="cursor-pointer underline hover:text-oxblood">{pausado ? `▶ ${rotulo.play}` : `⏸ ${rotulo.pause}`}</button>}
          {verTodas && <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={verTodas}>{rotulo.all} →</button>}
        </span>
      </div>
      <div className="carrossel-janela mt-4">
        <ul className={`flex w-max ${loop ? "carrossel-trilho" : ""}`} style={loop ? { animationDuration: `${Math.max(30, obras.length * 3.2)}s` } : undefined}>
          {lista.map((b, i) => {
            const copia = i >= obras.length;
            return (
              <li key={`${b.id}-${i}`} className="w-36 shrink-0 pr-5" aria-hidden={copia || undefined}>
                <L href={`/acervo/${b.id}`} className="group block" tabIndex={copia ? -1 : undefined}>
                  <span className="block transition-transform duration-200 group-hover:-translate-y-1"><Capa book={b} /></span>
                  <span className="mt-2 block line-clamp-2 font-serif text-sm font-semibold leading-tight group-hover:text-oxblood">{b.title}</span>
                  <span className="block truncate font-sans text-xs text-ink-soft">{b.author}</span>
                </L>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Uma ordem que muda a cada dia (a mesma para todo mundo naquele dia): a vitrine não mostra sempre os mesmos livros. */
function doDia<T extends { id: string }>(lista: T[], quantos: number) {
  const dia = Math.floor(Date.now() / 86_400_000);
  const peso = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0) + dia) >>> 0, dia);
  return [...lista].sort((a, b) => peso(a.id) - peso(b.id)).slice(0, quantos);
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
  const hidratado = useHydrated();
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

  return (
    <>
      <div role="search" className="mt-8 flex flex-wrap gap-3 font-sans text-sm">
        <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimite(POR_VEZ); if (e.target.value) setLista(true); }} aria-label={s.searchLabel} placeholder={s.searchPlaceholder} className={`${field} min-w-60 flex-1 font-mono outline-none`} />
        <button type="button" className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood" onClick={surpresa}>{s.surprise}</button>
      </div>

      {!lista ? (
        <>
          {/* A vitrine fica no alto: os livros passam sozinhos e param com o mouse em cima. */}
          <Carrossel titulo={s.newTitle} obras={novidades.map((id) => porId.get(id)).filter((b): b is Book => Boolean(b))} rotulo={{ pause: s.carouselPause, play: s.carouselPlay, all: s.allWorks }} />
          <Carrossel titulo={s.startTitle} obras={books.filter((b) => (essential as readonly string[]).includes(b.area) && b.license === "Domínio público")} rotulo={{ pause: s.carouselPause, play: s.carouselPlay, all: s.allWorks }} />
          <Carrossel titulo={s.pdTitle} obras={hidratado ? doDia(books.filter((b) => b.license === "Domínio público"), 240) : books.filter((b) => b.license === "Domínio público").slice(0, 240)} verTodas={() => abrirLista({ license: "Domínio público" })} rotulo={{ pause: s.carouselPause, play: s.carouselPlay, all: s.allWorks }} />
          <section className="mt-12">
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
