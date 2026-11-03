// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { L } from "@/components/I18n";
import { SeloDePrivacidade } from "@/components/SeloDePrivacidade";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";
import { buscaDasAulas, carregarIndice, responderLocal, type TrechoLocal } from "@/lib/escola/respostas-locais";

// O modo sem servidor (R1-63, parte 1): a dúvida é respondida com trechos das aulas do próprio site, achados no índice
// de busca já baixado, no aparelho. Nada é escrito por máquina: cada trecho é copiado da aula, com o link dela.

export type MotivoSemServidor = "semConta" | "desligado" | "semInternet" | "falhou";
type S = TextosDoAcompanhante["semServidor"];

const buscas = new Map<string, Promise<ReturnType<typeof buscaDasAulas> | null>>();
/** O índice do idioma, baixado e montado uma vez por página (só quando alguém usa). */
function buscaDoIdioma(lang: string) {
  let p = buscas.get(lang);
  if (!p) {
    p = carregarIndice(lang).then((indice) => (indice.length ? buscaDasAulas(indice) : null));
    buscas.set(lang, p);
  }
  return p;
}

export function RespostaSemServidor({ s, lang, pergunta, motivo }: { s: S; lang: string; pergunta: string; motivo: MotivoSemServidor }) {
  const [estado, setEstado] = useState<{ fase: "procurando" } | { fase: "pronto"; trechos: TrechoLocal[] } | { fase: "semIndice" }>({ fase: "procurando" });

  useEffect(() => {
    let vivo = true;
    buscaDoIdioma(lang).then((busca) => {
      if (!vivo) return;
      if (!busca) {
        buscas.delete(lang);
        setEstado({ fase: "semIndice" });
      } else setEstado({ fase: "pronto", trechos: responderLocal(pergunta, busca) });
    });
    return () => {
      vivo = false;
    };
  }, [lang, pergunta]);

  return (
    <section className="acompanhante-sem-servidor mt-4 border-l-4 border-ink-soft bg-parchment-deep px-4 py-3" aria-label={s.titulo} data-sem-servidor={motivo}>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{s.titulo}</p>
      <p className="mt-1 text-sm text-ink-soft">{s[motivo]}</p>
      <SeloDePrivacidade tipo="aparelho" lang={lang} className="mt-2" />
      <div role="status" aria-live="polite">
        {estado.fase === "procurando" && <p className="mt-3 text-ink-soft">{s.carregando}</p>}
        {estado.fase === "semIndice" && <p className="mt-3 text-oxblood">{s.semIndice}</p>}
        {estado.fase === "pronto" && estado.trechos.length === 0 && <p className="mt-3">{s.nada}</p>}
      </div>
      {estado.fase === "pronto" && estado.trechos.length > 0 && (
        <ol className="mt-3 space-y-3">
          {estado.trechos.map((t) => (
            <li key={t.href} className="border border-rule bg-parchment p-3">
              <p className="font-serif text-lg font-semibold leading-snug">{t.titulo}</p>
              {t.contexto && <p className="text-xs text-ink-soft">{t.contexto}</p>}
              <blockquote className="mt-2 border-l-2 border-gold pl-3 font-serif" lang="pt">
                {t.trecho}
              </blockquote>
              <L href={t.href} className="mt-2 inline-flex min-h-11 items-center font-semibold underline hover:text-oxblood">
                {s.abrirAula} →
              </L>
            </li>
          ))}
        </ol>
      )}
      {estado.fase === "pronto" && estado.trechos.length > 0 && <p className="mt-2 text-xs text-ink-soft">{s.copiado}</p>}
    </section>
  );
}
