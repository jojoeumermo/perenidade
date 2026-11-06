// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";

/**
 * Quando o painel quebra no navegador, em vez da tela genérica do Next ("This page couldn't load"): o que aconteceu, a
 * mensagem técnica (para mandar a quem cuida do site) e um botão que apaga só as preferências do painel guardadas neste
 * navegador (menu, favoritos, modo foco, cópias offline das páginas) e recarrega. A conta continua entrada.
 */
export default function ErroDoPainel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Painel:", error);
  }, [error]);

  const recomecar = async () => {
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const chave = window.localStorage.key(i);
        if (chave && chave.startsWith("lucia:painel")) window.localStorage.removeItem(chave);
      }
    } catch {
      // armazenamento bloqueado: segue para o recarregar
    }
    try {
      if ("caches" in window) for (const nome of await caches.keys()) if (/^lucia-(paginas|casca|fixos|leves)-/.test(nome)) await caches.delete(nome);
    } catch {
      // sem caches: segue
    }
    window.location.reload();
  };

  return (
    <div lang="pt-BR" className="mx-auto max-w-xl px-6 py-16 font-sans">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-oxblood">Painel</p>
      <h1 className="mt-2 font-serif text-3xl">O painel não abriu</h1>
      <p className="mt-3 text-ink-soft">
        Algo guardado neste navegador não combinou com a versão nova do painel. Toque em “Recomeçar o painel”: ele apaga só
        as preferências do painel neste aparelho (menu, favoritos, cópias offline) e abre de novo. A sua conta continua
        entrada.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={recomecar} className="cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood">
          Recomeçar o painel
        </button>
        <button type="button" onClick={reset} className="cursor-pointer border-2 border-ink px-5 py-2 font-medium hover:border-oxblood hover:text-oxblood">
          Tentar de novo
        </button>
      </div>
      <details className="mt-8 text-sm text-ink-soft">
        <summary className="cursor-pointer">Detalhe técnico (para mandar a quem cuida do site)</summary>
        <pre className="mt-2 overflow-auto whitespace-pre-wrap border border-rule bg-parchment-deep p-3 font-mono text-xs">
          {error.message || "sem mensagem"}
          {error.digest ? `\ncódigo: ${error.digest}` : ""}
        </pre>
      </details>
    </div>
  );
}
