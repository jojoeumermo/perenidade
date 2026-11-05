// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { type ReactNode, useState } from "react";
import { Botao } from "./Botao";
import { Vazio } from "./Vazio";

const simples = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * A tabela do painel (TanStack Table): ordem por coluna, busca de texto sem acento, páginas. Sem dado, mostra o estado vazio.
 * "legenda" é obrigatória (leitor de tela); "busca" liga a caixa de busca; "porPagina" liga a paginação.
 */
export function Tabela<T>({ dados, colunas, legenda, busca = false, porPagina, vazio, aoClicarLinha }: { dados: T[]; colunas: ColumnDef<T>[]; legenda: string; busca?: boolean; porPagina?: number; vazio?: ReactNode; aoClicarLinha?: (linha: T) => void }) {
  const [ordem, setOrdem] = useState<SortingState>([]);
  const [filtro, setFiltro] = useState("");
  // O TanStack devolve funções que o compilador do React não memoriza; aqui só se lê a tabela no mesmo render, sem repassar a filhos memorizados.
  // eslint-disable-next-line react-hooks/incompatible-library
  const tabela = useReactTable({
    data: dados,
    columns: colunas,
    state: { sorting: ordem, globalFilter: filtro },
    onSortingChange: setOrdem,
    onGlobalFilterChange: setFiltro,
    globalFilterFn: (linha, _coluna, valor: string) => {
      const termo = simples(String(valor));
      return linha.getAllCells().some((c) => simples(String(c.getValue() ?? "")).includes(termo));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(porPagina ? { getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageIndex: 0, pageSize: porPagina } } } : {}),
  });
  const linhas = tabela.getRowModel().rows;
  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      {busca && (
        <label className="pn-barra-ferramentas">
          <span className="sr-only">Buscar na tabela: {legenda}</span>
          <input type="search" className="pn-campo" style={{ maxWidth: "22rem" }} value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar" />
        </label>
      )}
      {linhas.length === 0 ? (
        (vazio ?? <Vazio titulo="Nada por aqui" texto={filtro ? "Nenhum registro com essa busca." : undefined} />)
      ) : (
        <div className="pn-tabela-caixa">
          <table className="pn-tabela">
            <caption className="sr-only">{legenda}</caption>
            <thead>
              {tabela.getHeaderGroups().map((g) => (
                <tr key={g.id}>
                  {g.headers.map((h) => {
                    const sentido = h.column.getIsSorted();
                    return (
                      <th key={h.id} scope="col" aria-sort={sentido === "asc" ? "ascending" : sentido === "desc" ? "descending" : undefined}>
                        {h.isPlaceholder ? null : h.column.getCanSort() ? (
                          <button type="button" className="pn-ordenar" onClick={h.column.getToggleSortingHandler()}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <span aria-hidden>{sentido === "asc" ? "▲" : sentido === "desc" ? "▼" : ""}</span>
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.id}
                  onClick={aoClicarLinha ? () => aoClicarLinha(l.original) : undefined}
                  // Linha clicável também abre pelo teclado (Enter ou espaço), mas não quando o foco está num botão ou campo da própria linha.
                  tabIndex={aoClicarLinha ? 0 : undefined}
                  onKeyDown={
                    aoClicarLinha
                      ? (e) => {
                          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            aoClicarLinha(l.original);
                          }
                        }
                      : undefined
                  }
                  style={aoClicarLinha ? { cursor: "pointer" } : undefined}
                >
                  {l.getVisibleCells().map((c) => (
                    <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {porPagina && tabela.getPageCount() > 1 && (
        <div className="pn-pagina-barra">
          <span>
            Página {tabela.getState().pagination.pageIndex + 1} de {tabela.getPageCount()}
          </span>
          <span className="pn-barra-ferramentas">
            <Botao pequeno onClick={() => tabela.previousPage()} disabled={!tabela.getCanPreviousPage()}>
              Anterior
            </Botao>
            <Botao pequeno onClick={() => tabela.nextPage()} disabled={!tabela.getCanNextPage()}>
              Próxima
            </Botao>
          </span>
        </div>
      )}
    </div>
  );
}

export type { ColumnDef };
