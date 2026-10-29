// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { type Locale, localePath, plural } from "@/i18n/config";
import type { SearchEntry, SearchHit } from "@/lib/search";
import { useI18n } from "./I18n";

/** Abre a busca do alto de qualquer lugar (a tecla "/" usa isto quando ela está à vista). */
export const ABRIR_BUSCA = "lucia:abrir-busca";

/** A busca do alto está à vista nesta tela? (no celular e no aplicativo ela não aparece) */
export const buscaDoTopoVisivel = () => {
  const caixa = document.querySelector<HTMLElement>(".busca-do-topo");
  return Boolean(caixa && caixa.offsetParent !== null);
};

type Buscador = (consulta: string, limite?: number) => SearchHit[];
let buscadorPronto: Promise<Buscador> | null = null;

/** Baixa o índice leve uma vez por página aberta e monta o buscador (o mesmo motor da página de busca). */
function carregarBuscador(lang: Locale): Promise<Buscador> {
  buscadorPronto ??= Promise.all([
    fetch(localePath(lang, "/indice-leve.json")).then((resposta) => {
      if (!resposta.ok) throw new Error(String(resposta.status));
      return resposta.json() as Promise<SearchEntry[]>;
    }),
    import("@/lib/search"),
    import("@/content/busca.json"),
  ]).then(([entradas, { buildSearch }, sinonimos]) => buildSearch(entradas, (sinonimos as { default?: Record<string, string> }).default ?? (sinonimos as unknown as Record<string, string>)));
  buscadorPronto.catch(() => {
    buscadorPronto = null;
  });
  return buscadorPronto;
}

const MAXIMO = 8;

/**
 * O campo "Buscar" do alto, no computador. Um clique e ele se alonga ali mesmo, sobre o espaço vazio do cabeçalho;
 * os resultados aparecem logo abaixo enquanto se digita, sem abrir outra página. Setas escolhem, Enter abre, Esc
 * fecha. Sem JavaScript, ele continua sendo o link para a página de busca.
 */
export function BuscaDoTopo() {
  const { lang, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const aberta = abertaEm === pathname;
  const [largura, setLargura] = useState<number | null>(null);
  const [consulta, setConsulta] = useState("");
  const [buscador, setBuscador] = useState<Buscador | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useId();

  const abrir = () => {
    // Até onde dá para crescer sem cobrir o nome do instituto (o subtítulo miúdo fica por baixo enquanto se busca).
    const fim = caixa.current?.getBoundingClientRect().right ?? 0;
    const marca = document.querySelector(".cabecalho-site .marca-nome")?.getBoundingClientRect().right ?? 0;
    setLargura(Math.max(caixa.current?.offsetWidth ?? 240, Math.min(640, fim - marca - 28)));
    setAbertaEm(pathname);
    setFalhou(false);
    carregarBuscador(lang)
      .then((pronto) => setBuscador(() => pronto))
      .catch(() => setFalhou(true));
    window.setTimeout(() => campo.current?.focus(), 20);
  };
  const fechar = () => {
    setAbertaEm(null);
    setConsulta("");
    setMarcado(0);
  };

  useEffect(() => {
    const deFora = () => abrir();
    window.addEventListener(ABRIR_BUSCA, deFora);
    return () => window.removeEventListener(ABRIR_BUSCA, deFora);
  });

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberta]);

  // Todos os achados contam no total; só os primeiros aparecem na lista (o resto está em "Ver todos os resultados").
  const achados = buscador && consulta.trim() ? buscador(consulta, 500) : [];
  const resultados = achados.slice(0, MAXIMO);
  const tipos = t.search.kinds as Record<string, string>;
  const todos = `${localePath(lang, "/busca")}?q=${encodeURIComponent(consulta.trim())}`;
  const ir = (href: string) => {
    fechar();
    router.push(href);
  };

  return (
    <div ref={caixa} className="relative h-11 w-[15rem] shrink-0 xl:w-[17rem]">
      {!aberta ? (
        <Link
          href={localePath(lang, "/busca")}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            abrir();
          }}
          aria-label={t.nav.search}
          aria-keyshortcuts="/"
          className="busca-do-topo absolute inset-y-0 right-0 flex w-full items-center gap-2.5 border-2 border-ink bg-folha px-3 font-sans text-[0.95rem] text-ink-soft hover:text-ink"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-ink" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 20 20" />
          </svg>
          <span className="flex-1">{t.nav.search}</span>
          <kbd aria-hidden className="border border-rule px-1.5 py-px font-mono text-[0.7rem] text-ink-soft">/</kbd>
        </Link>
      ) : (
        <div style={{ width: largura ?? undefined }} className="busca-do-topo busca-aberta absolute inset-y-0 right-0 z-50">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const escolhido = resultados[marcado] ?? resultados[0];
              if (escolhido) ir(localePath(lang, escolhido.entry.href));
              else if (consulta.trim()) ir(todos);
            }}
            className="flex h-11 items-center gap-2.5 border-2 border-ink bg-folha px-3 shadow-[4px_4px_0_var(--prelo)]"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-ink" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 20 20" />
            </svg>
            <input
              ref={campo}
              type="text"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              value={consulta}
              maxLength={120}
              onChange={(e) => {
                setConsulta(e.target.value);
                setMarcado(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  fechar();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMarcado((m) => Math.min(m + 1, Math.max(resultados.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMarcado((m) => Math.max(m - 1, 0));
                }
              }}
              role="combobox"
              aria-expanded={resultados.length > 0}
              aria-controls={lista}
              aria-activedescendant={resultados.length > 0 ? `${lista}-${marcado}` : undefined}
              aria-autocomplete="list"
              aria-label={t.search.label}
              placeholder={t.nav.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent font-sans text-[0.98rem] text-ink outline-none placeholder:text-ink-soft"
            />
            <button type="button" onClick={fechar} aria-label={t.nav.searchClose} className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center text-ink-soft hover:text-ink">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </form>

          <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] min-w-[22rem] border-2 border-ink bg-folha shadow-[6px_6px_0_var(--prelo)]">
            <p role="status" className="border-b border-rule px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink-soft">
              {falhou ? t.search.failed : !buscador ? t.search.loading : !consulta.trim() ? t.nav.searchTyping : resultados.length === 0 ? t.nav.searchNothing.replace("{q}", consulta.trim()) : plural(lang, achados.length, t.search.results)}
            </p>
            {resultados.length > 0 && (
              <ul id={lista} role="listbox" aria-label={t.search.label} className="max-h-[min(26rem,60vh)] overflow-y-auto">
                {resultados.map(({ entry, snippet }, i) => (
                  <li key={entry.href} id={`${lista}-${i}`} role="option" aria-selected={i === marcado}>
                    <Link
                      href={localePath(lang, entry.href)}
                      onClick={fechar}
                      onPointerEnter={() => setMarcado(i)}
                      className={`block border-b border-rule px-4 py-2.5 text-ink last:border-b-0 hover:text-ink ${i === marcado ? "bg-[color-mix(in_srgb,var(--prelo)_9%,transparent)]" : ""}`}
                    >
                      <span className="block font-mono text-[0.66rem] uppercase tracking-[0.1em] text-prelo-texto">{[tipos[entry.kind], entry.area, entry.context].filter(Boolean).join(" · ")}</span>
                      <span className="mt-0.5 block font-serif text-[1.12rem] font-semibold leading-snug">{entry.title}</span>
                      {snippet && <span className="mt-0.5 block truncate font-sans text-[0.82rem] text-ink-soft">{snippet}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {consulta.trim() && (
              <Link href={todos} onClick={fechar} className="flex items-center justify-between border-t-2 border-ink px-4 py-2.5 font-sans text-sm font-bold text-ink hover:bg-ink hover:text-parchment">
                {t.nav.searchAll} <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
