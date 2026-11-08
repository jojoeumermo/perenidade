// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fill } from "@/i18n/config";
import { partesDoTexto } from "@/lib/figuras-da-prova";
import { useI18n } from "./I18n";

/**
 * Uma figura de prova pública (Enem), na própria página: largura máxima da coluna, altura proporcional, carregada só
 * quando chega perto da tela e sem dizer à fonte de qual página veio (no-referrer). O fundo é branco porque as figuras
 * são desenhos em preto sobre fundo transparente, que sumiriam no tema escuro.
 *
 * Com `ampliar` (o padrão), um clique abre a figura grande numa janela que fecha com Esc, com o botão ou clicando fora.
 * Dentro de uma alternativa (que já é um botão ou rótulo de marcar resposta) vai sem `ampliar`: o clique marca a resposta.
 */
export function FiguraDaProva({ src, alt: dado, ampliar = true }: { src: string; alt?: string; ampliar?: boolean }) {
  const { lang, t } = useI18n();
  // A fonte não traz descrição das figuras: o texto alternativo diz o que é (da questão, da alternativa B) e o
  // conteúdo fica no enunciado em volta.
  const alt = dado ?? t.common.figure;
  const [aberta, setAberta] = useState(false);
  const imagem = (
    // eslint-disable-next-line @next/next/no-img-element -- figura de outro endereço, mostrada como veio (sem otimização do Next)
    <img src={src} alt={alt} lang={lang} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="inline-block h-auto max-w-full border border-rule bg-white align-middle" />
  );
  if (!ampliar) return <span className="my-1 inline-block max-w-full align-middle">{imagem}</span>;
  return (
    <>
      <button type="button" className="my-1 inline-block max-w-full cursor-zoom-in align-middle" onClick={() => setAberta(true)} aria-label={`${t.common.zoomFigure}: ${alt}`} title={t.common.zoomFigure}>
        {imagem}
      </button>
      {aberta && createPortal(<Ampliada src={src} alt={alt} fechar={() => setAberta(false)} rotuloFechar={t.common.closeFigure} lang={lang} />, document.body)}
    </>
  );
}

function Ampliada({ src, alt, fechar, rotuloFechar, lang }: { src: string; alt: string; fechar: () => void; rotuloFechar: string; lang: string }) {
  const janela = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = janela.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={janela}
      aria-label={alt}
      onClose={fechar}
      onClick={(e) => e.target === e.currentTarget && janela.current?.close()}
      className="m-auto max-h-[95vh] max-w-[95vw] overflow-auto border-2 border-ink bg-parchment p-3 text-ink backdrop:bg-black/70"
    >
      <p className="mb-2 text-right font-sans text-sm">
        <button type="button" autoFocus className="cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood hover:text-oxblood" onClick={() => janela.current?.close()}>
          {rotuloFechar} ✕
        </button>
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- a mesma figura, já baixada */}
      <img src={src} alt={alt} lang={lang} referrerPolicy="no-referrer" className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full bg-white" />
    </dialog>
  );
}

/**
 * Um texto simples (uma alternativa, uma resposta guardada no caderno) com as figuras de prova no lugar dos links.
 * O texto continua texto puro: nada de HTML vindo de fora.
 */
export function TextoComFiguras({ texto, alt, ampliar = true }: { texto: string; alt: string; ampliar?: boolean }) {
  const partes = partesDoTexto(texto);
  const figuras = partes.filter((p) => p.tipo === "figura").length;
  let k = 0;
  return (
    <>
      {partes.map((p, i) =>
        p.tipo === "texto" ? (
          <Fragment key={i}>{p.texto}</Fragment>
        ) : (
          <span key={i} className="block">
            <FiguraDaProva src={p.src} alt={figuras > 1 ? `${alt} (${++k}/${figuras})` : alt} ampliar={ampliar} />
          </span>
        ),
      )}
    </>
  );
}

/** Uma alternativa de prova com figura: "Imagem da alternativa B" como texto alternativo. Sem `ampliar` por padrão. */
export function AlternativaComFiguras({ texto, letra, ampliar = false }: { texto: string; letra: string; ampliar?: boolean }) {
  const { t } = useI18n();
  return <TextoComFiguras texto={texto} alt={fill(t.common.figureOption, { letra })} ampliar={ampliar} />;
}
