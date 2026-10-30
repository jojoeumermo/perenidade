// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import { lerErros, refazerErro, registrarErro } from "@/lib/estudo";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { useI18n } from "../I18n";
import { carregarProva, LETRAS, type QuestaoOficial } from "./dados";
import { CorrecaoDaQuestao, TextoDaQuestao } from "./Questao";

type S = TextosDoEstudo["enem"];
const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const botao = "cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";


/**
 * Prática com as questões oficiais classificadas pelo instituto: filtro por área, habilidade, conteúdo (objeto),
 * dificuldade e ano; uma questão por vez, corrigida na hora, com a resolução e o engano da alternativa marcada.
 * Errou: a questão vai para o caderno de erros (e volta na revisão). Acertou uma que estava lá: conta para tirá-la.
 */
export function PraticaOficial({ anos, areas, objetos, habilidades, s }: { anos: number[]; areas: Record<string, string>; objetos: Record<string, { id: string; nome: string }[]>; habilidades: Record<string, string>; s: S }) {
  const { lang } = useI18n();
  const p = s.praticar;
  const [todas, setTodas] = useState<QuestaoOficial[] | null>(null);
  const [erro, setErro] = useState(false);
  const [area, setArea] = useState("");
  const [habilidade, setHabilidade] = useState("");
  const [objeto, setObjeto] = useState("");
  /** Questões pedidas pelo endereço (?q=enem-2023-136,enem-2022-140), como faz o fim das aulas. */
  const [ids, setIds] = useState<string[]>([]);

  // O filtro pode vir no endereço (?area=matematica&habilidade=3, ?objeto=…, ?q=…): a página é estática, então lê aqui.
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o endereço só existe no navegador (a página é estática)
    setArea(u.get("area") ?? "");
    setHabilidade(u.get("habilidade") ?? "");
    setObjeto(u.get("objeto") ?? "");
    setIds((u.get("q") ?? "").split(",").filter(Boolean));
  }, []);
  const [dificuldade, setDificuldade] = useState("");
  const [ano, setAno] = useState("");
  const [fila, setFila] = useState<QuestaoOficial[] | null>(null);
  const [i, setI] = useState(0);
  const [escolhida, setEscolhida] = useState<number | undefined>(undefined);
  const [certas, setCertas] = useState(0);

  useEffect(() => {
    let vivo = true;
    Promise.all(anos.map((a) => carregarProva(a, lang)))
      .then((listas) => vivo && setTodas(listas.flat().filter((q) => q.camada)))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [anos, lang]);

  const filtradas = useMemo(
    () =>
      (todas ?? []).filter((q) => {
        const c = q.camada!;
        if (ids.length && !ids.includes(q.id)) return false;
        return (!area || c.area === area) && (!habilidade || String(c.habilidade) === habilidade) && (!objeto || c.objeto === objeto) && (!dificuldade || String(c.dificuldade) === dificuldade) && (!ano || String(c.ano) === ano);
      }),
    [todas, area, habilidade, objeto, dificuldade, ano, ids],
  );

  if (erro) return <p className="mt-6 font-sans text-oxblood">{s.provas.erroCarregar}</p>;
  if (!todas) return <p className="mt-6 font-sans text-ink-soft" role="status">{s.provas.carregando}</p>;

  if (!fila) {
    const habs = area ? Array.from({ length: 30 }, (_, k) => String(k + 1)) : [];
    return (
      <section className="mt-8 border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            {p.area}
            <select value={area} onChange={(e) => (setArea(e.target.value), setHabilidade(""), setObjeto(""))} className={campo}>
              <option value="">{p.todas}</option>
              {Object.entries(areas).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </label>
          <label className="block">
            {p.habilidade}
            <select value={habilidade} onChange={(e) => setHabilidade(e.target.value)} className={campo} disabled={!area}>
              <option value="">{p.todas}</option>
              {habs.map((h) => <option key={h} value={h}>H{h}: {habilidades[`${area}-${h}`]}</option>)}
            </select>
          </label>
          <label className="block">
            {p.objeto}
            <select value={objeto} onChange={(e) => setObjeto(e.target.value)} className={campo} disabled={!area}>
              <option value="">{p.todos}</option>
              {(objetos[area] ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </label>
          <label className="block">
            {p.dificuldade}
            <select value={dificuldade} onChange={(e) => setDificuldade(e.target.value)} className={campo}>
              <option value="">{p.todas}</option>
              {["1", "2", "3"].map((d) => <option key={d} value={d}>{fill(s.provas.nivel, { n: d })}</option>)}
            </select>
          </label>
          <label className="block">
            {p.anoFiltro}
            <select value={ano} onChange={(e) => setAno(e.target.value)} className={campo}>
              <option value="">{p.todos}</option>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-4" role="status">{filtradas.length ? fill(p.disponiveis, { n: filtradas.length }) : p.nenhuma}</p>
        <p className="mt-3">
          <button
            type="button"
            className={botao}
            disabled={!filtradas.length}
            onClick={() => {
              setFila([...filtradas].sort(() => Math.random() - 0.5).slice(0, 20));
              setI(0);
              setEscolhida(undefined);
              setCertas(0);
            }}
          >
            {p.comecar}
          </button>
        </p>
      </section>
    );
  }

  if (i >= fila.length)
    return (
      <section className="mt-8 border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
        <p className="font-serif text-2xl">{fill(p.fim, { n: fila.length, a: certas })}</p>
        <p className="mt-4">
          <button type="button" className={botao} onClick={() => (setFila(null), setIds([]))}>{p.recomecar}</button>
        </p>
      </section>
    );

  const q = fila[i];
  const respondeu = escolhida !== undefined;
  const responder = (j: number) => {
    if (respondeu) return;
    setEscolhida(j);
    if (j === q.resposta) {
      setCertas((c) => c + 1);
      if (lerErros().some((e) => e.id === q.id)) refazerErro(q.id, true, j);
    } else {
      registrarErro({ id: q.id, pergunta: `Enem ${q.camada!.ano}, questão ${q.n}: ${q.enunciado}`, opcoes: q.alternativas, resposta: q.resposta, escolhida: j, explicacao: q.camada!.resolucao, href: q.camada!.aulas[0]?.href ?? "/enem/praticar", origem: "banco" });
    }
  };
  return (
    <section className="mt-8 border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
      <p className="font-mono text-xs text-ink-soft">
        {fill(p.posicao, { i: i + 1, n: fila.length })} · {areas[q.camada!.area]} · H{q.camada!.habilidade} · {q.camada!.topicoNome ?? q.camada!.objetoNome} · {fill(s.provas.nivel, { n: q.camada!.dificuldade })}
      </p>
      <div className="mt-3">
        <TextoDaQuestao q={q} s={s.provas} titulo={fill(p.origem, { ano: q.camada!.ano, n: q.n })} />
      </div>
      <div className="mt-4 space-y-2" role="group" aria-label={fill(p.posicao, { i: i + 1, n: fila.length })}>
        {q.alternativas.map((alt, j) => {
          const estado = respondeu && j === q.resposta ? "border-ok text-ok" : respondeu && j === escolhida ? "border-oxblood text-oxblood" : "border-rule hover:border-gold";
          return (
            <button key={j} type="button" disabled={respondeu} onClick={() => responder(j)} className={`block w-full cursor-pointer border-2 bg-parchment px-4 py-2 text-left disabled:cursor-default ${estado}`}>
              <strong className="font-mono">{LETRAS[j]})</strong> {alt || "—"}
            </button>
          );
        })}
      </div>
      {respondeu && (
        <>
          <p className={`mt-3 font-semibold ${escolhida === q.resposta ? "text-ok" : "text-oxblood"}`} role="status">{escolhida === q.resposta ? p.certo : p.errado}</p>
          <CorrecaoDaQuestao q={q} escolhida={escolhida} s={s.provas} />
          <p className="mt-2 text-xs text-ink-soft">{p.classificacao}</p>
          <p className="mt-4">
            <button type="button" className={botao} onClick={() => (setI(i + 1), setEscolhida(undefined))}>{i + 1 < fila.length ? p.proxima : p.terminar}</button>
          </p>
        </>
      )}
      {!respondeu && (
        <p className="mt-4">
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setEscolhida(-1)}>{p.verResolucao}</button>
        </p>
      )}
    </section>
  );
}
