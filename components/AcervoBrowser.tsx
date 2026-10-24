// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fill, localePath, plural } from "@/i18n/config";
import { areaSlugs, essential, groups, licenses } from "@/lib/areas";
import type { Book, CatalogEntry } from "@/lib/content";
import { normalize } from "@/lib/text";
import { licenseName } from "./Cards";
import { CapaDoLivro, tomDe } from "./acervo/CapaDoLivro";
import { CartaoDaObra } from "./acervo/CartaoDaObra";
import { Selo } from "./Selo";
import { useHydrated } from "@/lib/storage";
import { L, useI18n } from "./I18n";

const field = "min-h-11 border-2 border-ink bg-folha px-3 py-2 text-ink";
const POR_VEZ = 24;
const CHAVE_ESTANTE = "lucia:minha-estante";
const CHAVE_VISTA = "lucia:acervo-vista";
type Estado = "want" | "reading" | "read";
type Estante = Record<string, Estado>;

function lerEstante(): Estante {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_ESTANTE) ?? "{}") as Estante;
  } catch {
    return {};
  }
}

/** O título de uma fileira, no desenho das seções: a etiqueta com a estrela, o fio e, no fim, a contagem e os botões. */
function Tarja({ titulo, conta, vermelha = false, children }: { titulo: string; conta?: number; vermelha?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
      <h2 className={`shrink-0 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] ${vermelha ? "bg-[#c21f16] text-white" : "bg-ink text-parchment"}`}>
        ★ {titulo}
        {conta !== undefined && <span className="ml-2 font-normal opacity-80">{conta}</span>}
      </h2>
      <span aria-hidden className={`min-w-8 flex-1 border-t-2 ${vermelha ? "border-[#c21f16]" : "border-ink"}`} />
      {children && <span className="flex shrink-0 flex-wrap items-center gap-3">{children}</span>}
    </div>
  );
}

/** Pausar e continuar, desenhados em traço (nada de símbolo de teclado). */
const Pausa = ({ tocando }: { tocando: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="currentColor">
    {tocando ? <path d="M4 2h3v12H4zM9 2h3v12H9z" /> : <path d="M4 2l10 6-10 6z" />}
  </svg>
);

/**
 * A vitrine do acervo: uma fileira de livros que anda sozinha, em loop, e para quando o mouse passa por cima, quando
 * um livro recebe o foco do teclado ou quando a pessoa aperta "Pausar". Com movimento reduzido no aparelho, não anda:
 * vira uma fileira para rolar com o dedo.
 */
function Carrossel({ titulo, obras, verTodas, rotulo, vermelha = false }: { titulo: string; obras: Book[]; verTodas?: () => void; rotulo: { pause: string; play: string; all: string }; vermelha?: boolean }) {
  const [pausado, setPausado] = useState(false);
  if (obras.length === 0) return null;
  const loop = obras.length >= 6;
  const lista = loop ? [...obras, ...obras] : obras;
  return (
    <section className="carrossel" data-pausado={pausado ? "1" : undefined} aria-roledescription="carrossel" aria-label={titulo}>
      <Tarja titulo={titulo} conta={obras.length} vermelha={vermelha}>
        {loop && (
          <button type="button" aria-pressed={pausado} onClick={() => setPausado((p) => !p)} className="botao botao-papel botao-menor min-h-11">
            <Pausa tocando={!pausado} />
            {pausado ? rotulo.play : rotulo.pause}
          </button>
        )}
        {verTodas && (
          <button type="button" className="botao botao-papel botao-menor min-h-11" onClick={verTodas}>
            {rotulo.all} →
          </button>
        )}
      </Tarja>
      <div className="carrossel-janela mt-5">
        <ul className={`flex w-max pb-3 ${loop ? "carrossel-trilho" : ""}`} style={loop ? { animationDuration: `${Math.max(30, obras.length * 3.2)}s` } : undefined}>
          {lista.map((b, i) => {
            const copia = i >= obras.length;
            return (
              <li key={`${b.id}-${i}`} className="w-[9.5rem] shrink-0 pt-1 pr-6" aria-hidden={copia || undefined}>
                <L href={`/acervo/${b.id}`} className="group block text-ink hover:text-ink" tabIndex={copia ? -1 : undefined}>
                  <span className="block transition-transform duration-150 group-hover:-translate-y-1 group-hover:-rotate-1">
                    <CapaDoLivro book={b} />
                  </span>
                  <span className="mt-3 block line-clamp-2 font-serif text-[0.95rem] font-semibold leading-tight group-hover:underline group-hover:decoration-[#c21f16]">{b.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-[0.65rem] uppercase tracking-[0.08em] text-ink-soft">{b.author}</span>
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
  // O texto de busca de cada obra é montado uma vez só: a cada letra digitada, só se compara.
  const palheiro = useMemo(() => books.map((book) => normalize(`${book.title} ${book.author} ${book.synopsis} ${book.source}`)), [books]);
  const results = books.filter((book, i) => {
    if (area && book.area !== area) return false;
    if (license && book.license !== license) return false;
    return terms.every((term) => palheiro[i].includes(term));
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

  const naEstante = (book: Book) => (
    <button
      type="button"
      aria-pressed={Boolean(estante[book.id])}
      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-ink-soft hover:text-prelo-texto"
      onClick={() => { const n = { ...estante }; if (n[book.id]) delete n[book.id]; else n[book.id] = "want"; guardarEstante(n); }}
    >
      <Selo nome={estante[book.id] ? "check" : "livros"} className="h-5 w-5" />
      {estante[book.id] ? s.shelfRemove : s.shelfAdd}
    </button>
  );
  const cartao = (book: Book) => <CartaoDaObra key={book.id} book={book} t={t} href={localePath(lang, `/acervo/${book.id}`)} acao={naEstante(book)} />;
  const linha = (book: Book) => (
    <li key={book.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b-[1.5px] border-rule py-2.5 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_9rem_auto]">
      <span className="min-w-0">
        <L href={`/acervo/${book.id}`} className="font-serif text-lg font-semibold leading-tight text-ink hover:underline hover:decoration-[#c21f16]">{book.title}</L>
        <span className="block font-sans text-sm text-ink-soft">{book.author}{book.year && `, ${book.year}`}</span>
      </span>
      <span className="hidden truncate font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink-soft sm:block">{t.areas[book.area][0]}</span>
      <span className="hidden font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink-soft sm:block">{licenseName(t, book.license)}</span>
      <a href={book.url} target="_blank" rel="noopener noreferrer" aria-label={fill(t.common.readAt, { source: book.source })} title={fill(t.common.readAt, { source: book.source })} className="inline-flex h-11 w-11 items-center justify-center border-2 border-ink font-sans font-bold text-ink hover:bg-ink hover:text-parchment">↗</a>
    </li>
  );
  const aba = (ativa: boolean) => `min-h-11 cursor-pointer border-2 border-ink px-4 font-sans text-sm font-semibold ${ativa ? "bg-ink text-parchment" : "bg-folha text-ink hover:text-prelo-texto"}`;
  const rotulos = { pause: s.carouselPause, play: s.carouselPlay, all: s.allWorks };

  return (
    <div className="flex flex-col gap-14 max-md:gap-10">
      {/* A busca do acervo, grande, no alto: filtra enquanto se digita. */}
      <div role="search" className="flex flex-wrap items-stretch gap-4">
        <span className="relative flex min-w-0 flex-1 basis-[20rem] shadow-[6px_6px_0_var(--sombra)]">
          <Selo nome="lupa" className="pointer-events-none absolute top-1/2 left-4 h-6 w-6 -translate-y-1/2 text-ink" />
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLimite(POR_VEZ); if (e.target.value) setLista(true); }}
            aria-label={s.searchLabel}
            placeholder={s.searchPlaceholder}
            className="min-w-0 flex-1 border-2 border-ink bg-folha py-4 pr-4 pl-14 font-sans text-lg text-ink outline-none placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </span>
        <button type="button" className="botao botao-papel min-h-[3.75rem] max-sm:w-full" onClick={surpresa}>
          <Selo nome="dado" className="h-6 w-6" />
          {s.surprise}
        </button>
      </div>

      {!lista ? (
        <>
          {/* A vitrine fica no alto: os livros passam sozinhos e param com o mouse em cima. */}
          <Carrossel titulo={s.newTitle} vermelha obras={novidades.map((id) => porId.get(id)).filter((b): b is Book => Boolean(b))} rotulo={rotulos} />
          <Carrossel titulo={s.startTitle} obras={books.filter((b) => (essential as readonly string[]).includes(b.area) && b.license === "Domínio público")} rotulo={rotulos} />
          <Carrossel titulo={s.pdTitle} vermelha obras={hidratado ? doDia(books.filter((b) => b.license === "Domínio público"), 240) : books.filter((b) => b.license === "Domínio público").slice(0, 240)} verTodas={() => abrirLista({ license: "Domínio público" })} rotulo={rotulos} />

          <section aria-label={s.areasTitle}>
            <Tarja titulo={s.areasTitle} />
            <div className="mt-7 flex flex-col gap-9">
              {groups.map((g) => {
                const areas = g.areas.filter((a) => (porArea.get(a) ?? 0) > 0);
                return areas.length > 0 && (
                  <div key={g.id}>
                    <p className="rotulo">{t.groups[g.id]}</p>
                    <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {areas.map((a) => (
                        <li key={a}>
                          <button type="button" onClick={() => abrirLista({ area: a })} className="sobe flex min-h-[4.25rem] w-full cursor-pointer items-stretch border-2 border-ink bg-folha text-left text-ink shadow-[4px_4px_0_var(--sombra)]">
                            {/* A lombada do livro da coleção, na cor da área. */}
                            <span aria-hidden className="flex w-8 shrink-0 items-center justify-center border-r-2 border-ink" style={{ background: tomDe(a) }}>
                              <svg viewBox="33 9 54 53" className="h-3 w-3" fill="#d4a24c"><polygon points="60,10 66.29,29.35 86.63,29.35 70.17,41.31 76.46,60.65 60,48.7 43.54,60.65 49.83,41.31 33.37,29.35 53.71,29.35" /></svg>
                            </span>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3.5 py-2">
                              <span className="font-serif text-lg font-semibold leading-tight">{t.areas[a][0]}</span>
                              <span className="shrink-0 font-mono text-sm font-medium text-prelo-texto" aria-label={plural(lang, porArea.get(a) ?? 0, t.common.works)}>{porArea.get(a)}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {minhas.length > 0 && (
            <section aria-label={s.mineTitle}>
              <Tarja titulo={s.mineTitle} conta={minhas.length} vermelha>
                <button type="button" className="botao botao-papel botao-menor min-h-11" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(estante, null, 2)], { type: "application/json" })); a.download = "minha-estante.json"; a.click(); }}>
                  <Selo nome="baixar" className="h-4 w-4" />
                  {s.shelfExport}
                </button>
                <button type="button" className="botao botao-papel botao-menor min-h-11" onClick={() => importar.current?.click()}>{s.shelfImport}</button>
                <input ref={importar} type="file" accept="application/json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f || f.size > 200_000) return; try { const d = JSON.parse(await f.text()) as Record<string, string>; const ok: Estante = {}; for (const [k, v] of Object.entries(d)) if (porId.has(k) && (v === "want" || v === "reading" || v === "read")) ok[k] = v; guardarEstante({ ...estante, ...ok }); } catch { /* arquivo inválido */ } }} />
              </Tarja>
              <ul className="mt-6 grid gap-4 font-sans text-sm lg:grid-cols-2">
                {minhas.map((b) => (
                  <li key={b.id} className="cartao flex items-center gap-4 p-3">
                    <CapaDoLivro book={b} pequena />
                    <span className="min-w-0 flex-1">
                      <L href={`/acervo/${b.id}`} className="font-serif text-lg font-semibold leading-tight text-ink hover:underline hover:decoration-[#c21f16]">{b.title}</L>
                      <span className="block text-ink-soft">{b.author}</span>
                    </span>
                    <select value={estante[b.id]} aria-label={b.title} onChange={(e) => guardarEstante({ ...estante, [b.id]: e.target.value as Estado })} className={`${field} font-mono text-xs uppercase`}>
                      <option value="want">{s.want}</option>
                      <option value="reading">{s.reading}</option>
                      <option value="read">{s.read}</option>
                    </select>
                    <button type="button" aria-label={s.shelfRemove} title={s.shelfRemove} className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-2 border-ink hover:text-prelo-texto" onClick={() => { const n = { ...estante }; delete n[b.id]; guardarEstante(n); }}>
                      <Selo nome="lixeira" className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-4 max-w-2xl font-sans text-sm text-ink-soft">{s.shelfNote}</p>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="botao botao-tinta px-7 py-4 text-base" onClick={() => abrirLista()}>{fill(s.seeAll, { n: books.length })} →</button>
            <L href="/contribuir?tipo=obra" className="botao botao-papel px-6 py-4 text-base">{s.suggest}</L>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="pont flex flex-wrap items-center gap-3 border-2 border-ink p-4 font-sans text-sm sm:p-5">
            <button type="button" className="botao botao-papel botao-menor min-h-11" onClick={() => { setLista(false); setArea(""); setLicense(""); setQuery(""); }}>{s.backShelves}</button>
            <select value={area} onChange={(e) => { setArea(e.target.value); setLimite(POR_VEZ); }} aria-label={s.area} className={`${field} max-sm:w-full`}>
              <option value="">{s.allAreas}</option>
              {areaSlugs.filter((a) => (porArea.get(a) ?? 0) > 0).map((slug) => <option key={slug} value={slug}>{t.areas[slug][0]} ({porArea.get(slug)})</option>)}
            </select>
            <select value={license} onChange={(e) => { setLicense(e.target.value); setLimite(POR_VEZ); }} aria-label={s.license} className={`${field} max-sm:w-full`}>
              <option value="">{s.allLicenses}</option>
              {licenses.map((l) => <option key={l} value={l}>{licenseName(t, l)} ({books.filter((b) => b.license === l && (!area || b.area === area)).length})</option>)}
            </select>
            {(area || license || query) && <button type="button" className="min-h-11 cursor-pointer px-1 font-semibold underline decoration-2 underline-offset-4 hover:text-prelo-texto" onClick={() => { setArea(""); setLicense(""); setQuery(""); setLimite(POR_VEZ); }}>{s.clear}</button>}
            <span className="ml-auto flex" role="group" aria-label={`${s.viewCards} / ${s.viewList}`}>
              <button type="button" aria-pressed={vista === "cartoes"} onClick={() => alternarVista("cartoes")} className={aba(vista === "cartoes")}>{s.viewCards}</button>
              <button type="button" aria-pressed={vista === "lista"} onClick={() => alternarVista("lista")} className={`${aba(vista === "lista")} -ml-0.5`}>{s.viewList}</button>
            </span>
          </div>
          <p role="status" className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">{fill(s.showing, { a: mostrando.length, b: results.length })}{fromCatalog.length > 0 ? ` · +${plural(lang, fromCatalog.length, t.common.works)}` : ""}</p>
          {mostrando.length > 0 && (vista === "cartoes" ? <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">{mostrando.map(cartao)}</div> : <ul className="border-t-2 border-ink font-sans text-sm">{mostrando.map(linha)}</ul>)}
          {results.length > mostrando.length && (
            <p className="mt-2 text-center">
              <button type="button" className="botao botao-tinta" onClick={() => setLimite((n) => n + POR_VEZ)}>{s.loadMore} ({results.length - mostrando.length})</button>
            </p>
          )}
          {fromCatalog.length > 0 && (
            <section aria-label={s.catalogTitle} className="mt-8">
              <Tarja titulo={s.catalogTitle} conta={fromCatalog.length} />
              <p className="mt-4 max-w-3xl text-lg leading-snug text-ink-soft">{s.catalogLead}</p>
              <ul className="cartao mt-6 gap-8 p-5 font-sans text-sm sm:p-6 lg:columns-2">
                {fromCatalog.map((entry) => (
                  <li key={entry.u} className="break-inside-avoid border-b-[1.5px] border-rule py-2.5">
                    <a href={entry.u} target="_blank" rel="noopener noreferrer" className="font-serif text-base font-semibold text-ink underline decoration-rule underline-offset-4 hover:decoration-[#c21f16]">{entry.t} ↗</a>
                    <span className="block text-ink-soft">{entry.a} · {entry.i} · {entry.f}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.length + fromCatalog.length === 0 && (
            <div className="cartao-v p-7">
              <p className="font-serif text-2xl leading-snug">{s.nothing}</p>
              <p className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="botao botao-papel" onClick={() => { setArea(""); setLicense(""); setLimite(POR_VEZ); }}>{s.clear}</button>
                <L href="/contribuir?tipo=obra" className="botao botao-prelo">{s.suggest}</L>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
