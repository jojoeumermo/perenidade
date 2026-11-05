// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

export type FormaDoEsqueleto = "linhas" | "cartoes" | "tabela" | "fila";

/**
 * Espaço reservado enquanto carrega, na forma do que vem (linhas, cartões, tabela ou fila). O brilho para com "menos
 * movimento" e no modo leve.
 */
export function Esqueleto({ linhas = 3, rotulo = "Carregando", forma = "linhas" }: { linhas?: number; rotulo?: string; forma?: FormaDoEsqueleto }) {
  const vezes = Array.from({ length: linhas }, (_, i) => i);
  return (
    <div role="status" aria-busy="true" style={{ display: "grid", gap: "0.6rem" }}>
      {forma === "cartoes" ? (
        <div className="pn-esqueleto-grade">
          {vezes.map((i) => (
            <span key={i} aria-hidden className="pn-esqueleto-cartao" />
          ))}
        </div>
      ) : forma === "tabela" ? (
        <div className="pn-tabela-caixa" style={{ display: "grid", gap: "0.7rem", padding: "0.8rem" }}>
          <span aria-hidden className="pn-esqueleto" style={{ width: "40%", height: "0.7rem" }} />
          {vezes.map((i) => (
            <span key={i} aria-hidden className="pn-esqueleto" />
          ))}
        </div>
      ) : forma === "fila" ? (
        <div className="pn-fila" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="pn-fila-lista" style={{ padding: "0.8rem", gap: "0.9rem" }}>
            {vezes.map((i) => (
              <span key={i} aria-hidden style={{ display: "grid", gap: "0.35rem" }}>
                <span className="pn-esqueleto" style={{ width: "70%" }} />
                <span className="pn-esqueleto" style={{ width: "40%", height: "0.65rem" }} />
              </span>
            ))}
          </div>
        </div>
      ) : (
        vezes.map((i) => <span key={i} aria-hidden className="pn-esqueleto" style={{ width: i === linhas - 1 ? "60%" : "100%" }} />)
      )}
      <span className="sr-only">{rotulo}</span>
    </div>
  );
}
