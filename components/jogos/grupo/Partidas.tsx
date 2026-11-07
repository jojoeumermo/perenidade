// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O desenho de cada partida em grupo, a partir da vista pública que o anfitrião transmite (lib/jogos/grupo/motor.ts).
// Botões grandes, cor E forma em cada alternativa (quem não distingue cores acha pela forma), relógio opcional com aviso
// escrito, e o retorno do palco (som se ligado, clarão na borda) a cada acerto, erro e vez.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "@/components/Link";
import { fill } from "@/i18n/config";
import type { TextosDosJogos } from "@/i18n/jogos";
import { ERROS_DA_FORCA, LADOS, type Acao, type Lado, type VistaBingo, type VistaDaSala, type VistaDebate, type VistaFio, type VistaForca, type VistaPerguntas } from "@/lib/jogos/grupo/motor";
import { CORES_DOS_JOGADORES, EQUIPES, LIMITE_DO_ARGUMENTO } from "@/lib/jogos/grupo/sala";
import { useImersao } from "../Imersao";
import { idSorteado } from "./canal";

type S = TextosDosJogos["grupo"];

export interface PropsDaPartida<V> {
  v: V;
  sala: VistaDaSala;
  eu: string;
  anfitriao: boolean;
  /** Esta pessoa joga (o anfitrião que só apresenta não joga). */
  joga: boolean;
  agir: (a: Acao) => void;
  s: S;
  lang: string;
  /** O fim do prazo da rodada no relógio deste aparelho (null: sem relógio). */
  prazoEm: number | null;
}

/** As quatro marcas das alternativas: cor do site e forma. */
const MARCAS = [
  { cor: "#c21f16", forma: "▲" },
  { cor: "#23408e", forma: "◆" },
  { cor: "#8a4b12", forma: "●" },
  { cor: "#2e6b4f", forma: "■" },
];

export const apelidoDe = (sala: VistaDaSala, id: string) => sala.jogadores.find((j) => j.id === id)?.apelido ?? "?";
export const corDe = (sala: VistaDaSala, id: string) => CORES_DOS_JOGADORES[sala.jogadores.find((j) => j.id === id)?.cor ?? 0] ?? "#1f1a14";

/** Toca o retorno uma vez quando `chave` muda (e só se `tom` existir). */
function useRetorno(chave: string, tom: Parameters<ReturnType<typeof useImersao>["retorno"]>[0] | null) {
  const { retorno } = useImersao();
  const anterior = useRef(chave);
  useEffect(() => {
    if (anterior.current === chave) return;
    anterior.current = chave;
    if (tom) retorno(tom);
  }, [chave, tom, retorno]);
}

/** O relógio da rodada: barra e número; nos últimos 5 segundos, um tique (se o som estiver ligado). */
export function Relogio({ prazoEm, segundos, s }: { prazoEm: number | null; segundos: number; s: S }) {
  const [agora, setAgora] = useState(() => Date.now());
  const { retorno } = useImersao();
  useEffect(() => {
    if (prazoEm === null) return;
    const r = window.setInterval(() => setAgora(Date.now()), 250);
    return () => window.clearInterval(r);
  }, [prazoEm]);
  const restam = prazoEm === null ? null : Math.max(0, Math.ceil((prazoEm - agora) / 1000));
  useEffect(() => {
    if (restam !== null && restam > 0 && restam <= 5) retorno("tique");
  }, [restam, retorno]);
  if (restam === null || segundos <= 0) return null;
  const parte = Math.min(1, restam / segundos);
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden className="h-2.5 flex-1 border border-ink bg-parchment-deep">
        <div className={`h-full ${restam <= 5 ? "bg-prelo" : "bg-ink"} transition-[width] duration-200 motion-reduce:transition-none`} style={{ width: `${parte * 100}%` }} />
      </div>
      <span className={`font-mono text-sm font-bold tabular-nums ${restam <= 5 ? "grupo-pulsa text-prelo-texto" : ""}`} role="timer" aria-live={restam <= 5 ? "polite" : "off"}>
        {fill(s.partida.restam, { n: restam })}
      </span>
    </div>
  );
}

function Cabeca({ esquerda, direita }: { esquerda: ReactNode; direita?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
      <span>{esquerda}</span>
      {direita && <span>{direita}</span>}
    </div>
  );
}

function BotaoDoAnfitriao({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="botao botao-prelo cursor-pointer">
      {children}
    </button>
  );
}

function LinkDaAula({ aula, lang, rotulo }: { aula?: { titulo: string; href: string }; lang: string; rotulo: string }) {
  if (!aula) return null;
  return (
    <Link href={`/${lang}${aula.href}`} target="_blank" className="underline hover:text-oxblood">
      {rotulo}: {aula.titulo}
    </Link>
  );
}

// ───────── Perguntas (Corrida, Quiz em equipe, Quem disse?, Fato ou boato?) ─────────

export function PartidaPerguntas({ v, sala, eu, anfitriao, joga, agir, s, lang, prazoEm }: PropsDaPartida<VistaPerguntas>) {
  const revelada = v.etapa === "revelada";
  const minha = v.respostas?.[eu];
  const respondi = v.responderam.includes(eu);
  const [escolhida, setEscolhida] = useState<{ i: number; opcao: number } | null>(null);
  const marcada = respondi ? (minha ?? (escolhida?.i === v.i ? escolhida.opcao : null)) : null;
  const total = sala.jogadores.filter((j) => !j.fora && (j.id !== sala.anfitriao || sala.opcoes.anfitriaoJoga)).length;
  const equipeMinha = sala.jogadores.find((j) => j.id === eu)?.equipe ?? 0;
  const escolhaDaEquipe = v.escolhas[`equipe:${equipeMinha}`];
  const acertei = revelada && (v.modo === "equipes" ? escolhaDaEquipe === v.certa : minha === v.certa);
  useRetorno(`${v.i}:${v.etapa}`, revelada ? (joga && (respondi || v.modo === "equipes") ? (acertei ? "certo" : "erro") : "vez") : "vez");

  return (
    <div className="grid gap-4">
      <Cabeca esquerda={fill(s.partida.pergunta, { i: v.i + 1, n: v.total })} direita={fill(s.partida.responderam, { n: v.responderam.length, total })} />
      <Relogio segundos={sala.opcoes.segundos} prazoEm={revelada ? null : prazoEm} s={s} />
      <h3 key={v.i} className="grupo-surge font-serif text-[1.5rem] font-semibold leading-snug sm:text-[1.8rem]">
        {v.enunciado}
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {v.opcoes.map((op, i) => {
          const m = MARCAS[i % MARCAS.length];
          const certa = revelada && v.certa === i;
          const errada = revelada && marcada === i && v.certa !== i;
          const quem = revelada && v.respostas ? Object.entries(v.respostas).filter(([, o]) => o === i).map(([id]) => id) : [];
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!joga || respondi || revelada}
                aria-pressed={marcada === i}
                onClick={() => {
                  setEscolhida({ i: v.i, opcao: i });
                  agir({ t: "responder", opcao: i });
                }}
                className={`flex min-h-16 w-full cursor-pointer items-start gap-3 border-2 border-ink p-3 text-left text-[1.05rem] font-semibold leading-snug shadow-[3px_3px_0_var(--sombra)] disabled:cursor-default ${certa ? "grupo-surge bg-[#dff0e4]" : errada ? "bg-[#f8dcd8]" : marcada === i ? "bg-[#fbe7b0]" : "bg-folha hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"} ${revelada && !certa && marcada !== i ? "opacity-60" : ""}`}
              >
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink text-lg text-[#fff8ea]" style={{ background: m.cor }}>
                  {m.forma}
                </span>
                <span className="flex-1">
                  {op}
                  {certa && <span className="ml-2 font-mono text-sm text-[#2e6b4f]">✓ {s.partida.certa}</span>}
                  {quem.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {quem.map((id) => (
                        <span key={id} className="px-1.5 py-0.5 font-mono text-[0.7rem] text-[#fff8ea]" style={{ background: corDe(sala, id) }}>
                          {apelidoDe(sala, id)}
                          {v.ganhos[id] ? ` +${v.ganhos[id]}` : ""}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="min-h-6 font-sans text-sm font-bold">
        {!joga && !revelada ? s.partida.apresentando : !revelada ? (respondi ? s.partida.espere : "") : !joga ? "" : acertei ? s.partida.acertou : respondi || v.modo === "equipes" ? s.partida.errou : s.partida.naoRespondeu}
      </p>
      {revelada && v.modo === "equipes" && (
        <ul className="flex flex-wrap gap-2">
          {Object.entries(v.escolhas).map(([chave, opcao]) => {
            const eq = EQUIPES[Number(chave.split(":")[1])];
            if (!eq) return null;
            return (
              <li key={chave} className="border-2 border-ink px-2 py-1 text-sm font-bold text-[#fff8ea]" style={{ background: eq.cor }}>
                {fill(s.partida.equipeEscolheu, { equipe: eq.nome })}: {MARCAS[opcao % MARCAS.length].forma} {opcao === v.certa ? "✓" : "✗"}
              </li>
            );
          })}
        </ul>
      )}
      {revelada && (v.explicacao || v.aula) && (
        <div className="border-l-4 border-ink bg-parchment-deep/60 p-3 text-[0.95rem] leading-relaxed">
          {v.explicacao && <p>{v.explicacao}</p>}
          {v.fonte && <p className="mt-1 text-sm text-ink-soft">{v.fonte}</p>}
          <p className="mt-1 text-sm">
            <LinkDaAula aula={v.aula} lang={lang} rotulo={s.partida.aula} />
          </p>
        </div>
      )}
      {anfitriao && <div>{revelada ? <BotaoDoAnfitriao onClick={() => agir({ t: "avancar" })}>{s.partida.proxima} →</BotaoDoAnfitriao> : <BotaoDoAnfitriao onClick={() => agir({ t: "avancar" })}>{s.partida.revelar}</BotaoDoAnfitriao>}</div>}
    </div>
  );
}

// ───────── Assembleia ─────────

const COR_DO_LADO: Record<Lado, string> = { concordo: "#2e6b4f", discordo: "#c21f16", duvida: "#8a4b12" };

function Barras({ contagem, s }: { contagem: Record<Lado, number>; s: S }) {
  const total = Math.max(1, LADOS.reduce((a, l) => a + contagem[l], 0));
  return (
    <ul className="grid gap-1.5">
      {LADOS.map((l) => (
        <li key={l} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="font-bold">{s.partida.debate.lados[l]}</span>
          <span className="h-4 border border-ink bg-parchment-deep">
            <span className="block h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(contagem[l] / total) * 100}%`, background: COR_DO_LADO[l] }} />
          </span>
          <span className="font-mono tabular-nums">{contagem[l]}</span>
        </li>
      ))}
    </ul>
  );
}

export function PartidaDebate({ v, anfitriao, joga, agir, s }: PropsDaPartida<VistaDebate>) {
  const d = s.partida.debate;
  const [texto, setTexto] = useState("");
  const [lado, setLado] = useState<Lado>("concordo");
  const [meus, setMeus] = useState<string[]>([]);
  const [opinei, setOpinei] = useState<Partial<Record<"opiniao" | "segunda", Lado>>>({});
  const [votei, setVotei] = useState<string | null>(null);
  const etapas = Object.keys(d.etapas) as VistaDebate["etapa"][];
  useRetorno(v.etapa, "vez");

  const opinar = (l: Lado) => {
    if (v.etapa !== "opiniao" && v.etapa !== "segunda") return;
    setOpinei((o) => ({ ...o, [v.etapa]: l }));
    agir({ t: "opinar", lado: l });
  };
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = texto.trim();
    if (limpo.length < 3 || meus.length >= 2) return;
    const id = idSorteado();
    setMeus((m) => [...m, id]);
    agir({ t: "argumentar", id, lado, texto: limpo });
    setTexto("");
  };
  const opinando = v.etapa === "opiniao" || v.etapa === "segunda";
  const minhaOpiniao = v.etapa === "opiniao" || v.etapa === "segunda" ? opinei[v.etapa] : undefined;

  return (
    <div className="grid gap-4">
      <ol className="flex flex-wrap gap-1.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em]">
        {etapas.map((e, i) => (
          <li key={e} aria-current={e === v.etapa ? "step" : undefined} className={`border-2 border-ink px-2 py-1 ${e === v.etapa ? "bg-ink text-parchment" : etapas.indexOf(v.etapa) > i ? "bg-parchment-deep" : "bg-folha text-ink-soft"}`}>
            {i + 1}. {d.etapas[e]}
          </li>
        ))}
      </ol>
      <blockquote className="border-2 border-ink bg-[#1f1a14] p-4 font-serif text-[1.5rem] font-semibold leading-snug text-[#f4ecd8] shadow-[5px_5px_0_#c21f16] sm:text-[1.9rem]">“{v.tema.afirmacao}”</blockquote>

      {opinando && (
        <section aria-label={v.etapa === "opiniao" ? d.pergunta : d.mudou} className="grid gap-2">
          <p className="font-bold">{v.etapa === "opiniao" ? d.pergunta : d.mudou}</p>
          {joga && (
            <div className="flex flex-wrap gap-2">
              {LADOS.map((l) => (
                <button key={l} type="button" aria-pressed={minhaOpiniao === l} onClick={() => opinar(l)} className="min-h-12 cursor-pointer border-2 border-ink px-4 py-2 font-bold text-[#fff8ea] shadow-[3px_3px_0_var(--sombra)] aria-pressed:outline aria-pressed:outline-[3px] aria-pressed:outline-offset-2 aria-pressed:outline-[#f0b323]" style={{ background: COR_DO_LADO[l] }}>
                  {minhaOpiniao === l ? "✓ " : ""}
                  {d.lados[l]}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-ink-soft" role="status">
            {fill(d.opinaram, { n: (v.etapa === "opiniao" ? v.opinaram : v.opinaram2).length })}
          </p>
        </section>
      )}

      {v.etapa === "argumentos" && joga && (
        <form onSubmit={enviar} className="grid gap-2 border-2 border-ink bg-folha p-3">
          <label htmlFor="grupo-argumento" className="font-bold">
            {d.escreva}
          </label>
          <textarea id="grupo-argumento" value={texto} maxLength={LIMITE_DO_ARGUMENTO} onChange={(e) => setTexto(e.target.value)} rows={2} className="w-full border-2 border-ink bg-white p-2" disabled={meus.length >= 2} />
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={d.lado} className="flex flex-wrap gap-1.5">
              {LADOS.map((l) => (
                <button key={l} type="button" aria-pressed={lado === l} onClick={() => setLado(l)} className="aba-pasta cursor-pointer">
                  {d.lados[l]}
                </button>
              ))}
            </div>
            <button type="submit" className="botao botao-prelo cursor-pointer" disabled={meus.length >= 2 || texto.trim().length < 3}>
              {d.enviar}
            </button>
            <span className="font-mono text-xs text-ink-soft">
              {texto.length}/{LIMITE_DO_ARGUMENTO} · {meus.length}/2
            </span>
          </div>
        </form>
      )}

      {v.etapa !== "opiniao" && (
        <section className="grid gap-2">
          {v.etapa === "votacao" && <p className="font-bold">{d.vote}</p>}
          {v.argumentos.length === 0 && <p className="text-ink-soft">{d.nenhum}</p>}
          <ul className="grid gap-2 sm:grid-cols-3">
            {LADOS.map((l) => (
              <li key={l} className="grid content-start gap-2">
                <p className="border-b-2 font-mono text-xs font-bold uppercase tracking-[0.1em]" style={{ borderColor: COR_DO_LADO[l], color: COR_DO_LADO[l] }}>
                  {d.lados[l]}
                </p>
                {v.argumentos
                  .filter((a) => a.lado === l)
                  .map((a) => {
                    const meu = meus.includes(a.id);
                    return (
                      <div key={a.id} className={`grupo-surge border-2 border-ink bg-folha p-2 text-[0.95rem] ${votei === a.id ? "outline outline-[3px] outline-[#f0b323]" : ""}`}>
                        <p className={a.oculto ? "italic text-ink-soft" : ""}>{a.oculto ? d.oculto : a.texto}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                          {meu && <span className="font-mono uppercase text-ink-soft">({d.seu})</span>}
                          {a.votos !== undefined && <span className="font-mono font-bold">{fill(d.votos, { n: a.votos })}</span>}
                          {v.etapa === "votacao" && joga && !meu && !a.oculto && (
                            <button
                              type="button"
                              aria-pressed={votei === a.id}
                              onClick={() => {
                                setVotei(a.id);
                                agir({ t: "votar", arg: a.id });
                              }}
                              className="aba-pasta cursor-pointer"
                            >
                              {d.votar}
                            </button>
                          )}
                          {anfitriao && (
                            <button type="button" onClick={() => agir({ t: "ocultar", arg: a.id })} className="cursor-pointer underline">
                              {a.oculto ? d.mostrar : d.ocultar}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </li>
            ))}
          </ul>
          {v.etapa === "votacao" && votei && <p role="status" className="text-sm font-bold">{d.votou}</p>}
        </section>
      )}

      {(v.etapa === "resultado" || v.etapa === "segunda") && v.contagem && (
        <section className="grid gap-3 border-2 border-ink bg-folha p-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 font-mono text-xs font-bold uppercase">{d.antes}</p>
            <Barras contagem={v.contagem} s={s} />
          </div>
          {v.etapa === "segunda" && v.contagem2 && (
            <div>
              <p className="mb-1 font-mono text-xs font-bold uppercase">{d.depois}</p>
              <Barras contagem={v.contagem2} s={s} />
            </div>
          )}
        </section>
      )}
      {(v.etapa === "resultado" || v.etapa === "segunda") && (
        <section className="border-l-4 border-prelo bg-parchment-deep/60 p-3">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.1em]">{d.resposta}</p>
          <p className="mt-1 whitespace-pre-line leading-relaxed">{v.tema.resposta}</p>
          {v.tema.fontes.length > 0 && (
            <p className="mt-2 text-sm">
              <span className="font-bold">{d.fontes}: </span>
              {v.tema.fontes.map((f, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {f.url && /^https:\/\//.test(f.url) ? (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {f.titulo}
                    </a>
                  ) : (
                    f.titulo
                  )}
                </span>
              ))}
            </p>
          )}
        </section>
      )}
      {anfitriao && (
        <div>
          <BotaoDoAnfitriao onClick={() => agir({ t: "avancar" })}>{d.avancar} →</BotaoDoAnfitriao>
        </div>
      )}
      {!joga && <p className="text-sm text-ink-soft">{s.partida.apresentando}</p>}
    </div>
  );
}

// ───────── Forca coletiva ─────────

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** A faixa de protesto que vai sendo rasgada a cada erro (desenho próprio, em vetor). */
function Faixa({ erros }: { erros: number }) {
  return (
    <svg viewBox="0 0 120 60" className="h-24 w-auto" aria-hidden>
      <path d="M8 6v52M112 6v52" stroke="currentColor" strokeWidth="3" />
      {Array.from({ length: ERROS_DA_FORCA }, (_, i) => {
        const x = 12 + i * 16;
        const caiu = i < erros;
        return <rect key={i} x={x} y={caiu ? 30 : 12} width="14" height="22" fill={caiu ? "transparent" : ["#c21f16", "#f0b323", "#2e6b4f"][i % 3]} stroke="currentColor" strokeDasharray={caiu ? "3 3" : undefined} className="transition-all duration-500 motion-reduce:transition-none" transform={caiu ? `rotate(${i % 2 ? 18 : -14} ${x + 7} 41)` : undefined} />;
      })}
    </svg>
  );
}

export function PartidaForca({ v, sala, eu, anfitriao, joga, agir, s, lang, prazoEm }: PropsDaPartida<VistaForca>) {
  const f = s.partida.forca;
  const [chute, setChute] = useState("");
  const minhaVez = v.vez === eu && v.etapa === "jogando";
  const ultimaChave = v.ultima ? `${v.i}:${v.letras.length}:${v.erros}` : `${v.i}`;
  useRetorno(`${ultimaChave}:${v.etapa}`, v.etapa === "salva" ? "fim" : v.etapa === "perdida" ? "erro" : v.ultima ? (v.ultima.acertou ? "certo" : "erro") : null);
  useRetorno(`vez:${v.vez}:${v.i}`, minhaVez ? "vez" : null);
  return (
    <div className="grid gap-4">
      <Cabeca esquerda={fill(f.palavra, { i: v.i + 1, n: v.total })} direita={fill(f.salvas, { n: v.salvas })} />
      <Relogio segundos={sala.opcoes.segundos} prazoEm={v.etapa === "jogando" ? prazoEm : null} s={s} />
      <div className="flex flex-wrap items-center gap-4">
        <Faixa erros={v.erros} />
        <p className="font-mono text-sm font-bold">{fill(f.erros, { n: v.erros, max: v.maximo })}</p>
      </div>
      <p className="flex flex-wrap gap-1.5" aria-label={v.mascara.split("").join(" ").replace(/_/g, "?")}>
        {v.mascara.split("").map((l, i) => (
          <span key={`${i}:${l}`} aria-hidden className={`flex h-12 w-10 items-center justify-center border-b-4 border-ink font-mono text-2xl font-bold ${l !== "_" ? "grupo-surge bg-folha" : ""}`}>
            {l === "_" ? "" : l}
          </span>
        ))}
      </p>
      <p className="leading-relaxed">
        <span className="font-bold">{f.dica}: </span>
        {v.dica}
      </p>
      <p role="status" aria-live="polite" className={`min-h-6 font-bold ${minhaVez ? "grupo-pulsa text-prelo-texto" : ""}`}>
        {v.etapa === "salva" ? fill(f.salva, { termo: v.termo ?? "" }) : v.etapa === "perdida" ? fill(f.perdida, { termo: v.termo ?? "" }) : minhaVez ? f.suaVez : v.vez ? fill(f.vez, { apelido: apelidoDe(sala, v.vez) }) : ""}
      </p>
      {v.ultima && v.etapa === "jogando" && (
        <p className="text-sm text-ink-soft">
          {fill(f.ultima, { apelido: apelidoDe(sala, v.ultima.de), letra: v.ultima.letra })} {v.ultima.acertou ? "✓" : "✗"}
        </p>
      )}
      {joga && v.etapa === "jogando" && (
        <>
          <div role="group" aria-label={f.letras} className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]">
            {ALFABETO.map((l) => {
              const usada = v.letras.includes(l);
              return (
                <button key={l} type="button" disabled={!minhaVez || usada} onClick={() => agir({ t: "letra", letra: l })} className="h-11 cursor-pointer border-2 border-ink bg-folha font-mono text-lg font-bold disabled:cursor-default disabled:opacity-35 enabled:hover:bg-[#fbe7b0]">
                  {l}
                </button>
              );
            })}
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!chute.trim()) return;
              agir({ t: "chutar", palavra: chute });
              setChute("");
            }}
          >
            <label className="grid gap-1 text-sm font-bold">
              {f.chute}
              <input value={chute} onChange={(e) => setChute(e.target.value)} maxLength={20} disabled={!minhaVez} className="border-2 border-ink bg-white px-2 py-1.5 font-mono uppercase" autoComplete="off" />
            </label>
            <button type="submit" className="botao cursor-pointer" disabled={!minhaVez}>
              {f.chutar}
            </button>
          </form>
        </>
      )}
      {v.etapa !== "jogando" && (
        <p className="text-sm">
          <LinkDaAula aula={v.aula} lang={lang} rotulo={s.partida.aula} />
        </p>
      )}
      {anfitriao && (
        <div className="flex flex-wrap gap-2">
          {v.etapa === "jogando" && (
            <button type="button" onClick={() => agir({ t: "pular" })} className="botao cursor-pointer">
              {f.pular}
            </button>
          )}
          <BotaoDoAnfitriao onClick={() => agir({ t: "avancar" })}>{v.etapa === "jogando" ? s.partida.revelar : `${s.partida.proxima} →`}</BotaoDoAnfitriao>
        </div>
      )}
    </div>
  );
}

// ───────── Bingo de conceitos ─────────

export function PartidaBingo({ v, sala, eu, anfitriao, joga, agir, s, prazoEm }: PropsDaPartida<VistaBingo>) {
  const b = s.partida.bingo;
  const cartela = v.cartelas[eu];
  const marcadas = new Set(v.marcadas[eu] ?? []);
  const atual = v.chamadas[0];
  const ganhei = v.vencedores.includes(eu);
  useRetorno(`${v.chamadas.length}`, "vez");
  useRetorno(`v:${v.vencedores.length}`, v.vencedores.length ? (ganhei && v.vencedores.at(-1) === eu ? "fim" : "certo") : null);
  const recadoMeu = sala.recado?.para === eu ? sala.recado : null;
  useRetorno(`r:${recadoMeu?.n ?? 0}`, recadoMeu ? "erro" : null);
  return (
    <div className="grid gap-4">
      <Cabeca esquerda={fill(b.restam, { n: v.restam })} direita={v.vencedores.length ? `${b.vencedores}: ${v.vencedores.map((id) => apelidoDe(sala, id)).join(", ")}` : undefined} />
      <Relogio segundos={sala.opcoes.segundos} prazoEm={prazoEm} s={s} />
      {atual && (
        <div key={v.chamadas.length} className="grupo-surge border-2 border-ink bg-[#1f1a14] p-4 text-[#f4ecd8] shadow-[5px_5px_0_#f0b323]">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#f0b323]">{b.chamada}</p>
          <p className="mt-2 font-serif text-[1.35rem] leading-snug sm:text-[1.6rem]">{atual.definicao}</p>
        </div>
      )}
      {cartela ? (
        <section aria-label={b.cartela} className="grid gap-2">
          <p className="text-sm">{b.marque}</p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${v.lado}, minmax(0, 1fr))` }}>
            {cartela.map((i) => (
              <button key={i} type="button" aria-pressed={marcadas.has(i)} disabled={!joga} onClick={() => agir({ t: "marcar", i })} className={`flex min-h-16 cursor-pointer items-center justify-center border-2 border-ink p-1.5 text-center text-[0.85rem] font-bold leading-tight break-words sm:text-[0.95rem] ${marcadas.has(i) ? "grupo-surge bg-[#c21f16] text-[#fff8ea]" : "bg-folha hover:bg-[#fbe7b0]"}`}>
                {marcadas.has(i) && <span aria-hidden className="mr-1">★</span>}
                {v.termos[i]}
              </button>
            ))}
          </div>
          {joga && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => agir({ t: "bingo" })} disabled={ganhei} className="botao botao-prelo min-h-12 cursor-pointer px-6 text-lg">
                {b.gritar}
              </button>
              <p role="status" aria-live="polite" className="text-sm font-bold text-prelo-texto">
                {recadoMeu?.texto ?? ""}
              </p>
            </div>
          )}
        </section>
      ) : (
        <p className="text-ink-soft">{b.semCartela}</p>
      )}
      {v.chamadas.length > 1 && (
        <details className="border-2 border-ink bg-folha p-2">
          <summary className="cursor-pointer font-bold">
            {b.anteriores} ({v.chamadas.length - 1})
          </summary>
          <ol className="mt-2 grid gap-1 text-sm">
            {v.chamadas.slice(1).map((c, n) => (
              <li key={n}>
                <b>{c.termo}</b>: {c.definicao.replace(/_{3,}/g, c.termo ?? "___")}
              </li>
            ))}
          </ol>
        </details>
      )}
      {anfitriao && (
        <div>
          <BotaoDoAnfitriao onClick={() => agir({ t: "avancar" })}>{b.chamar} →</BotaoDoAnfitriao>
        </div>
      )}
    </div>
  );
}

// ───────── Fio da história ─────────

export function PartidaFio({ v, sala, eu, anfitriao, joga, agir, s, prazoEm }: PropsDaPartida<VistaFio>) {
  const f = s.partida.fio;
  const revelada = v.etapa === "revelada";
  const meu = v.votos[eu];
  const contagem = new Map<number, number>();
  for (const p of Object.values(v.votos)) contagem.set(p, (contagem.get(p) ?? 0) + 1);
  useRetorno(`${v.numero}:${v.etapa}`, revelada ? (v.ultima?.certa ? "certo" : "erro") : "vez");
  const rotuloDaPosicao = (p: number) => (p === 0 ? fill(f.antes, { ano: v.linha[0]?.ano ?? "" }) : p === v.linha.length ? fill(f.depois, { ano: v.linha.at(-1)?.ano ?? "" }) : fill(f.entre, { a: v.linha[p - 1].ano, b: v.linha[p].ano }));
  // Revelada, a linha já tem a carta nova: as vagas de voto só aparecem enquanto se vota.
  const vaga = (p: number) =>
    revelada ? null : (
      <li key={`vaga:${p}`}>
        <button type="button" disabled={!joga} aria-pressed={meu === p} onClick={() => agir({ t: "posicao", p })} aria-label={rotuloDaPosicao(p)} className={`flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-ink px-2 py-1.5 font-mono text-xs font-bold uppercase disabled:cursor-default ${meu === p ? "border-solid bg-[#fbe7b0]" : "bg-transparent hover:bg-folha"}`}>
          ↓ {f.aqui}
          {contagem.get(p) ? <span className="bg-ink px-1.5 text-parchment">{fill(f.votos, { n: contagem.get(p) ?? 0 })}</span> : null}
          {Object.entries(v.votos)
            .filter(([, x]) => x === p)
            .map(([id]) => (
              <span key={id} aria-hidden className="h-3 w-3 rounded-full border border-ink" style={{ background: corDe(sala, id) }} />
            ))}
        </button>
      </li>
    );
  return (
    <div className="grid gap-4">
      <Cabeca esquerda={fill(f.numero, { i: v.numero, n: v.total })} direita={fill(f.acertos, { n: v.acertos })} />
      <Relogio segundos={sala.opcoes.segundos} prazoEm={revelada ? null : prazoEm} s={s} />
      <div key={v.numero} className="grupo-surge border-2 border-ink bg-[#23408e] p-4 text-[#fff8ea] shadow-[5px_5px_0_#1f1a14]">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#f0b323]">{revelada ? v.atual.ano : f.carta}</p>
        <p className="mt-2 text-[1.15rem] leading-snug">{v.atual.texto}</p>
      </div>
      <p role="status" aria-live="polite" className="min-h-6 font-bold">
        {revelada && v.ultima ? fill(v.ultima.certa ? f.acertou : f.errou, { ano: v.ultima.ano }) : ""}
      </p>
      <ol className="grid gap-1.5">
        {vaga(0)}
        {v.linha.flatMap((c, i) => [
          <li key={`carta:${c.ano}`} className={`grid grid-cols-[4.5rem_1fr] items-start gap-2 border-2 border-ink bg-folha p-2 text-[0.92rem] ${revelada && v.ultima?.ano === c.ano ? "grupo-surge bg-[#dff0e4]" : ""}`}>
            <span className="font-mono text-base font-bold">{c.ano}</span>
            <span>{c.texto}</span>
          </li>,
          vaga(i + 1),
        ])}
      </ol>
      {anfitriao && <div>{revelada ? <BotaoDoAnfitriao onClick={() => agir({ t: "avancar" })}>{s.partida.proxima} →</BotaoDoAnfitriao> : <BotaoDoAnfitriao onClick={() => agir({ t: "avancar" })}>{s.partida.revelar}</BotaoDoAnfitriao>}</div>}
    </div>
  );
}
