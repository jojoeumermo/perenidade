// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { ConviteDeMatricula, type TextosDoAvisoDeMatricula } from "@/components/escola/formatura/ConviteDeMatricula";
import { baixar, useGuardado } from "@/components/estudo/guardado";
import Link from "@/components/Link";
import { SeloDePrivacidade } from "@/components/SeloDePrivacidade";
import { fill, localePath, type Locale } from "@/i18n/config";
import type pt from "@/i18n/escola/matricula/pt.json";
import { icsSemanal } from "@/lib/agenda";
import { type Inscricao, lerInscricoes, lerMatricula, type Matricula } from "@/lib/escola/estudante";
import { type AulasDoAparelho, type CursoDoAparelho, inscricoesAtivas } from "@/lib/escola/matricula";
import { aulasPendentes, type EntradaDoPlano, gravarPlano, lerPlano, montarPlano, type Plano, planoDeHoje, ultimaAulaFeita } from "@/lib/escola/plano";
import { lerDatas, lerMetas } from "@/lib/meu-estudo";
import { useCompleted } from "@/lib/progress";
import { site } from "@/lib/site";
import "@/styles/escola-matricula.css";

export type TextosDoPlano = (typeof pt)["plano"];
type Comum = (typeof pt)["comum"];
const SEM_LISTA: Inscricao[] = [];
/** De segunda a domingo (0 = domingo). */
const SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** AAAA-MM-DD no relógio do aparelho (o plano é da semana de quem estuda, onde estiver). */
const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A entrada do plano com o que está no aparelho; null sem matrícula. */
export function entradaDoPlano(matricula: Matricula | null, inscricoes: readonly Inscricao[], concluidas: Iterable<string>, cursos: readonly CursoDoAparelho[], aulas: AulasDoAparelho, hoje: string): EntradaDoPlano | null {
  if (!matricula) return null;
  const metas = lerMetas();
  return {
    tempo: matricula.tempo,
    inscricoes,
    concluidas,
    cursos,
    minutosDaAula: (a) => aulas[a]?.minutos ?? 0,
    hoje,
    meta: metas.porSemana > 0 ? metas.porSemana : undefined,
  };
}

/**
 * O plano da semana sem culpa (R1-52), montado no aparelho por regras simples (lib/escola/plano.ts), e a tela diz
 * isso. Hoje em destaque, as aulas com link e "feito" pelo que está em 'lucia:concluidas'; o que não deu passa para o
 * próximo dia de estudo. A pessoa escolhe os dias; com duas semanas paradas, "Recomeçar com calma". "Lembrete no
 * calendário" baixa um .ics (lib/agenda.ts). Sem matrícula, o aviso único da Escola (ConviteDeMatricula). HTML do servidor neutro.
 */
export function PlanoDaSemana({ s, comum, aviso, cursos, aulas, lang }: { s: TextosDoPlano; comum: Comum; aviso: TextosDoAvisoDeMatricula; cursos: CursoDoAparelho[]; aulas: AulasDoAparelho; lang: Locale }) {
  const [matricula] = useGuardado<Matricula | null | undefined>(lerMatricula, undefined);
  const [inscricoes] = useGuardado<Inscricao[]>(lerInscricoes, SEM_LISTA);
  const concluidas = useCompleted();
  const [plano, setPlano] = useState<Plano | null>(null);
  const [hora, setHora] = useState("19:00");
  const [hoje, setHoje] = useState<string | null>(null);

  // Lê o plano guardado e o reajusta (ou monta o da semana) sempre que muda o que está guardado.
  useEffect(() => {
    if (!matricula) return;
    const id = window.setTimeout(() => {
      const dia = diaLocal(new Date());
      const entrada = entradaDoPlano(matricula, inscricoes, concluidas, cursos, aulas, dia);
      if (!entrada) return;
      const novo = planoDeHoje(lerPlano(), entrada, ultimaAulaFeita(lerDatas()));
      gravarPlano(novo);
      setPlano(novo);
      setHoje(dia);
      setHora((h) => (h === "19:00" ? lerMetas().hora : h));
    }, 0);
    return () => window.clearTimeout(id);
  }, [matricula, inscricoes, concluidas, cursos, aulas]);

  if (matricula === undefined || (matricula && (!plano || !hoje)))
    return (
      <p className="mt-8 min-h-64 font-sans text-sm text-ink-soft" aria-busy="true">
        {comum.carregando}
      </p>
    );

  if (matricula === null)
    return (
      <div className="mt-8" data-plano-convite="">
        <ConviteDeMatricula c={aviso} base={localePath(lang, "/escola")} />
      </div>
    );
  if (!plano || !hoje) return null;

  const refazer = (mudanca: { dias?: number[]; calma?: boolean }) => {
    const entrada = entradaDoPlano(matricula, inscricoes, concluidas, cursos, aulas, hoje);
    if (!entrada) return;
    const novo = montarPlano({ ...entrada, dias: mudanca.dias ?? plano.diasDaSemana, calma: mudanca.calma ?? plano.calma, anterior: plano });
    gravarPlano(novo);
    setPlano(novo);
  };

  const ativas = inscricoesAtivas(inscricoes).filter((i) => cursos.some((c) => c.slug === i.curso));
  const formatoDia = new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const formatoCurto = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", timeZone: "UTC" });
  const utc = (dia: string) => new Date(`${dia}T00:00:00Z`);
  const feitas = concluidas;
  const semAulas = plano.dias.every((d) => d.aulas.length === 0) && plano.paraDepois.length === 0;
  const acabou = ativas.length > 0 && semAulas && aulasPendentes({ inscricoes, concluidas, cursos, minutosDaAula: (a) => aulas[a]?.minutos ?? 0 }).length === 0;
  const acolhimento = s.acolhimento[Number(plano.semana.slice(-2)) % s.acolhimento.length];
  const primeiro = plano.dias[0]?.data ?? hoje;
  const ultimo = plano.dias.at(-1)?.data ?? hoje;

  function lembrete() {
    const ics = icsSemanal({
      dias: plano!.diasDaSemana,
      hora: /^\d{2}:\d{2}$/.test(hora) ? hora : "19:00",
      titulo: s.lembreteTitulo,
      descricao: s.lembreteDescricao,
      url: `${site.url}${localePath(lang, "/escola/plano")}`,
      inicio: new Date(),
      id: "escola-plano-da-semana",
    });
    baixar("plano-da-semana.ics", ics, "text/calendar");
  }

  return (
    <div className="mt-8 font-sans" data-plano="">
      <p className="max-w-2xl text-sm text-ink-soft" data-plano-regra="">
        {s.regra}
      </p>
      <SeloDePrivacidade tipo="aparelho" lang={lang} className="mt-2" />

      {ativas.length === 0 ? (
        <section className="mt-6 border border-rule bg-parchment-deep p-6">
          <p>{s.semCursos}</p>
          <Link href={localePath(lang, "/cursos")} className="mt-4 inline-flex min-h-11 items-center bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood">
            {s.verCursos}
          </Link>
        </section>
      ) : (
        <>
          <p className="mt-6 font-serif text-xl italic">{acolhimento}</p>

          {plano.oferecerCalma && (
            <section className="mt-5 border-2 border-gold bg-parchment-deep p-5" aria-labelledby="plano-calma" data-plano-calma="">
              <h2 id="plano-calma" className="font-serif text-2xl font-semibold">
                {s.calma.titulo}
              </h2>
              <p className="mt-1 text-ink-soft">{s.calma.texto}</p>
              <button type="button" className="mt-3 inline-flex min-h-11 cursor-pointer items-center bg-ink px-5 font-semibold text-parchment hover:bg-oxblood" onClick={() => refazer({ calma: true })}>
                {s.calma.botao}
              </button>
            </section>
          )}

          <section className="mt-6" aria-labelledby="plano-semana">
            <h2 id="plano-semana" className="font-serif text-2xl font-semibold">
              {fill(s.semana, { inicio: formatoCurto.format(utc(primeiro)), fim: formatoCurto.format(utc(ultimo)) })}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {plano.meta > 0 ? fill(s.metaDaSemana, { n: plano.meta }) : fill(s.tempoDaSemana, { n: plano.minutosDaSemana })}
              {plano.calma && (
                <>
                  {" · "}
                  {s.calma.ativo}{" "}
                  <button type="button" className="min-h-11 cursor-pointer underline hover:text-oxblood" onClick={() => refazer({ calma: false })}>
                    {s.calma.voltar}
                  </button>
                </>
              )}
            </p>

            {acabou ? (
              <p className="mt-4 border border-rule bg-parchment-deep p-4">
                {s.acabou}{" "}
                <Link href={localePath(lang, "/cursos")} className="underline hover:text-oxblood">
                  {s.verCursos}
                </Link>
              </p>
            ) : (
              <ol className="mt-4 grid gap-3">
                {plano.dias.map((dia) => {
                  const ehHoje = dia.data === hoje;
                  return (
                    <li key={dia.data} className="plano-dia border border-rule p-4" aria-current={ehHoje ? "date" : undefined} data-dia={dia.data}>
                      <h3 className="flex flex-wrap items-baseline gap-2 font-serif text-xl font-semibold">
                        {ehHoje && <span className="bg-oxblood px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-wider text-parchment">{s.hoje}</span>}
                        <span className="first-letter:uppercase">{formatoDia.format(utc(dia.data))}</span>
                      </h3>
                      {dia.aulas.length === 0 ? (
                        <p className="mt-1 text-sm text-ink-soft">{ehHoje ? s.hojeLivre : s.diaLivre}</p>
                      ) : (
                        <ul className="mt-2 grid gap-2">
                          {dia.aulas.map((aula) => {
                            const feita = feitas.has(aula);
                            return (
                              <li key={aula} className="flex flex-wrap items-center justify-between gap-2" data-aula={aula} data-feita={feita ? "" : undefined}>
                                <Link href={localePath(lang, `/trilhas/${aula}`)} className={`min-h-11 py-2 text-lg underline-offset-4 hover:text-oxblood hover:underline ${feita ? "text-ink-soft line-through" : ""}`}>
                                  {aulas[aula]?.titulo ?? aula}
                                </Link>
                                <span className="text-sm text-ink-soft">
                                  {fill(comum.minutos, { n: plano.minutosDe[aula] ?? aulas[aula]?.minutos ?? 0 })} ·{" "}
                                  <span className={feita ? "font-semibold text-ok" : ""}>{feita ? `✓ ${s.feito}` : s.aFazer}</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {plano.paraDepois.length > 0 && <p className="mt-3 text-sm text-ink-soft">{fill(s.paraDepois, { n: plano.paraDepois.length })}</p>}
          </section>

          <section className="mt-8" aria-labelledby="plano-dias">
            <h2 id="plano-dias" className="font-serif text-xl font-semibold">
              {s.escolherDias}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="plano-dias">
              {SEMANA.map((d) => {
                const marcado = plano.diasDaSemana.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={marcado}
                    aria-label={s.dias[d]}
                    disabled={marcado && plano.diasDaSemana.length === 1}
                    onClick={() => refazer({ dias: marcado ? plano.diasDaSemana.filter((x) => x !== d) : [...plano.diasDaSemana, d] })}
                    className={`min-h-11 min-w-12 cursor-pointer border-2 px-3 font-semibold disabled:cursor-not-allowed ${marcado ? "border-ink bg-ink text-parchment" : "border-rule hover:border-oxblood"}`}
                    data-dia-da-semana={d}
                  >
                    {s.diasCurtos[d]}
                  </button>
                );
              })}
            </div>
            <p className="mt-4">
              <button type="button" className="min-h-11 cursor-pointer underline hover:text-oxblood" onClick={() => refazer({})}>
                {s.remontar}
              </button>
            </p>
          </section>

          <section className="mt-8 border-t border-rule pt-6" aria-labelledby="plano-lembrete">
            <h2 id="plano-lembrete" className="font-serif text-xl font-semibold">
              {s.lembrete}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">{s.lembreteDica}</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                {s.lembreteHora}
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1 block min-h-11 border-2 border-ink bg-parchment px-3" />
              </label>
              <button type="button" className="inline-flex min-h-11 cursor-pointer items-center border-2 border-ink px-5 font-semibold hover:border-oxblood hover:text-oxblood" onClick={lembrete}>
                {s.lembrete}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
