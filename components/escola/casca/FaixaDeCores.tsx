// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** A faixa de cores do alto (a mesma das pranchas), decorativa. */
const FAIXA: [number, string][] = [
  [5, "#C21F16"],
  [2, "#F0B323"],
  [3, "#23408E"],
  [1, "#F3EFE6"],
  [4, "#2E6B4F"],
  [2, "#E4577F"],
  [3, "#EA7A24"],
  [3, "#1F8A85"],
  [2, "#F0B323"],
  [4, "#C21F16"],
];

export function FaixaDeCores() {
  return (
    <div aria-hidden className="ef-faixa">
      {FAIXA.map(([flex, cor], i) => (
        <span key={i} style={{ flex, background: cor }} />
      ))}
    </div>
  );
}

/** A estrela da Escola (contorno ouro). */
export function Estrela({ tamanho, traco = 3.4, cheia = false, className }: { tamanho: number; traco?: number; cheia?: boolean; className?: string }) {
  return (
    <svg aria-hidden width={tamanho} height={tamanho} viewBox="0 0 56 56" className={className}>
      <path
        d="M28 6l6.2 14.6 15.8 1.3-12 10.4 3.7 15.5L28 39.6l-13.7 8.2 3.7-15.5-12-10.4 15.8-1.3z"
        fill={cheia ? "#F2C94C" : "none"}
        stroke={cheia ? "none" : "#F2C94C"}
        strokeWidth={traco}
        strokeLinejoin="round"
      />
    </svg>
  );
}
