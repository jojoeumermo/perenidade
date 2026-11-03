// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo } from "react";
import { L } from "@/components/I18n";
import { useGuardado } from "@/components/estudo/guardado";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { COMPETENCIAS, registrosDoModulo, retornoPorCompetencia, type RetornoDoTema } from "@/lib/escola/avaliacao";
import { lerRespostas, lerTestes, type RespostaGuardada, type Teste } from "@/lib/meu-estudo";

/**
 * O retorno por competência (E4-13, R1-30): os temas em quatro grupos (vale rever, quase lá, pouco dado ainda, já
 * sabe), cada um com o link para rever a aula. NUNCA mostra número nem porcentagem: só a palavra. Nada sai do aparelho.
 * `titulos`: o nome de cada aula ("trilha/aula"); tema que não é aula aparece pelo próprio nome.
 */
export function RetornoPorCompetencia({ itens, titulos, s }: { itens: RetornoDoTema[]; titulos: Record<string, string>; s: TextosDaAvaliacao["retorno"] }) {
  const nome = (tema: string) => titulos[tema] ?? tema;
  return (
    <section className="retorno-competencia" aria-labelledby="retorno-competencia-titulo" data-retorno-competencia="">
      <h2 id="retorno-competencia-titulo">{s.titulo}</h2>
      <p className="mt-1 text-sm text-ink-soft">{s.lead}</p>
      {itens.length === 0 ? (
        <p className="mt-3">{s.vazio}</p>
      ) : (
        COMPETENCIAS.map((c) => {
          const doGrupo = itens.filter((i) => i.competencia === c);
          if (doGrupo.length === 0) return null;
          return (
            <div key={c} className="retorno-grupo" data-competencia={c}>
              <h3>{s.competencias[c].nome}</h3>
              <p className="text-sm text-ink-soft">{s.competencias[c].texto}</p>
              <ul>
                {doGrupo.map((i) => (
                  <li key={i.tema}>
                    <span lang="pt">{nome(i.tema)}</span>
                    {c !== "ja-sabe" && i.aulas[0] && (
                      <>
                        {" · "}
                        <L href={`/trilhas/${i.aulas[0]}`} className="underline hover:text-oxblood">
                          {s.rever}
                          {i.aulas[0] !== i.tema && titulos[i.aulas[0]] ? `: ${titulos[i.aulas[0]]}` : ""}
                        </L>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
      <p className="mt-4 text-xs text-ink-soft">{s.soNoAparelho}</p>
    </section>
  );
}

const SEM_TESTES: Record<string, Teste> = {};
const SEM_RESPOSTAS: Record<string, RespostaGuardada> = {};

/** O retorno de um módulo do curso, lido no aparelho (página /escola/cursos/[curso]/modulo/[n]). */
export function RetornoDoModulo({ aulas, titulos, s }: { aulas: string[]; titulos: Record<string, string>; s: TextosDaAvaliacao["retorno"] }) {
  const [testes] = useGuardado(lerTestes, SEM_TESTES);
  const [respostas] = useGuardado(lerRespostas, SEM_RESPOSTAS);
  const itens = useMemo(() => retornoPorCompetencia(registrosDoModulo(aulas, testes, respostas)), [aulas, testes, respostas]);
  return <RetornoPorCompetencia itens={itens} titulos={titulos} s={s} />;
}
