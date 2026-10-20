// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { can, hasBackend, rpc, useMe } from "@/lib/backend";
import { idDaQuestao, registrarErro } from "@/lib/estudo";
import { normalize } from "@/lib/text";
import { useI18n } from "./I18n";
import { Markdown } from "./Markdown";

type S = Dict["lists"];
interface Prova {
  ano: number;
  titulo: string;
  arquivo: string;
  total: number;
  porArea?: Record<string, number>;
}
interface Indice {
  atualizado: string;
  fontes: { id: string; nome: string; origem: string; provas: Prova[] }[];
}
interface Questao {
  id: string;
  n: number;
  area: string;
  lingua: string;
  contexto: string;
  imagens: string[];
  enunciado: string;
  alternativas: string[];
  resposta: number;
}
interface Resolucao {
  id: string;
  questao: string;
  texto: string;
  autor: string;
  minha: boolean;
}

const POR_PAGINA = 10;
const LETRAS = "ABCDE";
const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";

/**
 * As provas públicas no banco de questões: o ENEM inteiro, os vestibulares da Unicamp e da Fuvest e o Exame da OAB, trazidos
 * toda semana das fontes abertas (scripts/importar-questoes.mjs).
 * O site baixa só a prova aberta; as imagens das questões ficam na fonte e abrem só se a pessoa pedir. As resoluções
 * comentadas são escritas pelos educadores do instituto.
 */
export function ProvasPublicas({ s }: { s: S }) {
  const { lang } = useI18n();
  const eu = useMe();
  const educa = eu.status === "in" && can(eu.me, "educacao", "educacao_secundaria", "coordenacao", "revisao", "supervisao");
  const [indice, setIndice] = useState<Indice | null>(null);
  const [fonteId, setFonteId] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [questoes, setQuestoes] = useState<Questao[] | null>(null);
  const [area, setArea] = useState("");
  const [lingua, setLingua] = useState("ingles");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [gabaritos, setGabaritos] = useState<Record<string, boolean>>({});
  const [resolucoes, setResolucoes] = useState<Resolucao[]>([]);
  const [escrevendo, setEscrevendo] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/questoes/indice.json")
      .then((r) => (r.ok ? (r.json() as Promise<Indice>) : null))
      .then((dados) => {
        if (!vivo || !dados) return;
        setIndice(dados);
        setFonteId(dados.fontes[0]?.id ?? "");
        setArquivo(dados.fontes[0]?.provas[0]?.arquivo ?? "");
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!arquivo) return;
    let vivo = true;
    void Promise.resolve().then(() => vivo && setQuestoes(null));
    fetch(`/questoes/${arquivo}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ questoes: Questao[] }>) : { questoes: [] }))
      .then((dados) => vivo && setQuestoes(dados.questoes))
      .catch(() => vivo && setQuestoes([]));
    return () => {
      vivo = false;
    };
  }, [arquivo]);

  const n = normalize(termo.trim());
  const filtradas = useMemo(
    () => (questoes ?? []).filter((q) => (!area || q.area === area) && (!q.lingua || q.lingua === lingua) && (!n || normalize(`${q.contexto} ${q.enunciado} ${q.alternativas.join(" ")}`).includes(n))),
    [questoes, area, lingua, n],
  );
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas - 1);
  const vistas = filtradas.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);
  const chave = vistas.map((q) => q.id).join(",");

  useEffect(() => {
    if (!hasBackend || !chave) return;
    let vivo = true;
    rpc<Resolucao[]>("resolucoes_listar", { p_questoes: chave.split(",") })
      .then((r) => vivo && setResolucoes(r))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [chave]);

  if (!indice) return null;
  const fonte = indice.fontes.find((f) => f.id === fonteId) ?? indice.fontes[0];
  const presentes = new Set(fonte.provas.flatMap((p) => Object.keys(p.porArea ?? {})));
  const todasAsAreas: [string, string][] = [["linguagens", s.publicAreas.linguagens], ["humanas", s.publicAreas.humanas], ["natureza", s.publicAreas.natureza], ["matematica", s.publicAreas.matematica], ["direito", s.publicAreas.direito], ["saude", s.publicAreas.saude]];
  const areas: [string, string][] = [["", s.publicAllAreas], ...todasAsAreas.filter(([id]) => presentes.size === 0 || presentes.has(id))];
  const total = indice.fontes.reduce((n, f) => n + f.provas.reduce((m, p) => m + p.total, 0), 0);

  function responder(q: Questao, k: number) {
    if (q.id in respostas) return;
    setRespostas((r) => ({ ...r, [q.id]: k }));
    if (k !== q.resposta) {
      const prova = fonte.provas.find((p) => p.arquivo === arquivo);
      registrarErro({ id: idDaQuestao(q.enunciado || q.contexto, q.alternativas), pergunta: `${prova?.titulo ?? ""}, questão ${q.n}: ${q.enunciado}`.slice(0, 600), opcoes: q.alternativas, resposta: q.resposta, escolhida: k, href: "/questoes", origem: "banco" });
    }
  }
  async function publicar(q: Questao) {
    try {
      await rpc("resolucao_enviar", { p_questao: q.id, p_texto: escrevendo[q.id] ?? "" });
      setEscrevendo((e) => ({ ...e, [q.id]: "" }));
      setResolucoes(await rpc<Resolucao[]>("resolucoes_listar", { p_questoes: chave.split(",") }));
      setAviso("");
    } catch {
      setAviso(s.publicResolutionFailed);
    }
  }

  return (
    <section className="mt-10 scroll-mt-4 font-sans text-sm" aria-labelledby="provas-publicas">
      <h2 id="provas-publicas" className="border-b border-rule pb-2 font-serif text-2xl font-semibold">{s.publicTitle}</h2>
      <p className="mt-2 text-ink-soft">{fill(s.publicLead, { n: total.toLocaleString(lang) })}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          {s.publicSourcePick}
          <select value={fonte.id} onChange={(e) => { const f = indice.fontes.find((x) => x.id === e.target.value); if (!f) return; setFonteId(f.id); setArquivo(f.provas[0]?.arquivo ?? ""); setArea(""); setPagina(0); }} className={campo}>
            {indice.fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        <label className="block">
          {s.publicExam}
          <select value={arquivo} onChange={(e) => { setArquivo(e.target.value); setPagina(0); }} className={campo}>
            {fonte.provas.map((p) => <option key={p.arquivo} value={p.arquivo}>{p.titulo}</option>)}
          </select>
        </label>
        <label className="block">
          {s.publicArea}
          <select value={area} onChange={(e) => { setArea(e.target.value); setPagina(0); }} className={campo}>
            {areas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        {fonte.id === "enem" && <label className="block">
          {s.publicLanguage}
          <select value={lingua} onChange={(e) => { setLingua(e.target.value); setPagina(0); }} className={campo}>
            <option value="ingles">{s.publicEnglish}</option>
            <option value="espanhol">{s.publicSpanish}</option>
          </select>
        </label>}
        <label className="block">
          {s.find}
          <input type="search" value={termo} onChange={(e) => { setTermo(e.target.value); setPagina(0); }} className={campo} />
        </label>
      </div>
      {questoes === null ? (
        <p className="mt-4 text-ink-soft">{s.publicLoading}</p>
      ) : (
        <>
          <p className="mt-3 font-mono text-xs text-ink-soft" role="status">{fill(s.bankCount, { n: filtradas.length })} · {fill(s.publicPage, { a: atual + 1, b: paginas })}</p>
          <ol className="mt-4 space-y-6">
            {vistas.map((q) => {
              const dada = respostas[q.id];
              const respondida = dada !== undefined;
              const minhas = resolucoes.filter((r) => r.questao === q.id);
              return (
                <li key={q.id} className="border border-rule bg-parchment-deep p-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">{fonte.provas.find((p) => p.arquivo === arquivo)?.titulo} · {s.publicQuestion} {q.n} · {areas.find(([id]) => id === q.area)?.[1] ?? q.area}</p>
                  {q.contexto && <div className="mt-2 font-serif" lang="pt-BR"><Markdown lang={lang}>{q.contexto}</Markdown></div>}
                  {q.imagens.length > 0 && (
                    <p className="mt-1 text-xs">
                      {q.imagens.map((url, k) => <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="mr-3 underline hover:text-oxblood">🖼 {s.publicImage} {q.imagens.length > 1 ? k + 1 : ""}</a>)}
                    </p>
                  )}
                  {q.enunciado && <p className="mt-2 font-serif text-lg" lang="pt-BR">{q.enunciado}</p>}
                  <ol className="mt-2 space-y-1">
                    {q.alternativas.map((alt, k) => (
                      <li key={k}>
                        <button type="button" disabled={respondida} onClick={() => responder(q, k)} className={`w-full cursor-pointer border px-3 py-1.5 text-left disabled:cursor-default ${respondida && k === q.resposta ? "border-ok bg-ok/10 font-semibold" : respondida && k === dada ? "border-oxblood bg-oxblood/10" : "border-rule hover:border-gold"}`}>
                          <span className="font-mono">{LETRAS[k]})</span> <span lang="pt-BR">{alt.replace(/\[🖼[^\]]*\]\([^)]*\)/g, "🖼")}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {respondida && <span role="status" className={dada === q.resposta ? "font-semibold text-ok" : "font-semibold text-oxblood"}>{dada === q.resposta ? s.publicRight : fill(s.publicWrong, { l: LETRAS[q.resposta] })}</span>}
                    {!respondida && <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setGabaritos((g) => ({ ...g, [q.id]: !g[q.id] }))}>{gabaritos[q.id] ? fill(s.publicAnswerIs, { l: LETRAS[q.resposta] }) : s.bankReveal}</button>}
                  </p>
                  {minhas.length > 0 && (
                    <div className="mt-3 border-l-4 border-gold pl-3">
                      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">{s.publicResolutions}</p>
                      {minhas.map((r) => (
                        <div key={r.id} className="mt-2">
                          <div className="font-serif" lang="pt-BR"><Markdown lang={lang}>{r.texto}</Markdown></div>
                          <p className="text-xs text-ink-soft">{r.autor}{r.minha && <> · <button type="button" className="underline" onClick={() => void rpc("resolucao_retirar", { p_id: r.id }).then(() => setResolucoes((lista) => lista.filter((x) => x.id !== r.id)))}>{s.publicRemove}</button></>}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {educa && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer underline">{s.publicWrite}</summary>
                      <textarea value={escrevendo[q.id] ?? ""} onChange={(e) => setEscrevendo((x) => ({ ...x, [q.id]: e.target.value }))} rows={4} maxLength={6000} placeholder={s.publicWriteHint} className={`${campo} font-sans`} />
                      <button type="button" disabled={(escrevendo[q.id] ?? "").trim().length < 20} onClick={() => void publicar(q)} className="mt-2 cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood disabled:opacity-50">{s.publicSend}</button>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
          {paginas > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label={s.publicTitle}>
              <button type="button" disabled={atual === 0} onClick={() => { setPagina(atual - 1); document.getElementById("provas-publicas")?.scrollIntoView({ behavior: "smooth" }); }} className="cursor-pointer border-2 border-ink px-4 py-2 disabled:opacity-30">← {s.publicPrev}</button>
              <span className="font-mono text-xs">{fill(s.publicPage, { a: atual + 1, b: paginas })}</span>
              <button type="button" disabled={atual >= paginas - 1} onClick={() => { setPagina(atual + 1); document.getElementById("provas-publicas")?.scrollIntoView({ behavior: "smooth" }); }} className="cursor-pointer border-2 border-ink px-4 py-2 disabled:opacity-30">{s.publicNext} →</button>
            </nav>
          )}
        </>
      )}
      {aviso && <p className="mt-3 text-oxblood" role="status">{aviso}</p>}
      <p className="mt-6 text-xs text-ink-soft">
        {fill(s.publicSource, { data: indice.atualizado.split("-").reverse().join("/") })} <a href={fonte.origem} target="_blank" rel="noopener noreferrer" className="underline">{fonte.origem.replace("https://", "")}</a>
      </p>
    </section>
  );
}
