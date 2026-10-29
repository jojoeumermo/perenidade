// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, useSyncExternalStore } from "react";
import type { Dict } from "@/i18n/types";

/**
 * Mandar a página para onde o povo está: WhatsApp e Telegram com um texto curto pronto, copiar o link e, no celular,
 * os outros aplicativos do aparelho. Com `mensagem`, abre também a "Aula em 1 minuto": um resumo no formato de
 * mensagem, com a imagem da página, feito para encaminhar no grupo da família, do trabalho ou do bairro. A imagem só
 * carrega quando a pessoa abre o resumo (quem está com pouco dado não paga por ela).
 */
export function Compartilhar({ url, texto, imagem, mensagem, s }: { url: string; texto: string; imagem?: string; mensagem?: string; s: Dict["compartilhar"] }) {
  const [aviso, setAviso] = useState("");
  const [aberto, setAberto] = useState(false);
  const curto = `${texto} ${url}`;
  // A janela de compartilhar do aparelho só existe no navegador (no servidor, fica de fora).
  const podeCompartilhar = useSyncExternalStore(nada, () => "share" in navigator, () => false);

  async function copiar(valor: string, feito: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setAviso(feito);
    } catch {
      setAviso(valor);
    }
    setTimeout(() => setAviso(""), 3000);
  }

  async function outros() {
    try {
      await navigator.share({ title: texto, text: texto, url });
    } catch {
      /* a pessoa fechou a janela de compartilhar */
    }
  }

  // Imagem e texto juntos, pela janela de compartilhar do celular (o WhatsApp recebe os dois de uma vez).
  async function comImagem() {
    if (!imagem || !mensagem) return;
    try {
      const resposta = await fetch(imagem);
      const arquivo = new File([await resposta.blob()], "instituto-lucia.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [arquivo] })) await navigator.share({ files: [arquivo], text: mensagem });
      else await copiar(mensagem, s.textoCopiado);
    } catch {
      /* fechou a janela ou o aparelho não deixou */
    }
  }

  const botao = "cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold text-ink no-underline hover:border-oxblood hover:text-oxblood";

  return (
    <section id="compartilhar" aria-label={s.titulo} className="no-print mt-10 border-t-[3px] border-ink pt-4 font-sans text-sm">
      <p className="rotulo">{s.titulo}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a className={`${botao} border-ink bg-ink text-parchment hover:bg-oxblood hover:text-parchment`} href={`https://wa.me/?text=${encodeURIComponent(curto)}`} target="_blank" rel="noopener noreferrer">
          {s.whatsapp}
        </a>
        <a className={botao} href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
          {s.telegram}
        </a>
        <button type="button" className={botao} onClick={() => copiar(url, s.copiado)}>
          {s.copiar}
        </button>
        {podeCompartilhar && (
          <button type="button" className={botao} onClick={outros}>
            {s.outros}
          </button>
        )}
        <span role="status" className="text-ink-soft">{aviso}</span>
      </div>

      {mensagem && (
        <details className="mt-4 border-2 border-ink bg-parchment-deep" onToggle={(e) => setAberto(e.currentTarget.open)}>
          <summary className="cursor-pointer px-4 py-3 font-semibold">
            {s.umMinuto} <span className="font-normal text-ink-soft">· {s.umMinutoAjuda}</span>
          </summary>
          <div className="grid gap-4 border-t-2 border-ink p-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            {imagem && aberto && (
              // eslint-disable-next-line @next/next/no-img-element -- a imagem é gerada sob pedido (app/api/og), não passa pelo otimizador
              <img src={imagem} alt="" width={1200} height={630} loading="lazy" className="h-auto w-full border border-ink/30" />
            )}
            <div className="min-w-0">
              <pre className="whitespace-pre-wrap break-words font-sans text-[0.95rem] leading-relaxed text-ink">{mensagem}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className={`${botao} border-ink bg-ink text-parchment hover:bg-oxblood hover:text-parchment`} href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer">
                  {s.whatsapp}
                </a>
                {podeCompartilhar && imagem && (
                  <button type="button" className={botao} onClick={comImagem}>
                    {s.comImagem}
                  </button>
                )}
                <button type="button" className={botao} onClick={() => copiar(mensagem, s.textoCopiado)}>
                  {s.copiarTexto}
                </button>
                {imagem && (
                  <a className={botao} href={imagem} download="instituto-lucia.png">
                    {s.baixarImagem}
                  </a>
                )}
              </div>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}

const nada = () => () => {};
