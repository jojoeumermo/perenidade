// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Ícones de traço, no estilo dos de components/celular/Atalhos.tsx, para as aulas de alfabetização (ícone primeiro, texto
// depois): quem lê pouco reconhece o desenho antes da palavra. São só desenho: o nome do botão fica no texto ao lado e no
// aria-label, nunca só no ícone.

function Traco({ children }: { children: React.ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const IconeMicrofone = () => (
  <Traco>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Traco>
);
export const IconeParar = () => (
  <Traco>
    <rect x="7" y="7" width="10" height="10" rx="1" />
  </Traco>
);
export const IconeLixeira = () => (
  <Traco>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Traco>
);
export const IconeSeta = () => (
  <Traco>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Traco>
);
export const IconeRefazer = () => (
  <Traco>
    <path d="M4 12a8 8 0 1 1 3 6.2M4 19v-5h5" />
  </Traco>
);
export const IconeCerto = () => (
  <Traco>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Traco>
);
export const IconeErrado = () => (
  <Traco>
    <path d="M6 6l12 12M18 6L6 18" />
  </Traco>
);
export const IconeBalao = () => (
  <Traco>
    <path d="M4 5h16v11H9l-5 4z" />
  </Traco>
);
