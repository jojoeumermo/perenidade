// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/Link";
import { fill, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { aulasDaPartida, escolher, faseAtual, lerProgresso, mexeCom, novaPartida, registrarPartida, type Area, type Baralho, type Carta, type Escolha, type Lado, type Nota, type Partida, type Progresso } from "@/lib/rumos";
import { useI18n } from "../I18n";

type S = Dict["labs"]["jogos"]["rumos"];
/** O texto dos baralhos está em português; a interface, no idioma da pessoa. */
const PT = { lang: "pt-BR" } as const;

/** Arrasto que conta como escolha (em pixels) e arrasto que só mostra a escolha. */
const SOLTAR = 110;
const MOSTRAR = 36;

function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mudar = () => setReduzido(m.matches || document.documentElement.hasAttribute("data-leitor"));
    mudar();
    m.addEventListener("change", mudar);
    return () => m.removeEventListener("change", mudar);
  }, []);
  return reduzido;
}

function Fonte({ nota, s }: { nota: Nota; s: S }) {
  const { fonte } = nota;
  const nome = `${fonte.autor}, ${fonte.titulo}${fonte.ano ? ` (${fonte.ano})` : ""}`;
  return (
    <span className="mt-1 block font-sans text-xs text-ink-soft">
      {s.source}:{" "}
      {fonte.url ? (
        <a href={fonte.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {nome} ↗
        </a>
      ) : (
        nome
      )}
    </span>
  );
}

/** Os quatro medidores. Na prévia de uma escolha, um ponto marca os que vão mexer (grande quando mexe muito), sem dizer para que lado. */
function Medidores({ b, valores, previa, s }: { b: Baralho; valores: Record<string, number>; previa: Escolha | null; s: S }) {
  const marcas = new Map((previa ? mexeCom(previa) : []).map((m) => [m.medidor, m.forte]));
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4" aria-label={s.meters}>
      {b.medidores.map((m) => {
        const v = valores[m.id] ?? 0;
        const perto = v <= 15 || v >= 85;
        return (
          <li key={m.id} className="min-w-0 font-sans text-xs font-bold uppercase tracking-[0.08em]">
            <span className="flex items-center justify-between gap-2">
              <span {...PT} className="truncate">{m.nome}</span>
              <span aria-hidden="true" className="flex h-3 w-3 items-center justify-center">
                {marcas.has(m.id) && <span className={`block rounded-full bg-ink ${marcas.get(m.id) ? "h-3 w-3" : "h-1.5 w-1.5"}`} />}
              </span>
            </span>
            <span
              className="mt-1 block h-3 border-2 border-ink bg-folha"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={v}
              aria-valuetext={fill(perto ? s.meterNearEdge : s.meterValue, { nome: m.nome, n: v })}
              aria-label={m.nome}
            >
              <span className={`block h-full motion-safe:transition-[width] motion-safe:duration-300 ${perto ? "bg-prelo-texto" : "bg-ink"}`} style={{ width: `${v}%` }} />
            </span>
            {perto && <span className="mt-0.5 block font-mono text-[0.62rem] font-normal normal-case tracking-normal text-prelo-texto">{s.nearEdge}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** A carta na mesa: arrastar com o mouse ou o dedo, setas do teclado, ou os dois botões embaixo. */
function Mesa({ b, carta, numero, fase, aoEscolher, aoPrever, s }: { b: Baralho; carta: Carta; numero: number; fase: string | null; aoEscolher: (lado: Lado) => void; aoPrever: (lado: Lado | null) => void; s: S }) {
  const reduzido = useMovimentoReduzido();
  const [dx, setDx] = useState(0);
  const [inclinada, setInclinada] = useState<Lado | null>(null);
  const [aviso, setAviso] = useState("");
  const inicio = useRef<{ x: number; id: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const personagem = b.personagens.find((p) => p.id === carta.personagem);
  const nomes = (e: Escolha) =>
    mexeCom(e)
      .map((m) => `${b.medidores.find((x) => x.id === m.medidor)?.nome ?? m.medidor}${m.forte ? ` (${s.strong})` : ""}`)
      .join(", ");

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [carta.id]);

  const inclinar = (lado: Lado | null) => {
    setInclinada(lado);
    aoPrever(lado);
    if (lado) setAviso(fill(s.leaning, { lado: lado === "esquerda" ? s.left : s.right, texto: carta[lado].texto, mexe: nomes(carta[lado]) }));
    else setAviso("");
  };
  const confirmar = (lado: Lado) => {
    setDx(0);
    setInclinada(null);
    aoPrever(null);
    aoEscolher(lado);
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      const lado: Lado = ev.key === "ArrowLeft" ? "esquerda" : "direita";
      if (inclinada === lado) confirmar(lado);
      else inclinar(lado);
    } else if (ev.key === "Enter" && inclinada) {
      ev.preventDefault();
      confirmar(inclinada);
    } else if (ev.key === "Escape" && inclinada) {
      ev.preventDefault();
      inclinar(null);
    }
  };
  const onPointerDown = (ev: React.PointerEvent) => {
    if (ev.button !== 0) return;
    inicio.current = { x: ev.clientX, id: ev.pointerId };
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    if (!inicio.current || inicio.current.id !== ev.pointerId) return;
    const d = ev.clientX - inicio.current.x;
    setDx(d);
    const lado: Lado | null = d <= -MOSTRAR ? "esquerda" : d >= MOSTRAR ? "direita" : null;
    if (lado !== inclinada) inclinar(lado);
  };
  const soltar = (ev: React.PointerEvent) => {
    if (!inicio.current || inicio.current.id !== ev.pointerId) return;
    inicio.current = null;
    if (dx <= -SOLTAR) confirmar("esquerda");
    else if (dx >= SOLTAR) confirmar("direita");
    else {
      setDx(0);
      inclinar(null);
    }
  };

  const giro = reduzido ? 0 : Math.max(-12, Math.min(12, dx / 18));
  const deslocamento = reduzido ? Math.max(-24, Math.min(24, dx / 4)) : dx;
  const rotulo = inclinada ? carta[inclinada].texto : null;
  const idInstrucao = `rumos-instrucao-${carta.id}`;
  return (
    <div className="mt-6">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">
        {fill(s.cardN, { i: numero })}
        {fase ? ` · ${fase}` : ""}
      </p>
      <div className="mx-auto mt-2 max-w-md">
        <div
          ref={ref}
          {...PT}
          tabIndex={0}
          role="group"
          aria-roledescription={s.cardRole}
          aria-label={`${personagem?.nome ?? ""}: ${carta.titulo}`}
          aria-describedby={idInstrucao}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          className={`relative cursor-grab select-none border-2 border-ink bg-folha p-5 shadow-[5px_5px_0_var(--sombra)] outline-offset-4 active:cursor-grabbing ${dx === 0 && !reduzido ? "transition-transform duration-200" : ""}`}
          style={{ transform: `translateX(${deslocamento}px) rotate(${giro}deg)`, touchAction: "pan-y" }}
        >
          <p className="font-sans text-xs font-bold uppercase tracking-[0.1em]">
            {personagem?.nome}
            <span className="font-normal normal-case tracking-normal text-ink-soft"> · {personagem?.papel}</span>
          </p>
          <p className="mt-1 font-serif text-lg font-semibold leading-snug">{carta.titulo}</p>
          <p className="mt-3 font-serif text-xl leading-snug">{carta.texto}</p>
          <p
            aria-hidden="true"
            className={`mt-4 min-h-[3.2rem] border-2 border-dashed p-2 font-sans text-sm font-bold leading-snug ${rotulo ? "border-ink bg-parchment" : "border-transparent text-transparent"} ${inclinada === "direita" ? "text-right" : ""}`}
          >
            {rotulo ? (inclinada === "esquerda" ? `← ${rotulo}` : `${rotulo} →`) : "·"}
          </p>
        </div>
        <p id={idInstrucao} className="mt-3 text-center font-sans text-xs text-ink-soft">
          {s.howToKeys}
        </p>
      </div>
      <div className="mx-auto mt-4 grid max-w-md gap-2 sm:grid-cols-2">
        {(["esquerda", "direita"] as const).map((lado) => (
          <button
            key={lado}
            type="button"
            onClick={() => confirmar(lado)}
            onMouseEnter={() => aoPrever(lado)}
            onMouseLeave={() => aoPrever(inclinada)}
            onFocus={() => aoPrever(lado)}
            onBlur={() => aoPrever(null)}
            aria-describedby={`rumos-mexe-${carta.id}-${lado}`}
            className={`guia-opcao min-h-[3rem] ${lado === "direita" ? "text-right" : "text-left"} ${inclinada === lado ? "!bg-ink !text-parchment" : ""}`}
          >
            <span {...PT}>{lado === "esquerda" ? `← ${carta.esquerda.texto}` : `${carta.direita.texto} →`}</span>
            <span id={`rumos-mexe-${carta.id}-${lado}`} className="sr-only">
              {fill(s.affects, { lista: nomes(carta[lado]) })}
            </span>
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}

/** Depois de cada escolha: o que ela ensina, o que mudou, o fato real com a fonte e a aula. */
function Retorno({ b, carta, lado, antes, depois, acabou, seguir, s }: { b: Baralho; carta: Carta; lado: Lado; antes: Record<string, number>; depois: Record<string, number>; acabou: boolean; seguir: () => void; s: S }) {
  const { lang } = useI18n();
  const botao = useRef<HTMLButtonElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus({ preventScroll: false });
  }, []);
  const mudancas = b.medidores
    .map((m) => [m.nome, (depois[m.id] ?? 0) - (antes[m.id] ?? 0)] as const)
    .filter(([, d]) => d !== 0)
    .map(([nome, d]) => fill(d > 0 ? s.wentUp : s.wentDown, { nome, n: Math.abs(d) }));
  return (
    <div className="mx-auto mt-6 max-w-2xl border-2 border-ink bg-folha p-5 shadow-[5px_5px_0_var(--sombra)]">
      <h3 ref={titulo} tabIndex={-1} className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto outline-none">
        {s.youChose}: <span {...PT}>{carta[lado].texto}</span>
      </h3>
      <p {...PT} className="mt-2 font-serif text-lg leading-snug">{carta[lado].retorno}</p>
      {mudancas.length > 0 && (
        <p className="mt-3 font-sans text-sm">
          <strong className="font-bold">{s.changes}:</strong> {mudancas.join(" · ")}
        </p>
      )}
      <div className="mt-4 border-t-2 border-ink pt-3">
        <p className="font-sans text-xs font-bold uppercase tracking-[0.1em]">{s.realHistory}</p>
        <p {...PT} className="mt-1 leading-relaxed">{carta.historia.texto}</p>
        <Fonte nota={carta.historia} s={s} />
      </div>
      <p className="mt-3 font-sans text-sm">
        <strong className="font-bold">{s.study}:</strong>{" "}
        <Link {...PT} href={localePath(lang, carta.aula.href)} className="underline underline-offset-4 hover:text-prelo-texto">
          {carta.aula.titulo}
        </Link>
      </p>
      <button ref={botao} type="button" onClick={seguir} className="botao mt-5 cursor-pointer">
        {acabou ? s.seeEnd : s.next}
      </button>
    </div>
  );
}

/** O fim: o desfecho, as decisões com o que aconteceu na história real, as aulas e os desfechos já vistos neste aparelho. */
function Desfecho({ b, partida, progresso, deNovo, outro, s }: { b: Baralho; partida: Partida; progresso: Progresso | undefined; deNovo: () => void; outro: () => void; s: S }) {
  const { lang } = useI18n();
  const final = b.finais.find((f) => f.id === partida.fim)!;
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  const vistos = b.finais.filter((f) => progresso?.finais.includes(f.id) && f.id !== final.id);
  return (
    <div className="mt-6">
      <div className="border-2 border-ink bg-ink p-5 text-parchment shadow-[5px_5px_0_var(--sombra)]">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[#f0b323]">{s.end}</p>
        <h3 ref={titulo} tabIndex={-1} {...PT} className="mt-1 font-serif text-3xl font-semibold outline-none">
          {final.titulo}
        </h3>
        <p {...PT} className="mt-2 leading-relaxed text-parchment/90">{final.texto}</p>
        {final.historia && (
          <div className="mt-4">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.1em] text-[#f0b323]">{s.realHistory}</p>
            <p {...PT} className="mt-1 leading-relaxed text-parchment/90">{final.historia.texto}</p>
            <span className="[&_*]:!text-parchment/75 [&_span]:!text-parchment/75">
              <Fonte nota={final.historia} s={s} />
            </span>
          </div>
        )}
        <p className="mt-4 font-sans text-sm text-parchment/85">{s.errorTeaches}</p>
      </div>

      <h3 className="mt-8 font-serif text-2xl font-semibold">{s.decisions}</h3>
      <ol className="mt-3 grid gap-3">
        {partida.jogadas.map((j, i) => {
          const carta = b.cartas.find((c) => c.id === j.carta)!;
          return (
            <li key={j.carta} className="border-2 border-ink bg-folha p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft">
                {fill(s.cardN, { i: i + 1 })} · <span {...PT}>{carta.titulo}</span>
              </p>
              <p className="mt-1 font-sans font-bold">
                {s.youChose}: <span {...PT}>{carta[j.lado].texto}</span>
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer font-sans text-sm underline underline-offset-4">{s.whatHappened}</summary>
                <p {...PT} className="mt-2 text-sm leading-relaxed">{carta[j.lado].retorno}</p>
                <p {...PT} className="mt-2 text-sm leading-relaxed">
                  <strong className="font-sans text-xs uppercase tracking-[0.1em]">{s.realHistory}:</strong> {carta.historia.texto}
                </p>
                <Fonte nota={carta.historia} s={s} />
              </details>
            </li>
          );
        })}
      </ol>

      <h3 className="mt-8 font-serif text-2xl font-semibold">{s.studyMore}</h3>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {aulasDaPartida(b, partida).map((a) => (
          <li key={a.href}>
            <Link {...PT} href={localePath(lang, a.href)} className="underline underline-offset-4 hover:text-prelo-texto">
              {a.titulo}
            </Link>
          </li>
        ))}
      </ul>

      {vistos.length > 0 && (
        <>
          <h3 className="mt-8 font-sans text-sm font-bold uppercase tracking-[0.1em]">{s.seenEnds}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {vistos.map((f) => (
              <li key={f.id} {...PT} className="border border-ink px-2 py-1 font-sans text-sm">
                {f.titulo}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={deNovo} className="botao cursor-pointer">
          {s.again}
        </button>
        <button type="button" onClick={outro} className="botao botao-papel cursor-pointer">
          {s.otherDeck}
        </button>
      </div>
    </div>
  );
}

/**
 * Rumos: o jogo de decisões. Escolhe-se um baralho (história do Brasil, filosofia e sociologia, política e cidadania
 * ou a revisão do ENEM), e cada carta pede uma decisão entre duas. Sem pontos: o desfecho mostra o que aconteceu na
 * história real e as aulas para estudar. O progresso (partidas e desfechos vistos) fica só neste aparelho.
 */
export function Rumos({ baralhos, s }: { baralhos: Baralho[]; s: S }) {
  const [escolhido, setEscolhido] = useState<Baralho | null>(null);
  const [comecou, setComecou] = useState(false);
  const [area, setArea] = useState<Area | null>(null);
  const [partida, setPartida] = useState<Partida | null>(null);
  const [retorno, setRetorno] = useState<{ jogada: Partida["jogadas"][number]; seguinte: Partida } | null>(null);
  const [previa, setPrevia] = useState<Lado | null>(null);
  const [progresso, setProgresso] = useState<Record<string, Progresso>>({});
  const [vendoFim, setVendoFim] = useState(false);
  useEffect(() => {
    setProgresso(lerProgresso());
  }, []);
  const topo = useRef<HTMLDivElement>(null);

  const iniciar = (b: Baralho) => {
    setPartida(novaPartida(b, { semente: Math.floor(Math.random() * 2 ** 31), area: b.modo === "sorteio" ? area : null, progresso: progresso[b.id] }));
    setRetorno(null);
    setVendoFim(false);
    setComecou(true);
  };
  const carta = useMemo(() => (escolhido && partida?.atual ? escolhido.cartas.find((c) => c.id === partida.atual) ?? null : null), [escolhido, partida]);

  if (!escolhido) {
    return (
      <div>
        <p className="max-w-2xl leading-relaxed">{s.intro}</p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {baralhos.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  setEscolhido(b);
                  setComecou(false);
                  setArea(null);
                }}
                className="sobe flex h-full w-full cursor-pointer flex-col border-2 border-ink bg-folha p-4 text-left shadow-[4px_4px_0_var(--sombra)]"
              >
                <span {...PT} className="font-serif text-xl font-semibold leading-tight">{b.titulo}</span>
                <span {...PT} className="mt-1 block leading-snug text-ink-soft">{b.resumo}</span>
                <span className="mt-auto pt-3 font-sans text-xs text-ink-soft">
                  {fill(s.cardsInDeck, { n: b.cartas.length })}
                  {(progresso[b.id]?.partidas ?? 0) > 0 ? ` · ${fill(s.playedHere, { n: progresso[b.id].partidas })}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-sans text-xs text-ink-soft">{s.privacy}</p>
      </div>
    );
  }

  const b = escolhido;
  if (!comecou || !partida) {
    return (
      <div>
        <button type="button" onClick={() => setEscolhido(null)} className="font-sans text-sm underline underline-offset-4">
          ← {s.otherDeck}
        </button>
        <h3 {...PT} className="mt-3 font-serif text-2xl font-semibold">{b.titulo}</h3>
        <p {...PT} className="mt-2 max-w-2xl leading-relaxed">{b.papel}</p>
        <h4 className="mt-5 font-sans text-xs font-bold uppercase tracking-[0.1em]">{s.meters}</h4>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {b.medidores.map((m) => (
            <li key={m.id} {...PT} className="leading-snug">
              <strong className="font-sans">{m.nome}:</strong> {m.descricao}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-2xl font-sans text-sm leading-relaxed">{s.rules}</p>
        {(progresso[b.id]?.partidas ?? 0) === 0 && b.cartas.some((c) => c.condicao?.partidas) && <p className="mt-2 max-w-2xl font-sans text-sm text-ink-soft">{s.unlockHint}</p>}
        {b.modo === "sorteio" && (
          <fieldset className="mt-5">
            <legend className="font-sans text-xs font-bold uppercase tracking-[0.1em]">{s.reviewArea}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {([null, "historia", "geografia", "filosofia", "sociologia"] as const).map((a) => (
                <button key={a ?? "todas"} type="button" aria-pressed={area === a} onClick={() => setArea(a)} className="guia-opcao">
                  {a ? s.areas[a] : s.areas.todas}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <button type="button" onClick={() => iniciar(b)} className="botao mt-6 cursor-pointer">
          {s.start}
        </button>
        <p {...PT} className="mt-4 font-sans text-xs text-ink-soft">{b.sobre}</p>
      </div>
    );
  }

  const fase = faseAtual(b, partida);
  const mostrar = retorno ? retorno.seguinte : partida;
  const valores = retorno ? retorno.jogada.depois : partida.medidores;
  const cartaDoRetorno = retorno ? b.cartas.find((c) => c.id === retorno.jogada.carta)! : null;
  return (
    <div ref={topo}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p {...PT} className="font-serif text-lg font-semibold">{b.titulo}</p>
        <button type="button" onClick={() => setEscolhido(null)} className="font-sans text-xs underline underline-offset-4">
          {s.otherDeck}
        </button>
      </div>
      <div className="mt-3">
        <Medidores b={b} valores={vendoFim ? mostrar.medidores : valores} previa={!retorno && carta && previa ? carta[previa] : null} s={s} />
      </div>
      {vendoFim && partida.fim ? (
        <Desfecho
          b={b}
          partida={partida}
          progresso={progresso[b.id]}
          deNovo={() => iniciar(b)}
          outro={() => setEscolhido(null)}
          s={s}
        />
      ) : retorno && cartaDoRetorno ? (
        <Retorno
          key={retorno.jogada.carta}
          b={b}
          carta={cartaDoRetorno}
          lado={retorno.jogada.lado}
          antes={retorno.jogada.antes}
          depois={retorno.jogada.depois}
          acabou={Boolean(retorno.seguinte.fim)}
          seguir={() => {
            setPartida(retorno.seguinte);
            setRetorno(null);
            if (retorno.seguinte.fim) {
              setProgresso(registrarPartida(retorno.seguinte));
              setVendoFim(true);
            }
          }}
          s={s}
        />
      ) : carta ? (
        <Mesa
          key={carta.id}
          b={b}
          carta={carta}
          numero={partida.jogadas.length + 1}
          fase={fase?.nome ?? null}
          aoPrever={setPrevia}
          aoEscolher={(lado) => {
            const seguinte = escolher(b, partida, lado, progresso[b.id]);
            setPrevia(null);
            setRetorno({ jogada: seguinte.jogadas[seguinte.jogadas.length - 1], seguinte });
          }}
          s={s}
        />
      ) : null}
    </div>
  );
}
