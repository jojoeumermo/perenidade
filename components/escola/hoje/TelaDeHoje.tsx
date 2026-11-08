// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { useDaEscola } from "@/lib/escola/acesso";
import { preencher } from "@/lib/escola/textos";
import { useCompleted } from "@/lib/progress";
import { useEuDaEscola } from "../casca/Casca";
import { AulaAoVivoDeHoje } from "./AulaAoVivoDeHoje";
import type { CadernoDoQuadro } from "./cadernos-do-quadro";
import { PerguntaGeradora } from "./PerguntaGeradora";
import { cadernoAtual, fracaoDoPercurso, situacoes } from "./quadro";
import { QuadroDaSemana } from "./QuadroDaSemana";
import { QuemAcompanha } from "./QuemAcompanha";
import { Recados } from "./Recados";
import { ResumoDoNucleo } from "./ResumoDoNucleo";
import { dataCurta, dataDeHoje, periodoDoDia } from "./tempo";

/**
 * A tela Hoje (pranchas Hoje e Cel-Hoje), só para militante (monta dentro da casca, depois de escola_eu). Na ordem da
 * prancha: data e degrau, saudação pelo codinome, Quadro da semana, pergunta geradora e o percurso; à direita, núcleo,
 * quem acompanha, recados e "Travou numa aula?". No celular: quadro, núcleo e o resto embaixo.
 * Os blocos de núcleo, recados, pergunta e ao vivo leem as funções das F3/F4 pelo contrato (lib/escola/contratos.ts) e
 * mostram o vazio honesto enquanto elas não existem no banco.
 */
export function TelaDeHoje({ lang, t, cadernos }: { lang: Locale; t: TextosDaFormacaoBase["hoje"]; cadernos: CadernoDoQuadro[] }) {
  const eu = useEuDaEscola();
  const feitas = useCompleted();
  const nucleo = useDaEscola("escola_nucleo");
  const s = situacoes(cadernos, feitas);
  const atual = cadernoAtual(s);
  const caderno = atual >= 0 ? cadernos[atual] : null;
  const numeroAtual = caderno ? String(caderno.numero).padStart(2, "0") : null;
  const saudacao = t.saudacao[periodoDoDia()];
  const fracao = fracaoDoPercurso(cadernos.length, atual, s);

  return (
    <div className="ef-hoje" data-escola-escura="" data-tela-da-escola="hoje">
      <div className="ef-hoje-principal">
        <div className="ef-o-cabeca">
          <p className="ef-hoje-data">
            <span className="ef-so-computador">{preencher(t.linha, { data: dataDeHoje(lang), degrau: eu.degrau })}</span>
            <span className="ef-so-celular">{preencher(t.linha, { data: dataCurta(lang), degrau: eu.degrau })}</span>
            {numeroAtual && <> · {preencher(t.linhaCaderno, { n: numeroAtual })}</>}
          </p>
          <h1 className="ef-t ef-hoje-ola">{eu.codinome ? preencher(t.saudacaoNome, { saudacao, nome: eu.codinome }) : preencher(t.saudacaoSo, { saudacao })}</h1>
        </div>

        <AulaAoVivoDeHoje lang={lang} t={t} />

        <QuadroDaSemana lang={lang} t={t} caderno={caderno} feitas={feitas} encontro={nucleo?.ok ? (nucleo.dados?.proximo ?? null) : null} tudoFeito={atual < 0 && s.includes("feito")} />

        <PerguntaGeradora lang={lang} t={t} />

        <section aria-labelledby="ef-percurso" className="ef-percurso ef-o-percurso">
          <h2 id="ef-percurso" className="ef-t">
            {t.percurso}
          </h2>
          <div className="ef-postos">
            <span aria-hidden className="ef-postos-linha" />
            <span aria-hidden className="ef-postos-feito" style={{ width: `calc((100% - 56px) * ${fracao.toFixed(4)})` }} />
            <ol className="ef-postos-lista">
            {cadernos.map((c, i) => {
              const situacao = i === atual ? "atual" : s[i] === "feito" ? "feito" : "futuro";
              const rotulo = `${String(c.numero).padStart(2, "0")} · ${c.nome}${s[i] === "preparacao" ? ` (${t.emPreparacao})` : ""}`;
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
            <span>{t.degrau1}</span>
            {numeroAtual && <strong>{preencher(t.voceCaderno, { n: numeroAtual })}</strong>}
            <span>{t.degrau3}</span>
          </div>
        </section>
      </div>

      <aside aria-label={t.nucleo.titulo} className="ef-hoje-lado">
        <ResumoDoNucleo lang={lang} t={t} eu={eu} lido={nucleo} />
        <QuemAcompanha lang={lang} t={t} eu={eu} />
        <Recados t={t} />
        <section aria-labelledby="ef-duvida" className="ef-cartao ef-duvida ef-o-duvida">
          <h2 id="ef-duvida" className="ef-t">
            {t.duvida.titulo}
          </h2>
          <p>{t.duvida.texto}</p>
        </section>
      </aside>
    </div>
  );
}
