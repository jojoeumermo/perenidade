// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** Espaço reservado enquanto carrega: linhas que pulsam (e ficam paradas com "menos movimento"). */
export function Esqueleto({ linhas = 3, rotulo = "Carregando" }: { linhas?: number; rotulo?: string }) {
  return (
    <div role="status" aria-busy="true" style={{ display: "grid", gap: "0.6rem" }}>
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} aria-hidden className="pn-esqueleto" style={{ width: i === linhas - 1 ? "60%" : "100%" }} />
      ))}
      <span className="sr-only">{rotulo}</span>
    </div>
  );
}
