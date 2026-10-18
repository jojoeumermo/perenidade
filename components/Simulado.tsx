// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { lerErros, refazerErro, registrarErro } from "@/lib/estudo";
import type { QuestaoDoBanco } from "./BancoDeQuestoes";
import { L, useI18n } from "./I18n";

const QUANTIDADES = [10, 20, 30, 45, 90];
const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";

type Fase = { tipo: "escolha" } | { tipo: "prova"; questoes: QuestaoDoBanco[]; fim: number | null } | { tipo: "fim"; questoes: QuestaoDoBanco[]; respostas: Record<string, number>; tempoAcabou: boolean };

const relogio = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Simulado: questões sorteadas do banco, com relógio opcional. No fim, a nota por disciplina e a correção comentada;
 * cada questão errada (ou em branco) vai para o caderno de erros, e cada acerto conta para tirar de lá a que já estava.
 */
export function Simulado({ questoes, nome }: { questoes: QuestaoDoBanco[]; nome: (slug: string) => string }) {
  const { t } = useI18n();
  const s = t.lists;
  const [area, setArea] = useState("");
  const [quantas, setQuantas] = useState(20);
  const [minutos, setMinutos] = useState(40);
  const [fase, setFase] = useState<Fase>({ tipo: "escolha" });
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const respostasRef = useRef(respostas);
  const [agora, setAgora] = useState(0);
  const areas = [...new Set(questoes.map((q) => q.area))].sort((a, b) => nome(a).localeCompare(nome(b)));
  const base = questoes.filter((q) => !area || q.area === area);

  const entregar = (lista: QuestaoDoBanco[], tempoAcabou: boolean) => {
    const r = respostasRef.current;
    const erradas = new Set(lerErros().map((e) => e.id));
    for (const q of lista) {
      const escolhida = r[q.id];
      if (escolhida === q.resposta) {
        if (erradas.has(q.id)) refazerErro(q.id, true, escolhida);
      } else {
        registrarErro({ id: q.id, pergunta: q.pergunta, opcoes: q.opcoes, resposta: q.resposta, escolhida: escolhida ?? -1, explicacao: q.explicacao, href: q.href, origem: "simulado" });
      }
    }
    setFase({ tipo: "fim", questoes: lista, respostas: r, tempoAcabou });
    window.scrollTo({ top: document.getElementById("simulado")?.offsetTop ?? 0, behavior: "smooth" });
  };

  // O relógio: a cada segundo; quando o tempo acaba, o simulado é entregue como está.
  const fim = fase.tipo === "prova" ? fase.fim : null;
  const emProva = fase.tipo === "prova" ? fase.questoes : null;
  useEffect(() => {
    if (!fim || !emProva) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setAgora(t);
      if (t >= fim) {
        window.clearInterval(id);
        entregar(emProva, true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [fim, emProva]);

  const responder = (id: string, j: number) => {
    const novas = { ...respostasRef.current, [id]: j };
    respostasRef.current = novas;
    setRespostas(novas);
  };

  if (fase.tipo === "escolha") {
    return (
      <section id="simulado" className="mt-8 border-2 border-ink bg-parchment-deep p-4 font-sans text-sm">
        <h2 className="font-serif text-2xl font-semibold">{s.mockTitle}</h2>
        <p className="mt-1 text-ink-soft">{s.mockLead}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="block">{t.nav.disciplines}<select value={area} onChange={(e) => setArea(e.target.value)} className={campo}><option value="">{t.lists.anySubject}</option>{areas.map((a) => <option key={a} value={a}>{nome(a)} ({questoes.filter((q) => q.area === a).length})</option>)}</select></label>
          <label className="block">{s.mockQuestions}<select value={quantas} onChange={(e) => setQuantas(Number(e.target.value))} className={campo}>{QUANTIDADES.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="block">{s.mockTime}<input type="number" min={0} max={300} value={minutos} onChange={(e) => setMinutos(Math.max(0, Math.min(300, Number(e.target.value) || 0)))} className={campo} /></label>
          <button
            type="button"
            disabled={base.length < 5}
            className="self-end cursor-pointer bg-ink px-4 py-2.5 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              const sorteadas = [...base].sort(() => Math.random() - 0.5).slice(0, quantas);
              respostasRef.current = {};
              setRespostas({});
              setAgora(Date.now());
              setFase({ tipo: "prova", questoes: sorteadas, fim: minutos > 0 ? Date.now() + minutos * 60_000 : null });
            }}
          >
            {s.mockStart}
          </button>
        </div>
        {base.length < 5 && <p className="mt-2 text-oxblood">{s.mockNotEnough}</p>}
      </section>
    );
  }

  if (fase.tipo === "prova") {
    const feitas = Object.keys(respostas).length;
    return (
      <section id="simulado" className="mt-8 font-sans text-sm">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-2 border-ink bg-parchment px-4 py-2">
          <strong className="font-serif text-lg">{s.mockTitle}</strong>
          <span role="status" className="font-mono text-xs">{fill(s.mockAnswered, { a: feitas, b: fase.questoes.length })}</span>
          {fase.fim && <span className={`font-mono text-sm ${fase.fim - agora < 60_000 ? "text-oxblood" : ""}`} aria-live="off">{fill(s.mockLeft, { t: relogio(fase.fim - agora) })}</span>}
          <button type="button" className="ml-auto cursor-pointer bg-ink px-4 py-1.5 font-semibold text-parchment hover:bg-oxblood" onClick={() => entregar(fase.questoes, false)}>{s.mockFinish}</button>
        </div>
        <ol className="mt-4 space-y-5">
          {fase.questoes.map((q, i) => (
            <li key={q.id} className="border border-rule bg-parchment-deep p-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">{nome(q.area)}</p>
              <fieldset>
                <legend className="mt-1 font-serif text-lg">{i + 1}. {q.pergunta}</legend>
                <div className="mt-2 space-y-1">
                  {q.opcoes.map((o, j) => (
                    <label key={j} className={`flex cursor-pointer items-start gap-2 border px-3 py-1.5 ${respostas[q.id] === j ? "border-ink bg-parchment" : "border-rule"}`}>
                      <input type="radio" name={`sim-${q.id}`} checked={respostas[q.id] === j} onChange={() => responder(q.id, j)} className="mt-1" />
                      <span>{String.fromCharCode(97 + j)}) {o}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-right"><button type="button" className="cursor-pointer bg-ink px-6 py-2.5 font-semibold text-parchment hover:bg-oxblood" onClick={() => entregar(fase.questoes, false)}>{s.mockFinish}</button></p>
      </section>
    );
  }

  const certas = fase.questoes.filter((q) => fase.respostas[q.id] === q.resposta).length;
  const porArea = [...new Set(fase.questoes.map((q) => q.area))].map((a) => {
    const da = fase.questoes.filter((q) => q.area === a);
    return { a, total: da.length, certas: da.filter((q) => fase.respostas[q.id] === q.resposta).length };
  });
  return (
    <section id="simulado" className="mt-8 border-2 border-ink bg-parchment-deep p-4 font-sans text-sm">
      {fase.tempoAcabou && <p className="mb-2 font-semibold text-oxblood">{s.mockTimeUp}</p>}
      <p className="font-serif text-3xl font-semibold">{fill(s.mockResult, { a: certas, b: fase.questoes.length })}</p>
      <h3 className="mt-4 font-semibold">{s.mockByArea}</h3>
      <ul className="mt-2 space-y-1">
        {porArea.map(({ a, total, certas: c }) => (
          <li key={a} className="flex items-center gap-3">
            <span className="w-48 truncate">{nome(a)}</span>
            <span className="h-2 flex-1 bg-rule" aria-hidden><span className="block h-2 bg-ok" style={{ width: `${(100 * c) / total}%` }} /></span>
            <span className="w-14 text-right font-mono text-xs">{c}/{total}</span>
          </li>
        ))}
      </ul>
      {certas < fase.questoes.length && <p className="mt-3 text-ink-soft">{s.mockToErrors} <L href="/caderno?ferramenta=erros" className="underline hover:text-oxblood">{s.mockOpenErrors}</L></p>}
      <p className="mt-3"><button type="button" className="cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood" onClick={() => setFase({ tipo: "escolha" })}>{s.mockAgain}</button></p>
      <details className="mt-4" open={fase.questoes.length <= 20}>
        <summary className="cursor-pointer font-semibold">{s.mockReview}</summary>
        <ol className="mt-3 space-y-4">
          {fase.questoes.map((q, i) => {
            const r = fase.respostas[q.id];
            return (
              <li key={q.id} className={`border-l-4 p-3 ${r === q.resposta ? "border-ok" : "border-oxblood"} bg-parchment`}>
                <p className="font-serif text-lg">{i + 1}. {q.pergunta}</p>
                {r !== q.resposta && <p className="mt-1 text-oxblood">✗ {r === undefined ? s.mockSkipped : q.opcoes[r]}</p>}
                <p className="text-ok">✓ {q.opcoes[q.resposta]}</p>
                {q.explicacao && <p className="mt-1 text-ink-soft">{q.explicacao}</p>}
                <L href={q.href} className="mt-1 inline-block text-xs underline hover:text-oxblood">{t.lists.bankLesson}: {q.aula}</L>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
