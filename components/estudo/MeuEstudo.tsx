// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useState } from "react";
import { fill } from "@/i18n/config";
import { type CartaoDeRevisao, type Erro, lerCartoes, lerErros, paraHoje } from "@/lib/estudo";
import { apagarProgresso, emRevisao, lerRespostas, lerTestes, paraRevisar, porTema, type RespostaGuardada, type Teste } from "@/lib/meu-estudo";
import { useCompleted, useLastLesson } from "@/lib/progress";
import { notifyStored, useHydrated } from "@/lib/storage";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { CopiaDeSeguranca } from "../caderno/Estudo";
import type { NotebookStrings } from "../caderno/Caderno";
import { L, useI18n } from "../I18n";
import { Barra } from "./Barra";
import { useGuardado } from "./guardado";
import { useIndice } from "./indice";

type S = TextosDoEstudo["meuEstudo"];

const cartao = "border border-rule bg-parchment-deep p-5";
const botao = "inline-block cursor-pointer bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood";

function Numero({ valor, rotulo, detalhe }: { valor: ReactNode; rotulo: string; detalhe?: string }) {
  return (
    <div className="border-l-2 border-gold pl-3">
      <p className="font-serif text-3xl font-semibold leading-none">{valor}</p>
      <p className="mt-1 font-sans text-sm">{rotulo}</p>
      {detalhe && <p className="font-sans text-xs text-ink-soft">{detalhe}</p>}
    </div>
  );
}

/**
 * O painel "Meu estudo": o que a pessoa já fez, o que revisar e como vão os temas, montado no aparelho com o que ele
 * guarda (as aulas feitas e o caderno de erros que já existiam, e os testes e exercícios deste recurso). Nada sai daqui.
 * `extras` traz as partes de outros recursos (meta, nivelamento, turmas) quando estão ligados.
 */
export function MeuEstudo({ s, caderno, praticar, extras }: { s: S; caderno: NotebookStrings; praticar: boolean; extras?: ReactNode }) {
  const { lang } = useI18n();
  const hidratado = useHydrated();
  const feitas = useCompleted();
  const ultima = useLastLesson();
  const indice = useIndice(lang);
  const [testes] = useGuardado<Record<string, Teste>>(lerTestes, {});
  const [respostas] = useGuardado<Record<string, RespostaGuardada>>(lerRespostas, {});
  const [erros] = useGuardado<Erro[]>(lerErros, []);
  const [cartoes] = useGuardado<CartaoDeRevisao[]>(lerCartoes, []);
  const [aviso, setAviso] = useState("");

  if (!hidratado) return <p className="mt-8 font-sans text-sm text-ink-soft">{s.carregando}</p>;

  const nomeDa = (id: string) => indice?.aulas.get(id)?.titulo ?? id;
  const hrefDa = (id: string) => `/trilhas/${id}`;
  const listaDeTestes = Object.entries(testes);
  const acertosNosTestes = listaDeTestes.reduce((n, [, t]) => n + t.acertos, 0);
  const questoesNosTestes = listaDeTestes.reduce((n, [, t]) => n + t.total, 0);
  const revisarHoje = paraRevisar(respostas);
  const proximas = emRevisao(respostas);
  const cartoesHoje = paraHoje(cartoes).length;
  const reler = listaDeTestes
    .filter(([, t]) => t.total > 0 && t.acertos / t.total < 0.6)
    .sort((a, b) => b[1].quando - a[1].quando)
    .slice(0, 5);
  const temas = porTema(respostas);
  const vazio = feitas.size === 0 && listaDeTestes.length === 0 && Object.keys(respostas).length === 0 && erros.length === 0 && cartoes.length === 0;

  // Por disciplina: só as trilhas em que a pessoa já fez alguma coisa.
  const ativas = new Set<string>([...feitas, ...Object.keys(testes)].map((id) => id.split("/")[0]));
  const porArea = new Map<string, { nome: string; trilhas: { slug: string; titulo: string; feitas: number; total: number; acertos: number; questoes: number }[] }>();
  for (const [slug, titulo, area, nomeDaArea, , aulas] of indice?.trilhas ?? []) {
    if (!ativas.has(slug)) continue;
    const ids = aulas.map(([a]) => `${slug}/${a}`);
    const resultado = ids.map((id) => testes[id]).filter((t): t is Teste => Boolean(t));
    const grupo = porArea.get(area) ?? { nome: nomeDaArea, trilhas: [] };
    grupo.trilhas.push({ slug, titulo, feitas: ids.filter((id) => feitas.has(id)).length, total: ids.length, acertos: resultado.reduce((n, t) => n + t.acertos, 0), questoes: resultado.reduce((n, t) => n + t.total, 0) });
    porArea.set(area, grupo);
  }

  function apagar() {
    if (!window.confirm(s.apagarConfirma)) return;
    const n = apagarProgresso();
    notifyStored();
    setAviso(fill(s.apagado, { n }));
  }

  return (
    <div className="mt-8 space-y-8 font-sans text-sm">
      <section aria-labelledby="me-resumo" className={cartao}>
        <h2 id="me-resumo" className="font-serif text-2xl font-semibold">
          {s.resumo}
        </h2>
        {vazio ? (
          <div className="mt-3">
            <p className="text-ink-soft">{s.vazio}</p>
            <p className="mt-3 flex flex-wrap gap-3">
              <L href="/trilhas" className={botao}>
                {s.escolherAula}
              </L>
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-4">
            <Numero valor={feitas.size} rotulo={s.aulasFeitas} />
            <Numero valor={listaDeTestes.length} rotulo={s.testesFeitos} detalhe={questoesNosTestes ? fill(s.acertosDe, { a: acertosNosTestes, b: questoesNosTestes }) : undefined} />
            <Numero valor={Object.keys(respostas).length} rotulo={s.exerciciosFeitos} />
            <Numero valor={revisarHoje.length + cartoesHoje} rotulo={s.paraHoje} />
          </div>
        )}
        <p className="mt-4 text-xs text-ink-soft">{s.soNoAparelho}</p>
      </section>

      {ultima?.path && (
        <L href={ultima.path} className="flex flex-wrap items-center justify-between gap-3 border-2 border-gold bg-parchment-deep px-5 py-4 hover:border-oxblood">
          <span>
            <span className="block font-mono text-xs uppercase tracking-widest text-gold">{s.continuar}</span>
            <span className="font-serif text-xl font-semibold">{ultima.title}</span>
            <span className="text-ink-soft"> · {ultima.track}</span>
          </span>
          <span aria-hidden>→</span>
        </L>
      )}

      {extras}

      <section aria-labelledby="me-revisar" className={cartao}>
        <h2 id="me-revisar" className="font-serif text-2xl font-semibold">
          {s.revisar}
        </h2>
        <ul className="mt-3 space-y-3">
          {praticar && (
            <li>
              {revisarHoje.length > 0 ? (
                <>
                  <p>{fill(s.exerciciosHoje, { n: revisarHoje.length })}</p>
                  <L href="/meu-estudo/praticar?modo=revisar" className={`${botao} mt-2`}>
                    {s.revisarAgora}
                  </L>
                </>
              ) : proximas.length > 0 ? (
                <p className="text-ink-soft">{fill(s.proximaRevisao, { data: new Date(`${proximas[0].proxima}T12:00:00`).toLocaleDateString(lang) })}</p>
              ) : (
                <p className="text-ink-soft">{s.semExercicioParaRevisar}</p>
              )}
            </li>
          )}
          <li>
            {erros.length > 0 ? (
              <L href="/caderno?ferramenta=erros" className="underline hover:text-oxblood">
                {fill(s.cadernoDeErros, { n: erros.length })}
              </L>
            ) : (
              <span className="text-ink-soft">{s.semErros}</span>
            )}
          </li>
          {cartoesHoje > 0 && (
            <li>
              <L href="/caderno?ferramenta=revisao" className="underline hover:text-oxblood">
                {fill(s.cartoesHoje, { n: cartoesHoje })}
              </L>
            </li>
          )}
          {reler.length > 0 && (
            <li>
              <p>{s.valeReler}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {reler.map(([id, t]) => (
                  <li key={id}>
                    <L href={hrefDa(id)} className="underline hover:text-oxblood">
                      {nomeDa(id)}
                    </L>{" "}
                    <span className="text-ink-soft">{fill(s.acertosDe, { a: t.acertos, b: t.total })}</span>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
        {praticar && (
          <p className="mt-4">
            <L href="/meu-estudo/praticar" className="underline hover:text-oxblood">
              {s.praticarLivre} →
            </L>
          </p>
        )}
      </section>

      {porArea.size > 0 && (
        <section aria-labelledby="me-disciplinas" className={cartao}>
          <h2 id="me-disciplinas" className="font-serif text-2xl font-semibold">
            {s.porDisciplina}
          </h2>
          <div className="mt-4 space-y-6">
            {[...porArea.entries()].map(([area, g]) => (
              <div key={area}>
                <h3 className="font-semibold">{g.nome}</h3>
                <ul className="mt-2 space-y-3">
                  {g.trilhas.map((tr) => (
                    <li key={tr.slug}>
                      <p className="flex flex-wrap justify-between gap-x-3">
                        <L href={`/trilhas/${tr.slug}`} className="underline hover:text-oxblood">
                          {tr.titulo}
                        </L>
                        <span className="font-mono text-xs text-ink-soft">
                          {fill(s.aulasDe, { a: tr.feitas, b: tr.total })}
                          {tr.questoes > 0 && ` · ${fill(s.acertosDe, { a: tr.acertos, b: tr.questoes })}`}
                        </span>
                      </p>
                      <div className="mt-1">
                        <Barra feito={tr.feitas} total={tr.total} rotulo={fill(s.progressoDa, { trilha: tr.titulo })} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {!indice && <p className="mt-3 text-xs text-ink-soft">{s.semIndice}</p>}
        </section>
      )}

      {temas.length > 0 && (
        <section aria-labelledby="me-temas" className={cartao}>
          <h2 id="me-temas" className="font-serif text-2xl font-semibold">
            {s.porTema}
          </h2>
          <p className="mt-1 text-ink-soft">{s.porTemaLead}</p>
          <ul className="mt-4 space-y-3">
            {temas.map((t) => (
              <li key={t.tema}>
                <p className="flex flex-wrap justify-between gap-x-3">
                  <span>{t.tema}</span>
                  <span className="font-mono text-xs text-ink-soft">{fill(s.acertosDe, { a: t.acertos, b: t.tentativas })}</span>
                </p>
                <div className="mt-1">
                  <Barra feito={t.acertos} total={t.tentativas} rotulo={t.tema} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="me-dados" className={cartao}>
        <h2 id="me-dados" className="font-serif text-2xl font-semibold">
          {s.dados}
        </h2>
        <p className="mt-1 text-ink-soft">{s.dadosLead}</p>
        <div className="mt-4">
          <CopiaDeSeguranca s={caderno} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={apagar} className="cursor-pointer border-2 border-oxblood px-4 py-2 font-semibold text-oxblood hover:bg-oxblood hover:text-parchment">
            {s.apagar}
          </button>
          <L href="/meus-dados" className="underline hover:text-oxblood">
            {s.todosOsDados}
          </L>
        </div>
        <p className="mt-2 text-xs text-ink-soft">{s.apagarDica}</p>
        <p role="status" className="mt-2 min-h-5 font-semibold">
          {aviso}
        </p>
      </section>
    </div>
  );
}
