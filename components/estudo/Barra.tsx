// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** Uma barra de progresso discreta, sem nota: só mostra quanto do caminho já foi feito. */
export function Barra({ feito, total, rotulo }: { feito: number; total: number; rotulo: string }) {
  const pct = total ? Math.round((feito / total) * 100) : 0;
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo} className="h-1.5 bg-rule">
      <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
    </div>
  );
}
