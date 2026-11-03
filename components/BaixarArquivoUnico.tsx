// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { LIMITE_DO_ARQUIVO, montarArquivoUnico, nomeDoArquivo, tamanhoEmBytes } from "@/lib/arquivo-unico";

export interface TextosDoArquivoUnico {
  baixarHtml: string;
  baixarHtmlDica: string;
  baixarHtmlPronto: string;
  baixarHtmlFalhou: string;
  baixarHtmlFonte: string;
  baixarHtmlRodape: string;
}

/** Recorta a parte de leitura da página: sem botões, campos, o que é "no-print" e, se passar de 1 MB, sem imagens. */
function recortar(raiz: Element, semImagens: boolean): string {
  const copia = raiz.cloneNode(true) as Element;
  copia.querySelectorAll(".no-print, button, input, textarea, select, form, script, style, iframe, video, audio, [aria-hidden='true'], [hidden]").forEach((n) => n.remove());
  copia.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
  copia.querySelectorAll("img").forEach((img) => {
    if (semImagens || !(img.getAttribute("src") ?? "").startsWith("data:")) {
      const alt = img.getAttribute("alt");
      img.replaceWith(alt ? Object.assign(document.createElement("em"), { textContent: `[${alt}]` }) : document.createTextNode(""));
    }
  });
  copia.querySelectorAll("a[href^='/']").forEach((a) => a.setAttribute("href", new URL(a.getAttribute("href") ?? "/", window.location.origin).href));
  copia.querySelectorAll("[class]").forEach((n) => {
    // Só as classes dos blocos da aula dizem algo fora do site; o resto (Tailwind) só pesaria.
    const blocos = [...n.classList].filter((c) => c === "bloco" || c.startsWith("bloco-"));
    if (blocos.length) n.setAttribute("class", blocos.join(" "));
    else n.removeAttribute("class");
  });
  copia.querySelectorAll("[style], [data-p]").forEach((n) => {
    n.removeAttribute("style");
    n.removeAttribute("data-p");
  });
  return copia.innerHTML;
}

/** "Baixar a aula num arquivo só": um .html de menos de 1 MB que abre sem internet, para mandar no WhatsApp. */
export function BaixarArquivoUnico({ titulo, url, lang, seletor = "article", s }: { titulo: string; url: string; lang: string; seletor?: string; s: TextosDoArquivoUnico }) {
  const [estado, setEstado] = useState<"" | "pronto" | "falhou">("");
  function baixar() {
    try {
      const raiz = document.querySelector(seletor);
      if (!raiz) throw new Error("sem conteúdo");
      const montar = (semImagens: boolean) => montarArquivoUnico({ titulo, conteudo: recortar(raiz, semImagens), url, lang, fonte: s.baixarHtmlFonte, rodape: s.baixarHtmlRodape });
      let html = montar(false);
      if (tamanhoEmBytes(html) > LIMITE_DO_ARQUIVO) html = montar(true);
      if (tamanhoEmBytes(html) > LIMITE_DO_ARQUIVO) throw new Error("grande demais");
      const endereco = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: endereco, download: nomeDoArquivo(new URL(url).pathname) });
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
      <button type="button" onClick={baixar} className="cursor-pointer font-semibold underline decoration-[#c21f16] underline-offset-4 hover:text-oxblood">
        {s.baixarHtml}
      </button>
      <span className="ml-2 text-ink-soft">{s.baixarHtmlDica}</span>
      <span role="status" className="ml-2 font-semibold">
        {estado === "pronto" && s.baixarHtmlPronto}
        {estado === "falhou" && s.baixarHtmlFalhou}
      </span>
    </p>
  );
}
