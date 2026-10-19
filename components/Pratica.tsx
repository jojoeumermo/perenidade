// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { cartaoVencido, confere, embaralhar, type Exercicio, falar, juntar, lerProgresso, palavrasDe, parecido, type Progresso, registrarSessao, revisarCartao, temVoz, guardarProgresso } from "@/lib/pratica";

export type PraticaStrings = Dict["practice"];

type Resultado = "certo" | "errado" | "pulado";

/** O reconhecimento de fala do navegador (Web Speech API), onde existe. Os tipos não vêm na biblioteca padrão. */
interface Reconhecimento {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((evento: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type ReconhecimentoCtor = new () => Reconhecimento;

const botao = "cursor-pointer bg-ink px-6 py-2.5 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-5 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const ficha = "cursor-pointer border-2 border-rule bg-parchment px-3 py-2 font-serif text-lg hover:border-gold disabled:cursor-default";
const campo = "w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-serif text-xl";

/** Dois bipes curtos: sobe quando acerta, desce quando erra. Feitos aqui, sem arquivo de áudio. */
function tocar(certo: boolean) {
  try {
    const ctx = new AudioContext();
    const notas = certo ? [523, 784] : [220, 180];
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = certo ? "triangle" : "square";
      osc.frequency.value = freq;
      vol.gain.value = 0.06;
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.14);
    });
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // sem áudio
  }
}

const assinar = (cb: () => void) => {
  window.addEventListener("lucia:pratica", cb);
  return () => window.removeEventListener("lucia:pratica", cb);
};
let guardado: Progresso | null = null;
let guardadoEm = "";
const lerAgora = () => {
  // O mesmo objeto enquanto nada muda, para o React não pensar que mudou.
  const bruto = (() => {
    try {
      return localStorage.getItem("lucia:pratica") ?? "";
    } catch {
      return "";
    }
  })();
  if (!guardado || bruto !== guardadoEm) {
    guardado = lerProgresso();
    guardadoEm = bruto;
  }
  return guardado;
};
const vazioServidor: Progresso = { xp: 0, sequencia: 0, ultimoDia: "", som: true, porAula: {}, cartoes: {} };
export function useProgresso(): Progresso {
  return useSyncExternalStore(assinar, lerAgora, () => vazioServidor);
}

function Ouvir({ frase, lingua, s, devagar = true, autoFalar = false }: { frase: string; lingua: string; s: PraticaStrings; devagar?: boolean; autoFalar?: boolean }) {
  const [falando, setFalando] = useState(false);
  const toca = (rate: number) => {
    setFalando(true);
    void falar(frase, lingua, rate).then(() => setFalando(false));
  };
  // Ao aparecer, o exercício de ouvir fala a frase uma vez sozinho (depois de a tela assentar).
  useEffect(() => {
    if (!autoFalar) return;
    const relogio = window.setTimeout(() => toca(1), 250);
    return () => window.clearTimeout(relogio);
    // só na primeira vez que o exercício aparece
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frase]);
  if (!temVoz()) return null;
  return (
    <span className="inline-flex gap-2">
      <button type="button" onClick={() => toca(1)} aria-label={s.listen} title={s.listen} className={`${claro} px-3 ${falando ? "border-oxblood text-oxblood" : ""}`}>
        🔊 {s.listen}
      </button>
      {devagar && (
        <button type="button" onClick={() => toca(0.6)} aria-label={s.slow} title={s.slow} className={`${claro} px-3`}>
          🐢
        </button>
      )}
    </span>
  );
}

/** Cada tipo de exercício devolve ao jogo se a resposta ficou certa, errada ou (nos cartões e na fala) concluída. */
function Exercicio({ ex, lingua, s, responder, chaveDoCartao }: { ex: Exercicio; lingua: string; s: PraticaStrings; responder: (r: Resultado, certa?: string) => void; chaveDoCartao: string }) {
  const [texto, setTexto] = useState("");
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [montado, setMontado] = useState<string[]>([]);
  const banco = useMemo(() => (ex.tipo === "ordenar" ? embaralhar(palavrasDe(ex.frase, lingua)) : ex.tipo === "traduzir" && ex.palavras ? embaralhar(ex.palavras) : []), [ex, lingua]);
  const [usadas, setUsadas] = useState<number[]>([]);
  // Pares
  const esquerda = useMemo(() => (ex.tipo === "pares" ? embaralhar(ex.pares.map((p, i) => ({ texto: p[0], i }))) : []), [ex]);
  const direita = useMemo(() => (ex.tipo === "pares" ? embaralhar(ex.pares.map((p, i) => ({ texto: p[1], i }))) : []), [ex]);
  const [marcado, setMarcado] = useState<{ lado: "e" | "d"; i: number } | null>(null);
  const [feitos, setFeitos] = useState<number[]>([]);
  const [errosPares, setErrosPares] = useState(0);
  const [piscando, setPiscando] = useState<number | null>(null);
  // Cartões
  const [indice, setIndice] = useState(0);
  const [virado, setVirado] = useState(false);
  // Fala
  const [ouvido, setOuvido] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const reconhecimento = useRef<{ stop: () => void } | null>(null);
  const [grau, setGrau] = useState<number | null>(null);

  const janela = typeof window === "undefined" ? null : (window as unknown as { SpeechRecognition?: ReconhecimentoCtor; webkitSpeechRecognition?: ReconhecimentoCtor });
  const Reconhecedor = janela?.SpeechRecognition ?? janela?.webkitSpeechRecognition;

  if (ex.tipo === "escolha") {
    return (
      <div>
        <p className="font-serif text-2xl">{ex.pergunta}</p>
        <div className="mt-2"><Ouvir frase={ex.audio || ex.pergunta} lingua={lingua} s={s} /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {ex.opcoes.map((opcao, i) => (
            <button key={i} type="button" onClick={() => setEscolhido(i)} aria-pressed={escolhido === i} className={`${ficha} text-left ${escolhido === i ? "border-ink bg-parchment-deep" : ""}`}>
              <span className="mr-2 font-mono text-xs text-ink-soft">{i + 1}</span>
              {opcao}
            </button>
          ))}
        </div>
        <p className="mt-4">
          <button type="button" className={botao} disabled={escolhido === null} onClick={() => responder(escolhido === ex.resposta ? "certo" : "errado", ex.opcoes[ex.resposta])}>{s.check}</button>
        </p>
        {ex.dica && <p className="mt-2 text-sm text-ink-soft">{ex.dica}</p>}
      </div>
    );
  }

  if (ex.tipo === "traduzir" || ex.tipo === "ordenar") {
    const comBanco = banco.length > 0;
    const resposta = comBanco ? juntar(montado, lingua) : texto;
    const certas = ex.tipo === "traduzir" ? ex.resposta : [ex.frase];
    const naLingua = ex.tipo === "traduzir" && ex.na_lingua === true;
    const fala = ex.tipo === "ordenar" || naLingua ? ex.frase : certas[0];
    return (
      <div>
        <p className="font-sans text-xs uppercase tracking-widest text-gold">{ex.tipo === "ordenar" ? s.orderWords : s.translate}</p>
        <p className="mt-1 font-serif text-2xl">{ex.tipo === "ordenar" ? (ex.traducao ?? "") : ex.frase}</p>
        <div className="mt-2"><Ouvir frase={fala} lingua={lingua} s={s} /></div>
        {comBanco ? (
          <>
            <div className="mt-4 flex min-h-14 flex-wrap gap-2 border-b-2 border-ink pb-2" aria-label={s.yourAnswer}>
              {montado.length === 0 && <span className="self-center text-sm text-ink-soft">{s.tapWords}</span>}
              {montado.map((palavra, i) => (
                <button key={i} type="button" className={ficha} onClick={() => { setMontado(montado.filter((_, j) => j !== i)); setUsadas(usadas.filter((_, j) => j !== i)); }}>
                  {palavra}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {banco.map((palavra, i) => (
                <button key={i} type="button" disabled={usadas.includes(i)} className={`${ficha} ${usadas.includes(i) ? "opacity-30" : ""}`} onClick={() => { setMontado([...montado, palavra]); setUsadas([...usadas, i]); }}>
                  {palavra}
                </button>
              ))}
            </div>
          </>
        ) : (
          <input value={texto} onChange={(e) => setTexto(e.target.value)} lang={naLingua ? undefined : lingua} className={`${campo} mt-4`} placeholder={s.typeAnswer} onKeyDown={(e) => { if (e.key === "Enter" && texto.trim()) responder(confere(texto, certas) ? "certo" : "errado", certas[0]); }} />
        )}
        <p className="mt-4">
          <button type="button" className={botao} disabled={!resposta.trim()} onClick={() => responder(confere(resposta, certas) ? "certo" : "errado", certas[0])}>{s.check}</button>
        </p>
      </div>
    );
  }

  if (ex.tipo === "lacuna") {
    const [antes, depois] = ex.frase.split("___");
    const resposta = ex.opcoes ? (escolhido === null ? "" : ex.opcoes[escolhido]) : texto;
    return (
      <div>
        <p className="font-sans text-xs uppercase tracking-widest text-gold">{s.fillBlank}</p>
        <p className="mt-1 font-serif text-2xl">
          {antes}
          <span className="mx-1 inline-block min-w-24 border-b-2 border-ink px-2 text-center text-oxblood">{resposta || " "}</span>
          {depois}
        </p>
        <div className="mt-2"><Ouvir frase={ex.frase.replace("___", ex.resposta)} lingua={lingua} s={s} /></div>
        {ex.opcoes ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {ex.opcoes.map((opcao, i) => (
              <button key={i} type="button" onClick={() => setEscolhido(i)} aria-pressed={escolhido === i} className={`${ficha} ${escolhido === i ? "border-ink bg-parchment-deep" : ""}`}>{opcao}</button>
            ))}
          </div>
        ) : (
          <input value={texto} onChange={(e) => setTexto(e.target.value)} lang={lingua} className={`${campo} mt-4 max-w-sm`} placeholder={s.typeAnswer} onKeyDown={(e) => { if (e.key === "Enter" && texto.trim()) responder(confere(texto, ex.resposta) ? "certo" : "errado", ex.resposta); }} />
        )}
        <p className="mt-4">
          <button type="button" className={botao} disabled={!resposta} onClick={() => responder(confere(resposta, ex.resposta) ? "certo" : "errado", ex.resposta)}>{s.check}</button>
        </p>
        {ex.dica && <p className="mt-2 text-sm text-ink-soft">{ex.dica}</p>}
      </div>
    );
  }

  if (ex.tipo === "pares") {
    const tocarFicha = (lado: "e" | "d", i: number) => {
      if (feitos.includes(i)) return;
      if (!marcado || marcado.lado === lado) return setMarcado({ lado, i });
      if (marcado.i === i) {
        const novos = [...feitos, i];
        setFeitos(novos);
        setMarcado(null);
        if (novos.length === ex.pares.length) window.setTimeout(() => responder(errosPares === 0 ? "certo" : "errado"), 350);
      } else {
        setErrosPares((n) => n + 1);
        setPiscando(i);
        window.setTimeout(() => setPiscando(null), 400);
        setMarcado(null);
      }
    };
    const coluna = (lado: "e" | "d", itens: { texto: string; i: number }[]) => (
      <div className="grid gap-2">
        {itens.map((item) => (
          <button
            key={item.i}
            type="button"
            disabled={feitos.includes(item.i)}
            onClick={() => tocarFicha(lado, item.i)}
            aria-pressed={marcado?.lado === lado && marcado.i === item.i}
            className={`${ficha} ${feitos.includes(item.i) ? "border-ok text-ok opacity-60" : marcado?.lado === lado && marcado.i === item.i ? "border-ink bg-parchment-deep" : piscando === item.i ? "border-oxblood" : ""}`}
          >
            {item.texto}
          </button>
        ))}
      </div>
    );
    return (
      <div>
        <p className="font-sans text-xs uppercase tracking-widest text-gold">{s.matchPairs}</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {coluna("e", esquerda)}
          {coluna("d", direita)}
        </div>
      </div>
    );
  }

  if (ex.tipo === "ouvir") {
    return (
      <div>
        <p className="font-sans text-xs uppercase tracking-widest text-gold">{s.typeHeard}</p>
        <div className="mt-3"><Ouvir frase={ex.frase} lingua={lingua} s={s} autoFalar /></div>
        {!temVoz() && <p className="mt-2 text-sm text-oxblood">{s.noSpeech} <span className="font-serif text-lg text-ink">{ex.frase}</span></p>}
        <input value={texto} onChange={(e) => setTexto(e.target.value)} lang={lingua} className={`${campo} mt-4`} placeholder={s.typeAnswer} onKeyDown={(e) => { if (e.key === "Enter" && texto.trim()) responder(confere(texto, ex.frase) ? "certo" : "errado", ex.frase); }} />
        <p className="mt-4">
          <button type="button" className={botao} disabled={!texto.trim()} onClick={() => responder(confere(texto, ex.frase) ? "certo" : "errado", ex.frase)}>{s.check}</button>
        </p>
      </div>
    );
  }

  if (ex.tipo === "falar") {
    const escutar = () => {
      if (!Reconhecedor) return;
      try {
        const r = new Reconhecedor();
        r.lang = lingua;
        r.interimResults = false;
        r.maxAlternatives = 3;
        r.onresult = (evento) => {
          const alternativas = Array.from(evento.results[0] ?? []).map((a) => a.transcript);
          const melhor = alternativas.reduce((m, a) => Math.max(m, parecido(a, ex.frase)), 0);
          setOuvido(alternativas[0] ?? "");
          setGrau(melhor);
        };
        r.onend = () => setGravando(false);
        r.onerror = () => { setGravando(false); setOuvido(""); };
        reconhecimento.current = r;
        setGravando(true);
        setOuvido(null);
        setGrau(null);
        r.start();
      } catch {
        setGravando(false);
      }
    };
    return (
      <div>
        <p className="font-sans text-xs uppercase tracking-widest text-gold">{s.sayIt}</p>
        <p className="mt-1 font-serif text-2xl" lang={lingua}>{ex.frase}</p>
        {ex.traducao && <p className="text-ink-soft">{ex.traducao}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Ouvir frase={ex.frase} lingua={lingua} s={s} />
          {Reconhecedor && (
            <button type="button" onClick={gravando ? () => reconhecimento.current?.stop() : escutar} className={`${claro} px-3 ${gravando ? "border-oxblood text-oxblood" : ""}`}>
              🎙 {gravando ? s.speaking : s.speak}
            </button>
          )}
        </div>
        {Reconhecedor ? (
          <>
            {ouvido !== null && (
              <p className="mt-3 text-sm">
                {ouvido ? (
                  <>
                    {s.heard} <span className="font-serif text-lg">“{ouvido}”</span>{" "}
                    {grau !== null && (grau >= 0.7 ? <strong className="text-ok">✓</strong> : <span className="text-ink-soft">({Math.round(grau * 100)}%)</span>)}
                  </>
                ) : (
                  <span className="text-ink-soft">{s.noMic}</span>
                )}
              </p>
            )}
            <p className="mt-4 flex flex-wrap gap-3">
              <button type="button" className={botao} disabled={grau === null} onClick={() => responder((grau ?? 0) >= 0.7 ? "certo" : "errado", ex.frase)}>{s.check}</button>
              <button type="button" className={claro} onClick={() => responder("pulado")}>{s.skip}</button>
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-ink-soft">{s.couldSay}</p>
            <p className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={botao} onClick={() => responder("certo")}>{s.iDid}</button>
              <button type="button" className={claro} onClick={() => responder("errado", ex.frase)}>{s.notYet}</button>
            </p>
          </>
        )}
      </div>
    );
  }

  // cartoes
  const cartao = ex.cartoes[indice];
  const avancar = (facil: boolean) => {
    revisarCartao(`${chaveDoCartao}:${indice}`, facil);
    setVirado(false);
    if (indice + 1 < ex.cartoes.length) setIndice(indice + 1);
    else responder("certo");
  };
  return (
    <div>
      <p className="font-sans text-xs uppercase tracking-widest text-gold">
        {s.flashcards} · {indice + 1}/{ex.cartoes.length}
      </p>
      <button type="button" onClick={() => setVirado((v) => !v)} className="mt-3 flex min-h-40 w-full cursor-pointer flex-col items-center justify-center border-2 border-ink bg-parchment-deep p-6 text-center hover:border-gold" aria-live="polite">
        <span className="font-serif text-3xl" lang={virado ? undefined : lingua}>{virado ? cartao.verso : cartao.frente}</span>
        <span className="mt-3 font-sans text-xs uppercase tracking-widest text-ink-soft">{virado ? s.front : s.flip}</span>
      </button>
      <div className="mt-3"><Ouvir frase={cartao.frente} lingua={lingua} s={s} devagar={false} /></div>
      {virado && (
        <p className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={claro} onClick={() => avancar(false)}>{s.hard}</button>
          <button type="button" className={botao} onClick={() => avancar(true)}>{s.easy}</button>
        </p>
      )}
    </div>
  );
}

/**
 * A prática lúdica no fim das aulas de idioma, no jeito dos aplicativos de língua: uma sessão com barra de progresso,
 * um exercício de cada vez, resposta na hora, pontos e sequência de dias. Tudo roda no navegador: a voz é a do aparelho,
 * o reconhecimento de fala (quando existe) também, e o progresso fica guardado só aqui.
 */
/** `semPlacar` e `lead` (opcionais, recurso "pratica-sem-placar"): escondem os pontos e a sequência de dias e trocam o texto de abertura. */
export function Pratica({ id, exercicios, lingua, s, previa = false, semPlacar = false, lead }: { id: string; exercicios: Exercicio[]; lingua: string; s: PraticaStrings; previa?: boolean; semPlacar?: boolean; lead?: string }) {
  const progresso = useProgresso();
  const [fase, setFase] = useState<"inicio" | "jogando" | "fim">("inicio");
  const [fila, setFila] = useState<number[]>([]);
  const [posicao, setPosicao] = useState(0);
  const [rodada, setRodada] = useState(0);
  const [resultados, setResultados] = useState<Record<number, Resultado>>({});
  const [feedback, setFeedback] = useState<{ r: Resultado; certa?: string } | null>(null);
  const [resumo, setResumo] = useState<{ acertos: number; total: number; xp: number } | null>(null);
  const daAula = progresso.porAula[id];

  function comecar(indices: number[]) {
    setFila(indices);
    setPosicao(0);
    setResultados({});
    setFeedback(null);
    setRodada((n) => n + 1);
    setFase("jogando");
  }

  function responder(r: Resultado, certa?: string) {
    if (progresso.som && r !== "pulado") tocar(r === "certo");
    setFeedback({ r, certa });
    setResultados((antes) => ({ ...antes, [fila[posicao]]: r }));
  }

  function continuar() {
    setFeedback(null);
    if (posicao + 1 < fila.length) return setPosicao(posicao + 1);
    const acertos = Object.values(resultados).filter((r) => r === "certo").length;
    const total = fila.length;
    const antes = lerProgresso().xp;
    if (!previa) registrarSessao(id, acertos, total);
    setResumo({ acertos, total, xp: lerProgresso().xp - antes });
    setFase("fim");
  }

  const atual = fila[posicao];
  const ex = exercicios[atual];
  const errados = Object.entries(resultados).filter(([, r]) => r === "errado").map(([i]) => Number(i));
  // Cartões vencidos aparecem primeiro na revisão.
  const vencidos = exercicios.map((e, i) => (e.tipo === "cartoes" && cartaoVencido(`${id}:${i}:0`, progresso) ? i : -1)).filter((i) => i >= 0);

  return (
    <section aria-labelledby="pratica-titulo" className="no-print mt-12 border-4 border-ink bg-parchment-deep p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="pratica-titulo" className="font-sans text-2xl font-black uppercase italic">{s.title}</h2>
        <p className="flex flex-wrap gap-4 font-mono text-xs text-ink-soft">
          {!semPlacar && (
            <>
              <span title={s.xp}>★ {progresso.xp} {s.xp}</span>
              <span title={s.streak}>🔥 {fill(s.streakDays, { n: progresso.sequencia })}</span>
            </>
          )}
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => guardarProgresso({ ...lerProgresso(), som: !progresso.som })}>{progresso.som ? s.soundOn : s.soundOff}</button>
        </p>
      </div>

      {fase === "inicio" && (
        <div className="mt-4 font-sans text-sm">
          <p className="max-w-2xl text-ink-soft">{lead ?? s.lead}</p>
          {daAula && <p className="mt-2 text-ink-soft">{fill(s.best, { n: daAula.melhor, k: daAula.sessoes })}</p>}
          <p className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={botao} onClick={() => comecar(exercicios.map((_, i) => i))}>
              {daAula ? s.again : s.start} · {fill(s.exercises, { n: exercicios.length })}
            </button>
            {vencidos.length > 0 && daAula && (
              <button type="button" className={claro} onClick={() => comecar(vencidos)}>{s.reviewCards}</button>
            )}
          </p>
        </div>
      )}

      {fase === "jogando" && ex && (
        <div className="mt-4">
          <div className="flex items-center gap-3 font-mono text-xs text-ink-soft">
            <div role="progressbar" aria-valuenow={posicao} aria-valuemin={0} aria-valuemax={fila.length} aria-label={s.progress} className="h-2 flex-1 bg-rule">
              <div className="h-full bg-ok transition-[width]" style={{ width: `${(posicao / fila.length) * 100}%` }} />
            </div>
            <span>{fill(s.exerciseOf, { i: posicao + 1, n: fila.length })}</span>
          </div>
          <div key={`${rodada}-${posicao}`} className="mt-5 border-2 border-ink bg-parchment p-5 sm:p-6" lang={lingua}>
            {feedback ? (
              <div role="status" className={`border-l-4 pl-4 ${feedback.r === "certo" ? "border-ok" : feedback.r === "errado" ? "border-oxblood" : "border-gold"}`}>
                <p className={`font-sans text-xl font-black uppercase italic ${feedback.r === "certo" ? "text-ok" : feedback.r === "errado" ? "text-oxblood" : "text-gold"}`}>
                  {feedback.r === "certo" ? s.correct : feedback.r === "errado" ? s.wrong : s.skipped}
                </p>
                {feedback.certa && feedback.r !== "certo" && (
                  <p className="mt-2 font-serif text-lg" lang={lingua}>
                    <span className="font-sans text-sm text-ink-soft">{s.answerWas} </span>
                    {feedback.certa}
                  </p>
                )}
                <p className="mt-4">
                  <button type="button" className={botao} autoFocus onClick={continuar}>{posicao + 1 < fila.length ? s.continue : s.finish}</button>
                </p>
              </div>
            ) : (
              <Exercicio ex={ex} lingua={lingua} s={s} responder={responder} chaveDoCartao={`${id}:${atual}`} />
            )}
          </div>
          <p className="mt-3 text-right font-sans text-xs">
            <button type="button" className="cursor-pointer text-ink-soft underline hover:text-oxblood" onClick={() => setFase("inicio")}>{s.quit}</button>
          </p>
        </div>
      )}

      {fase === "fim" && resumo && (
        <div className="mt-4 font-sans text-sm">
          <p className="font-serif text-3xl font-semibold">{fill(s.score, { a: resumo.acertos, b: resumo.total })}</p>
          {!semPlacar && (
            <p className="mt-1 text-ink-soft">
              {previa ? s.previewNote : fill(s.earned, { n: resumo.xp })} · 🔥 {fill(s.streakDays, { n: lerProgresso().sequencia })}
            </p>
          )}
          <p className="mt-4 flex flex-wrap gap-3">
            {errados.length > 0 && <button type="button" className={botao} onClick={() => comecar(errados)}>{s.redoWrong}</button>}
            <button type="button" className={claro} onClick={() => comecar(exercicios.map((_, i) => i))}>{s.again}</button>
          </p>
        </div>
      )}
    </section>
  );
}
