// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { maisProximos, NIVEIS, ordemDoNivel as ordenar, pontuarEixos, type Nivel, type PosicaoNos12Eixos } from "@/lib/eixos/pontuacao";
import { KEYS, setItem, useHydrated, useStored } from "@/lib/storage";

export interface EixoDoTeste {
  id: string;
  grupo: string;
  nome: string;
  a: string;
  b: string;
  pergunta: string;
  ladoA: string;
  ladoB: string;
}
export interface PerguntaDoTeste {
  id: string;
  eixo: string;
  lado: "a" | "b";
  nivel: number;
  texto: string;
}
export interface IdeologiaDoTeste {
  id: string;
  nome: string;
  texto: string;
  posicao: Record<string, number>;
}
export interface ImagemDaFigura {
  /** Nome do arquivo no Wikimedia Commons (só é buscado quando a pessoa clica em "mostrar os retratos"). */
  arquivo: string;
  autor: string;
  licenca: string;
  pagina: string;
}
export interface PaisDoTeste extends PosicaoNos12Eixos {
  nome: string;
  texto: string;
}
export interface FiguraDoTeste extends PaisDoTeste {
  vida: string;
  imagem: ImagemDaFigura;
}
export interface TextosDoTeste {
  sobre2: string;
  paises: string;
  paisesNota: string;
  figuras: string;
  figurasNota: string;
  mostrarFotos: string;
  mostrarFotosAviso: string;
  ocultarFotos: string;
  credito: string;
  fonteImagem: string;
  privacidade: string;
}
export interface DadosDosEixos {
  sobre: string;
  ui: TextosDoTeste;
  paises: PaisDoTeste[];
  figuras: FiguraDoTeste[];
  grupos: { id: string; nome: string }[];
  eixos: EixoDoTeste[];
  perguntas: PerguntaDoTeste[];
  ideologias: IdeologiaDoTeste[];
}


interface Progresso {
  nivel: Nivel;
  respostas: Record<string, number>;
  atual: number;
  pronto: boolean;
}

/** A conta (ordem das perguntas, pontuação e proximidade) fica em lib/eixos/pontuacao.ts, pura e testada. */
const ordemDoNivel = (dados: DadosDosEixos, nivel: Nivel) => ordenar(dados.eixos, dados.perguntas, nivel);

/**
 * O teste dos 12 eixos: quatro grupos (economia, Estado, nação e mundo, sociedade), três eixos em cada, cinco respostas
 * possíveis e três tamanhos (rápido, padrão e completo). O resultado mostra a posição em cada eixo e as três ideologias
 * mais próximas, com uma descrição de cada. As respostas ficam só neste navegador (para continuar depois): nada vai
 * para o instituto.
 */
export function DozeEixos({ dados, s }: { dados: DadosDosEixos; s: Dict["eixos"] }) {
  const hydrated = useHydrated();
  const guardado = useStored(KEYS.eixos);
  const progresso = useMemo<Progresso | null>(() => {
    if (!hydrated || !guardado) return null;
    try {
      const lido = JSON.parse(guardado) as Progresso;
      return NIVEIS.includes(lido.nivel) && lido.respostas && typeof lido.respostas === "object" && !Array.isArray(lido.respostas) ? lido : null;
    } catch {
      return null;
    }
  }, [hydrated, guardado]);
  const salvar = (p: Progresso | null) => setItem(KEYS.eixos, p ? JSON.stringify(p) : null);
  const perguntas = useMemo(() => (progresso ? ordemDoNivel(dados, progresso.nivel) : []), [dados, progresso]);
  const atual = progresso && !progresso.pronto ? perguntas[Math.min(progresso.atual, perguntas.length - 1)] : undefined;

  /** A próxima pergunta ainda sem resposta a partir de "de" (quem sobe do teste rápido para o completo não repete nada). */
  const proximaEmAberto = (lista: PerguntaDoTeste[], respostas: Record<string, number>, de: number) => {
    const i = lista.findIndex((p, j) => j >= de && respostas[p.id] === undefined);
    return i < 0 ? lista.length : i;
  };
  const responder = (indice: number) => {
    if (!progresso || !atual) return;
    const respostas = { ...progresso.respostas, [atual.id]: indice };
    const proxima = proximaEmAberto(perguntas, respostas, progresso.atual + 1);
    salvar({ ...progresso, respostas, atual: proxima, pronto: proxima >= perguntas.length });
  };
  const completar = () => {
    if (!progresso) return;
    const atual = proximaEmAberto(ordemDoNivel(dados, 3), progresso.respostas, 0);
    salvar({ nivel: 3, respostas: progresso.respostas, atual, pronto: false });
  };
  const voltar = () => progresso && progresso.atual > 0 && salvar({ ...progresso, atual: progresso.atual - 1, pronto: false });

  // Teclado: 1 a 5 respondem, seta para a esquerda volta uma pergunta.
  useEffect(() => {
    if (!atual) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (/^[1-5]$/.test(e.key)) responder(Number(e.key) - 1);
      else if (e.key === "ArrowLeft") voltar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  if (!progresso) {
    return (
      <section aria-labelledby="eixos-niveis" className="mt-8">
        <h2 id="eixos-niveis" className="font-sans text-sm font-bold uppercase tracking-[0.08em]">{s.chooseLevel}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {NIVEIS.map((nivel) => (
            <button
              key={nivel}
              type="button"
              onClick={() => salvar({ nivel, respostas: {}, atual: 0, pronto: false })}
              className="eixos-nivel cursor-pointer border-2 border-ink bg-folha p-4 text-left shadow-[4px_4px_0_var(--sombra)]"
            >
              <span className="block font-serif text-2xl font-semibold">{s.levels[nivel].name}</span>
              <span className="mt-1 block font-mono text-xs uppercase tracking-[0.14em] text-prelo-texto">{fill(s.levels[nivel].count, { n: ordemDoNivel(dados, nivel).length })}</span>
              <span className="mt-2 block text-sm leading-snug text-ink-soft">{s.levels[nivel].desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-5 font-sans text-sm text-ink-soft">{s.privacy}</p>
        <p className="mt-2 font-sans text-xs text-ink-soft" lang="pt-BR">{dados.ui.privacidade}</p>
      </section>
    );
  }

  if (atual) {
    const eixo = dados.eixos.find((e) => e.id === atual.eixo);
    const feitas = Math.min(progresso.atual, perguntas.length);
    return (
      <section aria-labelledby="eixos-pergunta" className="mt-8 border-2 border-ink bg-folha p-6 shadow-[6px_6px_0_var(--sombra)] max-sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
          <span>{fill(s.question, { i: feitas + 1, n: perguntas.length })}</span>
          {eixo && <span>{eixo.nome}</span>}
        </div>
        <div className="mt-2 h-2 border border-ink" role="progressbar" aria-valuemin={0} aria-valuemax={perguntas.length} aria-valuenow={feitas} aria-label={s.progress}>
          <div className="h-full bg-prelo-texto" style={{ width: `${(100 * feitas) / perguntas.length}%` }} />
        </div>
        <p id="eixos-pergunta" lang="pt-BR" className="mt-6 font-serif text-[1.7rem] leading-snug text-balance max-sm:text-[1.35rem]">
          {atual.texto}
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-5">
          {s.answers.map((rotulo, i) => (
            <button key={rotulo} type="button" onClick={() => responder(i)} aria-pressed={progresso.respostas[atual.id] === i} className={`eixos-resposta eixos-resposta-${i}`}>
              <span aria-hidden className="font-mono text-[0.65rem] text-ink-soft">{i + 1}</span>
              <span>{rotulo}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 font-sans text-sm">
          <button type="button" onClick={voltar} disabled={progresso.atual === 0} className="cursor-pointer underline underline-offset-4 disabled:cursor-default disabled:no-underline disabled:opacity-40">
            {s.back}
          </button>
          <button type="button" onClick={() => salvar(null)} className="cursor-pointer text-ink-soft underline underline-offset-4">
            {s.quit}
          </button>
        </div>
        <p className="mt-3 font-sans text-xs text-ink-soft">{s.keys}</p>
      </section>
    );
  }

  const pontos = pontuarEixos(dados.eixos, perguntas, progresso.respostas);
  const melhores = maisProximos(dados.eixos, pontos, dados.ideologias, 3).map(({ item, proximidade }) => ({ ideologia: item, proximidade }));
  const paises = maisProximos(dados.eixos, pontos, dados.paises, 3);
  const figuras = maisProximos(dados.eixos, pontos, dados.figuras, 3);
  return (
    <section aria-labelledby="eixos-resultado" className="mt-8">
      <h2 id="eixos-resultado" className="font-serif text-3xl font-semibold">{s.resultTitle}</h2>
      <p className="mt-1 font-sans text-sm text-ink-soft">{fill(s.resultNote, { n: perguntas.length, nivel: s.levels[progresso.nivel].name })}</p>

      <div className="mt-6 grid gap-8" lang="pt-BR">
        {dados.grupos.map((grupo) => (
          <div key={grupo.id}>
            <h3 className="jornal-secao">
              <span className="jornal-editoria">{grupo.nome}</span>
            </h3>
            <ul className="mt-3 grid gap-5">
              {dados.eixos
                .filter((eixo) => eixo.grupo === grupo.id)
                .map((eixo) => {
                  const a = pontos[eixo.id];
                  const texto = a >= 56 ? eixo.ladoA : a <= 44 ? eixo.ladoB : s.balanced;
                  return (
                    <li key={eixo.id}>
                      <p className="font-sans text-sm font-bold">{eixo.nome}</p>
                      <div className="mt-1 flex items-center justify-between font-mono text-[0.72rem] uppercase tracking-[0.1em]">
                        <span>
                          {eixo.a} <strong>{a}%</strong>
                        </span>
                        <span>
                          <strong>{100 - a}%</strong> {eixo.b}
                        </span>
                      </div>
                      <div className="mt-1 flex h-4 border-2 border-ink" role="img" aria-label={`${eixo.a} ${a}%, ${eixo.b} ${100 - a}%`}>
                        <div className="eixos-barra-a h-full" style={{ width: `${a}%` }} />
                        <div className="eixos-barra-b h-full flex-1" />
                      </div>
                      <p className="mt-1.5 text-sm leading-snug text-ink-soft">{texto}</p>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      <h3 className="mt-10 font-serif text-2xl font-semibold">{s.closest}</h3>
      <ol className="mt-3 grid gap-4 md:grid-cols-3" lang="pt-BR">
        {melhores.map(({ ideologia, proximidade }, i) => (
          <li key={ideologia.id} className={`border-2 border-ink p-4 ${i === 0 ? "bg-ink text-parchment" : "bg-folha"}`}>
            <p className={`font-mono text-[0.68rem] uppercase tracking-[0.14em] ${i === 0 ? "text-[#f0b323]" : "text-prelo-texto"}`}>{fill(s.proximity, { p: proximidade })}</p>
            <p className="mt-1 font-serif text-xl font-semibold leading-snug">{ideologia.nome}</p>
            <p className={`mt-2 text-sm leading-snug ${i === 0 ? "text-parchment/85" : "text-ink-soft"}`}>{ideologia.texto}</p>
          </li>
        ))}
      </ol>

      <Proximos dados={dados} paises={paises} figuras={figuras} s={s} />

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => salvar(null)} className="botao cursor-pointer">
          {s.redo}
        </button>
        {progresso.nivel < 3 && (
          <button type="button" onClick={completar} className="botao botao-papel cursor-pointer">
            {s.fullVersion}
          </button>
        )}
      </div>

      <details className="mt-8 border-t-2 border-ink pt-4">
        <summary className="cursor-pointer font-sans text-sm font-bold uppercase tracking-[0.08em]">{s.methodTitle}</summary>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.methodText}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft" lang="pt-BR">{dados.sobre}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft" lang="pt-BR">{dados.ui.sobre2}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft" lang="pt-BR">{dados.ui.privacidade}</p>
      </details>
    </section>
  );
}

/**
 * Países e figuras históricas mais próximos. Os retratos são de terceiros (Wikimedia Commons): só são buscados depois do
 * clique, porque abrir a imagem mostra o endereço de rede da pessoa ao Wikimedia; sem o clique, vai só o texto.
 */
function Proximos({ dados, paises, figuras, s }: { dados: DadosDosEixos; paises: { item: PaisDoTeste; proximidade: number }[]; figuras: { item: FiguraDoTeste; proximidade: number }[]; s: Dict["eixos"] }) {
  const [fotos, setFotos] = useState(false);
  const u = dados.ui;
  return (
    <div lang="pt-BR">
      <h3 className="mt-10 font-serif text-2xl font-semibold">{u.paises}</h3>
      <p className="mt-1 font-sans text-sm text-ink-soft">{u.paisesNota}</p>
      <ol className="mt-3 grid gap-4 md:grid-cols-3">
        {paises.map(({ item, proximidade }) => (
          <li key={item.id} className="border-2 border-ink bg-folha p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-prelo-texto">{fill(s.proximity, { p: proximidade })}</p>
            <p className="mt-1 font-serif text-xl font-semibold leading-snug">{item.nome}</p>
            <p className="mt-2 text-sm leading-snug text-ink-soft">{item.texto}</p>
          </li>
        ))}
      </ol>

      <h3 className="mt-10 font-serif text-2xl font-semibold">{u.figuras}</h3>
      <p className="mt-1 font-sans text-sm text-ink-soft">{u.figurasNota}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 font-sans text-sm">
        <button type="button" onClick={() => setFotos((v) => !v)} aria-pressed={fotos} className="botao botao-papel cursor-pointer">
          {fotos ? u.ocultarFotos : u.mostrarFotos}
        </button>
        {!fotos && <span className="text-xs text-ink-soft">{u.mostrarFotosAviso}</span>}
      </div>
      <ol className="mt-3 grid gap-4 md:grid-cols-3">
        {figuras.map(({ item, proximidade }) => (
          <li key={item.id} className="border-2 border-ink bg-folha p-4">
            {fotos && (
              <figure className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem de terceiro, carregada só depois do clique */}
                <img
                  src={`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(item.imagem.arquivo)}?width=320`}
                  alt={`Retrato de ${item.nome}`}
                  width={160}
                  height={200}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-auto max-h-56 w-auto max-w-full border-2 border-ink object-contain"
                />
                <figcaption className="mt-1 text-[0.7rem] leading-snug text-ink-soft">
                  {fill(u.credito, { autor: item.imagem.autor, licenca: item.imagem.licenca })}{" "}
                  <a href={item.imagem.pagina} rel="noopener noreferrer" className="underline underline-offset-2">
                    {u.fonteImagem}
                  </a>
                </figcaption>
              </figure>
            )}
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-prelo-texto">{fill(s.proximity, { p: proximidade })}</p>
            <p className="mt-1 font-serif text-xl font-semibold leading-snug">{item.nome}</p>
            <p className="font-mono text-xs text-ink-soft">{item.vida}</p>
            <p className="mt-2 text-sm leading-snug text-ink-soft">{item.texto}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
