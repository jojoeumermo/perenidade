// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { type Fonte, limpar, type Marca, novoId } from "@/lib/caderno";
import { agendar, apagarCartao, apagarErro, type CartaoDeRevisao, type Erro, guardarCartoes, hoje, lerCartoes, lerCopia, lerErros, montarCopia, type Nota, paraHoje, refazerErro, responderCartao, restaurarCopia } from "@/lib/estudo";
import { L } from "../I18n";
import type { NotebookStrings } from "./Caderno";

const botao = "cursor-pointer bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const elo = "cursor-pointer underline hover:text-oxblood";
const campo = "w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-sans text-sm";

/** Cores do marca-texto: o texto marcado fica sempre escuro, para ler bem no tema claro e no escuro. */
const CORES: Record<Marca["cor"], string> = { amarelo: "#f3dc6b", verde: "#9fd8a8", rosa: "#f2a7c3" };

/** Lê de novo o que está guardado sempre que algo de estudo muda (nesta aba ou em outra). */
function useGuardado<T>(ler: () => T, inicial: T): [T, () => void] {
  const [valor, setValor] = useState<T>(inicial);
  const lerRef = useRef(ler);
  useEffect(() => {
    lerRef.current = ler;
  });
  useEffect(() => {
    const atualizar = () => setValor(lerRef.current());
    const id = window.setTimeout(atualizar, 0);
    window.addEventListener("lucia:estudo", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("lucia:estudo", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);
  return [valor, () => setValor(lerRef.current())];
}

// ───────────── Leitor com marca-texto ─────────────

/** Um parágrafo com as marcas pintadas (cada trecho na primeira vez em que aparece; marcas sobrepostas, só a primeira). */
function pintar(texto: string, marcas: Marca[]): ReactNode[] {
  const achados = marcas
    .map((m) => ({ m, i: texto.indexOf(m.trecho) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  const partes: ReactNode[] = [];
  let pos = 0;
  for (const { m, i } of achados) {
    if (i < pos) continue;
    if (i > pos) partes.push(texto.slice(pos, i));
    partes.push(<mark key={m.id} style={{ background: CORES[m.cor], color: "#17130e" }} title={m.nota || undefined}>{m.trecho}</mark>);
    pos = i + m.trecho.length;
  }
  if (pos < texto.length) partes.push(texto.slice(pos));
  return partes;
}

export function Ler({ s, fontes, mudarFonte, paraNotas }: { s: NotebookStrings; fontes: Fonte[]; mudarFonte: (id: string, m: Partial<Fonte>) => void; paraNotas: (t: string) => void }) {
  const [fonteId, setFonteId] = useState(fontes[0]?.id ?? "");
  const [selecao, setSelecao] = useState("");
  const [aviso, setAviso] = useState("");
  const area = useRef<HTMLDivElement>(null);
  const fonte = fontes.find((f) => f.id === fonteId) ?? fontes[0];
  if (!fonte) return null;
  const marcas = fonte.marcas ?? [];
  const blocos = fonte.texto.replace(/```[\s\S]*?```/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  const lerSelecao = () => {
    const sel = window.getSelection();
    const texto = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
    const dentro = sel && sel.rangeCount > 0 && area.current?.contains(sel.getRangeAt(0).commonAncestorContainer);
    setSelecao(dentro && texto.length >= 2 && texto.length <= 1200 ? texto : "");
  };
  const marcar = (cor: Marca["cor"]) => {
    if (!selecao) return;
    mudarFonte(fonte.id, { marcas: [...marcas, { id: novoId(), trecho: selecao, cor, nota: "" }] });
    window.getSelection()?.removeAllRanges();
    setSelecao("");
  };
  const mudarMarca = (id: string, m: Partial<Marca>) => mudarFonte(fonte.id, { marcas: marcas.map((x) => (x.id === id ? { ...x, ...m } : x)) });

  return (
    <div>
      <p className="text-ink-soft">{s.readLead}</p>
      {fontes.length > 1 && (
        <label className="mt-3 block max-w-md">
          <span className="text-xs text-ink-soft">{s.readSource}</span>
          <select value={fonte.id} onChange={(e) => setFonteId(e.target.value)} className={campo}>
            {fontes.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}
          </select>
        </label>
      )}
      <div className="sticky top-0 z-10 mt-3 flex flex-wrap items-center gap-2 border-b border-rule bg-parchment py-2">
        {(["amarelo", "verde", "rosa"] as const).map((cor) => (
          <button key={cor} type="button" disabled={!selecao} onMouseDown={(e) => e.preventDefault()} onClick={() => marcar(cor)} className="cursor-pointer border-2 border-ink px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: CORES[cor], color: "#17130e" }}>
            {cor === "amarelo" ? s.markYellow : cor === "verde" ? s.markGreen : s.markPink}
          </button>
        ))}
        <span className="text-xs text-ink-soft">{selecao ? `“${selecao.slice(0, 80)}${selecao.length > 80 ? "…" : ""}”` : s.selectHint}</span>
      </div>
      <div ref={area} onMouseUp={lerSelecao} onKeyUp={lerSelecao} onTouchEnd={() => window.setTimeout(lerSelecao, 50)} className="mt-3 max-h-[70vh] overflow-y-auto border border-rule bg-parchment-deep p-5 font-serif text-lg leading-relaxed">
        {blocos.map((b, i) => {
          const titulo = /^(#{1,6})\s+(.*)$/.exec(b);
          const texto = limpar(titulo ? titulo[2] : b);
          return titulo ? <h3 key={i} className="mt-5 text-xl font-semibold first:mt-0">{pintar(texto, marcas)}</h3> : <p key={i} className="mt-3 first:mt-0">{pintar(texto, marcas)}</p>;
        })}
      </div>
      <h3 className="mt-6 font-serif text-xl font-semibold">{fill(s.marks, { n: marcas.length })}</h3>
      {marcas.length === 0 ? (
        <p className="mt-2 text-ink-soft">{s.marksEmpty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {marcas.map((m) => (
            <li key={m.id} className="border-l-8 bg-parchment-deep p-3" style={{ borderColor: CORES[m.cor] }}>
              <p className="font-serif">“{m.trecho}”</p>
              <input value={m.nota} onChange={(e) => mudarMarca(m.id, { nota: e.target.value.slice(0, 600) })} placeholder={s.markNote} aria-label={s.markNote} className={`${campo} mt-2`} />
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <button type="button" className={elo} onClick={() => { const n = guardarCartoes([{ frente: m.nota.trim() || `${s.explain} “${m.trecho.slice(0, 140)}${m.trecho.length > 140 ? "…" : ""}”`, verso: m.trecho, origem: fonte.titulo }]); setAviso(fill(s.savedN, { n })); }}>{s.markToCard}</button>
                <button type="button" className={elo} onClick={() => paraNotas(`> ${m.trecho}${m.nota ? `\n\n${m.nota}` : ""}\n\n— ${fonte.titulo}`)}>{s.copyToNotes}</button>
                <button type="button" className={elo} onClick={() => mudarFonte(fonte.id, { marcas: marcas.filter((x) => x.id !== m.id) })}>{s.markRemove}</button>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-2 min-h-5 text-xs text-ok">{aviso}</p>
    </div>
  );
}

// ───────────── Revisão espaçada ─────────────

const diasAte = (dia: string) => Math.round((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${hoje()}T12:00:00Z`)) / 86400000);

export function Revisao({ s }: { s: NotebookStrings }) {
  const [cartoes, recarregar] = useGuardado<CartaoDeRevisao[]>(lerCartoes, []);
  const [virado, setVirado] = useState(false);
  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const fila = paraHoje(cartoes);
  const c = fila[0];
  const notas: [Nota, string][] = [["errei", s.gradeAgain], ["dificil", s.gradeHard], ["bom", s.gradeGood], ["facil", s.gradeEasy]];
  const quando = (n: Nota) => (c ? diasAte(agendar(c, n).proxima) : 0);

  return (
    <div>
      <p className="text-ink-soft">{s.reviewLead}</p>
      <p className="mt-3 font-mono text-xs text-ink-soft">{fill(s.reviewToday, { n: fila.length })} · {fill(s.reviewTotal, { n: cartoes.length })}</p>
      {c ? (
        <>
          <button type="button" onClick={() => setVirado((v) => !v)} className="mt-2 flex min-h-48 w-full cursor-pointer flex-col items-center justify-center border-2 border-ink bg-parchment-deep p-6 text-center hover:border-gold">
            <span className="font-serif text-2xl leading-snug">{virado ? c.verso : c.frente}</span>
            <span className="mt-3 font-mono text-xs uppercase tracking-widest text-ink-soft">{virado ? s.front : s.flip}</span>
          </button>
          <p className="mt-1 font-mono text-[0.65rem] text-ink-soft">{c.origem} · {fill(s.box, { n: c.caixa })}</p>
          {virado && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {notas.map(([n, nome]) => (
                <button key={n} type="button" className={n === "errei" ? claro : botao} onClick={() => { responderCartao(c.id, n); setVirado(false); recarregar(); }}>
                  {nome}
                  <span className="block text-[0.65rem] font-normal opacity-80">{quando(n) <= 0 ? s.nextToday : quando(n) === 1 ? s.nextTomorrow : fill(s.nextIn, { n: quando(n) })}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 border border-rule bg-parchment-deep px-4 py-8 text-center text-ink-soft">{s.reviewNone}</p>
      )}

      <details className="mt-8 border-t border-rule pt-4">
        <summary className="cursor-pointer font-semibold">{s.addCard}</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <textarea value={frente} onChange={(e) => setFrente(e.target.value)} rows={3} placeholder={s.cardFront} aria-label={s.cardFront} className={campo} />
          <textarea value={verso} onChange={(e) => setVerso(e.target.value)} rows={3} placeholder={s.cardBack} aria-label={s.cardBack} className={campo} />
        </div>
        <button type="button" className={`${botao} mt-2`} disabled={!frente.trim() || !verso.trim()} onClick={() => { guardarCartoes([{ frente, verso, origem: s.addCard }]); setFrente(""); setVerso(""); recarregar(); }}>{s.save}</button>
      </details>
      {cartoes.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold">{s.deck} ({cartoes.length})</summary>
          <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto text-xs">
            {[...cartoes].sort((a, b) => a.proxima.localeCompare(b.proxima)).map((x) => (
              <li key={x.id} className="flex items-baseline gap-3 border-b border-rule py-1">
                <span className="min-w-0 flex-1 truncate">{x.frente}</span>
                <span className="font-mono text-ink-soft">{x.proxima}</span>
                <button type="button" className={elo} onClick={() => { apagarCartao(x.id); recarregar(); }}>{s.deleteCard}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ───────────── Caderno de erros ─────────────

export function Erros({ s }: { s: NotebookStrings }) {
  const [erros, recarregar] = useGuardado<Erro[]>(lerErros, []);
  const [refazendo, setRefazendo] = useState<string[] | null>(null);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [retorno, setRetorno] = useState("");
  const [aviso, setAviso] = useState("");

  if (refazendo) {
    const e = erros.find((x) => x.id === refazendo[0]);
    if (!e) {
      return (
        <div>
          <p className="font-serif text-2xl font-semibold">{fill(s.mistakesCount, { n: erros.length })}</p>
          <button type="button" className={`${botao} mt-3`} onClick={() => setRefazendo(null)}>{s.next}</button>
        </div>
      );
    }
    return (
      <div>
        <p className="font-mono text-xs text-ink-soft">{refazendo.length} · {e.origem}</p>
        <p className="mt-2 font-serif text-xl leading-snug">{e.pergunta}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {e.opcoes.map((o, j) => (
            <button key={j} type="button" disabled={escolha !== null} onClick={() => { setEscolha(j); const saiu = refazerErro(e.id, j === e.resposta, j); setRetorno(j === e.resposta ? (saiu ? s.mistakeOut : s.mistakeKeep) : s.wrong); }} className={`cursor-pointer border-2 bg-parchment px-3 py-2 text-left disabled:cursor-default ${escolha === null ? "border-rule hover:border-gold" : j === e.resposta ? "border-ok text-ok" : j === escolha ? "border-oxblood text-oxblood" : "border-rule opacity-60"}`}>
              {o}
            </button>
          ))}
        </div>
        {escolha !== null && (
          <div className="mt-3">
            <p className={`font-semibold ${escolha === e.resposta ? "text-ok" : "text-oxblood"}`}>{retorno}</p>
            {e.explicacao && <p className="mt-1 text-ink-soft">{e.explicacao}</p>}
            <button type="button" className={`${botao} mt-3`} onClick={() => { setEscolha(null); setRetorno(""); setRefazendo(refazendo.slice(1)); recarregar(); }}>{s.next}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-ink-soft">{s.mistakesLead}</p>
      <p className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={botao} disabled={erros.length === 0} onClick={() => setRefazendo([...erros].sort(() => Math.random() - 0.5).map((e) => e.id))}>{s.mistakesRedo}</button>
        <L href="/questoes#simulado" className={claro}>{s.mockExam}</L>
        <span className="font-mono text-xs text-ink-soft">{fill(s.mistakesCount, { n: erros.length })}</span>
      </p>
      {erros.length === 0 ? (
        <p className="mt-4 border border-rule bg-parchment-deep px-4 py-8 text-center text-ink-soft">{s.mistakesEmpty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {erros.map((e) => (
            <li key={e.id} className="border border-rule bg-parchment-deep p-3">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">{e.origem} · {new Date(e.quando).toLocaleDateString()}</p>
              <p className="mt-1 font-serif text-lg">{e.pergunta}</p>
              <p className="mt-1 text-oxblood">✗ {s.yourAnswer}: {e.opcoes[e.escolhida] ?? "—"}</p>
              <p className="text-ok">✓ {s.rightAnswer}: {e.opcoes[e.resposta]}</p>
              {e.explicacao && <p className="mt-1 border-l-4 border-gold pl-2 text-ink-soft">{e.explicacao}</p>}
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {e.href && <L href={e.href} className={elo}>{s.studyAgain}</L>}
                <button type="button" className={elo} onClick={() => { const n = guardarCartoes([{ frente: e.pergunta, verso: `${e.opcoes[e.resposta]}${e.explicacao ? ` — ${e.explicacao}` : ""}`, origem: e.origem }]); setAviso(fill(s.savedN, { n })); }}>{s.mistakeToCard}</button>
                <button type="button" className={elo} onClick={() => { apagarErro(e.id); recarregar(); }}>{s.deleteCard}</button>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-2 min-h-5 text-xs text-ok">{aviso}</p>
    </div>
  );
}

// ───────────── Cópia de segurança ─────────────

export function CopiaDeSeguranca({ s }: { s: NotebookStrings }) {
  const [aviso, setAviso] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <section className="border-2 border-ink bg-parchment-deep p-3">
      <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.backup}</p>
      <p className="mt-1 text-xs text-ink-soft">{s.backupLead}</p>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <button
          type="button"
          className={elo}
          onClick={() => {
            const copia = montarCopia(window.localStorage);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([JSON.stringify(copia)], { type: "application/json" }));
            a.download = `instituto-lucia-copia-${hoje()}.json`;
            a.click();
            window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          }}
        >
          {s.backupExport}
        </button>
        <button type="button" className={elo} onClick={() => arquivo.current?.click()}>{s.backupImport}</button>
        <input
          ref={arquivo}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const copia = f.size < 20_000_000 ? lerCopia(await f.text()) : null;
            if (!copia) return setAviso(s.backupInvalid);
            if (!window.confirm(s.backupConfirm)) return;
            setAviso(fill(s.backupDone, { n: restaurarCopia(copia, window.localStorage) }));
            window.dispatchEvent(new Event("lucia:estudo"));
          }}
        />
      </p>
      <p role="status" className="mt-1 min-h-4 text-xs text-ok">{aviso}</p>
    </section>
  );
}
