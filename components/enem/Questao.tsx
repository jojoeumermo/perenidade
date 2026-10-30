// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { fill } from "@/i18n/config";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L, useI18n } from "../I18n";
import { Markdown } from "../Markdown";
import { LETRAS, type QuestaoOficial } from "./dados";

type S = TextosDoEstudo["enem"]["provas"];

/** O texto da questão oficial: contexto, links das imagens (abrem na fonte, só se a pessoa pedir) e o comando. */
export function TextoDaQuestao({ q, s, titulo }: { q: QuestaoOficial; s: S; titulo: string }) {
  const { lang } = useI18n();
  return (
    <div lang="pt-BR">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{titulo}</p>
      {q.contexto && (
        <div className="mt-2 font-serif text-base leading-relaxed">
          <Markdown lang={lang}>{q.contexto}</Markdown>
        </div>
      )}
      {q.imagens.length > 0 && (
        <p className="mt-2 font-sans text-xs">
          {q.imagens.map((url, k) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="mr-3 underline hover:text-oxblood">
              {s.abrirImagem} {q.imagens.length > 1 ? k + 1 : ""}
            </a>
          ))}
        </p>
      )}
      <p className="mt-3 font-serif text-lg font-medium">{q.enunciado}</p>
    </div>
  );
}

/** A correção comentada de uma questão: gabarito, resolução, o engano da que a pessoa marcou e onde estudar. */
export function CorrecaoDaQuestao({ q, escolhida, s, praticar }: { q: QuestaoOficial; escolhida: number | undefined; s: S; praticar?: string }) {
  const { lang } = useI18n();
  const c = q.camada;
  const letra = (i: number | undefined) => (i === undefined || i < 0 ? s.emBranco : LETRAS[i]);
  const engano = escolhida !== undefined && escolhida !== q.resposta ? c?.enganos[LETRAS[escolhida] as keyof NonNullable<typeof c>["enganos"]] : undefined;
  return (
    <div className="mt-3 space-y-2 font-sans text-sm">
      <p>
        <span className={escolhida === q.resposta ? "text-ok" : "text-oxblood"}>{fill(s.suaResposta, { r: letra(escolhida) })}</span> · <strong>{fill(s.gabarito, { r: LETRAS[q.resposta] })}</strong>
      </p>
      {engano && (
        <p className="border border-oxblood bg-parchment px-3 py-2">
          <strong>{fill(s.porQueNao, { letra: LETRAS[escolhida as number] })}:</strong> {engano}
        </p>
      )}
      {c ? (
        <details className="border border-rule bg-parchment px-3 py-2" open={escolhida !== q.resposta}>
          <summary className="cursor-pointer font-semibold">{s.resolucao}</summary>
          <div className="mt-2 font-serif text-base" lang="pt-BR">
            <Markdown lang={lang}>{c.resolucao}</Markdown>
          </div>
          {c.aulas.length > 0 && (
            <p className="mt-2">
              {s.estudar}:{" "}
              {c.aulas.map((a, i) => (
                <span key={a.href}>
                  {i > 0 && " · "}
                  <L href={a.href} className="underline hover:text-oxblood">{a.titulo}</L>
                </span>
              ))}
            </p>
          )}
          {praticar && (
            <p className="mt-1">
              <L href={praticar} className="underline hover:text-oxblood">{s.praticarHabilidade}</L>
            </p>
          )}
        </details>
      ) : (
        <p className="text-ink-soft">{s.semResolucao}</p>
      )}
    </div>
  );
}
