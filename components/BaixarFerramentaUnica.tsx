// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";

export interface TextosDaFerramentaUnica {
  baixarFerramenta: string;
  baixarFerramentaDica: string;
  baixarHtmlPronto: string;
  baixarHtmlFalhou: string;
  baixarHtmlFonte: string;
  baixarFerramentaRodape: string;
}

/** "Baixar a ferramenta num arquivo só": um .html de poucos KB, com o código dentro, que abre sem internet. Só aparece nas ferramentas que têm versão offline. */
export function BaixarFerramentaUnica({ id, titulo, descricao, url, lang, s }: { id: string; titulo: string; descricao?: string; url: string; lang: string; s: TextosDaFerramentaUnica }) {
  const [estado, setEstado] = useState<"" | "pronto" | "falhou">("");
  async function baixar() {
    try {
      // O código das ferramentas só é carregado na hora do clique.
      const { montarFerramentaUnica, nomeDaFerramenta, tamanhoDoArquivo, LIMITE_DO_ARQUIVO } = await import("@/lib/ferramentas-offline");
      const html = montarFerramentaUnica({ id, titulo, descricao, url, lang, fonte: s.baixarHtmlFonte, rodape: s.baixarFerramentaRodape });
      if (!html || tamanhoDoArquivo(html) > LIMITE_DO_ARQUIVO) throw new Error("sem versão offline");
      const endereco = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: endereco, download: nomeDaFerramenta(id) });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(endereco), 10_000);
      setEstado("pronto");
    } catch {
      setEstado("falhou");
    }
  }
  return (
    <p className="no-print mt-6 font-sans text-sm">
      <button type="button" onClick={() => void baixar()} className="cursor-pointer font-semibold underline decoration-[#c21f16] underline-offset-4 hover:text-oxblood">
        {s.baixarFerramenta}
      </button>
      <span className="ml-2 text-ink-soft">{s.baixarFerramentaDica}</span>
      <span role="status" className="ml-2 font-semibold">
        {estado === "pronto" && s.baixarHtmlPronto}
        {estado === "falhou" && s.baixarHtmlFalhou}
      </span>
    </p>
  );
}
