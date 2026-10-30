// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { type Placar, registrarProva, relogio, somar } from "@/lib/enem-aparelho";
import { lerErros, refazerErro, registrarErro } from "@/lib/estudo";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L, useI18n } from "../I18n";
import { carregarProva, doDia, LETRAS, type QuestaoOficial } from "./dados";
import { CorrecaoDaQuestao, TextoDaQuestao } from "./Questao";

type S = TextosDoEstudo["enem"];
type Fase = { tipo: "escolha" } | { tipo: "prova"; questoes: QuestaoOficial[]; fim: number | null; inicio: number } | { tipo: "fim"; questoes: QuestaoOficial[]; respostas: Record<string, number>; tempoAcabou: boolean; segundos: number };

const botao = "cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Uma prova oficial do Enem, de um dia, como foi aplicada: uma questão por vez, folha de respostas para pular entre
 * elas, relógio no tempo oficial (opcional) e correção só no fim. O resultado (acertos por área, habilidade e
 * dificuldade, e o tempo em cada questão) fica no aparelho; as erradas e em branco vão para o caderno de erros.
 * Não há nota TRI: só acertos.
 */
export function ProvaOficial({ ano, dia, minutosOficiais, habilidades, areas, s }: { ano: number; dia: 1 | 2; minutosOficiais: number; habilidades: Record<string, string>; areas: Record<string, string>; s: S }) {
  const { lang } = useI18n();
  const p = s.provas;
  const [todas, setTodas] = useState<QuestaoOficial[] | null>(null);
  const [erro, setErro] = useState(false);
  const [lingua, setLingua] = useState("ingles");
  const [comRelogio, setComRelogio] = useState(true);
  const [fase, setFase] = useState<Fase>({ tipo: "escolha" });
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const respostasRef = useRef(respostas);
  const [atual, setAtual] = useState(0);
  const [agora, setAgora] = useState(0);
  const tempos = useRef<Record<string, number>>({});
  const desde = useRef(0);

  useEffect(() => {
    let vivo = true;
    carregarProva(ano, lang)
      .then((q) => vivo && setTodas(q))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [ano, lang]);

  const linguas = useMemo(() => [...new Set((todas ?? []).filter((q) => q.dia === dia && q.lingua).map((q) => q.lingua))], [todas, dia]);
  // Se a prova só tem uma das línguas (a fonte de algumas edições não traz o inglês), vale a que existe.
  const linguaDaProva = linguas.includes(lingua) ? lingua : (linguas[0] ?? lingua);
  const doDiaEscolhido = useMemo(() => (todas ? doDia(todas, dia, linguaDaProva) : []), [todas, dia, linguaDaProva]);

  /** Soma ao tempo da questão aberta o que passou desde que ela apareceu. */
  const contarTempo = (id: string | undefined) => {
    if (!id) return;
    const t = Date.now();
    tempos.current[id] = (tempos.current[id] ?? 0) + (t - desde.current) / 1000;
    desde.current = t;
  };

  const entregar = (questoes: QuestaoOficial[], inicio: number, tempoAcabou: boolean) => {
    contarTempo(questoes[atualRef.current]?.id);
    const r = respostasRef.current;
    const erradas = new Set(lerErros().map((e) => e.id));
    const porArea: Record<string, Placar> = {};
    const porHabilidade: Record<string, Placar> = {};
    const porDificuldade: Record<string, Placar> = {};
    let acertos = 0;
    for (const q of questoes) {
      const certo = r[q.id] === q.resposta;
      if (certo) acertos++;
      somar(porArea, q.areaAuditada, certo);
      if (q.camada) {
        somar(porHabilidade, `${q.camada.area}-${q.camada.habilidade}`, certo);
        somar(porDificuldade, String(q.camada.dificuldade), certo);
      }
      const href = q.camada?.aulas[0]?.href ?? `/enem/provas/${ano}/${dia}`;
      if (certo) {
        if (erradas.has(q.id)) refazerErro(q.id, true, r[q.id]);
      } else {
        registrarErro({ id: q.id, pergunta: `Enem ${ano}, questão ${q.n}: ${q.enunciado}`, opcoes: q.alternativas, resposta: q.resposta, escolhida: r[q.id] ?? -1, explicacao: q.camada?.resolucao, href, origem: "simulado" });
      }
    }
    const segundos = (Date.now() - inicio) / 1000;
    registrarProva({ id: `oficial-${ano}-${dia}${linguas.length ? `-${linguaDaProva}` : ""}`, titulo: `Enem ${ano}, ${dia}º dia`, quando: Date.now(), acertos, total: questoes.length, porArea, porHabilidade, porDificuldade, segundos: Math.round(segundos) }, Object.fromEntries(Object.entries(tempos.current).map(([k, v]) => [k, Math.round(v)])));
    setFase({ tipo: "fim", questoes, respostas: r, tempoAcabou, segundos });
    window.scrollTo({ top: document.getElementById("prova")?.offsetTop ?? 0, behavior: "smooth" });
  };

  const atualRef = useRef(atual);
  useEffect(() => {
    atualRef.current = atual;
  }, [atual]);
  const fim = fase.tipo === "prova" ? fase.fim : null;
  const emProva = fase.tipo === "prova" ? fase : null;
  useEffect(() => {
    if (!emProva) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setAgora(t);
      if (fim && t >= fim) {
        window.clearInterval(id);
        entregar(emProva.questoes, emProva.inicio, true);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o relógio só reinicia quando a prova muda
  }, [emProva, fim]);

  const irPara = (i: number, questoes: QuestaoOficial[]) => {
    contarTempo(questoes[atual]?.id);
    setAtual(Math.max(0, Math.min(questoes.length - 1, i)));
    document.getElementById("questao-atual")?.focus();
  };

  if (erro) return <p className="mt-6 font-sans text-oxblood">{p.erroCarregar}</p>;
  if (!todas) return <p className="mt-6 font-sans text-ink-soft" role="status">{p.carregando}</p>;

  if (fase.tipo === "escolha") {
    const comResolucao = doDiaEscolhido.filter((q) => q.camada).length;
    return (
      <section id="prova" className="mt-8 border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
        <p>
          {fill(p.questoes, { n: doDiaEscolhido.length })} · {fill(p.comResolucao, { n: comResolucao })}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {linguas.length > 1 && (
            <fieldset>
              <legend className="font-semibold">{p.lingua}</legend>
              {linguas.map((l) => (
                <label key={l} className="mr-4 inline-flex items-center gap-2">
                  <input type="radio" name="lingua" checked={linguaDaProva === l} onChange={() => setLingua(l)} /> {l === "ingles" ? p.ingles : p.espanhol}
                </label>
              ))}
            </fieldset>
          )}
          <fieldset>
            <legend className="font-semibold">{p.tempo}</legend>
            <label className="mr-4 inline-flex items-center gap-2">
              <input type="radio" name="relogio" checked={comRelogio} onChange={() => setComRelogio(true)} /> {fill(p.tempoOficial, { n: dia, t: relogio(minutosOficiais * 60) })}
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="relogio" checked={!comRelogio} onChange={() => setComRelogio(false)} /> {p.semRelogio}
            </label>
            {dia === 1 && <p className="mt-1 text-ink-soft">{p.redacaoNoTempo}</p>}
          </fieldset>
        </div>
        <p className="mt-5">
          <button
            type="button"
            className={botao}
            disabled={doDiaEscolhido.length === 0}
            onClick={() => {
              const inicio = Date.now();
              respostasRef.current = {};
              setRespostas({});
              tempos.current = {};
              desde.current = inicio;
              setAtual(0);
              setAgora(inicio);
              setFase({ tipo: "prova", questoes: doDiaEscolhido, inicio, fim: comRelogio ? inicio + minutosOficiais * 60_000 : null });
            }}
          >
            {p.comecar}
          </button>
        </p>
      </section>
    );
  }

  if (fase.tipo === "prova") {
    const qs = fase.questoes;
    const q = qs[atual];
    const marcadas = Object.keys(respostas).length;
    return (
      <section id="prova" className="mt-8 font-sans text-sm">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-2 border-ink bg-parchment px-4 py-2">
          <span role="status" className="font-mono text-xs">{fill(p.respondidas, { a: marcadas, b: qs.length })}</span>
          {fase.fim && <span className={`font-mono text-sm ${fase.fim - agora < 300_000 ? "text-oxblood" : ""}`}>{fill(p.restam, { t: relogio((fase.fim - agora) / 1000) })}</span>}
          <button
            type="button"
            className={`ml-auto ${botao}`}
            onClick={() => {
              const brancas = qs.length - Object.keys(respostasRef.current).length;
              if (brancas > 0 && !window.confirm(fill(p.confirmarEntrega, { n: brancas }))) return;
              entregar(qs, fase.inicio, false);
            }}
          >
            {p.entregar}
          </button>
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <article id="questao-atual" tabIndex={-1} className="border border-rule bg-parchment-deep p-5 outline-none" aria-label={fill(p.questao, { n: q.n })}>
            <TextoDaQuestao q={q} s={p} titulo={`${fill(p.questao, { n: q.n })} · ${areas[q.areaAuditada] ?? q.areaAuditada}`} />
            <fieldset className="mt-4">
              <legend className="sr-only">{fill(p.questao, { n: q.n })}</legend>
              <div className="space-y-2">
                {q.alternativas.map((alt, j) => (
                  <label key={j} className={`flex cursor-pointer items-start gap-2 border px-3 py-2 ${respostas[q.id] === j ? "border-ink bg-parchment" : "border-rule"}`}>
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      className="mt-1"
                      checked={respostas[q.id] === j}
                      onChange={() => {
                        const novas = { ...respostasRef.current, [q.id]: j };
                        respostasRef.current = novas;
                        setRespostas(novas);
                      }}
                    />
                    <span>
                      <strong className="font-mono">{LETRAS[j]})</strong> {alt || "—"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mt-4 flex gap-3">
              <button type="button" className={claro} disabled={atual === 0} onClick={() => irPara(atual - 1, qs)}>← {p.anterior}</button>
              <button type="button" className={claro} disabled={atual === qs.length - 1} onClick={() => irPara(atual + 1, qs)}>{p.proxima} →</button>
            </p>
          </article>
          <nav aria-label={p.folha} className="border border-rule bg-parchment p-3">
            <p className="font-semibold">{p.folha}</p>
            <ol className="mt-2 grid grid-cols-5 gap-1">
              {qs.map((x, i) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => irPara(i, qs)}
                    aria-current={i === atual ? "true" : undefined}
                    aria-label={`${fill(p.questao, { n: x.n })}${respostas[x.id] !== undefined ? `: ${LETRAS[respostas[x.id]]}` : ""}`}
                    className={`w-full cursor-pointer border px-1 py-1 font-mono text-xs ${i === atual ? "border-ink border-2" : "border-rule"} ${respostas[x.id] !== undefined ? "bg-ink text-parchment" : "bg-parchment"}`}
                  >
                    {x.n}
                    {respostas[x.id] !== undefined ? LETRAS[respostas[x.id]] : ""}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>
    );
  }

  // Fim: o relatório e a correção comentada.
  const { questoes, respostas: r } = fase;
  const acertos = questoes.filter((q) => r[q.id] === q.resposta).length;
  const tabela = (mapa: Record<string, Placar>, nome: (k: string) => string) =>
    Object.entries(mapa)
      .sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1])
      .map(([k, [a, t]]) => (
        <li key={k} className="flex items-center gap-3">
          <span className="min-w-0 flex-1">{nome(k)}</span>
          <span className="h-2 w-24 shrink-0 bg-rule" aria-hidden>
            <span className="block h-2 bg-ok" style={{ width: `${(100 * a) / t}%` }} />
          </span>
          <span className="w-12 text-right font-mono text-xs">{a}/{t}</span>
        </li>
      ));
  const contas = { area: {} as Record<string, Placar>, hab: {} as Record<string, Placar>, dif: {} as Record<string, Placar> };
  for (const q of questoes) {
    const certo = r[q.id] === q.resposta;
    somar(contas.area, q.areaAuditada, certo);
    if (q.camada) {
      somar(contas.hab, `${q.camada.area}-${q.camada.habilidade}`, certo);
      somar(contas.dif, String(q.camada.dificuldade), certo);
    }
  }
  const nomeHab = (k: string) => {
    const [a, h] = k.split("-");
    return `${areas[a] ?? a}, H${h}: ${habilidades[k] ?? ""}`;
  };
  return (
    <section id="prova" className="mt-8 font-sans text-sm">
      <div className="border-2 border-ink bg-parchment-deep p-5">
        {fase.tempoAcabou && <p className="mb-2 font-semibold text-oxblood">{p.tempoAcabou}</p>}
        <h2 className="font-serif text-3xl font-semibold">{p.relatorio}</h2>
        <p className="mt-1 font-serif text-2xl">{fill(p.acertos, { a: acertos, b: questoes.length })}</p>
        <p className="mt-1 text-ink-soft">
          {fill(p.tempoTotal, { t: relogio(fase.segundos) })} · {fill(p.tempoMedio, { t: relogio(fase.segundos / Math.max(1, questoes.length)) })}
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">{p.porArea}</h3>
            <ul className="mt-2 space-y-1">{tabela(contas.area, (k) => areas[k] ?? k)}</ul>
            <h3 className="mt-4 font-semibold">{p.porDificuldade}</h3>
            <ul className="mt-2 space-y-1">{tabela(contas.dif, (k) => fill(p.nivel, { n: k }))}</ul>
          </div>
          <div>
            <h3 className="font-semibold">{p.porHabilidade}</h3>
            <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto pr-2">{tabela(contas.hab, nomeHab)}</ul>
          </div>
        </div>
        {acertos < questoes.length && (
          <p className="mt-4 text-ink-soft">
            {p.erradasNoCaderno} <L href="/caderno?ferramenta=erros" className="underline hover:text-oxblood">→</L>
          </p>
        )}
        <p className="mt-4">
          <button type="button" className={botao} onClick={() => setFase({ tipo: "escolha" })}>{p.refazer}</button>
        </p>
      </div>
      <h3 className="mt-8 font-serif text-2xl font-semibold">{p.correcao}</h3>
      <ol className="mt-4 space-y-5">
        {questoes.map((q) => (
          <li key={q.id} className={`border-2 bg-parchment-deep p-4 ${r[q.id] === q.resposta ? "border-ok" : "border-oxblood"}`}>
            <TextoDaQuestao q={q} s={p} titulo={`${fill(p.questao, { n: q.n })} · ${areas[q.areaAuditada] ?? q.areaAuditada}`} />
            <CorrecaoDaQuestao q={q} escolhida={r[q.id]} s={p} praticar={q.camada ? `/enem/praticar?area=${q.camada.area}&habilidade=${q.camada.habilidade}` : undefined} />
          </li>
        ))}
      </ol>
    </section>
  );
}
