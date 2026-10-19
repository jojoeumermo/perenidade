// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import { certaDe, corrigirEscolha, corrigirNumero, type ExercicioNovo } from "@/lib/exercicios";
import { responderExercicio } from "@/lib/meu-estudo";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L, useI18n } from "../I18n";

type S = TextosDoEstudo["exercicios"];
type Fase = "respondendo" | "certo" | "errado" | "resolvido";

const botao = "cursor-pointer bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood";

/** A etiqueta de revisão de um exercício: "Em revisão" até uma pessoa conferir; depois, quem (a função) e quando. */
export function EtiquetaDoExercicio({ ex, s }: { ex: ExercicioNovo; s: S }) {
  const { lang } = useI18n();
  if (ex.revisao.status === "revisada") {
    const data = new Date(`${ex.revisao.em}T12:00:00Z`).toLocaleDateString(htmlLang[lang], { timeZone: "UTC" });
    return <span className="border border-ok px-1.5 py-0.5 text-ok">{fill(s.revisado, { por: ex.revisao.por, data })}</span>;
  }
  return (
    <span className="border border-gold px-1.5 py-0.5 text-gold" title={s.emRevisaoDica}>
      {s.emRevisao}
    </span>
  );
}

/**
 * Um exercício: escolha entre alternativas ou resposta com número. A resposta é corrigida na hora, no aparelho. Errou:
 * aparece o engano mais comum que leva àquela resposta e como corrigir, sem nota e sem bronca; dá para tentar de novo
 * ou ver a resolução. Só a primeira resposta conta para a revisão espaçada (as outras tentativas são para aprender).
 */
export function CartaoDeExercicio({ ex, aula, s, posicao, corrigir, aoTerminar }: { ex: ExercicioNovo; aula: string; s: S; posicao?: string; corrigir?: string; aoTerminar?: (certoDePrimeira: boolean) => void }) {
  const [fase, setFase] = useState<Fase>("respondendo");
  const [tentadas, setTentadas] = useState<number[]>([]);
  const [texto, setTexto] = useState("");
  const [retorno, setRetorno] = useState("");
  const [naoEntendi, setNaoEntendi] = useState(false);
  /** O resultado da primeira resposta: é o que conta para a revisão espaçada. */
  const [primeira, setPrimeira] = useState<boolean | null>(null);
  const campo = useId();
  const certa = ex.tipo === "escolha" ? certaDe(ex) : -1;

  /** Guarda só a primeira resposta e devolve se ela foi certa. */
  function registrar(certo: boolean): boolean {
    if (primeira !== null) return primeira;
    setPrimeira(certo);
    responderExercicio(ex.id, { aula, tema: ex.tema, dificuldade: ex.dificuldade }, certo);
    return certo;
  }

  function escolher(j: number) {
    if (ex.tipo !== "escolha" || fase === "certo" || fase === "resolvido") return;
    const c = corrigirEscolha(ex, j);
    const dePrimeira = registrar(c.certo === true);
    if (c.certo) {
      setFase("certo");
      setRetorno("");
      aoTerminar?.(dePrimeira);
    } else {
      setTentadas((t) => [...t, j]);
      setFase("errado");
      setRetorno(c.engano ?? s.semEngano);
    }
  }

  function conferirNumero() {
    if (ex.tipo !== "numero") return;
    const c = corrigirNumero(ex, texto);
    if (c.certo === null) {
      setNaoEntendi(true);
      return;
    }
    setNaoEntendi(false);
    const dePrimeira = registrar(c.certo);
    if (c.certo) {
      setFase("certo");
      setRetorno("");
      aoTerminar?.(dePrimeira);
    } else {
      setFase("errado");
      setRetorno(c.engano ?? `${s.pista} ${ex.dica}`);
    }
  }

  function resolver() {
    setFase("resolvido");
    aoTerminar?.(false);
  }

  const pontos = "●".repeat(ex.dificuldade) + "○".repeat(3 - ex.dificuldade);
  const fechado = fase === "certo" || fase === "resolvido";

  return (
    <article className="border border-rule bg-parchment-deep p-5 font-sans text-sm" aria-labelledby={`${campo}-enunciado`}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-soft">
        {posicao && <span>{posicao}</span>}
        <span>{ex.tema}</span>
        <span>
          <span aria-hidden>{pontos} </span>
          {fill(s.dificuldade, { n: ex.dificuldade })}
        </span>
        <EtiquetaDoExercicio ex={ex} s={s} />
      </p>
      <p id={`${campo}-enunciado`} className="mt-3 font-serif text-xl leading-snug">
        {ex.enunciado}
      </p>

      {ex.tipo === "escolha" ? (
        <div className="mt-4 grid gap-2" role="group" aria-labelledby={`${campo}-enunciado`}>
          {ex.alternativas.map((alt, j) => {
            const tentada = tentadas.includes(j);
            const eACerta = j === certa && fechado;
            const estado = eACerta ? "border-ok text-ok" : tentada ? "border-oxblood text-oxblood" : "border-rule hover:border-gold";
            return (
              <button key={j} type="button" disabled={fechado || tentada} onClick={() => escolher(j)} className={`cursor-pointer border-2 bg-parchment px-4 py-2 text-left disabled:cursor-default ${estado}`}>
                {eACerta && <span aria-hidden>✓ </span>}
                {tentada && <span aria-hidden>✗ </span>}
                {alt.texto}
                {eACerta && <span className="sr-only"> ({s.certaSr})</span>}
                {tentada && <span className="sr-only"> ({s.tentadaSr})</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            conferirNumero();
          }}
        >
          <label htmlFor={campo} className="w-full text-ink-soft">
            {s.suaResposta}
          </label>
          <input
            id={campo}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value.slice(0, 40));
              if (fase === "errado") setFase("respondendo");
            }}
            disabled={fechado}
            inputMode="decimal"
            autoComplete="off"
            aria-describedby={`${campo}-formato`}
            className="w-40 border-2 border-ink bg-parchment px-3 py-2 font-mono"
          />
          {ex.unidade && <span className="pb-2">{ex.unidade}</span>}
          <button type="submit" className={botao} disabled={fechado || !texto.trim()}>
            {s.conferir}
          </button>
          <p id={`${campo}-formato`} className="w-full text-xs text-ink-soft">
            {s.formato}
          </p>
        </form>
      )}

      <div role="status" aria-live="polite" className="mt-3 min-h-0">
        {naoEntendi && <p className="text-oxblood">{s.naoEntendi}</p>}
        {fase === "certo" && (
          <div className="border-l-4 border-ok pl-3">
            <p className="font-semibold text-ok">{primeira ? s.certoDePrimeira : s.certoDepois}</p>
            <p className="mt-1 text-ink-soft">{ex.explicacao}</p>
          </div>
        )}
        {fase === "errado" && (
          <div className="border-l-4 border-gold pl-3">
            <p className="font-semibold">{s.quase}</p>
            <p className="mt-1">{retorno}</p>
          </div>
        )}
        {fase === "resolvido" && (
          <div className="border-l-4 border-gold pl-3">
            <p className="font-semibold">
              {s.resolucao} {ex.tipo === "escolha" ? ex.alternativas[certa]?.texto : `${ex.resposta}${ex.unidade ? ` ${ex.unidade}` : ""}`}
            </p>
            <p className="mt-1 text-ink-soft">{ex.explicacao}</p>
            {primeira === false && <p className="mt-2 text-xs text-ink-soft">{s.voltaAmanha}</p>}
          </div>
        )}
      </div>

      {fase === "errado" && (
        <p className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={claro}
            onClick={() => {
              setFase("respondendo");
              setRetorno("");
            }}
          >
            {s.tentarDeNovo}
          </button>
          <button type="button" className={claro} onClick={resolver}>
            {s.verResolucao}
          </button>
        </p>
      )}

      <p className="mt-4 text-xs text-ink-soft">
        {ex.fonte} · {fill(s.autoria, { nome: ex.autoria })}
        {corrigir && (
          <>
            {" · "}
            <L href={corrigir} className="underline hover:text-oxblood">
              {s.acheiUmErro}
            </L>
          </>
        )}
      </p>
    </article>
  );
}
