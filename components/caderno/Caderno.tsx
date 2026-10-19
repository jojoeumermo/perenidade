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
import { CopiaDeSeguranca, Erros, Ler, Revisao } from "./Estudo";

export type NotebookStrings = Dict["notebook"];
type Ferramenta = "resumo" | "ler" | "perguntar" | "cartoes" | "revisao" | "questionario" | "erros" | "mapa" | "tempo" | "audio" | "notas" | "plano" | "roteiro";
const SEM_FONTE: Ferramenta[] = ["notas", "plano", "revisao", "erros"];

const botao = "cursor-pointer bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const elo = "cursor-pointer underline hover:text-oxblood";
const campo = "w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-sans text-sm";

const novoCaderno = (titulo: string): Caderno => ({ id: novoId(), titulo, fontes: [], notas: "", criado: Date.now(), atualizado: Date.now() });

/**
 * O caderno de estudos: uma sala para estudar com tudo à mão. A pessoa junta fontes (aulas e obras do site, texto colado,
 * arquivos) e o caderno extrai delas resumo, palavras-chave, cartões de memória, questionário, mapa mental, linha do tempo
 * e um resumo em áudio a duas vozes; ao lado, as notas, o plano de estudo e o dicionário. Tudo roda no navegador e fica
 * guardado só nele: sem conta, sem serviço de fora, sem modelo de linguagem (o caderno é estatística de texto, e diz isso).
 */
export function CadernoDeEstudos({ s, modo = "site" }: { s: NotebookStrings; modo?: "site" | "painel" | "podcast" }) {
  const { lang } = useI18n();
  // Os cadernos moram no navegador: só são lidos depois de a tela montar (o servidor não os conhece).
  const [cadernos, setCadernos] = useState<Caderno[] | null>(null);
  const [atualId, setAtualId] = useState<string>("");
  const [ferramenta, setFerramenta] = useState<Ferramenta>("resumo");
  const [aba, setAba] = useState<"site" | "colar" | "arquivo" | null>(null);

  useEffect(() => {
    const relogio = window.setTimeout(() => {
      const lista = lerCadernos();
      const pronta = lista.length ? lista : [novoCaderno(s.untitled)];
      setCadernos(pronta);
      setAtualId(pronta[0].id);
      // Endereço com ?ferramenta=erros (vindo do simulado) ou ?ferramenta=revisao abre direto nela.
      const pedida = new URLSearchParams(window.location.search).get("ferramenta");
      if (pedida === "erros" || pedida === "revisao" || pedida === "ler") setFerramenta(pedida);
    }, 0);
    return () => window.clearTimeout(relogio);
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

  const ferramentas: [Ferramenta, string][] = [
    ["resumo", s.tools.summary],
    ["ler", s.tools.read],
    ["perguntar", s.tools.ask],
    ["cartoes", s.tools.cards],
    ["revisao", s.tools.review],
    ["questionario", s.tools.quiz],
    ["erros", s.tools.mistakes],
    ["mapa", s.tools.map],
    ["tempo", s.tools.timeline],
    ["audio", s.tools.audio],
    ["notas", s.tools.notes],
    ["plano", s.tools.plan],
    ...(modo === "podcast" ? ([["roteiro", s.tools.script]] as [Ferramenta, string][]) : []),
  ];

  function acrescentar(fonte: Omit<Fonte, "id" | "ativa">) {
    mudar({ fontes: [...atual!.fontes, { ...fonte, id: novoId(), ativa: true }] });
    setAba(null);
  }

  return (
    <div className="mt-8 grid gap-6 font-sans text-sm lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* Esquerda: cadernos e fontes. */}
      <aside className="space-y-5">
        <section className="border-2 border-ink bg-parchment-deep p-3">
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-widest text-gold">{s.notebooks}</span>
            <select
              value={atual.id}
              onChange={(e) => {
                if (e.target.value === "__novo") {
                  const novo = novoCaderno(s.untitled);
                  const lista = [novo, ...cadernos];
                  guardarCadernos(lista);
                  setCadernos(lista);
                  setAtualId(novo.id);
                } else setAtualId(e.target.value);
              }}
              className={`${campo} mt-1`}
            >
              {cadernos.map((c) => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
              <option value="__novo">+ {s.newNotebook}</option>
            </select>
          </label>
          <input value={atual.titulo} onChange={(e) => mudar({ titulo: e.target.value })} maxLength={80} aria-label={s.rename} className={`${campo} mt-2 font-serif text-base font-semibold`} />
          <p className="mt-2 flex gap-3 text-xs text-ink-soft">
            <button
              type="button"
              className={elo}
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

        <section className="border-2 border-ink bg-parchment-deep p-3">
          <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.sources} ({atual.fontes.length})</p>
          <ul className="mt-2 space-y-1.5">
            {atual.fontes.map((f) => (
              <li key={f.id} className={`flex items-start gap-2 border-l-2 pl-2 ${f.ativa ? "border-ink" : "border-rule opacity-60"}`}>
                <input type="checkbox" checked={f.ativa} onChange={(e) => mudar({ fontes: atual.fontes.map((x) => (x.id === f.id ? { ...x, ativa: e.target.checked } : x)) })} aria-label={s.active} className="mt-1" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold" title={f.titulo}>{f.titulo}</span>
                  <span className="block text-xs text-ink-soft">
                    {fill(s.minutes, { n: minutosDe(f.texto) })}
                    {f.origem.startsWith("/") && (
                      <>
                        {" · "}<L href={f.origem} className={elo}>↗</L>
                      </>
                    )}
                    {" · "}
                    <button type="button" className={elo} onClick={() => mudar({ fontes: atual.fontes.filter((x) => x.id !== f.id) })}>{s.remove}</button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {atual.fontes.length === 0 && <p className="mt-2 text-xs text-ink-soft">{s.empty}</p>}
          <div className="mt-3 flex flex-wrap gap-1">
            {(["site", "colar", "arquivo"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setAba(aba === id ? null : id)} aria-pressed={aba === id} className={`cursor-pointer border px-2 py-1 text-xs ${aba === id ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment hover:border-ink"}`}>
                {id === "site" ? s.fromSite : id === "colar" ? s.paste : s.file}
              </button>
            ))}
          </div>
          {aba === "site" && <DoSite s={s} lang={lang} acrescentar={acrescentar} />}
          {aba === "colar" && <Colar s={s} acrescentar={acrescentar} />}
          {aba === "arquivo" && <Arquivo s={s} acrescentar={acrescentar} />}
        </section>
        <CopiaDeSeguranca s={s} />
        <p className="text-xs text-ink-soft">{s.honest}</p>
      </aside>

      {/* Centro: as ferramentas. */}
      <section className="min-w-0">
        <div role="tablist" className="flex flex-wrap gap-x-4 gap-y-1 border-b-2 border-ink">
          {ferramentas.map(([id, nome]) => (
            <button key={id} type="button" role="tab" aria-selected={ferramenta === id} onClick={() => setFerramenta(id)} className={`-mb-0.5 cursor-pointer border-b-4 pb-2 ${ferramenta === id ? "border-[#c21f16] font-semibold" : "border-transparent text-ink-soft hover:border-rule hover:text-ink"}`}>
              {nome}
            </button>
          ))}
        </div>
        <div className="mt-5">
          {ativas.length === 0 && !SEM_FONTE.includes(ferramenta) ? (
            <p className="border border-rule bg-parchment-deep px-4 py-8 text-center text-ink-soft">{s.needSources}</p>
          ) : (
            <>
              {ferramenta === "resumo" && <Resumo s={s} fontes={ativas} paraNotas={(t) => mudar({ notas: `${atual.notas}${atual.notas ? "\n\n" : ""}${t}` })} />}
              {ferramenta === "ler" && <Ler key={atual.id} s={s} fontes={ativas} mudarFonte={mudarFonte} paraNotas={(t) => mudar({ notas: `${atual.notas}${atual.notas ? "\n\n" : ""}${t}` })} />}
              {ferramenta === "revisao" && <Revisao s={s} />}
              {ferramenta === "erros" && <Erros s={s} />}
              {ferramenta === "perguntar" && <Perguntar s={s} fontes={ativas} paraNotas={(t) => mudar({ notas: `${atual.notas}${atual.notas ? "\n\n" : ""}${t}` })} />}
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
        <p className="mt-8 border-t border-rule pt-4 text-xs text-ink-soft">
          {s.allFree} <L href="/ferramentas/dicionario" className={elo}>{s.dictionary}</L> · <L href="/ferramentas" className={elo}>{s.moreTools}</L>
        </p>
      </section>
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
    <div className="mt-2">
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={s.searchPlaceholder} aria-label={s.searchSite} className={campo} />
      {indice === null && <p className="mt-1 text-xs text-ink-soft">…</p>}
      {busca.trim().length >= 2 && achados.length === 0 && indice && <p className="mt-1 text-xs text-ink-soft">{s.noResults}</p>}
      <ul className="mt-1 max-h-60 space-y-1 overflow-y-auto [scrollbar-width:thin]">
        {achados.map(({ entry }) => (
          <li key={entry.href}>
            <button type="button" disabled={Boolean(ocupado)} onClick={() => void pegar(entry)} className="w-full cursor-pointer border border-rule bg-parchment px-2 py-1.5 text-left text-xs hover:border-ink disabled:opacity-50">
              <span className="block truncate font-semibold">{entry.title}</span>
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
    <div className="mt-2 space-y-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={s.pasteTitle} maxLength={120} className={campo} />
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={s.pasteText} rows={5} maxLength={200000} className={campo} />
      <button type="button" className={claro} disabled={texto.trim().length < 40} onClick={() => { acrescentar({ titulo: titulo.trim() || texto.trim().slice(0, 40), tipo: "texto", texto, origem: "" }); setTitulo(""); setTexto(""); }}>{s.pasteAdd}</button>
    </div>
  );
}

function Arquivo({ s, acrescentar }: { s: NotebookStrings; acrescentar: (f: Omit<Fonte, "id" | "ativa">) => void }) {
  return (
    <div className="mt-2">
      <input
        type="file"
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        className="block w-full text-xs"
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
      <p className="text-ink-soft">{s.summaryLead}</p>
      <label className="mt-3 flex items-center gap-3 text-xs">
        {s.summaryLength}
        <input type="range" min={3} max={15} value={tamanho} onChange={(e) => setTamanho(Number(e.target.value))} />
        <span className="font-mono">{tamanho}</span>
      </label>
      <ul className="mt-4 space-y-3 border-l-4 border-gold pl-4 font-serif text-lg leading-snug">
        {pontos.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      <p className="mt-5 font-mono text-xs uppercase tracking-widest text-gold">{s.keywords}</p>
      <p className="mt-1 flex flex-wrap gap-1.5">
        {chaves.map((c) => (
          <span key={c.palavra} className="border border-rule bg-parchment-deep px-2 py-0.5 text-xs">
            {c.palavra} <span className="font-mono text-ink-soft">{c.vezes}</span>
          </span>
        ))}
      </p>
      <p className="mt-4">
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
      <p className="text-ink-soft">{s.askLead}</p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setFeita(pergunta); }}>
        <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder={s.askPlaceholder} className={campo} />
        <button type="submit" className={botao} disabled={pergunta.trim().length < 3}>{s.askButton}</button>
      </form>
      {feita && trechos.length === 0 && <p className="mt-4 text-ink-soft">{s.askNone}</p>}
      <ul className="mt-4 space-y-3">
        {trechos.map((t, i) => (
          <li key={i} className="border-l-2 border-ink pl-3">
            <p className="font-serif text-lg leading-snug">{t.frase}</p>
            <p className="mt-1 text-xs text-ink-soft">
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
  const url = URL.createObjectURL(new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" }));
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
  if (todos.length === 0) return <p className="text-ink-soft">{s.cardsEmpty}</p>;
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
        <p className="font-serif text-2xl font-semibold">{fill(s.cardsDone, { a: sei, b: fila.length })}</p>
        <p className="mt-3 flex flex-wrap gap-3">
          {repetir.length > 0 && <button type="button" className={botao} onClick={() => { setFila(repetir); setRepetir([]); setI(0); setSei(0); }}>{s.redoUnknown}</button>}
          <button type="button" className={claro} onClick={() => { setFila([...todos].sort(() => Math.random() - 0.5)); setRepetir([]); setI(0); setSei(0); }}>{s.again}</button>
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-ink-soft">{s.cardsLead}</p>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button type="button" className={elo} onClick={() => guardar([cartao])}>{s.saveCard}</button>
        <button type="button" className={elo} onClick={() => guardar(todos)}>{s.saveAllCards} ({todos.length})</button>
        <button type="button" className={elo} onClick={() => baixarParaAnki(todos)}>{s.exportAnki}</button>
        <span role="status" className="text-ok">{guardados}</span>
      </p>
      <p className="mt-3 font-mono text-xs text-ink-soft">{i + 1} / {fila.length} · {cartao.fonte}</p>
      <button type="button" onClick={() => setVirado((v) => !v)} className="mt-2 flex min-h-48 w-full cursor-pointer flex-col items-center justify-center border-2 border-ink bg-parchment-deep p-6 text-center hover:border-gold">
        <span className="font-serif text-2xl leading-snug">{virado ? cartao.verso : cartao.frente}</span>
        <span className="mt-3 font-mono text-xs uppercase tracking-widest text-ink-soft">{virado ? s.front : s.flip}</span>
      </button>
      {virado && (
        <p className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={claro} onClick={() => avancar(false)}>{s.dontKnow}</button>
          <button type="button" className={botao} onClick={() => avancar(true)}>{s.know}</button>
        </p>
      )}
    </div>
  );
}

function Questionario({ s, fontes }: { s: NotebookStrings; fontes: Fonte[] }) {
  const [questoes, setQuestoes] = useState<Questao[]>(() => questoesDe(fontes, 10).slice(0, 10));
  const [i, setI] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [acertos, setAcertos] = useState(0);
  if (questoes.length === 0) return <p className="text-ink-soft">{s.quizEmpty}</p>;
  const q = questoes[i];
  if (!q) {
    return (
      <div>
        <p className="font-serif text-2xl font-semibold">{fill(s.quizScore, { a: acertos, b: questoes.length })}</p>
        <p className="mt-3">
          <button type="button" className={botao} onClick={() => { setQuestoes(questoesDe(fontes, 10).slice(0, 10)); setI(0); setEscolha(null); setAcertos(0); }}>{s.restart}</button>
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-ink-soft">{s.quizLead}</p>
      <p className="mt-3 font-mono text-xs text-ink-soft">{i + 1} / {questoes.length} · {q.fonte}</p>
      <p className="mt-2 font-serif text-xl leading-snug">{q.pergunta}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {q.opcoes.map((o, j) => (
          <button key={j} type="button" disabled={escolha !== null} onClick={() => { setEscolha(j); if (j === q.resposta) setAcertos((n) => n + 1); else registrarErro({ pergunta: q.pergunta, opcoes: q.opcoes, resposta: q.resposta, escolhida: j, explicacao: q.explicacao, origem: q.fonte }); }} className={`cursor-pointer border-2 bg-parchment px-3 py-2 text-left disabled:cursor-default ${escolha === null ? "border-rule hover:border-gold" : j === q.resposta ? "border-ok text-ok" : j === escolha ? "border-oxblood text-oxblood" : "border-rule opacity-60"}`}>
            {o}
          </button>
        ))}
      </div>
      {escolha !== null && (
        <div className="mt-3">
          <p className={`font-semibold ${escolha === q.resposta ? "text-ok" : "text-oxblood"}`}>{escolha === q.resposta ? s.correct : s.wrong}</p>
          {q.explicacao && <p className="mt-1 text-ink-soft">{q.explicacao}</p>}
          <button type="button" className={`${botao} mt-3`} onClick={() => { setI(i + 1); setEscolha(null); }}>{s.next}</button>
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
      <p className="text-ink-soft">{s.mapLead}</p>
      <p className="mt-2 flex gap-2 text-xs">
        <button type="button" aria-pressed={radial} onClick={() => setRadial(true)} className={`cursor-pointer border px-2 py-0.5 ${radial ? "border-ink bg-ink text-parchment" : "border-rule"}`}>◎</button>
        <button type="button" aria-pressed={!radial} onClick={() => setRadial(false)} className={`cursor-pointer border px-2 py-0.5 ${!radial ? "border-ink bg-ink text-parchment" : "border-rule"}`}>☰</button>
      </p>
      {radial ? (
        <div className="mt-3 space-y-4">
          {ramos.map((r, k) => {
            // Mapa mental: a fonte no centro, os títulos em volta e os subtítulos saindo de cada título.
            const cx = 380;
            const cy = 250;
            const n = Math.max(r.filhos.length, 1);
            return (
              <div key={k} className="overflow-x-auto border border-rule bg-parchment-deep p-3">
                <svg viewBox="0 0 760 500" width="760" height="500" role="img" aria-label={`${s.tools.map}: ${r.titulo}`} className="max-w-full font-sans">
                  {r.filhos.map((f, i) => {
                    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
                    const x = cx + Math.cos(ang) * 250;
                    const y = cy + Math.sin(ang) * 170;
                    const direita = Math.cos(ang) >= 0;
                    return (
                      <g key={i}>
                        <path d={`M ${cx} ${cy} Q ${(cx + x) / 2 + Math.sin(ang) * 30} ${(cy + y) / 2 - Math.cos(ang) * 30}, ${x} ${y}`} fill="none" stroke="#8a5f1c" strokeWidth="2" />
                        <circle cx={x} cy={y} r="6" fill="#1f1a14" />
                        <text x={x + (direita ? 10 : -10)} y={y + 4} textAnchor={direita ? "start" : "end"} fontSize="13" fontWeight="600" fill="currentColor">{corta(f.titulo, 30)}</text>
                        {f.filhos.slice(0, 4).map((g, j) => {
                          const gx = x + (direita ? 10 : -10);
                          const gy = y + 18 + j * 15;
                          return (
                            <text key={j} x={gx} y={gy} textAnchor={direita ? "start" : "end"} fontSize="11" fill="#8a5f1c">· {corta(g.titulo, 28)}</text>
                          );
                        })}
                      </g>
                    );
                  })}
                  <circle cx={cx} cy={cy} r="34" fill="#c21f16" />
                  <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#f4ecd8">{corta(r.titulo, 14)}</text>
                </svg>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="mt-3 overflow-x-auto border border-rule bg-parchment-deep p-3">
        <svg viewBox={`0 0 760 ${altura}`} width="760" height={altura} role="img" aria-label={s.tools.map} className="max-w-full font-sans">
          {linhas.map((l, i) => {
            const x = 20 + l.nivel * 160;
            const y = 20 + i * passo;
            // Liga ao pai (a última linha anterior com um nível a menos).
            let pai = -1;
            for (let j = i - 1; j >= 0; j--) if (linhas[j].nivel === l.nivel - 1) { pai = j; break; }
            return (
              <g key={i}>
                {pai >= 0 && <path d={`M ${20 + linhas[pai].nivel * 160 + 8} ${20 + pai * passo + 6} C ${x - 40} ${20 + pai * passo + 6}, ${x - 40} ${y + 6}, ${x} ${y + 6}`} fill="none" stroke="#8a5f1c" strokeWidth="1.5" />}
                <circle cx={x} cy={y + 6} r={l.nivel === 0 ? 7 : 4} fill={l.nivel === 0 ? "#c21f16" : l.nivel === 1 ? "#1f1a14" : "#8a5f1c"} />
                <text x={x + 14} y={y + 10} fontSize={l.nivel === 0 ? 15 : 13} fontWeight={l.nivel === 0 ? 700 : l.nivel === 1 ? 600 : 400} fill="currentColor">
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
  if (marcos.length === 0) return <p className="text-ink-soft">{s.timelineEmpty}</p>;
  return (
    <div>
      <p className="text-ink-soft">{s.timelineLead}</p>
      <ol className="mt-4 border-l-2 border-ink">
        {marcos.map((m, i) => (
          <li key={i} className="relative pl-6 pb-5">
            <span aria-hidden className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-[#c21f16]" />
            <p className="font-mono text-xs text-gold">{m.ano} · {m.fonte}</p>
            <p className="font-serif text-lg leading-snug">{m.texto}</p>
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
      <p className="text-ink-soft">{s.audioLead}</p>
      {!suportado && <p className="mt-3 text-oxblood">{s.audioNoVoice}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={botao} disabled={!suportado || tocando} onClick={tocar}>▶ {s.audioPlay}</button>
        <button type="button" className={claro} disabled={!tocando} onClick={pararTudo}>{s.audioStop}</button>
        <label className="flex items-center gap-2 text-xs">
          {s.audioSpeed} <input type="range" min={0.7} max={1.4} step={0.1} value={velocidade} onChange={(e) => setVelocidade(Number(e.target.value))} /> <span className="font-mono">{velocidade.toFixed(1)}×</span>
        </label>
      </div>
      <ol className="mt-5 space-y-2">
        {falas.map((f, i) => (
          <li key={i} className={`flex gap-3 ${atual === i ? "bg-parchment-deep" : ""} p-1`}>
            <span className={`shrink-0 font-mono text-xs ${f.voz === 0 ? "text-oxblood" : "text-gold"}`}>{f.voz === 0 ? s.voiceA : s.voiceB}</span>
            <span className="font-serif leading-snug">{f.texto}</span>
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
      <p className="text-ink-soft">{s.notesLead}</p>
      <textarea value={caderno.notas} onChange={(e) => mudar({ notas: e.target.value })} rows={18} placeholder={s.notesPlaceholder} className={`${campo} mt-3 font-serif text-base leading-relaxed`} />
      <p className="mt-3 flex flex-wrap gap-3">
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
  const mm = String(Math.floor(restante / 60)).padStart(2, "0");
  const ss = String(restante % 60).padStart(2, "0");
  return (
    <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="border-2 border-ink bg-parchment-deep p-4 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-gold">{modo === "foco" ? s.focus : s.rest}</p>
        <p className="mt-2 font-mono text-5xl font-semibold tabular-nums">{mm}:{ss}</p>
        <p className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" className={botao} onClick={() => setRodando((r) => !r)}>{rodando ? s.pause : s.start}</button>
          <button type="button" className={claro} onClick={() => { setRodando(false); setModo("foco"); setRestante(25 * 60); }}>{s.reset}</button>
        </p>
        <p className="mt-3 text-xs text-ink-soft">{s.pomodoro}</p>
      </div>
      <div>
        <p className="text-ink-soft">{s.planLead}</p>
        {tarefas.length === 0 ? (
          <p className="mt-3 text-ink-soft">{s.needSources}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {tarefas.map((t) => (
              <li key={t}>
                <label className={`flex items-start gap-2 ${feitos[t] ? "text-ink-soft line-through" : ""}`}>
                  <input type="checkbox" checked={Boolean(feitos[t])} onChange={(e) => setFeitos({ ...feitos, [t]: e.target.checked })} className="mt-1" />
                  {t}
                </label>
              </li>
            ))}
          </ul>
        )}
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
      <p className="text-ink-soft">{s.scriptLead}</p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap border border-rule bg-parchment-deep p-4 font-mono text-xs leading-relaxed">{roteiro}</pre>
      <p className="mt-3">
        <button type="button" className={botao} onClick={() => void navigator.clipboard.writeText(roteiro).then(() => setCopiado(true))}>{copiado ? s.copied : s.scriptCopy}</button>
      </p>
      <p className="mt-2 text-xs text-ink-soft">{limpar(todo).length > 0 ? "" : s.needSources}</p>
    </div>
  );
}
