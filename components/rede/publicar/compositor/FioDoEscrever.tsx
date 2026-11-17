// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef } from "react";
import { dividirEmBlocos, LIMITE_DE_BLOCOS, LIMITE_DO_BLOCO } from "@/lib/rede/publicar/compositor";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDoCompositor } from "./textos";
import "./compositor.css";

/** O que vale para cada bloco: o selo com o número, o que falta para as 500 letras (em vermelho se passou). */
function SeloEContador({ t, n, total, texto }: { t: TextosDoCompositor; n: number; total: number; texto: string }) {
  const passou = texto.length > LIMITE_DO_BLOCO;
  return (
    <>
      <span className="cp-fio-selo">{preencher(t.fio.bloco, { n, total })}</span>
      <span className={`ml-auto text-xs tabular-nums ${passou ? "font-bold text-[var(--al-vermelho-letra,var(--al-vermelho-texto))]" : "text-[var(--al-texto-3)]"}`} aria-hidden>
        {LIMITE_DO_BLOCO - texto.length}
      </span>
    </>
  );
}

/**
 * Em cima do campo principal do Escrever, com o fio ligado: o selo "Bloco 1 de N" e o que falta das 500 letras, como nos outros
 * blocos, e o botão de desligar o fio.
 */
export function CabecaDoFio({ t, primeiro, total, aoFechar }: { t: TextosDoCompositor; primeiro: string; total: number; aoFechar: () => void }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <SeloEContador t={t} n={1} total={total} texto={primeiro} />
      <button type="button" className="al2-acao text-sm" onClick={aoFechar}>
        {t.fio.desligar}
      </button>
    </div>
  );
}

/**
 * Os blocos do fio montado de uma vez (onda 12, 12A; L2-26), embaixo do campo principal (que é o bloco 1): cada bloco é um campo
 * com o número dele, o que falta para as 500 letras e o botão de tirar; "Mais um bloco" até 10. Se um bloco passou de 500 (um
 * texto colado), "Dividir o texto em blocos" corta tudo de novo (parágrafo, frase, espaço) e a pessoa confere antes de publicar.
 * Os blocos ficam presos por uma linha vermelha, como a conversa do cartão.
 */
export function FioDoEscrever({
  t,
  primeiro,
  aoMudarPrimeiro,
  blocos,
  aoMudar,
  aoFechar,
}: {
  t: TextosDoCompositor;
  /** O texto do bloco 1 (o campo principal do Escrever). */
  primeiro: string;
  aoMudarPrimeiro: (v: string) => void;
  /** Os blocos 2 em diante. */
  blocos: string[];
  aoMudar: (b: string[]) => void;
  aoFechar: () => void;
}) {
  const total = blocos.length + 1;
  const lista = useRef<HTMLOListElement>(null);
  const focarNo = useRef<number | null>(null);
  useEffect(() => {
    if (focarNo.current === null) return;
    lista.current?.querySelectorAll<HTMLTextAreaElement>("textarea")[focarNo.current]?.focus();
    focarNo.current = null;
  });
  const grandes = [primeiro, ...blocos].map((b, i) => (b.length > LIMITE_DO_BLOCO ? i + 1 : 0)).filter(Boolean);
  const vazios = blocos.some((b, i) => !b.trim() && i < blocos.length - 1);
  const dividir = () => {
    const novos = dividirEmBlocos([primeiro, ...blocos].map((b) => b.trim()).filter(Boolean).join("\n\n"));
    aoMudarPrimeiro(novos[0] ?? "");
    aoMudar(novos.slice(1).length ? novos.slice(1) : [""]);
  };
  return (
    <div className="cp-fio">
      <ol ref={lista} className="cp-fio-blocos" aria-label={t.fio.ligar}>
        {blocos.map((b, i) => {
          const n = i + 2;
          const passou = b.length > LIMITE_DO_BLOCO;
          return (
            <li key={i} className="cp-fio-bloco">
              <div className="flex items-center gap-2">
                <SeloEContador t={t} n={n} total={total} texto={b} />
                <button
                  type="button"
                  className="al2-acao"
                  aria-label={preencher(t.fio.tirar, { n })}
                  title={preencher(t.fio.tirar, { n })}
                  onClick={() => {
                    const novos = blocos.filter((_, j) => j !== i);
                    if (!novos.length) aoFechar();
                    else {
                      aoMudar(novos);
                      focarNo.current = Math.max(0, i - 1);
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <label className="mt-1 block">
                <span className="sr-only">{preencher(t.fio.bloco, { n, total })}</span>
                <textarea
                  className="al2-campo cp-fio-campo"
                  rows={3}
                  value={b}
                  aria-invalid={passou || undefined}
                  onChange={(e) => aoMudar(blocos.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </label>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {total < LIMITE_DE_BLOCOS ? (
          <button
            type="button"
            className="al2-chip"
            onClick={() => {
              aoMudar([...blocos, ""]);
              focarNo.current = blocos.length;
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            {t.fio.mais}
          </button>
        ) : (
          <span className="text-xs text-[var(--al-texto-3)]">{t.fio.limite}</span>
        )}
        {grandes.length > 0 && (
          <button type="button" className="al2-chip" onClick={dividir}>
            {t.fio.dividir}
          </button>
        )}
      </div>
      <div aria-live="polite" className="mt-1 space-y-1 empty:hidden">
        {grandes.map((n) => (
          <p key={n} className="al2-nota al2-nota-alerta">
            {preencher(t.fio.grande, { n })}
          </p>
        ))}
        {vazios && <p className="al2-nota">{t.fio.vazio}</p>}
      </div>
    </div>
  );
}
