// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/**
 * "Imprimir ementa": abre a ementa (um <details>) e imprime só ela. A marca data-imprimindo-ementa no <html> faz o CSS
 * (styles/escola-cursos.css) esconder o resto da página no papel; sai depois da impressão.
 */
export function ImprimirEmenta({ texto, alvo }: { texto: string; alvo: string }) {
  const imprimir = () => {
    const ementa = document.getElementById(alvo);
    if (ementa instanceof HTMLDetailsElement) ementa.open = true;
    const html = document.documentElement;
    html.setAttribute("data-imprimindo-ementa", "");
    const sair = () => {
      html.removeAttribute("data-imprimindo-ementa");
      window.removeEventListener("afterprint", sair);
    };
    window.addEventListener("afterprint", sair);
    window.print();
    // Alguns navegadores não disparam afterprint: a marca sai de todo jeito depois de um tempo.
    window.setTimeout(sair, 60_000);
  };
  return (
    <button type="button" onClick={imprimir} className="no-print inline-flex min-h-11 items-center gap-2 border-2 border-ink px-4 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood">
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
      </svg>
      {texto}
    </button>
  );
}
