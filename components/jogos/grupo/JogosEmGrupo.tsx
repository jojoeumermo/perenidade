// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Jogos em grupo (T23): de 2 a 12 pessoas estudando juntas, cada uma no seu aparelho. Esta é a porta (criar ou entrar
// numa sala, com apelido), o saguão (quem está, qual jogo, as opções) e o quadro do fim. As partidas em si estão em
// ./Partidas.tsx; a conexão em ./useSala.ts e ./canal.ts; as regras em lib/jogos/grupo/motor.ts.
//
// Privacidade (LGPD, art. 6º, III; ECA, art. 17): sem conta, sem cadastro, sem nome completo. O apelido existe só
// enquanto a aba está aberta; o código da sala vai no "#" do convite (o "#" não sai do navegador nem chega ao servidor).
import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDosJogos } from "@/i18n/jogos";
import { classificacao, JOGOS_EM_GRUPO, MOTOR, participantes, TEMPOS, type Acao, type EstadoDaSala, type IdDoJogoEmGrupo, type Opcoes, type VistaDaSala } from "@/lib/jogos/grupo/motor";
import { apelidoSorteado, codigoValido, CORES_DOS_JOGADORES, EQUIPES, gerarCodigo, limparApelido, MAXIMO_DE_JOGADORES, normalizarCodigo } from "@/lib/jogos/grupo/sala";
import { useImersao } from "../Imersao";
import { PartidaBingo, PartidaDebate, PartidaFio, PartidaForca, PartidaPerguntas, type PropsDaPartida } from "./Partidas";
import { ladoDoBingo, montarPacote, type BancoDoGrupo } from "./preparar";
import { useSala } from "./useSala";

type S = TextosDosJogos["grupo"];

/** O código no endereço: /jogos#sala=ABC23 (o convite). */
export function codigoDoEndereco(): string {
  if (typeof window === "undefined") return "";
  const achado = /(?:^|[#&])sala=([A-Za-z0-9-]{4,8})/.exec(window.location.hash);
  const codigo = achado ? normalizarCodigo(achado[1]) : "";
  return codigoValido(codigo) ? codigo : "";
}

export function JogosEmGrupo({ jogoInicial, banco, s: textos, lang }: { jogoInicial?: IdDoJogoEmGrupo; banco: BancoDoGrupo; s: TextosDosJogos; lang: string }) {
  const s = textos.grupo;
  const [sessao, setSessao] = useState<{ codigo: string; apelido: string; criar: boolean } | null>(null);
  const [codigo, setCodigo] = useState(codigoDoEndereco);
  const [apelido, setApelido] = useState(() => apelidoSorteado());
  const [erro, setErro] = useState("");
  const jogo = jogoInicial && JOGOS_EM_GRUPO.includes(jogoInicial) ? jogoInicial : "corrida";

  const comecar = (criar: boolean) => {
    const limpo = limparApelido(apelido);
    if (!limpo) return setErro(s.entrada.apelidoInvalido);
    const cod = criar ? gerarCodigo() : normalizarCodigo(codigo);
    if (!criar && !codigoValido(cod)) return setErro(s.entrada.codigoInvalido);
    setErro("");
    setSessao({ codigo: cod, apelido: limpo, criar });
  };

  if (sessao) {
    return (
      <Sessao
        key={`${sessao.codigo}:${sessao.criar}`}
        {...sessao}
        jogoInicial={jogo}
        banco={banco}
        s={s}
        lang={lang}
        aoSair={() => {
          setSessao(null);
          if (window.location.hash.includes("sala=")) history.replaceState(null, "", window.location.pathname + window.location.search);
        }}
        aoColidir={() => setSessao({ ...sessao, codigo: gerarCodigo() })}
      />
    );
  }

  const campo = "w-full border-2 border-ink bg-white px-3 py-2 text-lg";
  return (
    <div className="grid gap-5">
      <p className="max-w-3xl leading-relaxed">{s.lead}</p>
      <div className="grid gap-1">
        <label htmlFor="grupo-apelido" className="font-bold">
          {s.entrada.apelido}
        </label>
        <div className="flex max-w-md flex-wrap gap-2">
          <input id="grupo-apelido" value={apelido} maxLength={20} autoComplete="off" onChange={(e) => setApelido(e.target.value)} className={`${campo} flex-1`} aria-describedby="grupo-apelido-ajuda" />
          <button type="button" onClick={() => setApelido(apelidoSorteado())} className="botao cursor-pointer">
            ⟳ {s.entrada.sortear}
          </button>
        </div>
        <p id="grupo-apelido-ajuda" className="text-sm text-ink-soft">
          {s.entrada.apelidoAjuda}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="grupo-criar" className="flex flex-col gap-3 border-2 border-ink bg-folha p-4 shadow-[5px_5px_0_var(--sombra)]">
          <h2 id="grupo-criar" className="font-serif text-2xl font-semibold">
            {s.entrada.criar}
          </h2>
          <p className="text-[0.95rem] text-ink-soft">{s.entrada.criarTexto}</p>
          <p className="text-sm">
            <b>{s.jogos[jogo].nome}</b> · {s.jogos[jogo].texto}
          </p>
          <button type="button" onClick={() => comecar(true)} className="botao botao-prelo mt-auto min-h-12 cursor-pointer justify-center text-lg">
            {s.entrada.criarBotao}
          </button>
        </section>
        <section aria-labelledby="grupo-entrar" className="flex flex-col gap-3 border-2 border-ink bg-folha p-4 shadow-[5px_5px_0_var(--sombra)]">
          <h2 id="grupo-entrar" className="font-serif text-2xl font-semibold">
            {s.entrada.entrar}
          </h2>
          <p className="text-[0.95rem] text-ink-soft">{s.entrada.entrarTexto}</p>
          <form
            className="mt-auto grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              comecar(false);
            }}
          >
            <label htmlFor="grupo-codigo" className="font-bold">
              {s.entrada.codigo}
            </label>
            <input id="grupo-codigo" value={codigo} onChange={(e) => setCodigo(normalizarCodigo(e.target.value))} maxLength={7} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ABC23" className={`${campo} font-mono text-2xl tracking-[0.3em] uppercase`} />
            <button type="submit" className="botao min-h-12 cursor-pointer justify-center text-lg">
              {s.entrada.entrarBotao}
            </button>
          </form>
        </section>
      </div>
      <p role="alert" className="min-h-6 font-bold text-prelo-texto">
        {erro}
      </p>
      <p className="max-w-3xl text-sm text-ink-soft">{s.entrada.privacidade}</p>
    </div>
  );
}

function Sessao({ codigo, apelido, criar, jogoInicial, banco, s, lang, aoSair, aoColidir }: { codigo: string; apelido: string; criar: boolean; jogoInicial: IdDoJogoEmGrupo; banco: BancoDoGrupo; s: S; lang: string; aoSair: () => void; aoColidir: () => void }) {
  const sala = useSala({ codigo, apelido, criar, jogoInicial });
  const { vista, conexao } = sala;
  const { retorno } = useImersao();
  const fase = vista?.fase;
  const ultimaFase = useRef(fase);
  useEffect(() => {
    if (conexao === "colisao") aoColidir();
  }, [conexao, aoColidir]);
  useEffect(() => {
    if (fase === "fim" && ultimaFase.current !== "fim") retorno("fim");
    ultimaFase.current = fase;
  }, [fase, retorno]);

  if (conexao !== "na-sala" || !vista) {
    const textoDoErro = { "nao-achou": s.entrada.naoAchou, falhou: s.entrada.falhou, cheia: s.entrada.cheia, expulso: s.entrada.expulso } as Record<string, string>;
    const erro = textoDoErro[conexao];
    return (
      <div className="grid gap-3">
        <p role="status" aria-live="polite" className={`font-bold ${erro ? "text-prelo-texto" : "grupo-pulsa"}`}>
          {erro ?? s.entrada.conectando}
        </p>
        {sala.modo === "abas" && <p className="text-sm text-ink-soft">{s.entrada.soNesteNavegador}</p>}
        <div>
          <button type="button" onClick={aoSair} className="botao cursor-pointer">
            ← {s.entrada.voltar}
          </button>
        </div>
      </div>
    );
  }

  const anfitriao = vista.anfitriao === sala.eu;
  const joga = participantes({ ...vista, partida: null, expulsos: [] } as EstadoDaSala).some((j) => j.id === sala.eu);
  const prazoEm = vista.partida && "restante" in vista.partida && vista.partida.restante !== null ? sala.recebidaEm + vista.partida.restante : null;
  const props = { sala: vista, eu: sala.eu, anfitriao, joga, agir: sala.agir, s, lang, prazoEm };

  return (
    <div className="grid gap-5">
      <Barra vista={vista} eu={sala.eu} anfitriao={anfitriao} s={s} modo={sala.modo} agir={sala.agir} aoSair={aoSair} />
      {vista.recado && !vista.recado.para && (
        <p key={vista.recado.n} role="status" className="grupo-surge border-2 border-ink bg-[#fbe7b0] px-3 py-2 font-bold">
          {vista.recado.texto}
        </p>
      )}
      {vista.fase === "saguao" && <Saguao vista={vista} eu={sala.eu} anfitriao={anfitriao} banco={banco} s={s} agir={sala.agir} />}
      {vista.fase === "jogando" && vista.partida && <Partida {...props} v={vista.partida} />}
      {vista.fase === "fim" && <Fim vista={vista} eu={sala.eu} anfitriao={anfitriao} s={s} agir={sala.agir} />}
    </div>
  );
}

function Partida(props: PropsDaPartida<NonNullable<VistaDaSala["partida"]>>) {
  const { v } = props;
  switch (v.tipo) {
    case "perguntas":
      return <PartidaPerguntas {...props} v={v} />;
    case "debate":
      return <PartidaDebate {...props} v={v} />;
    case "forca":
      return <PartidaForca {...props} v={v} />;
    case "bingo":
      return <PartidaBingo {...props} v={v} />;
    case "fio":
      return <PartidaFio {...props} v={v} />;
  }
}

/** O alto da sala: o código grande (para ditar ou mostrar no telão), o convite, quem está e o botão de sair. */
function Barra({ vista, eu, anfitriao, s, modo, agir, aoSair }: { vista: VistaDaSala; eu: string; anfitriao: boolean; s: S; modo: "tempo-real" | "abas"; agir: (a: Acao) => void; aoSair: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const presentes = vista.jogadores.filter((j) => !j.fora);
  const convidar = async () => {
    const link = `${window.location.origin}${window.location.pathname}#sala=${vista.codigo}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt(s.sala.link, link);
    }
  };
  return (
    <div className="grid gap-3 border-2 border-ink bg-[#1f1a14] p-3 text-[#f4ecd8] sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#f0b323]">{s.sala.codigo}</p>
          <p className="font-mono text-[2.2rem] font-bold leading-none tracking-[0.25em]" aria-label={vista.codigo.split("").join(" ")}>
            {vista.codigo}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => void convidar()} className="cursor-pointer border-2 border-[#f4ecd8] px-3 py-1.5 text-sm font-bold hover:bg-[#f4ecd8] hover:text-[#1f1a14]">
            {copiado ? `✓ ${s.sala.copiado}` : s.sala.link}
          </button>
          <button type="button" onClick={aoSair} className="cursor-pointer border-2 border-[#f4ecd8] px-3 py-1.5 text-sm font-bold hover:bg-[#c21f16]">
            {s.sala.sair}
          </button>
        </div>
      </div>
      {modo === "abas" && <p className="text-xs text-[#cdbb91]">{s.sala.modoAbas}</p>}
      <div>
        <p className="mb-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#cdbb91]">{fill(s.sala.quem, { n: presentes.length, max: MAXIMO_DE_JOGADORES })}</p>
        <ul className="flex flex-wrap gap-1.5">
          {vista.jogadores.map((j) => (
            <li key={j.id} className={`flex items-center gap-1.5 border border-[#f4ecd8]/40 py-0.5 pr-1 pl-0.5 text-sm ${j.fora ? "opacity-45" : ""}`}>
              <span aria-hidden className="flex h-6 w-6 items-center justify-center text-xs font-bold text-[#fff8ea]" style={{ background: CORES_DOS_JOGADORES[j.cor] }}>
                {[...j.apelido][0]?.toUpperCase()}
              </span>
              <span className="font-bold">{j.apelido}</span>
              {j.id === eu && <span className="text-xs text-[#f0b323]">({s.sala.voce})</span>}
              {j.id === vista.anfitriao && <span className="text-xs text-[#cdbb91]">· {s.sala.anima}</span>}
              {j.fora && <span className="text-xs">· {s.sala.fora}</span>}
              {anfitriao && j.id !== eu && (
                <button type="button" onClick={() => agir({ t: "expulsar", id: j.id })} aria-label={`${s.sala.expulsar}: ${j.apelido}`} title={s.sala.expulsar} className="ml-0.5 cursor-pointer px-1 text-[#e0837a] hover:text-[#fff8ea]">
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Saguao({ vista, eu, anfitriao, banco, s, agir }: { vista: VistaDaSala; eu: string; anfitriao: boolean; banco: BancoDoGrupo; s: S; agir: (a: Acao) => void }) {
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState("");
  const o = vista.opcoes;
  const jogo = vista.jogo;
  const escolher = (jogoNovo: IdDoJogoEmGrupo, opcoes: Partial<Opcoes> = {}) => agir({ t: "escolher", jogo: jogoNovo, opcoes });
  const comEquipes = jogo === "mutirao";
  const minhaEquipe = vista.jogadores.find((j) => j.id === eu)?.equipe ?? 0;
  const pedeFonte = jogo === "corrida" || jogo === "mutirao";
  const semRodadas = jogo === "assembleia";

  const comecar = async () => {
    setPreparando(true);
    setErro("");
    try {
      const pacote = await montarPacote(jogo, o, banco);
      const vazio = !pacote || (pacote.tipo === "perguntas" && pacote.perguntas.length === 0) || (pacote.tipo === "forca" && pacote.palavras.length === 0) || (pacote.tipo === "fio" && pacote.cartas.length < 3) || (pacote.tipo === "bingo" && pacote.conceitos.length < pacote.lado * pacote.lado + 2);
      if (vazio || MOTOR[jogo] !== pacote.tipo) setErro(s.sala.semConteudo);
      else agir({ t: "comecar", pacote });
    } catch {
      setErro(s.sala.semConteudo);
    } finally {
      setPreparando(false);
    }
  };

  const grupoDeBotoes = <T extends string | number | boolean>(nome: string, valor: T, opcoes: [T, string][], aoEscolher: (v: T) => void) => (
    <div role="group" aria-label={nome} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{nome}</span>
      {opcoes.map(([v, rotulo]) => (
        <button key={String(v)} type="button" aria-pressed={valor === v} onClick={() => aoEscolher(v)} disabled={!anfitriao} className="aba-pasta cursor-pointer disabled:cursor-default">
          {rotulo}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid gap-5">
      <section aria-labelledby="grupo-escolha" className="grid gap-3">
        <h2 id="grupo-escolha" className="font-serif text-2xl font-semibold">
          {s.sala.escolherJogo}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {JOGOS_EM_GRUPO.map((id) => (
            <li key={id}>
              <button type="button" aria-pressed={jogo === id} disabled={!anfitriao} onClick={() => escolher(id)} className={`flex h-full w-full cursor-pointer flex-col items-start gap-1 border-2 border-ink p-3 text-left disabled:cursor-default ${jogo === id ? "bg-ink text-parchment shadow-[4px_4px_0_var(--prelo)]" : "bg-folha enabled:hover:-translate-y-0.5 motion-reduce:enabled:hover:translate-y-0"} ${!anfitriao && jogo !== id ? "opacity-55" : ""}`}>
                <span className="font-serif text-lg font-semibold leading-tight">{s.jogos[id].nome}</span>
                <span className={`text-[0.85rem] leading-snug ${jogo === id ? "text-[#e9dcbc]" : "text-ink-soft"}`}>{s.jogos[id].texto}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 border-2 border-ink bg-folha p-4">
        {pedeFonte && (
          <label className="grid max-w-md gap-1 text-sm font-bold">
            {s.sala.fonte}
            <select value={o.fonte} disabled={!anfitriao} onChange={(e) => escolher(jogo, { fonte: e.target.value })} className="border-2 border-ink bg-white px-2 py-1.5 font-normal">
              <option value="glossario">{s.sala.glossario}</option>
              {banco.disciplinas.map((d) => (
                <option key={d.area} value={d.area}>
                  {d.nome} ({d.n})
                </option>
              ))}
            </select>
          </label>
        )}
        {!semRodadas &&
          grupoDeBotoes(
            s.sala.rodadas,
            o.rodadas,
            (jogo === "bingo" ? [6, 12] : [5, 8, 12, 20]).map((n) => [n, jogo === "bingo" ? `${ladoDoBingo(n)}×${ladoDoBingo(n)}` : String(n)] as [number, string]),
            (n) => escolher(jogo, { rodadas: n }),
          )}
        {jogo !== "assembleia" &&
          grupoDeBotoes(
            s.sala.tempo,
            o.segundos,
            TEMPOS.map((n) => [n, n === 0 ? s.sala.semTempo : fill(s.sala.segundos, { n })] as [number, string]),
            (n) => escolher(jogo, { segundos: n }),
          )}
        {comEquipes &&
          grupoDeBotoes(
            s.sala.equipes,
            o.equipes,
            [2, 3, 4].map((n) => [n, String(n)] as [number, string]),
            (n) => escolher(jogo, { equipes: n }),
          )}
        {grupoDeBotoes(
          s.sala.anfitriaoJoga,
          o.anfitriaoJoga,
          [
            [true, "✓"],
            [false, "✗"],
          ],
          (b) => escolher(jogo, { anfitriaoJoga: b }),
        )}
        <p className="text-xs text-ink-soft">{s.sala.pontosDaPartida}</p>
      </section>

      {comEquipes && (
        <section className="grid gap-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-[0.12em]">{s.sala.equipes}</h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {EQUIPES.slice(0, o.equipes).map((eq, n) => (
              <li key={eq.nome} className="border-2 border-ink bg-folha">
                <p className="px-2 py-1 font-bold text-[#fff8ea]" style={{ background: eq.cor }}>
                  {eq.nome}
                </p>
                <ul className="min-h-10 p-2 text-sm">
                  {vista.jogadores
                    .filter((j) => !j.fora && j.equipe === n)
                    .map((j) => (
                      <li key={j.id}>
                        {j.apelido}
                        {j.id === eu ? ` (${s.sala.voce})` : ""}
                      </li>
                    ))}
                </ul>
                {minhaEquipe !== n && (
                  <button type="button" onClick={() => agir({ t: "equipe", n })} className="m-2 mt-0 cursor-pointer text-sm underline">
                    {fill(s.sala.irPara, { equipe: eq.nome })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {anfitriao ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void comecar()} disabled={preparando} className="botao botao-prelo min-h-14 cursor-pointer px-8 text-lg">
            {preparando ? s.sala.preparando : `▶ ${s.sala.comecar}`}
          </button>
          {vista.jogadores.filter((j) => !j.fora).length < 2 && <p className="text-sm text-ink-soft">{s.sala.poucos}</p>}
          <p role="alert" className="font-bold text-prelo-texto">
            {erro}
          </p>
        </div>
      ) : (
        <p role="status" className="grupo-pulsa font-bold">
          {s.sala.esperando}
        </p>
      )}
    </div>
  );
}

function Fim({ vista, eu, anfitriao, s, agir }: { vista: VistaDaSala; eu: string; anfitriao: boolean; s: S; agir: (a: Acao) => void }) {
  const doGrupo = MOTOR[vista.jogo] === "forca" || MOTOR[vista.jogo] === "fio";
  const equipes = vista.jogo === "mutirao";
  const lista = classificacao(vista, equipes ? "equipes" : "jogadores").filter((x) => equipes || vista.jogadores.some((j) => j.id === x.chave && (j.id !== vista.anfitriao || vista.opcoes.anfitriaoJoga)));
  const maior = Math.max(1, ...lista.map((x) => x.pontos));
  const nome = (chave: string) => (chave.startsWith("equipe:") ? (EQUIPES[Number(chave.slice(7))]?.nome ?? chave) : (vista.jogadores.find((j) => j.id === chave)?.apelido ?? "?"));
  const cor = (chave: string) => (chave.startsWith("equipe:") ? (EQUIPES[Number(chave.slice(7))]?.cor ?? "#1f1a14") : CORES_DOS_JOGADORES[vista.jogadores.find((j) => j.id === chave)?.cor ?? 0]);
  return (
    <section aria-labelledby="grupo-fim" className="grid gap-4 border-2 border-ink bg-folha p-4 shadow-[6px_6px_0_#f0b323] sm:p-6">
      <h2 id="grupo-fim" tabIndex={-1} className="font-serif text-3xl font-semibold">
        ★ {s.fim.titulo}
      </h2>
      {doGrupo && <p className="text-lg font-bold">{fill(s.fim.grupo, { n: vista.pontos.grupo ?? 0 })}</p>}
      {!doGrupo && vista.jogo !== "assembleia" && lista.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{s.fim.placar}</p>
          <ol className="grid gap-1.5">
            {lista.map((x, i) => (
              <li key={x.chave} className={`grupo-surge grid grid-cols-[2rem_9rem_1fr_3rem] items-center gap-2 ${x.chave === eu ? "font-bold" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>
                <span className="font-mono">{i + 1}º</span>
                <span className="truncate">{nome(x.chave)}</span>
                <span className="h-4 border border-ink bg-parchment-deep">
                  <span className="block h-full" style={{ width: `${(x.pontos / maior) * 100}%`, background: cor(x.chave) }} />
                </span>
                <span className="font-mono tabular-nums">{fill(s.partida.pontos, { n: x.pontos })}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-xs text-ink-soft">{s.sala.pontosDaPartida}</p>
      {anfitriao ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="botao botao-prelo cursor-pointer"
            onClick={() => {
              agir({ t: "escolher", jogo: vista.jogo });
            }}
          >
            ⟳ {s.fim.jogarDeNovo}
          </button>
          <button type="button" className="botao cursor-pointer" onClick={() => agir({ t: "encerrar" })}>
            {s.fim.outroJogo}
          </button>
        </div>
      ) : (
        <p className="text-ink-soft">{s.fim.esperando}</p>
      )}
    </section>
  );
}
