// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { preencher } from "@/lib/escola/textos";
import { useCompleted } from "@/lib/progress";
import { useDiscreto } from "./discreto";
import type { AulaDoCaderno, GrupoDoCaderno } from "./vista";

export interface LadoDoCaderno {
  lado: "A" | "B";
  titulo: string;
  resumo: string;
  /** Nas trilhas, as aulas; no Despertar e no Ano de formação, os grupos (etapas ou módulos). */
  aulas: AulaDoCaderno[];
  grupos: GrupoDoCaderno[];
}

/** A aula de agora: a primeira pronta que ainda não foi feita neste aparelho. */
export function aulaDeAgora(prontas: readonly AulaDoCaderno[], feitas: ReadonlySet<string>): AulaDoCaderno | null {
  return prontas.find((a) => !feitas.has(a.id)) ?? null;
}

function LinhaDaAula({ lang, a, feita, agora, t, discreto }: { lang: Locale; a: AulaDoCaderno; feita: boolean; agora: boolean; t: TextosDaFormacao["caderno"]; discreto: boolean }) {
  return (
    <li className="eff-linha" data-agora={agora ? "" : undefined} data-preparo={a.href ? undefined : ""}>
      <span className="ef-t eff-codigo">{a.codigo ?? "—"}</span>
      {a.href ? (
        <Link href={localePath(lang, a.href)} replace={discreto} className={`eff-aula${feita ? " eff-riscado" : ""}`} aria-current={agora ? "step" : undefined}>
          {a.titulo}
          {feita && <span className="sr-only"> ({t.feita})</span>}
          {agora && <span className="sr-only"> ({t.agora})</span>}
        </Link>
      ) : (
        <span className="eff-aula eff-aula-preparo">
          {a.titulo} <em>({t.emPreparacao})</em>
        </span>
      )}
      <span className="eff-min">{a.minutos ? preencher(t.minutos, { n: a.minutos }) : ""}</span>
    </li>
  );
}

/**
 * Os dois lados do caderno (pranchas Caderno e Cel-Caderno): lado A, teoria, e lado B, prática. As aulas feitas NESTE
 * aparelho aparecem riscadas a caneta vermelha (o mesmo progresso de /trilhas) e a de agora fica marcada. No celular,
 * uma aba por lado. No Despertar e no Ano de formação, cada lado lista as etapas ou os módulos, que abrem as aulas.
 */
export function LadoAeB({ lang, lados, prontas, t }: { lang: Locale; lados: LadoDoCaderno[]; prontas: AulaDoCaderno[]; t: TextosDaFormacao["caderno"] }) {
  const feitas = useCompleted();
  const discreto = useDiscreto();
  const agora = aulaDeAgora(prontas, feitas);
  const ladoDeAgora = agora?.lado ?? "A";
  const [aba, setAba] = useState<"A" | "B" | null>(null);
  const aberta = aba ?? ladoDeAgora;
  const linha = (a: AulaDoCaderno) => <LinhaDaAula key={a.id} lang={lang} a={a} feita={feitas.has(a.id)} agora={agora?.id === a.id} t={t} discreto={discreto} />;

  return (
    <>
      <div role="tablist" aria-label={t.lados} className="eff-abas-lado">
        {lados.map((l) => (
          <button key={l.lado} type="button" role="tab" id={`eff-aba-lado-${l.lado}`} aria-controls={`eff-lado-${l.lado}`} aria-selected={aberta === l.lado} onClick={() => setAba(l.lado)} className="eff-aba-lado">
            {l.titulo}
          </button>
        ))}
      </div>
      <div className="eff-lados">
        {lados.map((l) => (
          <section key={l.lado} id={`eff-lado-${l.lado}`} aria-labelledby={`eff-lado-titulo-${l.lado}`} className="eff-lado" data-aberta={aberta === l.lado ? "" : undefined}>
            <div className="eff-lado-cabeca">
              <h2 id={`eff-lado-titulo-${l.lado}`} className="ef-t">
                {l.titulo}
              </h2>
              <span>{l.resumo}</span>
            </div>
            {l.grupos.length > 0 ? (
              <ol className="eff-grupos">
                {l.grupos.map((g) => {
                  const feitasNoGrupo = g.aulas.filter((a) => feitas.has(a.id)).length;
                  const temAgora = g.aulas.some((a) => a.id === agora?.id);
                  return (
                    <li key={g.titulo}>
                      <details className="eff-grupo" open={temAgora || undefined}>
                        <summary>
                          <span className="ef-t eff-grupo-titulo" lang={g.emPortugues && lang !== "pt" ? "pt-BR" : undefined}>
                            {g.titulo}
                          </span>
                          <span className="eff-min">
                            {feitasNoGrupo}/{preencher(t.aulasDoGrupo, { n: g.aulas.length })}
                          </span>
                        </summary>
                        <ol className="eff-lista">{g.aulas.map(linha)}</ol>
                      </details>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <ol className="eff-lista">{l.aulas.map(linha)}</ol>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
