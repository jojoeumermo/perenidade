// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { lerCartoes } from "@/lib/estudo";
import type { ExercicioNovo } from "@/lib/exercicios";
import { lerRespostas, paraRevisar, type RespostaGuardada } from "@/lib/meu-estudo";
import { ligado } from "@/lib/recursos";
import { useHydrated } from "@/lib/storage";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { useTextosDaBusca } from "../busca/TextosDaBusca";
import { L } from "../I18n";
import { ComecoEmTresPassos } from "./ComecoEmTresPassos";
import { CartaoDeExercicio } from "./Exercicio";
import { useGuardado } from "./guardado";

export interface ExercicioComOrigem {
  ex: ExercicioNovo;
  /** trilha/aula */
  aula: string;
  tituloDaAula: string;
  trilha: string;
  tituloDaTrilha: string;
}

const TAMANHO = 10;
/** A aula que o "Revisar esta aula" do fim da aula (E4-03) deixou para praticar primeiro: {aula: "trilha/aula"}. */
export const CHAVE_PRATICAR_AULA = "lucia:praticar-aula";

/** Lê e apaga a aula pedida pelo "Revisar esta aula" (sessionStorage; forma errada vira null). */
function tirarAulaPedida(): string | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_PRATICAR_AULA);
    sessionStorage.removeItem(CHAVE_PRATICAR_AULA);
    if (!bruto) return null;
    let aula: unknown = bruto;
    try {
      aula = (JSON.parse(bruto) as { aula?: unknown })?.aula ?? bruto;
    } catch {
      // gravado como texto puro ("trilha/aula"): vale também
    }
    return typeof aula === "string" && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(aula) ? aula : null;
  } catch {
    return null;
  }
}
const botao = "cursor-pointer bg-ink px-5 py-2.5 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const campo = "mt-1 w-full border-2 border-ink bg-parchment px-3 py-2";

/**
 * Praticar: os exercícios com explicação de todas as aulas que têm, à vontade (com filtro por trilha, dificuldade e
 * tema, dos mais fáceis para os mais difíceis) ou "revisar meus erros" (os que a pessoa errou e já chegou o dia de
 * refazer). Um exercício por vez; no fim, um resumo sem nota.
 */
export function Praticar({ todos, s, sEx }: { todos: ExercicioComOrigem[]; s: TextosDoEstudo["praticar"]; sEx: TextosDoEstudo["exercicios"] }) {
  const hidratado = useHydrated();
  const [respostas] = useGuardado<Record<string, RespostaGuardada>>(lerRespostas, {});
  const [modo, setModo] = useState<"livre" | "revisar">("livre");
  const [trilha, setTrilha] = useState("");
  const [nivel, setNivel] = useState(0);
  const [tema, setTema] = useState("");
  const [sessao, setSessao] = useState<string[] | null>(null);
  const [posicao, setPosicao] = useState(0);
  const [terminado, setTerminado] = useState(false);
  const [resultados, setResultados] = useState<Record<string, boolean>>({});
  const [aulaPedida, setAulaPedida] = useState<string | null>(null);
  const busca = useTextosDaBusca();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("modo") === "revisar") void Promise.resolve().then(() => setModo("revisar"));
  }, []);

  // Etapa 4 (E4-05): veio do "Revisar esta aula"? Os exercícios daquela aula vêm primeiro, depois os da mesma trilha.
  useEffect(() => {
    const aula = tirarAulaPedida();
    if (!aula) return;
    const daAula = todos.filter((x) => x.aula === aula).sort((a, b) => a.ex.dificuldade - b.ex.dificuldade);
    const trilhaDaAula = aula.split("/")[0];
    const daTrilha = todos.filter((x) => x.aula !== aula && x.trilha === trilhaDaAula).sort((a, b) => a.ex.dificuldade - b.ex.dificuldade);
    void Promise.resolve().then(() => {
      setAulaPedida(aula);
      if (daAula.length > 0) {
        setModo("livre");
        setSessao([...daAula, ...daTrilha].slice(0, TAMANHO).map((x) => x.ex.id));
        setPosicao(0);
        setResultados({});
        setTerminado(false);
      }
    });
  }, [todos]);

  if (!hidratado) return null;

  // O aviso da aula pedida: de qual aula são os primeiros exercícios e quantos cartões dela estão no baralho.
  const tituloPedido = aulaPedida ? (todos.find((x) => x.aula === aulaPedida)?.tituloDaAula ?? aulaPedida) : "";
  const temExerciciosDaAula = Boolean(aulaPedida && todos.some((x) => x.aula === aulaPedida));
  const cartoesDaAula = aulaPedida ? lerCartoes().filter((c) => c.origem === tituloPedido).length : 0;
  const avisoDaAula =
    aulaPedida && busca ? (
      <div className="mt-6 border-l-2 border-gold pl-3 font-sans text-sm" data-praticar-aula={aulaPedida}>
        <p>{fill(temExerciciosDaAula ? busca.textos.praticarAula.primeiro : busca.textos.praticarAula.semExercicios, { aula: tituloPedido })}</p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {cartoesDaAula > 0 && (
            <L href="/caderno?ferramenta=revisao" className="underline hover:text-oxblood">
              {fill(busca.textos.praticarAula.cartoes, { n: cartoesDaAula })}
            </L>
          )}
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => { setAulaPedida(null); setSessao(null); }}>
            {busca.textos.praticarAula.fechar}
          </button>
        </p>
      </div>
    ) : null;

  // Etapa 4 (E4-05): nada para praticar ainda? O vazio ensina a começar.
  if (todos.length === 0 && ligado("escola")) {
    return (
      <section className="mt-8 border border-rule bg-parchment-deep p-5" aria-label={s.titulo}>
        <ComecoEmTresPassos caso="praticar" />
      </section>
    );
  }

  const trilhas = [...new Map(todos.map((x) => [x.trilha, x.tituloDaTrilha])).entries()];
  const temas = [...new Set(todos.filter((x) => !trilha || x.trilha === trilha).map((x) => x.ex.tema))].sort();
  const devidos = new Set(paraRevisar(respostas));
  const escolhidos =
    modo === "revisar"
      ? todos.filter((x) => devidos.has(x.ex.id))
      : todos.filter((x) => (!trilha || x.trilha === trilha) && (!nivel || x.ex.dificuldade === nivel) && (!tema || x.ex.tema === tema));
  const porId = new Map(todos.map((x) => [x.ex.id, x]));

  function comecar() {
    // À vontade: dos mais fáceis para os mais difíceis, sorteando dentro de cada nível; na revisão, os mais atrasados primeiro.
    const ordem = modo === "revisar" ? escolhidos : [...escolhidos].sort((a, b) => a.ex.dificuldade - b.ex.dificuldade || Math.random() - 0.5);
    setSessao(ordem.slice(0, TAMANHO).map((x) => x.ex.id));
    setPosicao(0);
    setResultados({});
    setTerminado(false);
  }

  if (sessao) {
    const atual = porId.get(sessao[posicao]);
    if (!atual || posicao >= sessao.length) {
      const dePrimeira = Object.values(resultados).filter(Boolean).length;
      const voltam = Object.values(resultados).filter((r) => !r).length;
      return (
        <section className="mt-8 border-2 border-ink bg-parchment-deep p-6 font-sans text-sm" aria-labelledby="pr-fim">
          <h2 id="pr-fim" className="font-serif text-2xl font-semibold">
            {s.fimTitulo}
          </h2>
          <p className="mt-2">{fill(s.fimResumo, { n: sessao.length, a: dePrimeira })}</p>
          {voltam > 0 && <p className="mt-1 text-ink-soft">{fill(s.fimVoltam, { n: voltam })}</p>}
          <p className="mt-1 text-ink-soft">{s.fimAnimo}</p>
          <p className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={botao} onClick={() => setSessao(null)}>
              {s.deNovo}
            </button>
            <L href="/meu-estudo" className="self-center underline hover:text-oxblood">
              {s.voltarAoMeuEstudo}
            </L>
          </p>
        </section>
      );
    }
    return (
      <>
      {avisoDaAula}
      <section className="mt-8" aria-label={s.titulo}>
        <p className="flex flex-wrap items-center justify-between gap-2 font-sans text-sm">
          <span className="font-mono text-xs text-ink-soft">{fill(s.posicao, { i: posicao + 1, n: sessao.length })}</span>
          <span className="text-ink-soft">
            {s.daAula}{" "}
            <L href={`/trilhas/${atual.aula}`} className="underline hover:text-oxblood">
              {atual.tituloDaAula}
            </L>
          </span>
        </p>
        <div className="mt-2">
          <CartaoDeExercicio
            key={atual.ex.id}
            ex={atual.ex}
            aula={atual.aula}
            s={sEx}
            corrigir={`/contribuir?corrigir=${encodeURIComponent(`/trilhas/${atual.aula}`)}`}
            aoTerminar={(certo) => {
              setResultados((r) => (atual.ex.id in r ? r : { ...r, [atual.ex.id]: certo }));
              setTerminado(true);
            }}
          />
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-3 font-sans text-sm">
          <button
            type="button"
            className={botao}
            disabled={!terminado}
            onClick={() => {
              setPosicao((p) => p + 1);
              setTerminado(false);
            }}
          >
            {posicao + 1 < sessao.length ? s.proximo : s.terminar}
          </button>
          {!terminado && <span className="text-xs text-ink-soft">{s.respondaParaSeguir}</span>}
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setSessao(null)}>
            {s.parar}
          </button>
        </p>
      </section>
      </>
    );
  }

  return (
    <>
    {avisoDaAula}
    <section className="mt-8 border border-rule bg-parchment-deep p-5 font-sans text-sm" aria-labelledby="pr-escolha">
      <h2 id="pr-escolha" className="font-serif text-2xl font-semibold">
        {s.comoPraticar}
      </h2>
      <fieldset className="mt-3">
        <legend className="sr-only">{s.modo}</legend>
        <div className="flex flex-wrap gap-2">
          {(["livre", "revisar"] as const).map((m) => (
            <label key={m} className={`cursor-pointer border-2 px-3 py-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold ${modo === m ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
              <input type="radio" name="modo" className="sr-only" checked={modo === m} onChange={() => setModo(m)} />
              {m === "livre" ? s.livre : fill(s.revisarMeusErros, { n: devidos.size })}
            </label>
          ))}
        </div>
      </fieldset>
      {modo === "revisar" ? (
        <p className="mt-3 text-ink-soft">{devidos.size > 0 ? s.revisarLead : s.revisarVazio}</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            {s.trilha}
            <select value={trilha} onChange={(e) => { setTrilha(e.target.value); setTema(""); }} className={campo}>
              <option value="">{s.todas}</option>
              {trilhas.map(([slug, titulo]) => (
                <option key={slug} value={slug}>
                  {titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {s.dificuldade}
            <select value={nivel} onChange={(e) => setNivel(Number(e.target.value))} className={campo}>
              <option value={0}>{s.todas}</option>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {fill(s.nivel, { n })}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {s.tema}
            <select value={tema} onChange={(e) => setTema(e.target.value)} className={campo}>
              <option value="">{s.todos}</option>
              {temas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <p className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className={botao} disabled={escolhidos.length === 0} onClick={comecar}>
          {fill(s.comecar, { n: Math.min(TAMANHO, escolhidos.length) })}
        </button>
        <span className="text-xs text-ink-soft">{fill(s.disponiveis, { n: escolhidos.length })}</span>
      </p>
      {todos.some((x) => x.ex.revisao.status === "em-revisao") && <p className="mt-4 border-l-2 border-gold pl-3 text-xs text-ink-soft">{sEx.avisoEmRevisao}</p>}
    </section>
    </>
  );
}
