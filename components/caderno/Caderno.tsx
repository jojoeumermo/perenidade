// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import synonyms from "@/content/busca.json";
import { fill, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { type Caderno, type Cartao, cartoesDe, type Fonte, guardarCadernos, lerCadernos, limpar, linhaDoTempo, mapaDe, minutosDe, novoId, palavrasChave, procurar, type Questao, questoesDe, type Ramo, resumir, roteiroDeAudio } from "@/lib/caderno";
import { guardarCartoes, registrarErro } from "@/lib/estudo";
import { buildSearch, type SearchEntry, type SearchHit } from "@/lib/search";
import { L, useI18n } from "../I18n";
import { Star } from "../Masthead";
import { CopiaDeSeguranca, Erros, Ler, Revisao } from "./Estudo";
import { CadernosProntos, enderecoDoSite, montarCaderno, PublicarCadernoPronto, type ReferenciaDoSite } from "./Prontos";

export type NotebookStrings = Dict["notebook"];
type Ferramenta = "resumo" | "ler" | "perguntar" | "cartoes" | "revisao" | "questionario" | "erros" | "mapa" | "tempo" | "audio" | "notas" | "plano" | "roteiro";
const SEM_FONTE: Ferramenta[] = ["notas", "plano", "revisao", "erros"];

const botao = "cursor-pointer border-2 border-ink bg-ink px-4 py-2 font-sans text-sm font-bold uppercase tracking-wide text-parchment hover:border-oxblood hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink bg-parchment px-3 py-1.5 font-sans text-sm font-bold uppercase tracking-wide hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const elo = "cursor-pointer underline decoration-1 underline-offset-2 hover:text-oxblood";
const campo = "w-full border-2 border-ink bg-parchment px-3 py-2 font-sans text-sm";
const etiqueta = "font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-soft";
/** Cores das lombadas na estante, em rodízio. */
const LOMBADAS = ["#c21f16", "#c9a227", "#3d6fb0", "#8a5f1c", "#4f8a3c"];

const novoCaderno = (titulo: string): Caderno => ({ id: novoId(), titulo, fontes: [], notas: "", criado: Date.now(), atualizado: Date.now() });

/** Ícones das ferramentas, no traço das placas: linhas grossas, sem enfeite. */
function Icone({ nome }: { nome: Ferramenta | "site" | "colar" | "arquivo" }) {
  const p: Record<string, React.ReactNode> = {
    resumo: <path d="M4 6h16M4 11h16M4 16h10" />,
    ler: <path d="M3 5.5C6 4 9 4 12 6c3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5zM12 6v13.5" />,
    perguntar: <path d="M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.2-1.5 2.4M12 18v.01" />,
    cartoes: <path d="M4 8h12v11H4zM8 5h12v11" />,
    revisao: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />,
    questionario: <path d="M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M4 19h16" />,
    erros: <path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9 9l6 6M15 9l-6 6" />,
    mapa: <path d="M12 12m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M5 5l5 5M19 5l-5 5M5 19l5-5M19 19l-5-5" />,
    tempo: <path d="M3 12h18M7 9v6M12 7v10M17 9v6" />,
    audio: <path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />,
    notas: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
    plano: <path d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 8v4l3 2" />,
    roteiro: <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4" />,
    site: <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16 16l5 5" />,
    colar: <path d="M8 4h8v3H8zM6 6H4v15h16V6h-2M8 12h8M8 16h5" />,
    arquivo: <path d="M6 3h8l4 4v14H6zM14 3v4h4" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter" className="shrink-0">
      {p[nome]}
    </svg>
  );
}

/** A abertura de cada ferramenta: a faixa preta com o nome em letra pesada e a cunha vermelha com a estrela. */
function Faixa({ titulo, lead }: { titulo: string; lead?: string }) {
  return (
    <header className="mb-5">
      <div className="jornal-preto jornal-cartaz jornal-cartaz-menor">
        <h2 className="jornal-cartaz-nome font-sans font-black uppercase italic">
          <span className="jornal-cartaz-baixo">{titulo}</span>
        </h2>
        <span className="jornal-cunha jornal-cunha-vermelha" aria-hidden>
          <Star className="jornal-cunha-estrela" />
        </span>
      </div>
      {lead && <p className="mt-3 max-w-3xl font-serif text-lg italic leading-snug text-ink-soft">{lead}</p>}
    </header>
  );
}

/**
 * O caderno de estudos: uma sala para estudar com tudo à mão. A pessoa junta fontes (aulas e obras do site, texto colado,
 * arquivos) e o caderno extrai delas resumo, palavras-chave, cartões de memória, questionário, mapa mental, linha do tempo
 * e um resumo em áudio a duas vozes; ao lado, as notas, o plano de estudo e o dicionário. Tudo roda no navegador e fica
 * guardado só nele: sem conta, sem serviço de fora, sem modelo de linguagem (o caderno é estatística de texto, e diz isso).
 *
 * O desenho é o do jornal do instituto: a capa do caderno é uma faixa preta com a cunha vermelha, os cadernos ficam na
 * estante como lombadas, as fontes são recortes, e cada ferramenta abre com a sua faixa.
 */
export function CadernoDeEstudos({ s, modo = "site" }: { s: NotebookStrings; modo?: "site" | "painel" | "podcast" }) {
  const { lang } = useI18n();
  // Os cadernos moram no navegador: só são lidos depois de a tela montar (o servidor não os conhece).
  const [cadernos, setCadernos] = useState<Caderno[] | null>(null);
  const [atualId, setAtualId] = useState<string>("");
  const [ferramenta, setFerramenta] = useState<Ferramenta>("resumo");
  const [aba, setAba] = useState<"site" | "colar" | "arquivo" | null>(null);
  const [montando, setMontando] = useState(false);
  const fontesRef = useRef<HTMLElement>(null);

  /** Um caderno novo já com as páginas do site (uma aula, a trilha inteira, um caderno pronto). */
  async function abrirComFontes(titulo: string, refs: ReferenciaDoSite[]) {
    setMontando(true);
    const novo = await montarCaderno(lang, titulo, refs, novoId);
    setCadernos((lista) => {
      const nova = [novo, ...(lista ?? []).filter((c) => c.fontes.length || c.notas.trim())];
      guardarCadernos(nova);
      return nova;
    });
    setAtualId(novo.id);
    setFerramenta("resumo");
    setMontando(false);
  }

  useEffect(() => {
    const relogio = window.setTimeout(() => {
      const lista = lerCadernos();
      const pronta = lista.length ? lista : [novoCaderno(s.untitled)];
      setCadernos(pronta);
      setAtualId(pronta[0].id);
      // Endereço com ?ferramenta=erros (vindo do simulado) ou ?ferramenta=revisao abre direto nela.
      const busca = new URLSearchParams(window.location.search);
      const pedida = busca.get("ferramenta");
      if (pedida === "erros" || pedida === "revisao" || pedida === "ler") setFerramenta(pedida);
      // ?abrir=/trilhas/x/a,/trilhas/x/b&titulo=… (de "Estudar esta aula no caderno" ou "Estudar a trilha no caderno").
      const abrir = (busca.get("abrir") ?? "").split(",").filter((origem) => enderecoDoSite.test(origem)).slice(0, 30);
      if (abrir.length) {
        void abrirComFontes((busca.get("titulo") ?? s.untitled).slice(0, 80), abrir.map((origem) => ({ titulo: "", origem })));
        window.history.replaceState(null, "", window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(relogio);
    // Roda uma vez ao abrir a página: o endereço só é lido nesse momento (e depois é limpo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.untitled]);

  const atual = cadernos?.find((c) => c.id === atualId) ?? cadernos?.[0] ?? null;
  const mudar = (mudanca: Partial<Caderno>) => {
    if (!atual) return;
    setCadernos((lista) => {
      const nova = (lista ?? []).map((c) => (c.id === atual.id ? { ...c, ...mudanca, atualizado: Date.now() } : c));
      guardarCadernos(nova);
      return nova;
    });
  };
  const ativas = useMemo(() => (atual?.fontes ?? []).filter((f) => f.ativa), [atual]);
  const mudarFonte = (id: string, m: Partial<Fonte>) => {
    if (atual) mudar({ fontes: atual.fontes.map((f) => (f.id === id ? { ...f, ...m } : f)) });
  };

  if (!cadernos || !atual) return <p className="mt-8 font-mono text-xs text-ink-soft">…</p>;

  const nomes: Record<Ferramenta, string> = {
    resumo: s.tools.summary,
    ler: s.tools.read,
    perguntar: s.tools.ask,
    cartoes: s.tools.cards,
    revisao: s.tools.review,
    questionario: s.tools.quiz,
    erros: s.tools.mistakes,
    mapa: s.tools.map,
    tempo: s.tools.timeline,
    audio: s.tools.audio,
    notas: s.tools.notes,
    plano: s.tools.plan,
    roteiro: s.tools.script,
  };
  const gavetas: [string, Ferramenta[]][] = [
    [s.groupUnderstand, ["resumo", "ler", "perguntar", "mapa", "tempo", "audio"]],
    [s.groupPractice, ["cartoes", "revisao", "questionario", "erros"]],
    [s.groupOrganize, ["notas", "plano", ...(modo === "podcast" ? (["roteiro"] as Ferramenta[]) : [])]],
  ];
  const novo = () => {
    const caderno = novoCaderno(s.untitled);
    const lista = [caderno, ...cadernos];
    guardarCadernos(lista);
    setCadernos(lista);
    setAtualId(caderno.id);
  };
  const minutos = atual.fontes.reduce((t, f) => t + minutosDe(f.texto), 0);
  const posicao = cadernos.findIndex((c) => c.id === atual.id) + 1;
  const acrescentarPor = (id: "site" | "colar" | "arquivo") => {
    setAba(id);
    fontesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  function acrescentar(fonte: Omit<Fonte, "id" | "ativa">) {
    mudar({ fontes: [...atual!.fontes, { ...fonte, id: novoId(), ativa: true }] });
    setAba(null);
  }
  const paraNotas = (t: string) => mudar({ notas: `${atual.notas}${atual.notas ? "\n\n" : ""}${t}` });

  return (
    <div className="mt-10 space-y-8 font-sans text-sm">
      {/* A estante: cada caderno é uma lombada. */}
      <nav aria-label={s.shelf}>
        <p className={etiqueta}>{s.shelf}</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {cadernos.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === atual.id}
              onClick={() => setAtualId(c.id)}
              className="caderno-lombada w-44 shrink-0 cursor-pointer px-3 py-2 text-left hover:-translate-y-0.5 motion-safe:transition-transform"
              style={{ borderLeftColor: LOMBADAS[i % LOMBADAS.length] }}
            >
              <span className="block truncate font-serif text-base font-semibold" title={c.titulo}>{c.titulo}</span>
              <span className="block font-mono text-[0.65rem] uppercase tracking-wider opacity-75">{fill(s.sourcesCount, { n: c.fontes.length })}</span>
            </button>
          ))}
          <button type="button" onClick={novo} className="w-40 shrink-0 cursor-pointer border-2 border-dashed border-ink px-3 py-2 text-left font-bold uppercase tracking-wide hover:border-oxblood hover:text-oxblood">
            + {s.newNotebook}
          </button>
        </div>
      </nav>

      {/* A capa do caderno aberto. */}
      <section aria-label={s.rename}>
        <div className="jornal-preto jornal-cartaz">
          <div className="relative z-10 py-[2.6cqw] pr-[24cqw] pl-[3.6cqw]">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-[#f4ecd8]/70">{fill(s.notebookNo, { n: posicao, total: cadernos.length })}</p>
            <input
              value={atual.titulo}
              onChange={(e) => mudar({ titulo: e.target.value })}
              maxLength={80}
              aria-label={s.rename}
              className="mt-1 w-full bg-transparent font-sans text-[clamp(1.5rem,7cqw,3.4rem)] leading-[1.02] font-black uppercase italic text-[#f4ecd8] outline-none placeholder:text-[#f4ecd8]/50 focus:underline focus:decoration-[#c21f16] focus:decoration-4 focus:underline-offset-8"
            />
          </div>
          <span className="jornal-cunha jornal-cunha-vermelha" aria-hidden>
            <Star className="jornal-cunha-estrela" />
          </span>
        </div>
        <div className="jornal-fio" />
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.7rem] uppercase tracking-wider text-ink-soft">
          <span>{fill(s.sourcesInUse, { a: ativas.length, b: atual.fontes.length })}</span>
          <span>{fill(s.minutes, { n: minutos })}</span>
          <span>{fill(s.updatedOn, { d: new Date(atual.atualizado).toLocaleDateString(lang === "zh" ? "zh-CN" : lang) })}</span>
          <button
            type="button"
            className={`${elo} ml-auto normal-case tracking-normal`}
            onClick={() => {
              if (!window.confirm(s.confirmDelete)) return;
              const lista = cadernos.filter((c) => c.id !== atual.id);
              const pronta = lista.length ? lista : [novoCaderno(s.untitled)];
              guardarCadernos(pronta);
              setCadernos(pronta);
              setAtualId(pronta[0].id);
            }}
          >
            {s.delete}
          </button>
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* Esquerda: a pasta de recortes (as fontes). */}
        <aside ref={fontesRef} className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label={s.sources}>
          <h2 className="jornal-secao font-sans text-xs font-black uppercase tracking-[0.18em]">
            <span className="jornal-editoria">{s.sources}</span>
            <span className="font-mono font-normal text-ink-soft">{atual.fontes.length}</span>
          </h2>
          {atual.fontes.length === 0 && <p className="font-serif text-base italic text-ink-soft">{s.empty}</p>}
          <ul className="space-y-3">
            {atual.fontes.map((f) => (
              <li key={f.id} className="caderno-recorte p-3" data-ativa={f.ativa ? "true" : "false"}>
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="jornal-editoria !text-[0.6rem]">{f.tipo === "aula" ? s.typeLesson : f.tipo === "site" ? s.typeSite : f.tipo === "arquivo" ? s.typeFile : s.typeText}</span>
                    <span className="mt-1.5 block font-serif text-base leading-snug font-semibold" title={f.titulo}>{f.titulo}</span>
                  </span>
                  <label className="mt-0.5 flex cursor-pointer items-center" title={s.active}>
                    <input type="checkbox" checked={f.ativa} onChange={(e) => mudarFonte(f.id, { ativa: e.target.checked })} aria-label={`${s.active}: ${f.titulo}`} className="h-5 w-5 cursor-pointer accent-[#c21f16]" />
                  </label>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.68rem] uppercase tracking-wider opacity-80">
                  <span>{fill(s.minutes, { n: minutosDe(f.texto) })}</span>
                  {f.origem.startsWith("/") && <L href={f.origem} className={elo}>{s.openSource} ↗</L>}
                  <button type="button" className={elo} onClick={() => mudar({ fontes: atual.fontes.filter((x) => x.id !== f.id) })}>{s.remove}</button>
                </p>
              </li>
            ))}
          </ul>
          <div className="caderno-bloco p-3">
            <p className={etiqueta}>{s.addSource}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(["site", "colar", "arquivo"] as const).map((id) => (
                <button key={id} type="button" onClick={() => setAba(aba === id ? null : id)} aria-pressed={aba === id} className="caderno-ferramenta flex cursor-pointer flex-col items-center gap-1 border-2 border-ink bg-parchment px-1 py-2 text-xs font-bold hover:border-oxblood">
                  <Icone nome={id} />
                  {id === "site" ? s.fromSite : id === "colar" ? s.paste : s.file}
                </button>
              ))}
            </div>
            {aba === "site" && <DoSite s={s} lang={lang} acrescentar={acrescentar} />}
            {aba === "colar" && <Colar s={s} acrescentar={acrescentar} />}
            {aba === "arquivo" && <Arquivo s={s} acrescentar={acrescentar} />}
            {montando && <p role="status" className="mt-2 text-xs text-ink-soft">{s.building}</p>}
          </div>
        </aside>

        {/* Centro: as gavetas de ferramentas e a ferramenta aberta. */}
        <section className="min-w-0">
          {atual.fontes.length === 0 && <ComeceAqui s={s} acrescentarPor={acrescentarPor} />}
          <nav aria-label={s.toolsLabel} className="grid gap-4 sm:grid-cols-[1.4fr_1fr_0.8fr]">
            {gavetas.map(([gaveta, itens]) => (
              <div key={gaveta}>
                <p className={`${etiqueta} border-b-2 border-ink pb-1`}>{gaveta}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {itens.map((id) => (
                    <button key={id} type="button" aria-pressed={ferramenta === id} onClick={() => setFerramenta(id)} className="caderno-ferramenta inline-flex cursor-pointer items-center gap-1.5 border-2 border-ink/25 bg-parchment px-2.5 py-1.5 text-sm font-semibold hover:border-ink">
                      <Icone nome={id} />
                      {nomes[id]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-8">
            {ativas.length === 0 && !SEM_FONTE.includes(ferramenta) ? (
              <>
                <Faixa titulo={nomes[ferramenta]} />
                <p className="caderno-folha px-5 py-10 text-center font-serif text-lg italic">{s.needSources}</p>
              </>
            ) : (
              <>
                {ferramenta === "resumo" && <Resumo s={s} fontes={ativas} paraNotas={paraNotas} />}
                {ferramenta === "ler" && (
                  <>
                    <Faixa titulo={nomes.ler} />
                    <Ler key={atual.id} s={s} fontes={ativas} mudarFonte={mudarFonte} paraNotas={paraNotas} />
                  </>
                )}
                {ferramenta === "revisao" && (
                  <>
                    <Faixa titulo={nomes.revisao} />
                    <Revisao s={s} />
                  </>
                )}
                {ferramenta === "erros" && (
                  <>
                    <Faixa titulo={nomes.erros} />
                    <Erros s={s} />
                  </>
                )}
                {ferramenta === "perguntar" && <Perguntar s={s} fontes={ativas} paraNotas={paraNotas} />}
                {ferramenta === "cartoes" && <Cartoes key={ativas.map((f) => f.id).join()} s={s} fontes={ativas} />}
                {ferramenta === "questionario" && <Questionario key={ativas.map((f) => f.id).join()} s={s} fontes={ativas} />}
                {ferramenta === "mapa" && <Mapa s={s} fontes={ativas} />}
                {ferramenta === "tempo" && <Tempo s={s} fontes={ativas} />}
                {ferramenta === "audio" && <Audio s={s} titulo={atual.titulo} fontes={ativas} lang={lang} />}
                {ferramenta === "notas" && <Notas s={s} caderno={atual} mudar={mudar} />}
                {ferramenta === "plano" && <Plano s={s} fontes={ativas} />}
                {ferramenta === "roteiro" && <Roteiro s={s} titulo={atual.titulo} fontes={ativas} />}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Rodapé do caderno: os cadernos prontos da equipe, a cópia de segurança e o aviso honesto. */}
      <footer className="grid gap-6 border-t-[7px] border-double border-ink pt-8 md:grid-cols-2">
        <CadernosProntos s={s} usar={(titulo, fontes) => void abrirComFontes(titulo, fontes)} />
        <div className="space-y-4">
          {modo !== "site" && <PublicarCadernoPronto caderno={atual} />}
          <CopiaDeSeguranca s={s} />
          <p className="border-l-4 border-[#c21f16] pl-3 font-serif text-base italic leading-snug text-ink-soft">{s.honest}</p>
          <p className="text-xs text-ink-soft">
            {s.allFree} <L href="/ferramentas/dicionario" className={elo}>{s.dictionary}</L> · <L href="/ferramentas" className={elo}>{s.moreTools}</L>
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Para quem abre o caderno pela primeira vez: três passos, com o primeiro já a um clique. */
function ComeceAqui({ s, acrescentarPor }: { s: NotebookStrings; acrescentarPor: (id: "site" | "colar" | "arquivo") => void }) {
  return (
    <div className="caderno-bloco mb-8 p-5">
      <h2 className="jornal-secao font-sans text-sm font-black uppercase tracking-[0.18em]">
        <span className="jornal-editoria">{s.startHere}</span>
      </h2>
      <ol className="mt-4 grid gap-5 md:grid-cols-3">
        {[s.step1, s.step2, s.step3].map((passo, i) => (
          <li key={i} className="flex gap-3">
            <span className="caderno-numero font-sans text-5xl" aria-hidden>{i + 1}</span>
            <span className="pt-1 font-serif text-lg leading-snug">{passo}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={botao} onClick={() => acrescentarPor("site")}><span className="inline-flex items-center gap-2"><Icone nome="site" />{s.fromSite}</span></button>
        <button type="button" className={claro} onClick={() => acrescentarPor("colar")}><span className="inline-flex items-center gap-2"><Icone nome="colar" />{s.paste}</span></button>
        <button type="button" className={claro} onClick={() => acrescentarPor("arquivo")}><span className="inline-flex items-center gap-2"><Icone nome="arquivo" />{s.file}</span></button>
      </p>
    </div>
  );
}

function DoSite({ s, lang, acrescentar }: { s: NotebookStrings; lang: string; acrescentar: (f: Omit<Fonte, "id" | "ativa">) => void }) {
  const [indice, setIndice] = useState<SearchEntry[] | null>(null);
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState("");
  useEffect(() => {
    let cancelado = false;
    fetch(localePath(lang, "/indice.json"))
      .then((r) => (r.ok ? (r.json() as Promise<SearchEntry[]>) : []))
      .then((dados) => {
        if (!cancelado) setIndice(dados);
      })
      .catch(() => {
        if (!cancelado) setIndice([]);
      });
    return () => {
      cancelado = true;
    };
  }, [lang]);
  const procurarNoSite = useMemo(() => (indice ? buildSearch(indice, synonyms) : null), [indice]);
  const achados: SearchHit[] = procurarNoSite && busca.trim().length >= 2 ? procurarNoSite(busca, 12) : [];

  async function pegar(entrada: SearchEntry) {
    setOcupado(entrada.href);
    let texto = entrada.text;
    if (entrada.kind === "aula") {
      try {
        const r = await fetch(`${localePath(lang, entrada.href)}/texto`);
        if (r.ok) texto = (await r.text()).split("\n").slice(2).join("\n").replace(/\n---\n[^\n]*\n?$/, "");
      } catch {
        // fica com o texto do índice
      }
    }
    acrescentar({ titulo: entrada.title, tipo: entrada.kind === "aula" ? "aula" : "site", texto, origem: entrada.href });
    setOcupado("");
  }

  return (
    <div className="mt-3">
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={s.searchPlaceholder} aria-label={s.searchSite} autoFocus className={campo} />
      {indice === null && <p className="mt-1 text-xs text-ink-soft">…</p>}
      {busca.trim().length >= 2 && achados.length === 0 && indice && <p className="mt-1 text-xs text-ink-soft">{s.noResults}</p>}
      <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto [scrollbar-width:thin]">
        {achados.map(({ entry }) => (
          <li key={entry.href}>
            <button type="button" disabled={Boolean(ocupado)} onClick={() => void pegar(entry)} className="w-full cursor-pointer border-2 border-ink/20 bg-parchment px-2 py-1.5 text-left text-xs hover:border-ink disabled:opacity-50">
              <span className="block truncate font-serif text-sm font-semibold">+ {entry.title}</span>
              <span className="block truncate text-ink-soft">{entry.context || entry.area}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Colar({ s, acrescentar }: { s: NotebookStrings; acrescentar: (f: Omit<Fonte, "id" | "ativa">) => void }) {
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={s.pasteTitle} maxLength={120} className={campo} />
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={s.pasteText} rows={6} maxLength={200000} className={`${campo} font-serif text-base`} />
      <button type="button" className={botao} disabled={texto.trim().length < 40} onClick={() => { acrescentar({ titulo: titulo.trim() || texto.trim().slice(0, 40), tipo: "texto", texto, origem: "" }); setTitulo(""); setTexto(""); }}>{s.pasteAdd}</button>
    </div>
  );
}

function Arquivo({ s, acrescentar }: { s: NotebookStrings; acrescentar: (f: Omit<Fonte, "id" | "ativa">) => void }) {
  return (
    <div className="mt-3">
      <input
        type="file"
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        className="block w-full text-xs file:mr-3 file:cursor-pointer file:border-2 file:border-ink file:bg-ink file:px-3 file:py-1.5 file:font-bold file:text-parchment"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const texto = (await f.text()).slice(0, 400_000);
          acrescentar({ titulo: f.name.replace(/\.(txt|md|markdown)$/i, ""), tipo: "arquivo", texto, origem: "" });
          e.target.value = "";
        }}
      />
      <p className="mt-1 text-xs text-ink-soft">{s.fileHint}</p>
    </div>
  );
}

function Resumo({ s, fontes, paraNotas }: { s: NotebookStrings; fontes: Fonte[]; paraNotas: (t: string) => void }) {
  const [tamanho, setTamanho] = useState(6);
  const todo = fontes.map((f) => f.texto).join("\n\n");
  const pontos = useMemo(() => resumir(todo, tamanho), [todo, tamanho]);
  const chaves = useMemo(() => palavrasChave(todo, 14), [todo]);
  return (
    <div>
      <Faixa titulo={s.tools.summary} lead={s.summaryLead} />
      <label className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider">
        {s.summaryLength}
        <input type="range" min={3} max={15} value={tamanho} onChange={(e) => setTamanho(Number(e.target.value))} className="accent-[#c21f16]" />
        <span className="font-bold">{tamanho}</span>
      </label>
      <ol className="caderno-folha mt-4 divide-y divide-rule px-5 py-2">
        {pontos.map((p, i) => (
          <li key={i} className="flex gap-4 py-4">
            <span className="caderno-numero w-10 shrink-0 text-right font-sans text-4xl" aria-hidden>{i + 1}</span>
            <span className="font-serif text-lg leading-snug">{p}</span>
          </li>
        ))}
      </ol>
      <h3 className="jornal-secao mt-8 font-sans text-xs font-black uppercase tracking-[0.18em]">
        <span className="jornal-editoria">{s.keywords}</span>
      </h3>
      <p className="mt-4 flex flex-wrap gap-3">
        {chaves.map((c, i) => (
          <span key={c.palavra} className="jornal-carimbo !text-sm" style={{ transform: `rotate(${i % 2 ? 1.5 : -2}deg)` }}>
            {c.palavra} <span className="font-mono text-xs not-italic opacity-70">{c.vezes}</span>
          </span>
        ))}
      </p>
      <p className="mt-6">
        <button type="button" className={claro} onClick={() => paraNotas(`## ${s.tools.summary}\n\n${pontos.map((p) => `- ${p}`).join("\n")}`)}>{s.copyToNotes}</button>
      </p>
    </div>
  );
}

function Perguntar({ s, fontes, paraNotas }: { s: NotebookStrings; fontes: Fonte[]; paraNotas: (t: string) => void }) {
  const [pergunta, setPergunta] = useState("");
  const [feita, setFeita] = useState("");
  const trechos = useMemo(() => (feita ? procurar(fontes, feita) : []), [fontes, feita]);
  return (
    <div>
      <Faixa titulo={s.tools.ask} lead={s.askLead} />
      <form className="flex border-2 border-ink" onSubmit={(e) => { e.preventDefault(); setFeita(pergunta); }}>
        <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder={s.askPlaceholder} aria-label={s.tools.ask} className="min-w-0 flex-1 bg-parchment px-4 py-3 font-serif text-lg outline-none" />
        <button type="submit" className="cursor-pointer bg-[#c21f16] px-5 font-sans font-black uppercase italic text-white hover:bg-[#a51810] disabled:cursor-not-allowed disabled:opacity-60" disabled={pergunta.trim().length < 3}>{s.askButton}</button>
      </form>
      {feita && trechos.length === 0 && <p className="mt-4 font-serif text-lg italic text-ink-soft">{s.askNone}</p>}
      <ul className="mt-5 space-y-4">
        {trechos.map((t, i) => (
          <li key={i} className="caderno-recorte p-4">
            <p className="font-serif text-lg leading-snug"><span className="caderno-numero mr-1 font-serif text-3xl not-italic" aria-hidden>“</span>{t.frase}</p>
            <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-wider opacity-80">
              {t.fonte} · <button type="button" className={elo} onClick={() => paraNotas(`> ${t.frase}\n> — ${t.fonte}`)}>{s.copyToNotes}</button>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cartões num CSV que o Anki importa (Arquivo → Importar): frente, verso e a fonte como etiqueta. Gerado no aparelho. */
function baixarParaAnki(lista: Cartao[]) {
  const celula = (texto: string) => `"${texto.replace(/"/g, '""').replace(/\r?\n/g, "<br>")}"`;
  const linhas = ["#separator:Comma", "#html:true", "#columns:Frente,Verso,Tags", ...lista.map((c) => [c.frente, c.verso, c.fonte.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 60)].map(celula).join(","))];
  const url = URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "cartoes-anki.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Cartoes({ s, fontes }: { s: NotebookStrings; fontes: Fonte[] }) {
  const todos = useMemo(() => fontes.flatMap(cartoesDe), [fontes]);
  const [fila, setFila] = useState<Cartao[]>(() => todos);
  const [i, setI] = useState(0);
  const [virado, setVirado] = useState(false);
  const [sei, setSei] = useState(0);
  const [repetir, setRepetir] = useState<Cartao[]>([]);
  const [guardados, setGuardados] = useState("");
  if (todos.length === 0) {
    return (
      <div>
        <Faixa titulo={s.tools.cards} />
        <p className="caderno-folha px-5 py-10 text-center font-serif text-lg italic">{s.cardsEmpty}</p>
      </div>
    );
  }
  const guardar = (lista: Cartao[]) => setGuardados(fill(s.savedN, { n: guardarCartoes(lista.map((c) => ({ frente: c.frente, verso: c.verso, origem: c.fonte }))) }));
  const cartao = fila[i];
  const avancar = (soube: boolean) => {
    if (soube) setSei((n) => n + 1);
    else setRepetir((r) => [...r, cartao]);
    setVirado(false);
    setI(i + 1);
  };
  if (!cartao) {
    return (
      <div>
        <Faixa titulo={s.tools.cards} />
        <p className="font-sans text-4xl font-black uppercase italic">{fill(s.cardsDone, { a: sei, b: fila.length })}</p>
        <p className="mt-4 flex flex-wrap gap-3">
          {repetir.length > 0 && <button type="button" className={botao} onClick={() => { setFila(repetir); setRepetir([]); setI(0); setSei(0); }}>{s.redoUnknown}</button>}
          <button type="button" className={claro} onClick={() => { setFila([...todos].sort(() => Math.random() - 0.5)); setRepetir([]); setI(0); setSei(0); }}>{s.again}</button>
        </p>
      </div>
    );
  }
  return (
    <div>
      <Faixa titulo={s.tools.cards} lead={s.cardsLead} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-soft">{i + 1} / {fila.length} · {cartao.fonte}</p>
        <div className="h-1.5 w-40 bg-rule" aria-hidden>
          <div className="h-full bg-[#c21f16]" style={{ width: `${(i / fila.length) * 100}%` }} />
        </div>
      </div>
      <button type="button" key={`${i}-${virado}`} onClick={() => setVirado((v) => !v)} className="caderno-ficha caderno-ficha-virar mt-3 flex min-h-64 w-full cursor-pointer flex-col items-center justify-center px-8 py-10 text-center">
        <span className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#c21f16]">{virado ? s.back : s.question}</span>
        <span className="mt-3 font-serif text-2xl leading-snug sm:text-3xl">{virado ? cartao.verso : cartao.frente}</span>
        <span className="mt-5 font-mono text-[0.68rem] uppercase tracking-[0.2em] opacity-60">{virado ? s.front : s.flip}</span>
      </button>
      {virado && (
        <p className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
          <button type="button" className={claro} onClick={() => avancar(false)}>{s.dontKnow}</button>
          <button type="button" className="cursor-pointer border-2 border-ink bg-[#c21f16] px-4 py-2 font-sans text-sm font-black uppercase italic text-white hover:bg-[#a51810]" onClick={() => avancar(true)}>{s.know}</button>
        </p>
      )}
      <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <button type="button" className={elo} onClick={() => guardar([cartao])}>{s.saveCard}</button>
        <button type="button" className={elo} onClick={() => guardar(todos)}>{s.saveAllCards} ({todos.length})</button>
        <button type="button" className={elo} onClick={() => baixarParaAnki(todos)}>{s.exportAnki}</button>
        <span role="status" className="text-ok">{guardados}</span>
      </p>
    </div>
  );
}

function Questionario({ s, fontes }: { s: NotebookStrings; fontes: Fonte[] }) {
  const [questoes, setQuestoes] = useState<Questao[]>(() => questoesDe(fontes, 10).slice(0, 10));
  const [i, setI] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [acertos, setAcertos] = useState(0);
  if (questoes.length === 0) {
    return (
      <div>
        <Faixa titulo={s.tools.quiz} />
        <p className="caderno-folha px-5 py-10 text-center font-serif text-lg italic">{s.quizEmpty}</p>
      </div>
    );
  }
  const q = questoes[i];
  if (!q) {
    return (
      <div>
        <Faixa titulo={s.tools.quiz} />
        <p className="font-sans text-4xl font-black uppercase italic">{fill(s.quizScore, { a: acertos, b: questoes.length })}</p>
        <p className="mt-4">
          <button type="button" className={botao} onClick={() => { setQuestoes(questoesDe(fontes, 10).slice(0, 10)); setI(0); setEscolha(null); setAcertos(0); }}>{s.restart}</button>
        </p>
      </div>
    );
  }
  return (
    <div>
      <Faixa titulo={s.tools.quiz} lead={s.quizLead} />
      <div className="flex items-center gap-3">
        <span className="caderno-numero font-sans text-4xl">{i + 1}</span>
        <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">/ {questoes.length} · {q.fonte}</span>
        <span className="ml-auto font-mono text-xs uppercase tracking-wider">✓ {acertos}</span>
      </div>
      <p className="mt-3 font-serif text-2xl leading-snug">{q.pergunta}</p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {q.opcoes.map((o, j) => {
          const estado = escolha === null ? "" : j === q.resposta ? "certa" : j === escolha ? "errada" : "apagada";
          return (
            <button
              key={j}
              type="button"
              disabled={escolha !== null}
              onClick={() => { setEscolha(j); if (j === q.resposta) setAcertos((n) => n + 1); else registrarErro({ pergunta: q.pergunta, opcoes: q.opcoes, resposta: q.resposta, escolhida: j, explicacao: q.explicacao, origem: q.fonte }); }}
              className={`flex cursor-pointer items-stretch border-2 text-left disabled:cursor-default ${estado === "certa" ? "border-ok" : estado === "errada" ? "border-oxblood" : estado === "apagada" ? "border-rule opacity-55" : "border-ink hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--ink)] motion-safe:transition"}`}
            >
              <span className={`flex w-10 shrink-0 items-center justify-center font-sans text-lg font-black ${estado === "certa" ? "bg-ok text-parchment" : estado === "errada" ? "bg-oxblood text-parchment" : "bg-ink text-parchment"}`}>{"ABCDEFGH"[j]}</span>
              <span className="flex-1 bg-parchment px-3 py-2.5 font-serif text-base leading-snug">{o}</span>
            </button>
          );
        })}
      </div>
      {escolha !== null && (
        <div className="mt-4 border-l-4 pl-4" style={{ borderColor: escolha === q.resposta ? "var(--ok)" : "var(--oxblood)" }}>
          <p className={`font-sans text-lg font-black uppercase italic ${escolha === q.resposta ? "text-ok" : "text-oxblood"}`}>{escolha === q.resposta ? s.correct : s.wrong}</p>
          {q.explicacao && <p className="mt-1 font-serif text-base text-ink-soft">{q.explicacao}</p>}
          <button type="button" className={`${botao} mt-3`} onClick={() => { setI(i + 1); setEscolha(null); }}>{s.next} →</button>
        </div>
      )}
    </div>
  );
}

function Mapa({ s, fontes }: { s: NotebookStrings; fontes: Fonte[] }) {
  const ramos = useMemo(() => mapaDe(fontes), [fontes]);
  // Um desenho simples: cada fonte é um tronco à esquerda, os títulos saem dele, os subtítulos dos títulos.
  const linhas: { y: number; nivel: number; texto: string }[] = [];
  const andar = (r: Ramo, nivel: number) => {
    linhas.push({ y: linhas.length, nivel, texto: r.titulo });
    r.filhos.forEach((f) => andar(f, nivel + 1));
  };
  ramos.forEach((r) => andar(r, 0));
  const passo = 30;
  const altura = linhas.length * passo + 20;
  const [radial, setRadial] = useState(true);
  const corta = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  return (
    <div>
      <Faixa titulo={s.tools.map} lead={s.mapLead} />
      <p className="flex gap-1.5 text-xs" role="group" aria-label={s.tools.map}>
        <button type="button" aria-pressed={radial} onClick={() => setRadial(true)} className="caderno-ferramenta cursor-pointer border-2 border-ink bg-parchment px-3 py-1 font-bold">◎</button>
        <button type="button" aria-pressed={!radial} onClick={() => setRadial(false)} className="caderno-ferramenta cursor-pointer border-2 border-ink bg-parchment px-3 py-1 font-bold">☰</button>
      </p>
      {radial ? (
        <div className="mt-3 space-y-4">
          {ramos.map((r, k) => {
            // Mapa mental: a fonte no centro, os títulos em volta e os subtítulos saindo de cada título.
            const cx = 380;
            const cy = 250;
            const n = Math.max(r.filhos.length, 1);
            return (
              <div key={k} className="caderno-folha overflow-x-auto p-3">
                <svg viewBox="0 0 760 500" width="760" height="500" role="img" aria-label={`${s.tools.map}: ${r.titulo}`} className="max-w-full font-sans">
                  {r.filhos.map((f, i) => {
                    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
                    const x = cx + Math.cos(ang) * 250;
                    const y = cy + Math.sin(ang) * 170;
                    const direita = Math.cos(ang) >= 0;
                    return (
                      <g key={i}>
                        <path d={`M ${cx} ${cy} Q ${(cx + x) / 2 + Math.sin(ang) * 30} ${(cy + y) / 2 - Math.cos(ang) * 30}, ${x} ${y}`} fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="3" />
                        <rect x={x - 6} y={y - 6} width="12" height="12" fill="currentColor" />
                        <text x={x + (direita ? 12 : -12)} y={y + 5} textAnchor={direita ? "start" : "end"} fontSize="14" fontWeight="800" fill="currentColor">{corta(f.titulo, 30)}</text>
                        {f.filhos.slice(0, 4).map((g, j) => {
                          const gx = x + (direita ? 12 : -12);
                          const gy = y + 21 + j * 16;
                          return (
                            <text key={j} x={gx} y={gy} textAnchor={direita ? "start" : "end"} fontSize="12" fill="currentColor" fillOpacity="0.75">— {corta(g.titulo, 28)}</text>
                          );
                        })}
                      </g>
                    );
                  })}
                  <circle cx={cx} cy={cy} r="46" fill="#c21f16" stroke="#1f1a14" strokeWidth="4" />
                  <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="900" fontStyle="italic" fill="#fff">{corta(r.titulo, 16).toUpperCase()}</text>
                </svg>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="caderno-folha mt-3 overflow-x-auto p-3">
          <svg viewBox={`0 0 760 ${altura}`} width="760" height={altura} role="img" aria-label={s.tools.map} className="max-w-full font-sans">
            {linhas.map((l, i) => {
              const x = 20 + l.nivel * 160;
              const y = 20 + i * passo;
              // Liga ao pai (a última linha anterior com um nível a menos).
              let pai = -1;
              for (let j = i - 1; j >= 0; j--) if (linhas[j].nivel === l.nivel - 1) { pai = j; break; }
              return (
                <g key={i}>
                  {pai >= 0 && <path d={`M ${20 + linhas[pai].nivel * 160 + 8} ${20 + pai * passo + 6} C ${x - 40} ${20 + pai * passo + 6}, ${x - 40} ${y + 6}, ${x} ${y + 6}`} fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />}
                  {l.nivel === 0 ? <rect x={x - 7} y={y - 1} width="14" height="14" fill="#c21f16" /> : <circle cx={x} cy={y + 6} r={l.nivel === 1 ? 5 : 3.5} fill="currentColor" />}
                  <text x={x + 14} y={y + 10} fontSize={l.nivel === 0 ? 15 : 13} fontWeight={l.nivel === 0 ? 900 : l.nivel === 1 ? 700 : 400} fill="currentColor">
                    {l.texto.length > 48 ? `${l.texto.slice(0, 46)}…` : l.texto}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

function Tempo({ s, fontes }: { s: NotebookStrings; fontes: Fonte[] }) {
  const marcos = useMemo(() => linhaDoTempo(fontes), [fontes]);
  if (marcos.length === 0) {
    return (
      <div>
        <Faixa titulo={s.tools.timeline} />
        <p className="caderno-folha px-5 py-10 text-center font-serif text-lg italic">{s.timelineEmpty}</p>
      </div>
    );
  }
  return (
    <div>
      <Faixa titulo={s.tools.timeline} lead={s.timelineLead} />
      <ol className="relative ml-2 border-l-4 border-ink">
        {marcos.map((m, i) => (
          <li key={i} className="relative pb-7 pl-8">
            <span aria-hidden className="absolute -left-[12px] top-2 h-5 w-5 rotate-45 border-2 border-ink bg-[#c21f16]" />
            <p className="caderno-numero font-sans text-3xl">{m.ano}</p>
            <p className="mt-1 font-serif text-lg leading-snug">{m.texto}</p>
            <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-wider text-ink-soft">{m.fonte}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Audio({ s, titulo, fontes, lang }: { s: NotebookStrings; titulo: string; fontes: Fonte[]; lang: string }) {
  const falas = useMemo(() => roteiroDeAudio(titulo, fontes, s.audioIntro, s.audioQuestions, s.audioClose), [titulo, fontes, s]);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(-1);
  const [velocidade, setVelocidade] = useState(1);
  const parar = useRef(false);
  const suportado = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => () => { parar.current = true; if (suportado) window.speechSynthesis.cancel(); }, [suportado]);

  function vozes(): [SpeechSynthesisVoice | undefined, SpeechSynthesisVoice | undefined] {
    const todas = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang === "pt" ? "pt" : lang.slice(0, 2)));
    return [todas[0], todas[1] ?? todas[0]];
  }
  function tocar() {
    if (!suportado) return;
    parar.current = false;
    setTocando(true);
    const [a, b] = vozes();
    const synth = window.speechSynthesis;
    synth.cancel();
    falas.forEach((fala, i) => {
      const u = new SpeechSynthesisUtterance(fala.texto);
      u.lang = lang === "pt" ? "pt-BR" : lang;
      const voz = fala.voz === 0 ? a : b;
      if (voz) u.voice = voz;
      // Sem duas vozes, a segunda pessoa fala um pouco mais grave e devagar.
      u.pitch = fala.voz === 0 ? 1 : a && b && a !== b ? 1 : 0.85;
      u.rate = velocidade * (fala.voz === 0 ? 1 : 0.97);
      u.onstart = () => setAtual(i);
      if (i === falas.length - 1) u.onend = () => { setTocando(false); setAtual(-1); };
      synth.speak(u);
    });
  }
  function pararTudo() {
    window.speechSynthesis.cancel();
    setTocando(false);
    setAtual(-1);
  }
  return (
    <div>
      <Faixa titulo={s.tools.audio} lead={s.audioLead} />
      {!suportado && <p className="text-oxblood">{s.audioNoVoice}</p>}
      <div className="jornal-preto flex flex-wrap items-center gap-4 px-4 py-3">
        <button type="button" className="cursor-pointer bg-[#c21f16] px-5 py-2 font-sans font-black uppercase italic text-white hover:bg-[#a51810] disabled:cursor-not-allowed disabled:opacity-50" disabled={!suportado || tocando} onClick={tocar}>▶ {s.audioPlay}</button>
        <button type="button" className="cursor-pointer border-2 border-[#f4ecd8] px-4 py-1.5 font-sans text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40" disabled={!tocando} onClick={pararTudo}>■ {s.audioStop}</button>
        <label className="ml-auto flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
          {s.audioSpeed} <input type="range" min={0.7} max={1.4} step={0.1} value={velocidade} onChange={(e) => setVelocidade(Number(e.target.value))} className="accent-[#c21f16]" /> <span>{velocidade.toFixed(1)}×</span>
        </label>
      </div>
      <ol className="caderno-folha mt-4 space-y-1 p-3">
        {falas.map((f, i) => (
          <li key={i} className={`flex gap-3 border-l-4 p-2 ${atual === i ? "border-[#c21f16] bg-[#c21f16]/10" : "border-transparent"}`}>
            <span className={`mt-0.5 h-fit shrink-0 px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase ${f.voz === 0 ? "bg-[#c21f16] text-white" : "bg-ink text-parchment"}`}>{f.voz === 0 ? s.voiceA : s.voiceB}</span>
            <span className="font-serif text-base leading-snug">{f.texto}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Notas({ s, caderno, mudar }: { s: NotebookStrings; caderno: Caderno; mudar: (m: Partial<Caderno>) => void }) {
  function exportar() {
    const texto = `# ${caderno.titulo}\n\n${caderno.notas}\n\n---\n${s.sources}:\n${caderno.fontes.map((f) => `- ${f.titulo}${f.origem ? ` (${f.origem})` : ""}`).join("\n")}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/markdown;charset=utf-8" }));
    a.download = `${caderno.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 50) || "caderno"}.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  /** Tudo o que o caderno extraiu, num arquivo só, para estudar depois sem internet. */
  function exportarTudo() {
    const fontes = caderno.fontes.filter((f) => f.ativa);
    const partes: string[] = [`# ${caderno.titulo}`, ""];
    partes.push(`## ${s.tools.summary}`, "", ...fontes.flatMap((f) => [`### ${f.titulo}`, "", ...resumir(f.texto).map((x) => `- ${x}`), ""]));
    partes.push(`## ${s.keywords}`, "", palavrasChave(fontes.map((f) => f.texto).join("\n")).map((p) => p.palavra).join(", "), "");
    partes.push(`## ${s.tools.cards}`, "", ...fontes.flatMap((f) => cartoesDe(f).map((c) => `- **${c.frente}** — ${c.verso}`)), "");
    partes.push(`## ${s.tools.quiz}`, "", ...questoesDe(fontes).flatMap((q, i) => [`${i + 1}. ${q.pergunta}`, ...q.opcoes.map((o, j) => `   ${j === q.resposta ? "[x]" : "[ ]"} ${o}`), ""]));
    const ramo = (r: Ramo, nivel: number): string[] => [`${"  ".repeat(nivel)}- ${r.titulo}`, ...r.filhos.flatMap((f) => ramo(f, nivel + 1))];
    partes.push(`## ${s.tools.map}`, "", ...mapaDe(fontes).flatMap((r) => ramo(r, 0)), "");
    const marcos = linhaDoTempo(fontes);
    if (marcos.length) partes.push(`## ${s.tools.timeline}`, "", ...marcos.map((m) => `- **${m.ano}** — ${m.texto}`), "");
    partes.push(`## ${s.tools.notes}`, "", caderno.notas, "", "---", `${s.sources}:`, ...caderno.fontes.map((f) => `- ${f.titulo}${f.origem ? ` (${f.origem})` : ""}`), "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([partes.join("\n")], { type: "text/markdown;charset=utf-8" }));
    a.download = `${caderno.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 50) || "caderno"}-completo.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  return (
    <div>
      <Faixa titulo={s.tools.notes} lead={s.notesLead} />
      <textarea value={caderno.notas} onChange={(e) => mudar({ notas: e.target.value })} rows={16} placeholder={s.notesPlaceholder} aria-label={s.tools.notes} className="caderno-pauta w-full resize-y font-serif text-lg" />
      <p className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={botao} onClick={exportarTudo}>{s.exportAll}</button>
        <button type="button" className={claro} onClick={exportar}>{s.exportNotes}</button>
        <button type="button" className={claro} onClick={() => window.print()}>{s.print}</button>
      </p>
    </div>
  );
}

function Plano({ s, fontes }: { s: NotebookStrings; fontes: Fonte[] }) {
  const [modo, setModo] = useState<"foco" | "pausa">("foco");
  const [restante, setRestante] = useState(25 * 60);
  const [rodando, setRodando] = useState(false);
  const [feitos, setFeitos] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!rodando) return;
    const relogio = window.setInterval(() => {
      setRestante((r) => {
        if (r > 1) return r - 1;
        const proximo = modo === "foco" ? "pausa" : "foco";
        setModo(proximo);
        setRodando(false);
        return proximo === "foco" ? 25 * 60 : 5 * 60;
      });
    }, 1000);
    return () => window.clearInterval(relogio);
  }, [rodando, modo]);
  const tarefas = fontes.flatMap((f) => {
    const titulos = [...f.texto.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].replace(/[*_`]/g, "").trim());
    return (titulos.length ? titulos : [f.titulo]).map((t) => `${f.titulo} › ${t}`);
  });
  const feitas = tarefas.filter((t) => feitos[t]).length;
  const mm = String(Math.floor(restante / 60)).padStart(2, "0");
  const ss = String(restante % 60).padStart(2, "0");
  return (
    <div>
      <Faixa titulo={s.tools.plan} lead={s.planLead} />
      <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="jornal-preto h-fit p-5 text-center">
          <p className={`inline-block px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.2em] ${modo === "foco" ? "bg-[#c21f16] text-white" : "bg-[#f4ecd8] text-[#1f1a14]"}`}>{modo === "foco" ? s.focus : s.rest}</p>
          <p className="mt-3 font-mono text-6xl font-bold tabular-nums" aria-live="off">{mm}:{ss}</p>
          <p className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className="cursor-pointer bg-[#c21f16] px-4 py-2 font-sans font-black uppercase italic text-white hover:bg-[#a51810]" onClick={() => setRodando((r) => !r)}>{rodando ? s.pause : s.start}</button>
            <button type="button" className="cursor-pointer border-2 border-[#f4ecd8] px-3 py-1.5 font-sans text-sm font-bold uppercase" onClick={() => { setRodando(false); setModo("foco"); setRestante(25 * 60); }}>{s.reset}</button>
          </p>
          <p className="mt-3 font-mono text-[0.68rem] uppercase tracking-wider opacity-70">{s.pomodoro}</p>
        </div>
        <div>
          {tarefas.length === 0 ? (
            <p className="caderno-folha px-5 py-10 text-center font-serif text-lg italic">{s.needSources}</p>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-wider text-ink-soft">{feitas} / {tarefas.length}</p>
              <div className="mt-1 h-2 bg-rule" aria-hidden>
                <div className="h-full bg-[#c21f16]" style={{ width: `${(feitas / tarefas.length) * 100}%` }} />
              </div>
              <ul className="caderno-folha mt-3 divide-y divide-rule px-4">
                {tarefas.map((t) => (
                  <li key={t}>
                    <label className={`flex cursor-pointer items-start gap-3 py-2.5 font-serif text-base ${feitos[t] ? "text-ink-soft line-through" : ""}`}>
                      <input type="checkbox" checked={Boolean(feitos[t])} onChange={(e) => setFeitos({ ...feitos, [t]: e.target.checked })} className="mt-1 h-4 w-4 accent-[#c21f16]" />
                      {t}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Para o podcast: um roteiro de episódio montado a partir das fontes, no gabarito do programa. */
function Roteiro({ s, titulo, fontes }: { s: NotebookStrings; titulo: string; fontes: Fonte[] }) {
  const [copiado, setCopiado] = useState(false);
  const todo = fontes.map((f) => f.texto).join("\n\n");
  const pontos = resumir(todo, 9);
  const chaves = palavrasChave(todo, 6).map((p) => p.palavra);
  const roteiro = [
    `## Abertura (até 1 min)`,
    `- Vinheta. Neste episódio: ${titulo}.`,
    `- Por que isso importa para quem trabalha e estuda agora.`,
    ``,
    `## Bloco 1 · Contexto (5 a 8 min)`,
    ...pontos.slice(0, 3).map((p) => `- ${p}`),
    `- Obra para quem quer ler mais: ${fontes[0]?.titulo ?? "…"}`,
    ``,
    `## Bloco 2 · O centro da conversa (10 a 15 min)`,
    ...pontos.slice(3, 7).map((p) => `- ${p}`),
    `- Palavras que vão aparecer e precisam ser explicadas: ${chaves.join(", ")}.`,
    `- Pergunta para o convidado: …`,
    ``,
    `## Bloco 3 · Hoje (5 min)`,
    ...pontos.slice(7).map((p) => `- ${p}`),
    `- Pergunta da comunidade: …`,
    ``,
    `## Chamada para a ação (1 min)`,
    `- Ler: ${fontes.map((f) => f.titulo).join("; ")}.`,
    ``,
    `## Encerramento (1 min)`,
    `- Fontes e transcrição na página do episódio, em institutolucia.org/podcasts.`,
  ].join("\n");
  return (
    <div>
      <Faixa titulo={s.tools.script} lead={s.scriptLead} />
      <pre className="caderno-folha overflow-x-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed">{roteiro}</pre>
      <p className="mt-3">
        <button type="button" className={botao} onClick={() => void navigator.clipboard.writeText(roteiro).then(() => setCopiado(true))}>{copiado ? s.copied : s.scriptCopy}</button>
      </p>
      <p className="mt-2 text-xs text-ink-soft">{limpar(todo).length > 0 ? "" : s.needSources}</p>
    </div>
  );
}
