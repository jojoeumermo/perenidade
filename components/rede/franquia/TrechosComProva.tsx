// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { preencher } from "@/lib/rede/preencher";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { TrechoComProvaNaFila } from "@/lib/rede/tipos-moderacao";
import { dataCurta } from "../moderacao/base";

/**
 * Os trechos de uma denúncia com prova, como a moderação os lê: o texto exato, de onde veio e o dia da mensagem, com a frase que diz
 * o que a prova prova e o que NÃO prova (a autoria é a que o aparelho de quem denunciou diz).
 */
export function TrechosComProva({ sm, lang, prova }: { sm: TextosDaModeracao; lang: string; prova: TrechoComProvaNaFila[] }) {
  const t = sm.fila.prova;
  return (
    <section className="space-y-2 rounded-md border-[1.5px] border-ink px-3 py-2 text-sm" aria-label={preencher(t.titulo, { n: prova.length })}>
      <p className="font-bold">{preencher(t.titulo, { n: prova.length })}</p>
      <ul className="space-y-2">
        {prova.map((p, i) => (
          <li key={i} className="rounded-md bg-parchment-deep px-3 py-2">
            <p className="text-xs font-semibold">
              <span className="rounded-full border border-ink px-2 py-0.5">{t.selo}</span>
              {" · "}
              {(t.origem as Record<string, string>)[p.origem] ?? p.origem}
              {" · "}
              {preencher(t.dia, { dia: dataCurta(`${p.dia}T12:00:00Z`, lang) })}
            </p>
            <blockquote className="mt-1 whitespace-pre-line break-words">{p.texto}</blockquote>
          </li>
        ))}
      </ul>
      <p role="note" className="text-xs text-ink-soft">{t.explica}</p>
    </section>
  );
}
