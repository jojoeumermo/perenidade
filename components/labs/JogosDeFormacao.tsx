// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { fill, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { useI18n } from "../I18n";

type Placar = { unidade: number; fundo: number; pressao: number; apoio: number };
interface Escolha {
  texto: string;
  efeito: Partial<Placar>;
  retorno: string;
  historia?: string;
}
interface Cena {
  titulo: string;
  texto: string;
  escolhas: Escolha[];
}
export interface DadosDaGreve {
  sobre: string;
  inicio: Placar;
  cenas: Cena[];
  finais: Record<"vitoria" | "parcial" | "derrota", { titulo: string; texto: string }>;
  aulas: { titulo: string; href: string }[];
}
export interface Fato {
  dia: string;
  ano: number;
  texto: string;
  link?: string;
}
export interface Frase {
  texto: string;
  autor: string;
  fonte: string;
}

type S = Dict["labs"]["jogos"];
const limitar = (n: number) => Math.max(0, Math.min(100, n));
/** Embaralha uma cópia (Fisher-Yates). Só roda depois de um clique, então não há diferença entre servidor e navegador. */
function embaralhar<T>(lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Greve!: seis decisões numa greve inventada, com quatro medidores e o que cada escolha costuma provocar na luta real. */
function Greve({ dados, s }: { dados: DadosDaGreve; s: S }) {
  const { lang } = useI18n();
  const [cena, setCena] = useState(-1);
  const [placar, setPlacar] = useState<Placar>(dados.inicio);
  const [escolhida, setEscolhida] = useState<Escolha | null>(null);
  const medidores: [keyof Placar, string][] = [
    ["unidade", s.strikeUnity],
    ["fundo", s.strikeFund],
    ["pressao", s.strikePressure],
    ["apoio", s.strikeSupport],
  ];
  const final = placar.pressao >= 55 && placar.unidade >= 55 && placar.fundo >= 25 ? "vitoria" : placar.pressao >= 35 && placar.unidade >= 40 ? "parcial" : "derrota";

  if (cena < 0) {
    return (
      <div>
        <p className="max-w-2xl leading-relaxed">{s.strikeIntro}</p>
        <button type="button" onClick={() => setCena(0)} className="botao mt-4 cursor-pointer">{s.start}</button>
      </div>
    );
  }
  const atual = dados.cenas[cena];
  return (
    <div lang="pt-BR">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={s.strikeMeters}>
        {medidores.map(([chave, nome]) => (
          <li key={chave} className="font-sans text-xs font-bold uppercase tracking-[0.08em]">
            <span className="flex justify-between">
              {nome} <span className="font-mono font-normal">{placar[chave]}</span>
            </span>
            <span className="mt-1 block h-2.5 border border-ink" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={placar[chave]} aria-label={nome}>
              <span className="block h-full bg-prelo-texto transition-[width] duration-300" style={{ width: `${placar[chave]}%` }} />
            </span>
          </li>
        ))}
      </ul>
      {atual ? (
        <div className="mt-6 border-2 border-ink bg-folha p-5 shadow-[5px_5px_0_var(--sombra)]">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">{fill(s.round, { i: cena + 1, n: dados.cenas.length })} · {atual.titulo}</p>
          <p className="mt-2 font-serif text-xl leading-snug">{atual.texto}</p>
          {!escolhida ? (
            <div className="mt-4 grid gap-2">
              {atual.escolhas.map((escolha) => (
                <button
                  key={escolha.texto}
                  type="button"
                  onClick={() => {
                    setEscolhida(escolha);
                    setPlacar((p) => ({ unidade: limitar(p.unidade + (escolha.efeito.unidade ?? 0)), fundo: limitar(p.fundo + (escolha.efeito.fundo ?? 0)), pressao: limitar(p.pressao + (escolha.efeito.pressao ?? 0)), apoio: limitar(p.apoio + (escolha.efeito.apoio ?? 0)) }));
                  }}
                  className="guia-opcao text-left"
                >
                  {escolha.texto}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <p className="border-l-4 border-prelo-texto pl-3 leading-relaxed">{escolhida.retorno}</p>
              {escolhida.historia && (
                <p className="mt-3 border-l-4 border-ink pl-3 text-sm leading-relaxed text-ink-soft">
                  <strong className="font-sans text-xs uppercase tracking-[0.1em] text-ink">{s.realLife}</strong> {escolhida.historia}
                </p>
              )}
              <button type="button" onClick={() => { setEscolhida(null); setCena((c) => c + 1); }} className="botao mt-4 cursor-pointer">
                {cena + 1 < dados.cenas.length ? s.next : s.seeEnd}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 border-2 border-ink bg-ink p-5 text-parchment shadow-[5px_5px_0_var(--sombra)]">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[#f0b323]">{s.end}</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{dados.finais[final].titulo}</p>
          <p className="mt-2 leading-relaxed text-parchment/90">{dados.finais[final].texto}</p>
          <p className="mt-4 font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#f0b323]">{s.studyMore}</p>
          <ul className="mt-1 space-y-1">
            {dados.aulas.map((aula) => (
              <li key={aula.href}>
                <Link href={localePath(lang, aula.href)} className="underline underline-offset-4 hover:text-[#f0b323]">{aula.titulo}</Link>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => { setCena(-1); setPlacar(dados.inicio); setEscolhida(null); }} className="botao botao-papel mt-5 cursor-pointer">
            {s.again}
          </button>
        </div>
      )}
      <p className="mt-4 font-sans text-xs text-ink-soft">{dados.sobre}</p>
    </div>
  );
}

/** Linha do tempo: cinco fatos de "Neste dia" para pôr na ordem dos anos, com conferência e o link de cada um. */
function LinhaDoTempo({ fatos, s }: { fatos: Fato[]; s: S }) {
  const [rodada, setRodada] = useState<Fato[] | null>(null);
  const [conferido, setConferido] = useState(false);
  const nova = () => {
    // Cinco anos diferentes, para a ordem certa nunca ficar em dúvida.
    const porAno = new Map<number, Fato>();
    for (const fato of embaralhar(fatos)) if (!porAno.has(fato.ano)) porAno.set(fato.ano, fato);
    setRodada([...porAno.values()].slice(0, 5));
    setConferido(false);
  };
  const mover = (i: number, passo: number) =>
    setRodada((lista) => {
      if (!lista) return lista;
      const j = i + passo;
      if (j < 0 || j >= lista.length) return lista;
      const copia = [...lista];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  if (!rodada) {
    return (
      <div>
        <p className="max-w-2xl leading-relaxed">{s.timelineIntro}</p>
        <button type="button" onClick={nova} className="botao mt-4 cursor-pointer">{s.start}</button>
      </div>
    );
  }
  const certa = [...rodada].sort((a, b) => a.ano - b.ano);
  const acertos = rodada.filter((fato, i) => fato === certa[i]).length;
  return (
    <div lang="pt-BR">
      <p className="font-sans text-sm text-ink-soft">{s.timelineHow}</p>
      <ol className="mt-3 grid gap-2">
        {rodada.map((fato, i) => {
          const noLugar = conferido && fato === certa[i];
          return (
            <li key={`${fato.ano}-${fato.dia}`} className={`flex items-start gap-3 border-2 p-3 ${conferido ? (noLugar ? "border-[#2e6b4f] bg-[#2e6b4f]/10" : "border-prelo-texto bg-prelo-texto/10") : "border-ink bg-folha"}`}>
              <span className="font-mono text-sm font-bold">{i + 1}</span>
              <span className="min-w-0 flex-1 leading-snug">
                {conferido && <strong className="mr-1.5 font-mono">{fato.ano}</strong>}
                {fato.texto}
                {conferido && fato.link && (
                  <a href={fato.link} target="_blank" rel="noopener noreferrer" className="ml-1.5 font-sans text-xs underline">{s.source} ↗</a>
                )}
              </span>
              {!conferido && (
                <span className="flex shrink-0 flex-col gap-1">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={s.up} className="cursor-pointer border border-ink px-2 font-mono disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === rodada.length - 1} aria-label={s.down} className="cursor-pointer border border-ink px-2 font-mono disabled:opacity-30">↓</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {conferido ? (
        <div className="mt-4">
          <p className="font-serif text-xl font-semibold">{fill(s.timelineScore, { n: acertos, total: rodada.length })}</p>
          <button type="button" onClick={nova} className="botao mt-3 cursor-pointer">{s.again}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConferido(true)} className="botao mt-4 cursor-pointer">{s.check}</button>
      )}
    </div>
  );
}

/** Quem disse?: oito frases do mural do instituto, cada uma com quatro autores possíveis e a fonte depois da resposta. */
function QuemDisse({ frases, s }: { frases: Frase[]; s: S }) {
  const [rodadas, setRodadas] = useState<{ frase: Frase; opcoes: string[] }[] | null>(null);
  const [atual, setAtual] = useState(0);
  const [resposta, setResposta] = useState<string | null>(null);
  const [pontos, setPontos] = useState(0);
  const autores = [...new Set(frases.map((f) => f.autor))];
  const nova = () => {
    setRodadas(
      embaralhar(frases)
        .slice(0, 8)
        .map((frase) => ({ frase, opcoes: embaralhar([frase.autor, ...embaralhar(autores.filter((a) => a !== frase.autor)).slice(0, 3)]) })),
    );
    setAtual(0);
    setResposta(null);
    setPontos(0);
  };
  if (!rodadas) {
    return (
      <div>
        <p className="max-w-2xl leading-relaxed">{s.quotesIntro}</p>
        <button type="button" onClick={nova} className="botao mt-4 cursor-pointer">{s.start}</button>
      </div>
    );
  }
  const rodada = rodadas[atual];
  if (!rodada) {
    return (
      <div>
        <p className="font-serif text-2xl font-semibold">{fill(s.quotesScore, { n: pontos, total: rodadas.length })}</p>
        <button type="button" onClick={nova} className="botao mt-4 cursor-pointer">{s.again}</button>
      </div>
    );
  }
  return (
    <div lang="pt-BR">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">{fill(s.round, { i: atual + 1, n: rodadas.length })}</p>
      <blockquote className="mt-2 border-l-4 border-ink pl-4 font-serif text-xl italic leading-snug">“{rodada.frase.texto}”</blockquote>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {rodada.opcoes.map((autor) => {
          const marcada = resposta === autor;
          const certa = autor === rodada.frase.autor;
          return (
            <button
              key={autor}
              type="button"
              disabled={resposta !== null}
              onClick={() => {
                setResposta(autor);
                if (certa) setPontos((p) => p + 1);
              }}
              className={`guia-opcao text-left ${resposta !== null && certa ? "!border-[#2e6b4f] !bg-[#2e6b4f] !text-white" : ""} ${marcada && !certa ? "!border-prelo-texto" : ""}`}
            >
              {autor}
            </button>
          );
        })}
      </div>
      {resposta !== null && (
        <div className="mt-4">
          <p className="font-sans text-sm">
            <strong>{resposta === rodada.frase.autor ? s.right : s.wrong}</strong> {rodada.frase.autor}, {rodada.frase.fonte}.
          </p>
          <button type="button" onClick={() => { setAtual((a) => a + 1); setResposta(null); }} className="botao mt-3 cursor-pointer">{s.next}</button>
        </div>
      )}
    </div>
  );
}

/** Os jogos de formação: abas para Greve!, Linha do tempo e Quem disse? Tudo roda no aparelho, sem placar guardado. */
export function JogosDeFormacao({ greve, fatos, frases, s }: { greve: DadosDaGreve; fatos: Fato[]; frases: Frase[]; s: S }) {
  const [aba, setAba] = useState<"greve" | "tempo" | "frases">("greve");
  const abas: ["greve" | "tempo" | "frases", string][] = [
    ["greve", s.strike],
    ["tempo", s.timeline],
    ["frases", s.quotes],
  ];
  return (
    <div className="mt-8">
      <div role="group" aria-label={s.title} className="flex flex-wrap items-end gap-1.5 border-b-2 border-ink">
        {abas.map(([id, nome]) => (
          <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)} className="aba-pasta">
            {nome}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {aba === "greve" && <Greve dados={greve} s={s} />}
        {aba === "tempo" && <LinhaDoTempo fatos={fatos} s={s} />}
        {aba === "frases" && <QuemDisse frases={frases} s={s} />}
      </div>
    </div>
  );
}
