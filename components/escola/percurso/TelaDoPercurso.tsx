// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo } from "react";
import { useCaderneta } from "@/components/escola/guardado-escola";
import { useEuDaEscola } from "@/components/escola/casca/Casca";
import { cadernoAtual, fracaoDoPercurso, situacoes } from "@/components/escola/hoje/quadro";
import { useTarefas } from "@/components/escola/vida/guardado-vida";
import type { Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import type { TextosDoPercurso } from "@/i18n/escola/percurso";
import { contarCaderneta, faltaNoDegrau, type CadernoParaPercurso } from "@/lib/escola/conquistas";
import { preencher } from "@/lib/escola/textos";
import { useCompleted } from "@/lib/progress";
import { Caderneta } from "./Caderneta";
import { CarteirinhaVermelha } from "./CarteirinhaVermelha";
import { LevarOPercurso } from "./LevarOPercurso";
import { MostrarNaAlumia } from "./MostrarNaAlumia";
import { ParaFecharODegrau } from "./ParaFecharODegrau";

export type CadernoDoPercurso = CadernoParaPercurso & { nome: string };

/**
 * Meu percurso (prancha Cel-Percurso; no computador, também o percurso de postos da Hoje). Só para militante: monta
 * dentro da casca, depois de escola_eu. Na ordem da prancha: carteirinha, caderneta, "para fechar o degrau", levar e
 * baixar; depois, "Mostrar na Alumia". O que a pessoa estudou é deste aparelho; o degrau, o núcleo e o codinome vêm do
 * banco (escola_eu); as conquistas na Alumia, das funções da F5.
 */
export function TelaDoPercurso({ lang, t, tHoje, cadernos }: {
  lang: Locale;
  t: TextosDoPercurso;
  tHoje: Pick<TextosDaFormacaoBase["hoje"], "percurso" | "degrau1" | "degrau3" | "voceCaderno" | "emPreparacao">;
  cadernos: CadernoDoPercurso[];
}) {
  const eu = useEuDaEscola();
  const feitas = useCompleted();
  const tarefas = useTarefas();
  const registros = useCaderneta();
  const contas = useMemo(() => contarCaderneta(cadernos, feitas, tarefas, registros), [cadernos, feitas, tarefas, registros]);
  const falta = useMemo(() => faltaNoDegrau(eu.degrau, cadernos, feitas, tarefas), [eu.degrau, cadernos, feitas, tarefas]);
  const s = situacoes(cadernos, feitas);
  const atual = cadernoAtual(s);
  const fracao = fracaoDoPercurso(cadernos.length, atual, s);
  const numeroAtual = atual >= 0 ? String(cadernos[atual].numero).padStart(2, "0") : null;

  return (
    <div className="ep-percurso" data-escola-escura="" data-tela-da-escola="percurso">
      <h1 className="ef-t ep-titulo">{t.titulo}</h1>

      <section aria-labelledby="ep-postos" className="ef-percurso ep-postos">
        <h2 id="ep-postos" className="ef-t">
          {tHoje.percurso}
        </h2>
        <div className="ef-postos">
          <span aria-hidden className="ef-postos-linha" />
          <span aria-hidden className="ef-postos-feito" style={{ width: `calc((100% - 56px) * ${fracao.toFixed(4)})` }} />
          <ol className="ef-postos-lista">
            {cadernos.map((c, i) => {
              const situacao = i === atual ? "atual" : s[i] === "feito" ? "feito" : "futuro";
              const rotulo = `${String(c.numero).padStart(2, "0")} · ${c.nome}${s[i] === "preparacao" ? ` (${tHoje.emPreparacao})` : ""}`;
              return (
                <li key={c.numero} className="ef-t ef-posto" data-situacao={situacao} title={rotulo} aria-current={i === atual ? "step" : undefined}>
                  <span aria-hidden>{String(c.numero).padStart(2, "0")}</span>
                  <span className="sr-only">{rotulo}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="ef-percurso-legenda">
          <span>{tHoje.degrau1}</span>
          {numeroAtual && <strong>{preencher(tHoje.voceCaderno, { n: numeroAtual })}</strong>}
          <span>{tHoje.degrau3}</span>
        </div>
      </section>

      <div className="ep-grade">
        <div className="ep-coluna ep-coluna-esquerda">
          <div className="ep-a-carteirinha">
            <CarteirinhaVermelha eu={eu} t={t.carteirinha} lang={lang} />
          </div>
          <div className="ep-a-fechar">
            <ParaFecharODegrau falta={falta} t={t.fechar} lang={lang} />
          </div>
          <div className="ep-a-levar">
            <LevarOPercurso t={t.levar} lang={lang} />
          </div>
        </div>
        <div className="ep-coluna">
          <div className="ep-a-caderneta">
            <Caderneta contas={contas} t={t.caderneta} lang={lang} />
          </div>
          <div className="ep-a-alumia">
            <MostrarNaAlumia eu={eu} t={t.alumia} tSelos={t.selos} lang={lang} cadernos={cadernos} feitas={feitas} />
          </div>
        </div>
      </div>
    </div>
  );
}
