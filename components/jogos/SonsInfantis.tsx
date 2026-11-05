// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMudo } from "@/components/criancas/comum";
import { fill } from "@/i18n/config";
import type { TextosDosJogos } from "@/i18n/jogos";
import { criarSorteio, embaralhar, sementeNova } from "@/lib/jogos/base";
import { BATIDAS, conferirMelodia, paresDeSons, RITMO_PRONTO, RODADAS_DA_MELODIA, sortearMelodia, TECLAS, type Batida } from "@/lib/jogos/sons";
import { somDeFesta, somDeTente, temAudio, tocarBatida, tocarNota } from "./audio";
import { Aviso, Botao, Quadro } from "./comum";

type Id = "piano" | "melodia" | "bateria" | "iguais" | "altoBaixo";
const ORDEM: Id[] = ["piano", "melodia", "bateria", "iguais", "altoBaixo"];
const ICONES: Record<Id, string> = { piano: "🎹", melodia: "🎵", bateria: "🥁", iguais: "🃏", altoBaixo: "📏" };

type Som = { mudo: boolean; nota: (midi: number, dur?: number, quando?: number) => void; batida: (b: Batida) => void; tente: () => void; festa: () => void };

/** Os sons do jogo, respeitando o "som desligado" da área infantil (guardado só neste navegador). */
function useSom(): [Som, boolean, (m: boolean) => void] {
  const [mudo, setMudo] = useMudo();
  // Estável enquanto o som não muda: os jogos usam `som` em efeitos (o ritmo da bateria não pode reiniciar a cada render).
  const som = useMemo<Som>(
    () => ({
      mudo,
      nota: (m, d, q) => {
        if (!mudo) tocarNota(m, d, q);
      },
      batida: (b) => {
        if (!mudo) tocarBatida(b);
      },
      tente: () => {
        if (!mudo) somDeTente();
      },
      festa: () => {
        if (!mudo) somDeFesta();
      },
    }),
    [mudo],
  );
  return [som, mudo, setMudo];
}

/** Teclas coloridas grandes; cada uma acende quando toca (o som nunca é a única pista). */
function Teclado({ ativa, aoTocar, s, desligado }: { ativa: number | null; aoTocar: (i: number) => void; s: TextosDosJogos; desligado?: boolean }) {
  return (
    <div role="group" aria-label={s.criancas.jogos.piano.nome} className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {TECLAS.map((k, i) => (
        <button
          key={k.id}
          type="button"
          disabled={desligado}
          onClick={() => aoTocar(i)}
          aria-label={fill(s.criancas.tecla, { nome: k.nome })}
          aria-keyshortcuts={k.tecla}
          style={{ background: k.cor }}
          className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl border-4 border-ink text-ink shadow-[4px_4px_0_#221C17] transition-transform disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none ${ativa === i ? "scale-105 ring-4 ring-white" : ""}`}
        >
          <span aria-hidden className="text-4xl">{k.bicho}</span>
          <span className="text-lg font-bold text-white [text-shadow:0_1px_2px_#221C17]">{k.nome}</span>
        </button>
      ))}
    </div>
  );
}

function Piano({ som, s }: { som: Som; s: TextosDosJogos }) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const tocar = useCallback((i: number) => {
    som.nota(TECLAS[i].midi);
    setAtiva(i);
    window.setTimeout(() => setAtiva((a) => (a === i ? null : a)), 260);
  }, [som]);
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !raiz.current?.contains(document.activeElement)) return;
      const i = TECLAS.findIndex((k) => k.tecla === e.key.toLowerCase());
      if (i >= 0) tocar(i);
    };
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [tocar]);
  return (
    <div ref={raiz}>
      <p className="mb-3 text-lg">{s.criancas.jogos.piano.texto}</p>
      <Teclado ativa={ativa} aoTocar={tocar} s={s} />
    </div>
  );
}

function Melodia({ som, s }: { som: Som; s: TextosDosJogos }) {
  const t = s.criancas;
  const [rodada, setRodada] = useState(0);
  const [melodia, setMelodia] = useState<number[]>(() => sortearMelodia(RODADAS_DA_MELODIA[0], criarSorteio(sementeNova())));
  const [fase, setFase] = useState<"parado" | "ouvindo" | "vez" | "fim">("parado");
  const [tocadas, setTocadas] = useState<number[]>([]);
  const [ativa, setAtiva] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);

  const ouvir = (m = melodia) => {
    timers.current.forEach((x) => window.clearTimeout(x));
    setFase("ouvindo");
    setTocadas([]);
    setAviso(t.ouvindo);
    m.forEach((nota, i) => {
      timers.current.push(window.setTimeout(() => { som.nota(TECLAS[nota].midi, 0.5); setAtiva(nota); }, 300 + i * 750));
      timers.current.push(window.setTimeout(() => setAtiva(null), 300 + i * 750 + 450));
    });
    timers.current.push(window.setTimeout(() => { setFase("vez"); setAviso(t.suaVez); }, 300 + m.length * 750));
  };
  const tocar = (i: number) => {
    if (fase !== "vez") return;
    som.nota(TECLAS[i].midi);
    setAtiva(i);
    window.setTimeout(() => setAtiva(null), 250);
    const novas = [...tocadas, i];
    setTocadas(novas);
    const r = conferirMelodia(melodia, novas);
    if (r === "errou") {
      som.tente();
      setFase("parado");
      setAviso(t.denovo);
    } else if (r === "completa") {
      som.festa();
      if (rodada + 1 >= RODADAS_DA_MELODIA.length) {
        setFase("fim");
        setAviso(`${t.muitoBem} ${t.fimMelodia}`);
      } else {
        setFase("parado");
        setAviso(t.muitoBem);
        setRodada(rodada + 1);
        setMelodia(sortearMelodia(RODADAS_DA_MELODIA[rodada + 1], criarSorteio(sementeNova())));
      }
    }
  };
  const recomecar = () => {
    setRodada(0);
    const m = sortearMelodia(RODADAS_DA_MELODIA[0], criarSorteio(sementeNova()));
    setMelodia(m);
    setFase("parado");
    setTocadas([]);
    setAviso("");
  };

  return (
    <div>
      <p className="mb-3 text-lg">{t.jogos.melodia.texto} <span className="font-bold">{fill(t.rodada, { i: rodada + 1, n: RODADAS_DA_MELODIA.length })}</span></p>
      <Teclado ativa={ativa} aoTocar={tocar} s={s} desligado={fase !== "vez"} />
      <div className="mt-4 flex flex-wrap gap-3">
        {fase === "fim" ? (
          <Botao className="text-lg" onClick={recomecar}>{t.comecar}</Botao>
        ) : (
          <Botao className="text-lg" disabled={fase === "ouvindo" || fase === "vez"} onClick={() => ouvir()}>{t.ouvir}</Botao>
        )}
      </div>
      <Aviso>{aviso}</Aviso>
    </div>
  );
}

function Bateria({ som, s }: { som: Som; s: TextosDosJogos }) {
  const t = s.criancas;
  const [ativa, setAtiva] = useState<Batida | null>(null);
  const [tocando, setTocando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const passo = useRef(0);
  const bater = useCallback((b: Batida) => {
    som.batida(b);
    setAtiva(b);
    window.setTimeout(() => setAtiva((a) => (a === b ? null : a)), 160);
  }, [som]);
  useEffect(() => {
    if (!tocando) return;
    passo.current = 0;
    const id = window.setInterval(() => {
      const i = passo.current % 8;
      for (const b of BATIDAS) if (RITMO_PRONTO[b.id][i]) bater(b.id);
      passo.current++;
    }, 330);
    return () => window.clearInterval(id);
  }, [tocando, bater]);
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !raiz.current?.contains(document.activeElement)) return;
      const b = BATIDAS.find((x) => x.tecla === e.key.toLowerCase());
      if (b) bater(b.id);
    };
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [bater]);
  return (
    <div ref={raiz}>
      <p className="mb-3 text-lg">{t.jogos.bateria.texto}</p>
      <div role="group" aria-label={t.jogos.bateria.nome} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BATIDAS.map((b) => (
          <button key={b.id} type="button" onClick={() => bater(b.id)} aria-label={fill(t.batida, { nome: b.nome })} aria-keyshortcuts={b.tecla} style={{ background: b.cor }} className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-full border-4 border-ink text-ink shadow-[4px_4px_0_#221C17] transition-transform motion-reduce:transition-none ${ativa === b.id ? "scale-105 ring-4 ring-white" : ""}`}>
            <span aria-hidden className="text-4xl">{b.desenho}</span>
            <span className="text-lg font-bold text-white [text-shadow:0_1px_2px_#221C17]">{b.nome}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Botao className="text-lg" aria-pressed={tocando} onClick={() => setTocando((x) => !x)}>{tocando ? t.parar : t.ritmo}</Botao>
      </div>
    </div>
  );
}

function Iguais({ som, s }: { som: Som; s: TextosDosJogos }) {
  const t = s.criancas;
  const PARES = 4;
  const montar = () => embaralhar(paresDeSons(PARES), criarSorteio(sementeNova()));
  const [cartas, setCartas] = useState<number[]>(montar);
  const [viradas, setViradas] = useState<number[]>([]);
  const [feitos, setFeitos] = useState<number[]>([]);
  const [aviso, setAviso] = useState("");
  const espera = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(espera.current), []);
  const virar = (pos: number) => {
    if (viradas.length >= 2 || viradas.includes(pos) || feitos.includes(cartas[pos])) return;
    som.nota(TECLAS[cartas[pos]].midi, 0.5);
    const novas = [...viradas, pos];
    setViradas(novas);
    if (novas.length === 2) {
      if (cartas[novas[0]] === cartas[novas[1]]) {
        const todos = [...feitos, cartas[pos]];
        setFeitos(todos);
        setViradas([]);
        if (todos.length === PARES) {
          som.festa();
          setAviso(t.iguaisCompleto);
        } else setAviso(fill(t.paresAchados, { n: todos.length, total: PARES }));
      } else espera.current = window.setTimeout(() => setViradas([]), 1300);
    }
  };
  const novo = () => {
    window.clearTimeout(espera.current);
    setCartas(montar());
    setViradas([]);
    setFeitos([]);
    setAviso("");
  };
  return (
    <div>
      <p className="mb-3 text-lg">{t.jogos.iguais.texto}</p>
      <ul className="grid grid-cols-4 gap-3">
        {cartas.map((nota, pos) => {
          const aberta = viradas.includes(pos) || feitos.includes(nota);
          const k = TECLAS[nota];
          return (
            <li key={pos}>
              <button type="button" onClick={() => virar(pos)} aria-label={aberta ? `${fill(t.cartaSom, { n: pos + 1 })}: ${k.nome}` : fill(t.cartaSom, { n: pos + 1 })} style={aberta ? { background: k.cor } : undefined} className={`flex aspect-square w-full cursor-pointer items-center justify-center rounded-3xl border-4 border-ink text-5xl shadow-[4px_4px_0_#221C17] ${aberta ? "" : "bg-white"}`}>
                <span aria-hidden>{aberta ? k.bicho : "❓"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4"><Botao className="text-lg" onClick={novo}>{s.comum.novo}</Botao></div>
      <Aviso>{aviso}</Aviso>
    </div>
  );
}

function AltoBaixo({ som, s }: { som: Som; s: TextosDosJogos }) {
  const t = s.criancas;
  const RODADAS = 6;
  const sortear = () => {
    const rnd = criarSorteio(sementeNova());
    const a = Math.floor(rnd() * TECLAS.length);
    let b = Math.floor(rnd() * TECLAS.length);
    if (b === a) b = (a + 1 + Math.floor(rnd() * (TECLAS.length - 1))) % TECLAS.length;
    return [a, b] as const;
  };
  const [par, setPar] = useState(sortear);
  const [rodada, setRodada] = useState(1);
  const [resp, setResp] = useState<"certo" | "errado" | null>(null);
  const [ativa, setAtiva] = useState<0 | 1 | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);
  const ouvir = () => {
    timers.current.forEach((x) => window.clearTimeout(x));
    som.nota(TECLAS[par[0]].midi, 0.7);
    setAtiva(0);
    timers.current.push(window.setTimeout(() => { som.nota(TECLAS[par[1]].midi, 0.7); setAtiva(1); }, 900));
    timers.current.push(window.setTimeout(() => setAtiva(null), 1700));
  };
  const escolher = (qual: 0 | 1) => {
    const maisAgudo = TECLAS[par[0]].midi > TECLAS[par[1]].midi ? 0 : 1;
    setResp(qual === maisAgudo ? "certo" : "errado");
    if (qual === maisAgudo) som.festa();
    else som.tente();
  };
  const outro = () => {
    if (rodada >= RODADAS) {
      setRodada(1);
    } else setRodada(rodada + 1);
    setPar(sortear());
    setResp(null);
  };
  return (
    <div>
      <p className="mb-3 text-lg">{t.doisSons} <span className="font-bold">{fill(t.rodada, { i: rodada, n: RODADAS })}</span></p>
      <div className="flex flex-wrap gap-3">
        <Botao className="text-lg" onClick={ouvir}>{t.ouvirDois}</Botao>
        <span aria-hidden className="inline-flex items-center gap-2 text-4xl">
          <span className={ativa === 0 ? "scale-125" : "opacity-60"}>1️⃣</span>
          <span className={ativa === 1 ? "scale-125" : "opacity-60"}>2️⃣</span>
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Botao className="text-lg" disabled={resp !== null} onClick={() => escolher(0)}>{t.primeiro}</Botao>
        <Botao className="text-lg" disabled={resp !== null} onClick={() => escolher(1)}>{t.segundo}</Botao>
        {resp && <Botao className="text-lg" onClick={outro}>{rodada >= RODADAS ? t.comecar : t.outraVez}</Botao>}
      </div>
      <Aviso>{resp === "certo" ? t.agudoCerto : resp === "errado" ? t.agudoErrado : ""}</Aviso>
    </div>
  );
}

/**
 * Brincadeiras com música e sons para crianças. Os sons são sintetizados no aparelho (WebAudio, components/jogos/audio.ts):
 * nada é baixado, nada sai do aparelho e nada identifica a criança. Sem pontos, sem tempo e sem derrota: o que o jogo
 * pede é ouvir e repetir. O botão de som usa a mesma preferência da área infantil.
 */
export function SonsInfantis({ s, inicial }: { s: TextosDosJogos; inicial?: Id }) {
  const [id, setId] = useState<Id | null>(inicial ?? null);
  const [som, mudo, setMudo] = useSom();
  const audio = useSyncExternalStore(() => () => {}, temAudio, () => true);
  const t = s.criancas;
  const Jogo = { piano: Piano, melodia: Melodia, bateria: Bateria, iguais: Iguais, altoBaixo: AltoBaixo };

  return (
    <div className="rounded-3xl border-4 border-ink bg-[#FFF8E7] p-4 text-[#221C17] sm:p-6" style={{ fontFamily: "'Andika', 'Lexend', 'Comic Neue', 'Trebuchet MS', system-ui, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-lg">{t.lead}</p>
        <button type="button" aria-pressed={!mudo} onClick={() => setMudo(!mudo)} className="min-h-12 cursor-pointer rounded-full border-4 border-ink bg-white px-5 text-lg font-bold">
          {mudo ? `🔇 ${t.somMudo}` : `🔊 ${t.somLigado}`}
        </button>
      </div>
      {!audio && <p className="mt-3 font-bold">{t.semAudio}</p>}
      {id === null ? (
        <>
          <h3 className="mt-5 text-2xl font-bold">{t.escolha}</h3>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ORDEM.map((j) => (
              <li key={j}>
                <button type="button" onClick={() => setId(j)} className="flex h-full min-h-32 w-full cursor-pointer flex-col rounded-3xl border-4 border-ink bg-white p-4 text-left shadow-[5px_5px_0_#221C17] hover:-translate-y-0.5">
                  <span aria-hidden className="text-4xl">{ICONES[j]}</span>
                  <span className="mt-1 text-xl font-bold">{t.jogos[j].nome}</span>
                  <span className="text-base">{t.jogos[j].texto}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setId(null)} className="min-h-12 cursor-pointer rounded-full border-4 border-ink bg-white px-5 text-lg font-bold">← {s.treino.voltar}</button>
            <h3 className="text-2xl font-bold"><span aria-hidden>{ICONES[id]}</span> {t.jogos[id].nome}</h3>
          </div>
          <div className="mt-4">
            <Quadro>{(() => { const J = Jogo[id]; return <J som={som} s={s} />; })()}</Quadro>
          </div>
        </div>
      )}
    </div>
  );
}
