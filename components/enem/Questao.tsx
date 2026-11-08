// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { fill } from "@/i18n/config";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L, useI18n } from "../I18n";
import { figurasSoltas } from "@/lib/figuras-da-prova";
import { AlternativaComFiguras, FiguraDaProva } from "../FiguraDaProva";
import { Markdown } from "../Markdown";
import { LETRAS, type QuestaoOficial } from "./dados";

type S = TextosDoEstudo["enem"]["provas"];

/**
 * O texto da questão oficial: contexto (com as figuras da prova na própria página, no lugar dos links da fonte), as
 * figuras que a fonte lista sem pôr no texto e o comando.
 */
export function TextoDaQuestao({ q, titulo }: { q: QuestaoOficial; titulo: string }) {
  const { lang } = useI18n();
  const soltas = figurasSoltas(q.imagens, q.contexto, q.enunciado, ...q.alternativas);
  return (
    <div lang="pt-BR">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{titulo}</p>
      {q.contexto && (
        <div className="mt-2 font-serif text-base leading-relaxed">
          <Markdown lang={lang} figuras>{q.contexto}</Markdown>
        </div>
      )}
      {soltas.length > 0 && (
        <p className="mt-2">
          {soltas.map((url) => (
            <span key={url} className="block">
              <FiguraDaProva src={url} />
            </span>
          ))}
        </p>
      )}
      <p className="mt-3 font-serif text-lg font-medium">{q.enunciado}</p>
    </div>
  );
}

/** Uma alternativa: a letra fica com quem chama; aqui o texto e, se houver, a figura (sem ampliar: o clique marca). */
export function TextoDaAlternativa({ texto, letra }: { texto: string; letra: string }) {
  return texto ? <AlternativaComFiguras texto={texto} letra={letra} /> : <>—</>;
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
