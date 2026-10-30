// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { type Locale, fill, localePath } from "@/i18n/config";
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

/** Tira acento e maiúscula letra por letra, para achar o trecho digitado no título sem perder a posição de cada letra. */
const dobrar = (letra: string) => letra.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** O título com o trecho procurado marcado (a palavra mais comprida da consulta que aparece nele). */
function marcar(titulo: string, consulta: string): ReactNode {
  const letras = [...titulo];
  const dobradas = letras.map(dobrar);
  if (dobradas.some((d) => d.length !== 1)) return titulo;
  const texto = dobradas.join("");
  const palavras = dobrar(consulta)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const palavra of palavras) {
    const em = texto.indexOf(palavra);
    if (em < 0) continue;
    return (
      <>
        {letras.slice(0, em).join("")}
        <mark className="busca-marca">{letras.slice(em, em + palavra.length).join("")}</mark>
        {letras.slice(em + palavra.length).join("")}
      </>
    );
  }
  return titulo;
}

function Lupa({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/**
 * O campo "Buscar" do alto, no computador: calmo, de borda fina, que só ganha a borda de tinta quando recebe o cursor.
 * Um clique (ou a tecla "/") e ele se alonga ali mesmo; os resultados aparecem logo abaixo enquanto se digita,
 * agrupados por tipo. Setas escolhem, Enter abre, Esc fecha. Sem JavaScript, ele continua sendo o link para a página de busca.
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
    setLargura(Math.max(caixa.current?.offsetWidth ?? 240, Math.min(560, fim - marca - 28)));
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

  // Todos os achados contam no total; só os primeiros aparecem, agrupados por tipo na ordem em que o primeiro de cada
  // tipo apareceu (o resto está em "Ver os N resultados"). A ordem de teclado segue a ordem da tela.
  const achados = buscador && consulta.trim() ? buscador(consulta, 500) : [];
  const grupos: { kind: SearchEntry["kind"]; itens: SearchHit[] }[] = [];
  for (const achado of achados.slice(0, MAXIMO)) {
    const grupo = grupos.find((g) => g.kind === achado.entry.kind);
    if (grupo) grupo.itens.push(achado);
    else grupos.push({ kind: achado.entry.kind, itens: [achado] });
  }
  const resultados = grupos.flatMap((g) => g.itens);
  const nomesDosGrupos = t.nav.searchGroups as Record<string, string>;
  const todos = `${localePath(lang, "/busca")}?q=${encodeURIComponent(consulta.trim())}`;
  const formas = t.nav.searchSeeN as Record<string, string>;
  const verTodos = fill(formas[new Intl.PluralRules(lang).select(achados.length)] ?? formas.other, { n: achados.length });
  const ir = (href: string) => {
    fechar();
    router.push(href);
  };
  const aviso = falhou ? t.search.failed : !buscador ? t.search.loading : !consulta.trim() ? t.nav.searchTyping : resultados.length === 0 ? t.nav.searchNothing.replace("{q}", consulta.trim()) : "";
  let posicao = -1;

  return (
    <div ref={caixa} className="relative h-10 w-[15rem] shrink-0 xl:w-[17rem]">
      {!aberta ? (
        <Link
          href={localePath(lang, "/busca")}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            abrir();
          }}
          aria-label={`${t.nav.search}: ${t.nav.searchPlaceholder}`}
          aria-keyshortcuts="/"
          className="busca-do-topo busca-campo absolute inset-y-0 right-0 flex w-full items-center gap-2.5 px-3 font-sans text-[0.94rem] text-ink-soft hover:text-ink"
        >
          <Lupa className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{t.nav.searchPlaceholder}</span>
          <kbd aria-hidden className="busca-tecla">/</kbd>
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
            className="busca-campo busca-campo-aberto flex h-10 items-center gap-2.5 px-3"
          >
            <Lupa className="h-4 w-4 shrink-0 text-ink" />
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
              className="min-w-0 flex-1 bg-transparent font-sans text-[0.95rem] text-ink outline-none placeholder:text-ink-soft"
            />
            <button type="button" onClick={fechar} aria-label={t.nav.searchClose} className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center text-ink-soft hover:text-ink">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </form>

          <div className="busca-lista absolute inset-x-0 top-[calc(100%+0.375rem)] min-w-[24rem]">
            <p role="status" aria-live="polite" className={aviso ? "px-3.5 py-3 font-sans text-sm text-ink-soft" : "sr-only"}>
              {aviso || verTodos}
            </p>
            {resultados.length > 0 && (
              <ul id={lista} role="listbox" aria-label={t.search.label} className="max-h-[min(28rem,62vh)] overflow-y-auto py-2">
                {grupos.map((grupo) => (
                  <Fragment key={grupo.kind}>
                    <li role="presentation" aria-hidden className="busca-grupo px-3.5 pt-2.5 pb-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft first:pt-1">
                      {nomesDosGrupos[grupo.kind] ?? grupo.kind}
                    </li>
                    {grupo.itens.map(({ entry }) => {
                      posicao += 1;
                      const i = posicao;
                      const ativo = i === marcado;
                      return (
                        <li key={entry.href} id={`${lista}-${i}`} role="option" aria-selected={ativo} aria-label={`${nomesDosGrupos[entry.kind] ?? ""}: ${entry.title}`}>
                          <Link
                            href={localePath(lang, entry.href)}
                            onClick={fechar}
                            tabIndex={-1}
                            onPointerEnter={() => setMarcado(i)}
                            className={`busca-item flex items-baseline gap-3 px-3.5 py-2 text-ink hover:text-ink ${ativo ? "busca-item-ativo" : ""}`}
                          >
                            <span className="min-w-0 flex-1 truncate font-serif text-[1.08rem] leading-snug">{marcar(entry.title, consulta)}</span>
                            {(entry.area || entry.context) && <small className="max-w-[45%] shrink-0 truncate font-sans text-xs text-ink-soft">{[entry.area, entry.context].filter(Boolean).join(" · ")}</small>}
                          </Link>
                        </li>
                      );
                    })}
                  </Fragment>
                ))}
              </ul>
            )}
            {consulta.trim() && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-3.5 pt-2.5 pb-2 font-sans text-xs text-ink-soft">
                <span aria-hidden>
                  <kbd className="busca-tecla">↑</kbd> <kbd className="busca-tecla">↓</kbd> {t.nav.searchPick}
                </span>
                <span aria-hidden>
                  <kbd className="busca-tecla">Enter</kbd> {t.nav.searchGo}
                </span>
                <span aria-hidden>
                  <kbd className="busca-tecla">Esc</kbd> {t.nav.searchShut}
                </span>
                <Link href={todos} onClick={fechar} className="ml-auto font-semibold text-ink underline-offset-4 hover:text-prelo-texto hover:underline">
                  {achados.length > 0 ? verTodos : t.nav.searchAll} <span aria-hidden>→</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
