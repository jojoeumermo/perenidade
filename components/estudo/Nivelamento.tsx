// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import { corrigirEscolha, corrigirNumero, type ExercicioNovo } from "@/lib/exercicios";
import { gravarNivelamento, lerNivelamentos, sugerirInicio } from "@/lib/meu-estudo";
import { useHydrated } from "@/lib/storage";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L, useI18n } from "../I18n";
import { useGuardado } from "./guardado";

type S = TextosDoEstudo["nivelamento"];

export interface TesteDeNivelamento {
  trilha: string;
  titulo: string;
  /** As aulas prontas da trilha, na ordem do roteiro ("trilha/aula"), com o título. */
  roteiro: { id: string; titulo: string }[];
  questoes: { aula: string; ex: ExercicioNovo }[];
}

const botao = "cursor-pointer bg-ink px-5 py-2.5 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-4 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood";

/** Uma pergunta do nivelamento: sem certo/errado na tela (não é prova); "Não sei" vale e é bem-vindo. */
function Pergunta({ ex, s, responder }: { ex: ExercicioNovo; s: S; responder: (certo: boolean) => void }) {
  const [texto, setTexto] = useState("");
  return (
    <div className="border border-rule bg-parchment-deep p-5">
      <p className="font-serif text-xl leading-snug" id={`niv-${ex.id}`}>
        {ex.enunciado}
      </p>
      {ex.tipo === "escolha" ? (
        <div className="mt-4 grid gap-2" role="group" aria-labelledby={`niv-${ex.id}`}>
          {ex.alternativas.map((alt, j) => (
            <button key={j} type="button" onClick={() => responder(corrigirEscolha(ex, j).certo === true)} className="cursor-pointer border-2 border-rule bg-parchment px-4 py-2 text-left hover:border-gold">
              {alt.texto}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            responder(corrigirNumero(ex, texto).certo === true);
          }}
        >
          <label htmlFor={`niv-campo-${ex.id}`} className="w-full text-ink-soft">
            {s.suaResposta}
          </label>
          <input id={`niv-campo-${ex.id}`} value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 40))} inputMode="decimal" autoComplete="off" className="w-40 border-2 border-ink bg-parchment px-3 py-2 font-mono" />
          {ex.unidade && <span className="pb-2">{ex.unidade}</span>}
          <button type="submit" className={botao} disabled={!texto.trim()}>
            {s.seguir}
          </button>
        </form>
      )}
      <button type="button" className="mt-4 cursor-pointer text-sm underline hover:text-oxblood" onClick={() => responder(false)}>
        {s.naoSei}
      </button>
    </div>
  );
}

/**
 * Nivelamento (recurso "nivelamento"): poucas perguntas, uma por tema da trilha, que só sugerem por onde começar.
 * Pode ser pulado, não mostra nota nem acerto durante o teste, não gera rótulo; a sugestão fica só no aparelho.
 * As perguntas são os exercícios marcados com "nivelamento: true" em content/exercicios.
 */
export function Nivelamento({ testes, s }: { testes: TesteDeNivelamento[]; s: S }) {
  const hidratado = useHydrated();
  const [trilha, setTrilha] = useState(testes[0]?.trilha ?? "");
  const [posicao, setPosicao] = useState<number | null>(null);
  const [respostas, setRespostas] = useState<Record<string, boolean>>({});
  const [, recarregar] = useGuardado(lerNivelamentos, {});
  if (!hidratado) return null;
  const teste = testes.find((t) => t.trilha === trilha);
  if (!teste) return <p className="mt-6 text-ink-soft">{s.nenhum}</p>;
  const nomeDe = (id: string | null) => teste.roteiro.find((a) => a.id === id)?.titulo ?? id ?? "";

  if (posicao !== null && posicao < teste.questoes.length) {
    const q = teste.questoes[posicao];
    return (
      <section className="mt-8 font-sans text-sm" aria-label={teste.titulo}>
        <p className="flex flex-wrap justify-between gap-2 font-mono text-xs text-ink-soft">
          <span>{fill(s.posicao, { i: posicao + 1, n: teste.questoes.length })}</span>
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setPosicao(null)}>
            {s.parar}
          </button>
        </p>
        <div className="mt-2">
          <Pergunta
            key={q.ex.id}
            ex={q.ex}
            s={s}
            responder={(certo) => {
              const novas = { ...respostas, [q.aula]: certo };
              setRespostas(novas);
              if (posicao + 1 >= teste.questoes.length) {
                const sugestao = sugerirInicio(teste.roteiro.map((a) => a.id), novas, teste.questoes.map((x) => x.aula));
                gravarNivelamento(teste.trilha, { sugestao, titulo: sugestao ? nomeDe(sugestao) : undefined });
                recarregar();
              }
              setPosicao(posicao + 1);
            }}
          />
        </div>
      </section>
    );
  }

  if (posicao !== null) {
    const sugestao = sugerirInicio(teste.roteiro.map((a) => a.id), respostas, teste.questoes.map((x) => x.aula));
    const firmes = teste.questoes.filter((q) => respostas[q.aula]).map((q) => nomeDe(q.aula));
    return (
      <section className="mt-8 border-2 border-ink bg-parchment-deep p-6 font-sans text-sm" aria-labelledby="niv-fim">
        <h2 id="niv-fim" className="font-serif text-2xl font-semibold">
          {s.fimTitulo}
        </h2>
        {sugestao ? (
          <p className="mt-2 text-lg">
            {s.sugestao}{" "}
            <L href={`/trilhas/${sugestao}`} className="font-semibold underline hover:text-oxblood">
              {nomeDe(sugestao)}
            </L>
            .
          </p>
        ) : (
          <p className="mt-2 text-lg">{s.tudoFirme}</p>
        )}
        {firmes.length > 0 && <p className="mt-2 text-ink-soft">{fill(s.jaFirme, { lista: firmes.join(", ") })}</p>}
        <p className="mt-2 text-ink-soft">{s.fimLead}</p>
        <p className="mt-4 flex flex-wrap gap-3">
          {sugestao && (
            <L href={`/trilhas/${sugestao}`} className={botao}>
              {s.irParaAula}
            </L>
          )}
          <L href={`/trilhas/${teste.trilha}`} className={claro}>
            {s.verTrilha}
          </L>
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 border border-rule bg-parchment-deep p-5 font-sans text-sm" aria-labelledby="niv-inicio">
      <h2 id="niv-inicio" className="font-serif text-2xl font-semibold">
        {s.antesTitulo}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
        {s.regras.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {testes.length > 1 && (
        <label className="mt-4 block max-w-md">
          {s.trilha}
          <select value={trilha} onChange={(e) => setTrilha(e.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2">
            {testes.map((t) => (
              <option key={t.trilha} value={t.trilha}>
                {t.titulo}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={botao} onClick={() => { setRespostas({}); setPosicao(0); }}>
          {fill(s.comecar, { n: teste.questoes.length, trilha: teste.titulo })}
        </button>
        <L href={`/trilhas/${teste.trilha}`} className={claro}>
          {s.pular}
        </L>
      </p>
    </section>
  );
}

/** As sugestões já guardadas, dentro do "Meu estudo". */
export function NivelamentosFeitos({ s }: { s: S }) {
  const { lang } = useI18n();
  const [feitos] = useGuardado(lerNivelamentos, {});
  const lista = Object.entries(feitos);
  return (
    <section aria-labelledby="me-nivel" className="border border-rule bg-parchment-deep p-5">
      <h2 id="me-nivel" className="font-serif text-2xl font-semibold">
        {s.titulo}
      </h2>
      {lista.length === 0 ? (
        <p className="mt-2 text-ink-soft">
          {s.convite}{" "}
          <L href="/nivelamento" className="underline hover:text-oxblood">
            {s.fazer}
          </L>
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {lista.map(([trilha, n]) => (
            <li key={trilha}>
              {n.sugestao ? (
                <>
                  {s.sugestaoGuardada}{" "}
                  <L href={`/trilhas/${n.sugestao}`} className="underline hover:text-oxblood">
                    {n.titulo ?? n.sugestao}
                  </L>
                </>
              ) : (
                s.tudoFirme
              )}{" "}
              <span className="text-xs text-ink-soft">({new Date(n.quando).toLocaleDateString(htmlLang[lang])})</span>
            </li>
          ))}
          <li>
            <L href="/nivelamento" className="text-xs underline hover:text-oxblood">
              {s.refazer}
            </L>
          </li>
        </ul>
      )}
    </section>
  );
}
