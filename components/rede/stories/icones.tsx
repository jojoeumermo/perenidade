// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Os ícones dos stories (traço das pranchas). Todos decorativos: quem os usa põe o nome no botão (aria-label).

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconeMais = () => (
  <svg {...base} strokeWidth={3.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconeFechar = () => (
  <svg {...base}>
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
);
export const IconeOlhoRiscado = () => (
  <svg {...base} strokeWidth={1.8}>
    <path d="M3 12s3.5-6 9-6c1.6 0 3 .5 4.2 1.2M21 12s-3.5 6-9 6c-1.6 0-3-.5-4.2-1.2" />
    <path d="M9.9 14.1A3 3 0 0 1 14.1 9.9" />
    <path d="M4 4l16 16" />
  </svg>
);
export const IconePausar = () => (
  <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
    <rect x="6" y="4.5" width="4.2" height="15" rx="1.2" />
    <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" />
  </svg>
);
export const IconeTocar = () => (
  <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
    <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z" />
  </svg>
);
export const IconeTresPontos = () => (
  <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
    <circle cx="12" cy="5" r="2.1" />
    <circle cx="12" cy="12" r="2.1" />
    <circle cx="12" cy="19" r="2.1" />
  </svg>
);
export const IconeSetaEsq = () => (
  <svg {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconeSetaDir = () => (
  <svg {...base}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const IconeLinkFora = () => (
  <svg {...base}>
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);
