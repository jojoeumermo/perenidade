// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apagarRascunho, apagarTodosOsRascunhos, listarRascunhos, resumir, type Rascunho } from "@/lib/rede/stories/rascunhos";
import { PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { preencherStory } from "./usar";

type T = TextosDosStories["p5"]["rascunhos"];

/** A miniatura do rascunho: a primeira foto (endereço local, solto ao sair) ou a cor do fundo. */
function Miniatura({ foto, cor }: { foto: Blob | null; cor: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!foto) return;
    const u = URL.createObjectURL(foto);
    // A miniatura só existe com a foto: o endereço local nasce e morre junto do componente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto]);
  return (
    <span className="al-st-rascunho-mini" aria-hidden style={{ background: cor }}>
      {/* Endereço local do próprio aparelho (blob:), nada de rede. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" draggable={false} /> : null}
    </span>
  );
}

/**
 * Os rascunhos de story deste aparelho (P5, A16): abrir, apagar um, apagar todos. Ficam só aqui (lib/rede/stories/rascunhos.ts), e a
 * tela diz isso e como apagar. Nada vai ao servidor.
 */
export function Rascunhos({ t, lang, aoAbrir, aoFechar }: { t: T; lang: string; aoAbrir: (r: Rascunho) => void; aoFechar: () => void }) {
  const [lista, setLista] = useState<Rascunho[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    let vivo = true;
    listarRascunhos()
      .then((l) => vivo && setLista(l))
      .catch(() => {
        if (!vivo) return;
        setLista([]);
        setErro(t.semArmazenamento);
      });
    return () => {
      vivo = false;
    };
  }, [t.semArmazenamento]);
  useEffect(() => {
    raiz.current?.querySelector<HTMLElement>("button")?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      aoFechar();
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [aoFechar]);

  const quando = (ms: number) => new Intl.DateTimeFormat(lang, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(ms);

  return (
    <div ref={raiz} className="al-st-colagem" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
      <div className="al-st-colagem-caixa">
        <h2 id={`${id}-t`} className="al-cond al-st-titulo-secao">
          {t.titulo}
        </h2>
        <p className="al-st-dica">{t.aviso}</p>
        {erro ? (
          <p className="al-st-erro-criar" role="alert">
            {erro}
          </p>
        ) : null}
        {lista === null ? null : lista.length === 0 ? (
          <p className="al-st-dica">{t.vazio}</p>
        ) : (
          <ul className="al-st-rascunhos">
            {lista.map((r) => {
              const x = resumir(r);
              return (
                <li key={r.id} className="al-st-rascunho">
                  <Miniatura foto={x.foto} cor={PALETA_DO_STORY[x.cor].fundo} />
                  <span className="al-st-rascunho-texto">
                    <strong>{x.texto || "…"}</strong>
                    <span>
                      {quando(x.atualizado)} · {x.quadros === 1 ? t.umQuadro : preencherStory(t.quadros, { n: x.quadros })}
                    </span>
                  </span>
                  <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => aoAbrir(r)}>
                    {t.abrir}
                  </button>
                  <button
                    type="button"
                    className="al-botao al-botao-fantasma al-botao-p"
                    onClick={async () => {
                      await apagarRascunho(r.id).catch(() => undefined);
                      setLista((l) => (l ?? []).filter((y) => y.id !== r.id));
                    }}
                  >
                    {t.apagar}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="al-st-caixa-acoes">
          {lista && lista.length > 1 ? (
            <button
              type="button"
              className="al-botao al-botao-fantasma al-botao-m"
              onClick={async () => {
                await apagarTodosOsRascunhos().catch(() => undefined);
                setLista([]);
              }}
            >
              {t.apagarTodos}
            </button>
          ) : null}
          <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={aoFechar}>
            {t.fechar}
          </button>
        </div>
      </div>
    </div>
  );
}
