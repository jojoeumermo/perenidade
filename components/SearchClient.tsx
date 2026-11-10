// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fill, localePath, plural } from "@/i18n/config";
import synonyms from "@/content/busca.json";
import { buildSearch, type SearchEntry } from "@/lib/search";
import { BuscaPorVoz } from "./busca/BuscaPorVoz";
import { MelhorCaminho } from "./busca/MelhorCaminho";
import { useTextosDaBusca } from "./busca/TextosDaBusca";
import { L, useI18n } from "./I18n";
import { ConviteDoHistorico, VistasHoje } from "./PorOndeAndei";

/** Quantos resultados cada grupo mostra antes do "ver todos". */
const POR_GRUPO = 5;
const ORDEM_DOS_TIPOS = ["pagina", "trilha", "aula", "obra", "autor", "verbete", "materia", "memorial", "checagem", "debate", "pergunta", "falacia"];
const ordemDoTipo = (tipo: string) => (ORDEM_DOS_TIPOS.includes(tipo) ? ORDEM_DOS_TIPOS.indexOf(tipo) : ORDEM_DOS_TIPOS.length);
const chip = (ativo: boolean) => `cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold ${ativo ? "bg-ink text-parchment" : "bg-parchment hover:border-oxblood hover:text-oxblood"}`;

export function SearchClient() {
  const { lang, t } = useI18n();
  const textosDaBusca = useTextosDaBusca();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(localePath(lang, "/indice.json"))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<SearchEntry[]>;
      })
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const search = useMemo(() => (entries ? buildSearch(entries, synonyms) : null), [entries]);
  const hits = search ? search(query) : [];
  const typed = query.trim().length > 0;
  // "pagina" (E4-05) não tem nome no núcleo do i18n: usa o dos textos da busca.
  const kinds: Record<string, string> = { pagina: textosDaBusca?.textos.indice.grupo ?? "", ...(t.search.kinds as Record<string, string>) };
  const [filtro, setFiltro] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  // Os grupos na ordem do que mais se procura; tipos novos que apareçam vão para o fim, sem sumir.
  const grupos = useMemo(() => {
    const porTipo = new Map<string, typeof hits>();
    for (const hit of hits) porTipo.set(hit.entry.kind, [...(porTipo.get(hit.entry.kind) ?? []), hit]);
    return [...porTipo.entries()].sort(([a], [b]) => ordemDoTipo(a) - ordemDoTipo(b));
  }, [hits]);
  // Um filtro de um tipo que não aparece nesta busca volta para "Tudo".
  const filtroAtivo = grupos.some(([kind]) => kind === filtro) ? filtro : "";

  return (
    <>
      <div role="search" className="mt-8 flex border-2 border-ink bg-parchment-deep">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.search.label}
          placeholder={t.search.placeholder}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft"
        />
        {/* Etapa 4 (E4-05): o microfone. A busca do celular chega a esta página, então ele fica aqui também. */}
        <BuscaPorVoz aoOuvir={(texto) => setQuery(texto)} className="self-center pr-1" />
      </div>

      <p role="status" className="mt-6 font-mono text-xs text-ink-soft">
        {failed
          ? t.search.failed
          : !entries
            ? t.search.loading
            : typed
              ? plural(lang, hits.length, t.search.results)
              : fill(t.search.indexSize, { n: entries.length })}
      </p>

      {entries && typed && <MelhorCaminho consulta={query} entradas={entries} />}
      {!typed && (
        <>
          <VistasHoje className="mt-6" />
          <ConviteDoHistorico className="mt-6" />
        </>
      )}

      {/* Em tópicos (09/11/2026): os resultados vêm agrupados pelo tipo (aulas, obras, jornal...), na mesma ordem de
          relevância dentro de cada grupo. Os filtros no alto mostram um tipo só; cada grupo mostra os 5 primeiros e abre
          o resto no "ver todos". */}
      {typed && grupos.length > 1 && (
        <div role="group" aria-label={t.search.label} className="mt-4 flex flex-wrap gap-2 font-sans text-sm">
          <button type="button" aria-pressed={filtroAtivo === ""} onClick={() => setFiltro("")} className={chip(filtroAtivo === "")}>
            {textosDaBusca?.textos.indice.todos ?? "Tudo"} <span className="font-mono text-xs">{hits.length}</span>
          </button>
          {grupos.map(([kind, lista]) => (
            <button key={kind} type="button" aria-pressed={filtroAtivo === kind} onClick={() => setFiltro(kind)} className={chip(filtroAtivo === kind)}>
              {kinds[kind] || kind} <span className="font-mono text-xs">{lista.length}</span>
            </button>
          ))}
        </div>
      )}
      {grupos
        .filter(([kind]) => !filtroAtivo || filtroAtivo === kind)
        .map(([kind, lista]) => {
          const tudo = Boolean(filtroAtivo) || abertos.has(kind);
          const vistos = tudo ? lista : lista.slice(0, POR_GRUPO);
          return (
            <section key={kind} className="mt-8" aria-labelledby={`busca-grupo-${kind}`}>
              <h2 id={`busca-grupo-${kind}`} className="flex items-baseline gap-3 border-b-2 border-ink pb-1.5 font-serif text-2xl font-semibold">
                {kinds[kind] || kind}
                <span className="font-mono text-xs font-normal text-ink-soft">{lista.length}</span>
              </h2>
              <ul className="divide-y divide-rule">
                {vistos.map(({ entry, snippet }) => (
                  <li key={entry.href}>
                    <L href={entry.href} className="group block py-4">
                      {(entry.area || entry.context) && <p className="font-mono text-xs text-gold">{[entry.area, entry.context].filter(Boolean).join(" · ")}</p>}
                      <p className="mt-1 text-xl font-semibold group-hover:text-oxblood">{entry.title}</p>
                      <p className="mt-1 line-clamp-2 text-ink-soft">{snippet}</p>
                    </L>
                  </li>
                ))}
              </ul>
              {!tudo && lista.length > POR_GRUPO && (
                <button type="button" onClick={() => setAbertos((a) => new Set(a).add(kind))} className="mt-2 cursor-pointer font-sans text-sm font-semibold text-oxblood underline underline-offset-4 hover:text-ink">
                  {fill(textosDaBusca?.textos.indice.verTodos ?? "Ver todos ({n})", { n: lista.length })}
                </button>
              )}
            </section>
          );
        })}
      {entries && typed && hits.length === 0 && (
        <p className="mt-8 text-xl text-ink-soft">
          {fill(t.search.nothingFor, { q: query.trim() })}{" "}
          <L href="/contribuir" className="underline hover:text-oxblood">{t.search.canContribute}</L>.
        </p>
      )}
    </>
  );
}
