// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { L } from "@/components/I18n";
import { useInscricoes } from "@/components/escola/guardado-escola";
import { useGuardado } from "@/components/estudo/guardado";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { detalheDoReconhecimento, lerProvas, MAX_AVALIADOR, podeDispensar, type ProvaGuardada, registrosDaProva } from "@/lib/escola/avaliacao";
import { acrescentarNaCaderneta, diaEmBrasilia, MAX_DETALHE } from "@/lib/escola/estudante";

export interface TrilhaDosSaberes {
  slug: string;
  titulo: string;
  prova: boolean;
  disponiveis: Record<string, number>;
}

export interface CursoDosSaberes {
  slug: string;
  titulo: string;
  alternancia: boolean;
  trilhas: TrilhaDosSaberes[];
  /** As tarefas de "tempo trabalho" de todos os módulos (formato alternância), na ordem. */
  praticas: string[];
}

const SEM_PROVAS: Record<string, ProvaGuardada[]> = {};

/** A trilha já foi mostrada numa prova de proficiência deste aparelho (alguma deu "já sabe" em todos os temas)? */
export function mostrouNaProficiencia(provas: ProvaGuardada[] | undefined, disponiveis: Record<string, number>): boolean {
  return (provas ?? []).some((p) => p.modo === "proficiencia" && podeDispensar(registrosDaProva(p.porTema), disponiveis));
}

/**
 * O reconhecimento de saberes (E4-13, R1-48): a pessoa escolhe um curso que já domina pela vida e segue três passos:
 * (1) as provas de proficiência de cada trilha; (2) nos cursos de alternância, as tarefas de tempo trabalho viram um
 * roteiro de avaliação prática, feito ao vivo com um educador ou alguém do Núcleo; (3) o registro "Saberes
 * reconhecidos" vai para a caderneta, com o nome de quem avaliou só se essa pessoa permitir. É registro da Escola, não
 * certificação oficial. Tudo fica no aparelho.
 */
export function ReconhecimentoDeSaberes({ cursos, s }: { cursos: CursoDosSaberes[]; s: TextosDaAvaliacao["saberes"] }) {
  const inscricoes = useInscricoes();
  const [provas] = useGuardado(lerProvas, SEM_PROVAS);
  const [escolhido, setEscolhido] = useState("");
  const [conferidas, setConferidas] = useState<number[]>([]);
  const [avaliador, setAvaliador] = useState("");
  const [permissao, setPermissao] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [registrado, setRegistrado] = useState(false);
  const curso = cursos.find((c) => c.slug === escolhido) ?? null;
  const inscricao = curso ? inscricoes.find((i) => i.curso === curso.slug && !i.trancadoEm) : undefined;

  const estadoDa = (t: TrilhaDosSaberes): "dispensada" | "ja-mostrou" | "a-fazer" =>
    inscricao?.dispensas.includes(t.slug) ? "dispensada" : mostrouNaProficiencia(provas[t.slug], t.disponiveis) ? "ja-mostrou" : "a-fazer";
  const mostradas = curso ? curso.trilhas.filter((t) => estadoDa(t) !== "a-fazer") : [];
  const praticas = curso ? conferidas.map((i) => curso.praticas[i]).filter(Boolean) : [];
  const nome = avaliador.trim().slice(0, MAX_AVALIADOR);
  // Prática conferida pede quem conferiu, com a permissão dela para o nome ficar na caderneta.
  const faltaAvaliador = praticas.length > 0 && !(nome && permissao);
  const temOQue = mostradas.length > 0 || praticas.length > 0;

  function escolher(slug: string) {
    setEscolhido(slug);
    setConferidas([]);
    setRegistrado(false);
  }

  function registrar() {
    if (!curso || !temOQue || faltaAvaliador) return;
    const detalhe = detalheDoReconhecimento({ trilhas: mostradas.map((t) => t.titulo), praticas, observacao, rotulos: s.rotulos }).slice(0, MAX_DETALHE);
    const feito = acrescentarNaCaderneta({
      tipo: "saberes",
      curso: curso.slug,
      data: diaEmBrasilia(new Date()),
      titulo: s.tituloDoRegistro,
      detalhe,
      ...(nome && permissao ? { pessoas: [nome] } : {}),
    });
    if (feito) setRegistrado(true);
  }

  return (
    <div className="font-sans" data-reconhecimento-de-saberes="">
      <label className="mt-8 block font-semibold" htmlFor="curso-dos-saberes">
        {s.escolha}
      </label>
      <select id="curso-dos-saberes" className="campo-dos-saberes" value={escolhido} onChange={(e) => escolher(e.target.value)}>
        <option value="">{s.escolher}</option>
        {cursos.map((c) => (
          <option key={c.slug} value={c.slug} lang="pt">
            {c.titulo}
          </option>
        ))}
      </select>

      {curso && (
        <>
          <section className="passo-dos-saberes" aria-labelledby="saberes-passo-1">
            <h2 id="saberes-passo-1">{s.passo1}</h2>
            <p className="mt-1">{s.passo1Texto}</p>
            {!inscricao && (
              <p className="mt-2 text-sm text-ink-soft">
                {s.entrar}{" "}
                <L href={`/escola/cursos/${curso.slug}`} className="underline hover:text-oxblood">
                  {s.verCurso} →
                </L>
              </p>
            )}
            <ul>
              {curso.trilhas.map((t) => {
                const estado = estadoDa(t);
                return (
                  <li key={t.slug} className="prova-da-trilha" data-trilha-dos-saberes={t.slug} data-estado={estado}>
                    <span lang="pt">
                      {t.titulo}{" "}
                      <span className="text-sm font-normal text-ink-soft">({estado === "dispensada" ? s.dispensada : estado === "ja-mostrou" ? s.jaMostrou : s.aFazer})</span>
                    </span>
                    {t.prova ? (
                      <L href={`/trilhas/${t.slug}/prova?modo=proficiencia`} className="font-semibold underline hover:text-oxblood">
                        {s.fazerProva}
                      </L>
                    ) : (
                      <span className="w-full text-sm text-ink-soft">{s.semProva}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="passo-dos-saberes" aria-labelledby="saberes-passo-2">
            <h2 id="saberes-passo-2">{s.passo2}</h2>
            {curso.alternancia && curso.praticas.length > 0 ? (
              <>
                <p className="mt-1">{s.passo2Texto}</p>
                <p className="mt-2">
                  <span className="selo-em-revisao">{s.roteiroEmRevisao}</span>
                </p>
                <ul>
                  {curso.praticas.map((p, i) => (
                    <li key={`${i}-${p}`}>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1.5" checked={conferidas.includes(i)} onChange={(e) => setConferidas((c) => (e.target.checked ? [...c, i] : c.filter((x) => x !== i)))} />
                        <span>
                          <span lang="pt">{p}</span>
                          {conferidas.includes(i) && <span className="ml-2 text-sm text-ok">({s.conferida})</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1">{s.semPratica}</p>
            )}
          </section>

          <section className="passo-dos-saberes" aria-labelledby="saberes-passo-3">
            <h2 id="saberes-passo-3">{s.passo3}</h2>
            <label className="mt-3 block" htmlFor="avaliador-dos-saberes">
              {s.avaliador}
            </label>
            <input id="avaliador-dos-saberes" className="campo-dos-saberes" value={avaliador} maxLength={MAX_AVALIADOR} autoComplete="off" onChange={(e) => setAvaliador(e.target.value)} />
            <label className="mt-2 flex items-start gap-2">
              <input type="checkbox" className="mt-1.5" checked={permissao} onChange={(e) => setPermissao(e.target.checked)} />
              <span>{s.permissao}</span>
            </label>
            <label className="mt-3 block" htmlFor="observacao-dos-saberes">
              {s.observacao}
            </label>
            <textarea id="observacao-dos-saberes" className="campo-dos-saberes min-h-24" value={observacao} maxLength={600} onChange={(e) => setObservacao(e.target.value)} />
            {!temOQue && <p className="mt-2 text-sm text-ink-soft">{s.nada}</p>}
            {temOQue && faltaAvaliador && <p className="mt-2 text-sm text-ink-soft">{s.faltaAvaliador}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-4">
              <button type="button" className="botao botao-tinta botao-menor disabled:cursor-not-allowed disabled:opacity-50" disabled={!temOQue || faltaAvaliador || registrado} onClick={registrar}>
                {s.registrar}
              </button>
              {registrado && (
                <span role="status" data-saberes-registrado="">
                  {s.registrado}{" "}
                  <L href="/escola/caderneta" className="underline hover:text-oxblood">
                    {s.verCaderneta} →
                  </L>
                </span>
              )}
            </p>
            <p className="mt-3 text-xs text-ink-soft">{s.soNoAparelho}</p>
          </section>
        </>
      )}
    </div>
  );
}
