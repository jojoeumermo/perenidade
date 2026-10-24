// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os sinais pequenos das páginas da comunidade e do instituto, em traço (no lugar de ✓, ✕, ▲, ↗ e companhia): leves,
// na cor do texto, iguais em qualquer aparelho e nos dois temas.

const caminhos = {
  mais: "M12 5v14M5 12h14",
  fechar: "M6 6l12 12M18 6L6 18",
  certo: "M5 12.5l4.5 4.5L19 7.5",
  sobe: "M12 5l7 9H5z",
  fora: "M9 5h10v10M19 5L6 18",
  seta: "M5 12h14M13 6l6 6-6 6",
  volta: "M19 12H5M11 6l-6 6 6 6",
  cartoes: "M4 4h16v7H4zM4 14h16v6H4z",
  compacto: "M4 6h16M4 12h16M4 18h16",
  menos: "M5 12h14",
} as const;

export type Traco = keyof typeof caminhos;

export function Traco({ nome, className = "h-4 w-4", cheio = false }: { nome: Traco; className?: string; cheio?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
      <path d={caminhos[nome]} />
    </svg>
  );
}
