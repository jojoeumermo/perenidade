// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaTurma } from "@/i18n/escola/turma";
import { BackendError, hasBackend, useMe } from "@/lib/backend";
import {
  entrarNaTurmaDoCurso,
  type TurmaDoCurso as Situacao,
  turmaDoCurso as lerTurma,
} from "@/lib/escola/banco";
import {
  icsDosEncontros,
  type TurmaDoCursoNoMes,
} from "@/lib/escola/turma-do-curso";
import { JITSI_DOMINIO } from "@/lib/jitsi";
import { useCompleted } from "@/lib/progress";

type S = TextosDaTurma["turma"];

export interface AulaDaTurma {
  titulo: string;
  minutos: number;
}

type Quem = ReturnType<typeof useMe>;
const ContaDaPagina = createContext<Quem | null>(null);

/**
 * Lê a conta UMA vez para todas as turmas da página (a lista tem dois botões por curso; sem isto, cada botão pediria
 * "eu" ao banco). Toda página que monta EntrarNaTurma fica dentro deste provedor.
 */
export function ContaDasTurmas({ children }: { children: React.ReactNode }) {
  const quem = useMe();
  return (
    <ContaDaPagina.Provider value={quem}>{children}</ContaDaPagina.Provider>
  );
}

const data = (iso: string, idioma: string) =>
  new Intl.DateTimeFormat(idioma, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));

/**
 * Entrar e sair da turma de um curso num mês (turma_curso e turma_curso_entrar, do E4-02). Exige conta; sem conta,
 * explica e leva a /entrar. No curso sensível, um quadro destacado pede o "Concordo" antes de mandar qualquer coisa
 * (LGPD, art. 11, I); sair apaga o registro (p_entrar=false). A sala do encontro só aparece para quem entrou, no mês
 * corrente, pelo mesmo caminho da Turma do mês (components/TurmaDoMes.tsx). Precisa estar dentro de ContaDasTurmas.
 */
export function EntrarNaTurma({
  curso,
  titulo,
  mes,
  sensivel,
  proxima,
  s,
  lang,
}: {
  curso: string;
  titulo: string;
  mes: string;
  sensivel: boolean;
  proxima: boolean;
  s: S;
  lang: Locale;
}) {
  const quem = useContext(ContaDaPagina) ?? ({ status: "loading" } as Quem);
  const id = useId();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [concordo, setConcordo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [saiu, setSaiu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const logado = quem.status === "in";
  const ehSensivel = sensivel || situacao?.sensivel === true;

  useEffect(() => {
    if (!hasBackend || quem.status === "loading") return;
    let vivo = true;
    void lerTurma(mes, curso).then((t) => vivo && setSituacao(t));
    return () => {
      vivo = false;
    };
  }, [mes, curso, quem.status]);

  async function mudar(entrar: boolean) {
    setAviso("");
    setSaiu(false);
    // Curso sensível sem "Concordo": não manda nada.
    if (entrar && ehSensivel && !concordo) {
      setAviso(s.marqueConcordo);
      return;
    }
    setEnviando(true);
    try {
      const nova = await entrarNaTurmaDoCurso(
        mes,
        curso,
        entrar,
        entrar && ehSensivel ? concordo : false,
      );
      if (nova) setSituacao(nova);
      if (!entrar) {
        setSaiu(true);
        setConcordo(false);
      }
    } catch (e) {
      const codigo = e instanceof BackendError ? e.code : "";
      setAviso(
        codigo === "consentimento"
          ? s.consentimento
          : codigo === "entre_primeiro"
            ? s.semConta
            : s.erro,
      );
    } finally {
      setEnviando(false);
    }
  }

  // Sem o serviço, o aviso aparece uma vez por curso (no mês corrente), não em cada botão.
  if (!hasBackend) return proxima ? null : <p className="turma-nota">{s.semServico}</p>;

  const n = situacao?.inscritos ?? null;
  return (
    <div className="turma-entrar" data-turma-entrar={`${curso}:${mes}`}>
      {n !== null && (
        <p className="turma-inscritos">
          {n === 1 ? s.inscritaUma : fill(s.inscritos, { n })}
        </p>
      )}

      {!logado ? (
        quem.status === "loading" ? null : (
          <div className="turma-sem-conta" data-turma-sem-conta="">
            <p>{s.semConta}</p>
            <Link
              href={localePath(lang, "/entrar")}
              className="botao botao-tinta"
            >
              {proxima ? s.avisar : s.entrar}
            </Link>
          </div>
        )
      ) : situacao?.eu ? (
        <>
          <p className="turma-nota" role="status">
            {proxima ? s.dentroProxima : s.dentro}
          </p>
          <div className="turma-botoes">
            {situacao.sala && !proxima && (
              <a
                href={`https://${JITSI_DOMINIO}/${situacao.sala}`}
                target="_blank"
                rel="noreferrer"
                className="botao botao-tinta"
                data-turma-sala=""
              >
                {s.abrirSala}
              </a>
            )}
            <button
              type="button"
              className="botao"
              disabled={enviando}
              onClick={() => void mudar(false)}
              data-turma-sair=""
            >
              {s.sair}
            </button>
          </div>
        </>
      ) : (
        <>
          {ehSensivel && (
            <div
              className="turma-consentimento"
              role="group"
              aria-labelledby={`${id}-t`}
              data-turma-consentimento=""
            >
              <p id={`${id}-t`} className="turma-consentimento-titulo">
                {s.sensivelTitulo}
              </p>
              <p className="turma-consentimento-texto">{s.sensivelTexto}</p>
              <p className="turma-consentimento-lei">{s.sensivelLei}</p>
              <label className="turma-concordo">
                <input
                  type="checkbox"
                  checked={concordo}
                  onChange={(e) => setConcordo(e.target.checked)}
                  data-turma-concordo=""
                />
                <span>{s.concordo}</span>
              </label>
            </div>
          )}
          <div className="turma-botoes">
            <button
              type="button"
              className="botao botao-tinta"
              disabled={enviando}
              onClick={() => void mudar(true)}
              data-turma-entrar-botao=""
              aria-label={`${proxima ? s.avisar : s.entrar}: ${titulo}`}
            >
              {proxima ? s.avisar : s.entrar}
            </button>
          </div>
        </>
      )}
      {saiu && (
        <p className="turma-nota" role="status" data-turma-saiu="">
          {s.saiu}
        </p>
      )}
      {aviso && (
        <p role="alert" className="turma-aviso">
          {aviso}
        </p>
      )}
    </div>
  );
}

/** O cronograma do mês: 4 semanas, as aulas com o progresso deste aparelho, os encontros, o seminário e o .ics. */
export function CronogramaDaTurma({
  turma,
  aulas,
  tituloDoCurso,
  endereco,
  s,
  lang,
  idioma,
}: {
  turma: TurmaDoCursoNoMes;
  aulas: Record<string, AulaDaTurma>;
  tituloDoCurso: string;
  endereco: string;
  s: S;
  lang: Locale;
  idioma: string;
}) {
  const feitas = useCompleted();
  const todas = turma.semanas.flatMap((w) => w.aulas);
  const minhas = todas.filter((a) => feitas.has(a)).length;

  function baixarIcs() {
    const texto = icsDosEncontros(
      turma,
      {
        titulo: tituloDoCurso,
        seminario: s.seminario.replace(/[:：].*$/, "").trim(),
        descricao: s.icsDescricao,
      },
      endereco,
    );
    const url = URL.createObjectURL(
      new Blob([texto], { type: "text/calendar;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.nomeDoIcs}-${turma.curso}-${turma.mes}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div className="turma-cronograma" data-cronograma={turma.mes}>
      <p className="turma-progresso">
        {fill(s.progresso, { feitas: minhas, total: todas.length })}
      </p>
      {turma.continua && (
        <p className="turma-nota">{fill(s.continua, { n: todas.length })}</p>
      )}
      <ol className="turma-semanas">
        {turma.semanas.map((semana, i) => {
          const seminario = semana.encontro === turma.seminario;
          return (
            <li
              key={semana.inicio}
              className="turma-semana"
              data-semana={i + 1}
            >
              <p className="turma-semana-rotulo">
                {fill(s.semana, {
                  n: i + 1,
                  data: data(semana.inicio, idioma),
                })}
              </p>
              {semana.aulas.length ? (
                <ul className="turma-aulas">
                  {semana.aulas.map((id) => {
                    const feita = feitas.has(id);
                    const aula = aulas[id];
                    return (
                      <li key={id}>
                        <span
                          aria-hidden
                          className={`turma-caixa ${feita ? "turma-caixa-feita" : ""}`}
                        />
                        <span className="min-w-0">
                          <Link
                            href={localePath(lang, `/trilhas/${id}`)}
                            className="turma-aula-link"
                            lang="pt"
                          >
                            {aula?.titulo ?? id}
                          </Link>
                          <span className="turma-aula-dados">
                            {aula
                              ? ` · ${fill(s.minutos, { n: aula.minutos })}`
                              : ""}
                            {feita ? ` · ${s.feita}` : ""}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="turma-nota">{s.semAulaNaSemana}</p>
              )}
              <p
                className={
                  seminario
                    ? "turma-encontro turma-encontro-seminario"
                    : "turma-encontro"
                }
              >
                {fill(seminario ? s.seminario : s.encontro, {
                  data: data(semana.encontro, idioma),
                })}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="mt-4">
        <button
          type="button"
          className="botao"
          onClick={baixarIcs}
          data-turma-ics=""
        >
          {s.baixarIcs}
        </button>
      </p>
    </div>
  );
}
