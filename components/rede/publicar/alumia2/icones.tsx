// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os ícones da cara nova (pranchas computador-inicio, celular-inicio e celular-escrever-ato): traço de 24 px, desenho próprio,
// sem biblioteca de fora. Sempre decorativos (aria-hidden): o rótulo vai em texto ou em aria-label no botão.

export const ICONES = {
  inicio: "M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5",
  explorar: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z",
  atos: "M6 21V4M6 4.5h11l-2.5 4 2.5 4H6",
  comunidades: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  nucleos: "M12 4.5a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6zM6 14a2.3 2.3 0 1 0 0 4.6A2.3 2.3 0 0 0 6 14zM18 14a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6zM10.8 8.8 7.2 14.2M13.2 8.8l3.6 5.4M8.3 16.3h7.4",
  avisos: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5h4",
  conversas: "M4 5h16v11H10l-4.5 4v-4H4z",
  salvos: "M6.5 4h11v16.5L12 16.6l-5.5 3.9z",
  perfil: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6",
  fediverso: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3z",
  escrever: "M4.5 19.5h4L19 9l-4-4L4.5 15.5zM13.5 6.5l4 4",
  mais: "M12 5v14M5 12h14",
  lupa: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.2 16.2 20.5 20.5",
  imagem: "M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 8.5h.01",
  enquete: "M6 20V11M12 20V5M18 20v-6",
  responder: "M4 5h16v11H10l-4.5 4v-4H4z",
  repostar: "M17 3.5 20 6.5l-3 3M20 6.5H8a4 4 0 0 0-4 4V11M7 20.5 4 17.5l3-3M4 17.5h12a4 4 0 0 0 4-4V13",
  acender: "M12 3c1.7 2.8 5 5 5 9.2a5 5 0 0 1-10 0c0-2.4 1.3-3.9 2.4-5 .2 1.5.9 2.6 1.9 3.1C11.1 8.4 11.4 5.6 12 3z",
  util: "M7 11v8H4v-8zM7 11l4-7c1.4 0 2.3 1 2 2.4L12.5 10H18a2 2 0 0 1 2 2.3l-1.1 5.4A2 2 0 0 1 17 19H7",
  compartilhar: "M12 15V4M8 7.5 12 3.5l4 4M5 12.5V20h14v-7.5",
  livro: "M12 6.5C10.4 5.2 8 4.5 4 4.5v14c4 0 6.4.7 8 2 1.6-1.3 4-2 8-2v-14c-4 0-6.4.7-8 2zM12 6.5v14",
  setaCima: "M12 19V5M6 11l6-6 6 6",
  visto: "M5 12.5 9.5 17 19 7",
  chevron: "M9 5.5 15.5 12 9 18.5",
  sair: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  pontos: "M5 12h.01M12 12h.01M19 12h.01",
  fechar: "M6 6l12 12M18 6 6 18",
  ponto: "M12 12h.01",
} as const;

export type NomeDoIcone = keyof typeof ICONES;

export function Icone({ nome, className = "h-6 w-6", grosso = false }: { nome: NomeDoIcone; className?: string; grosso?: boolean }) {
  const largo = nome === "pontos" || nome === "ponto";
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={largo ? 3 : grosso ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONES[nome]} />
    </svg>
  );
}
