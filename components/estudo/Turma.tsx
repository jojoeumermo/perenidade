// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { fill, localePath } from "@/i18n/config";
import { hoje } from "@/lib/estudo";
import { lembrarTurma, lerTurmas } from "@/lib/meu-estudo";
import { useCompleted } from "@/lib/progress";
import { useHydrated } from "@/lib/storage";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { codificarSequencia, codigoDaSequencia, type Comprovante, gerarComprovante, lerComprovantes, lerSequencia, MAX_AULAS, type Sequencia } from "@/lib/turma";
import { CopyButton } from "../CopyButton";
import { L, useI18n } from "../I18n";
import { baixar } from "./guardado";
import { type Indice, useIndice } from "./indice";
import { Barra } from "./Barra";

type S = TextosDoEstudo["turma"];

const cartao = "border border-rule bg-parchment-deep p-5";
const botao = "cursor-pointer bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-40";
const campo = "mt-1 w-full border-2 border-ink bg-parchment px-3 py-2";

const nomeDaAula = (indice: Indice | null, id: string) => indice?.aulas.get(id)?.titulo ?? id;

/** O QR Code do link (o mesmo gerador que o painel usa), para projetar na sala. Link longo demais: sem QR. */
function QrDoLink({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [imagem, setImagem] = useState("");
  useEffect(() => {
    let vivo = true;
    import("qrcode")
      .then((qrcode) => qrcode.toDataURL(texto, { errorCorrectionLevel: "L", margin: 1, width: 240, color: { dark: "#1f1a14", light: "#ffffff" } }))
      .then((url) => vivo && setImagem(url))
      .catch(() => vivo && setImagem(""));
    return () => {
      vivo = false;
    };
  }, [texto]);
  // eslint-disable-next-line @next/next/no-img-element -- imagem gerada no aparelho (data:), não há o que otimizar
  return imagem ? <img src={imagem} alt={rotulo} width={240} height={240} className="mt-3 border border-rule bg-white p-1" /> : null;
}

// ───────────── Professor: montar a sequência ─────────────

function MontarSequencia({ s, indice }: { s: S; indice: Indice | null }) {
  const { lang } = useI18n();
  const [area, setArea] = useState("");
  const [trilha, setTrilha] = useState("");
  const [aulas, setAulas] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [recado, setRecado] = useState("");
  const [link, setLink] = useState("");

  if (!indice) return <p className="mt-4 text-ink-soft">{s.carregandoAulas}</p>;
  const areas = [...new Map(indice.trilhas.map(([, , a, nome]) => [a, nome])).entries()].sort((x, y) => x[1].localeCompare(y[1], lang));
  const trilhas = indice.trilhas.filter(([, , a]) => a === area);
  const escolhida = indice.trilhas.find(([slug]) => slug === trilha);
  const adicionar = (ids: string[]) => {
    setAulas((atual) => [...atual, ...ids.filter((id) => !atual.includes(id))].slice(0, MAX_AULAS));
    setLink("");
  };
  const mover = (i: number, d: number) => {
    setAulas((atual) => {
      const nova = [...atual];
      [nova[i], nova[i + d]] = [nova[i + d], nova[i]];
      return nova;
    });
    setLink("");
  };

  function gerar() {
    const seq: Sequencia = { v: 1, titulo, aulas, recado: recado.trim() || undefined };
    const fragmento = codificarSequencia(seq);
    const endereco = `${window.location.origin}${localePath(lang, "/turma")}#${fragmento}`;
    setLink(endereco);
    lembrarTurma({ codigo: codigoDaSequencia(seq), titulo: titulo.trim(), link: fragmento, aulas });
  }

  return (
    <div className="mt-4 space-y-6">
      <fieldset>
        <legend className="font-semibold">{s.passo1}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            {s.disciplina}
            <select value={area} onChange={(e) => { setArea(e.target.value); setTrilha(""); }} className={campo}>
              <option value="">{s.escolha}</option>
              {areas.map(([slug, nome]) => (
                <option key={slug} value={slug}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {s.trilha}
            <select value={trilha} onChange={(e) => setTrilha(e.target.value)} className={campo} disabled={!area}>
              <option value="">{s.escolha}</option>
              {trilhas.map(([slug, nome, , , etapa]) => (
                <option key={slug} value={slug}>
                  {nome} ({etapa})
                </option>
              ))}
            </select>
          </label>
        </div>
        {escolhida && (
          <div className="mt-3">
            <button type="button" className={claro} onClick={() => adicionar(escolhida[5].map(([a]) => `${escolhida[0]}/${a}`))}>
              {fill(s.adicionarTodas, { n: escolhida[5].length })}
            </button>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto border border-rule bg-parchment p-2">
              {escolhida[5].map(([slug, nome]) => {
                const id = `${escolhida[0]}/${slug}`;
                const ja = aulas.includes(id);
                return (
                  <li key={id} className="flex items-center justify-between gap-3">
                    <span>{nome}</span>
                    <button type="button" className="shrink-0 cursor-pointer underline hover:text-oxblood disabled:cursor-default disabled:no-underline disabled:text-ink-soft" disabled={ja || aulas.length >= MAX_AULAS} onClick={() => adicionar([id])} aria-label={fill(s.adicionarAula, { aula: nome })}>
                      {ja ? s.jaEsta : s.adicionar}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </fieldset>

      <section aria-labelledby="tu-ordem">
        <h3 id="tu-ordem" className="font-semibold">
          {fill(s.passo2, { n: aulas.length, max: MAX_AULAS })}
        </h3>
        {aulas.length === 0 ? (
          <p className="mt-2 text-ink-soft">{s.nenhumaAula}</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {aulas.map((id, i) => (
              <li key={id} className="flex items-center gap-2 border-b border-rule py-1">
                <span className="w-6 shrink-0 font-mono text-xs text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">{nomeDaAula(indice, id)}</span>
                <button type="button" className="cursor-pointer px-1 hover:text-oxblood disabled:opacity-30" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={fill(s.subir, { aula: nomeDaAula(indice, id) })}>
                  ↑
                </button>
                <button type="button" className="cursor-pointer px-1 hover:text-oxblood disabled:opacity-30" disabled={i === aulas.length - 1} onClick={() => mover(i, 1)} aria-label={fill(s.descer, { aula: nomeDaAula(indice, id) })}>
                  ↓
                </button>
                <button type="button" className="cursor-pointer px-1 hover:text-oxblood" onClick={() => { setAulas((a) => a.filter((x) => x !== id)); setLink(""); }} aria-label={fill(s.tirar, { aula: nomeDaAula(indice, id) })}>
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <fieldset>
        <legend className="font-semibold">{s.passo3}</legend>
        <label className="mt-2 block">
          {s.tituloDaSequencia}
          <input value={titulo} onChange={(e) => { setTitulo(e.target.value.slice(0, 120)); setLink(""); }} className={campo} placeholder={s.tituloExemplo} />
        </label>
        <label className="mt-3 block">
          {s.recado}
          <textarea value={recado} onChange={(e) => { setRecado(e.target.value.slice(0, 500)); setLink(""); }} rows={3} className={campo} />
        </label>
      </fieldset>

      <div>
        <button type="button" className={botao} disabled={!titulo.trim() || aulas.length === 0} onClick={gerar}>
          {s.gerarLink}
        </button>
        <p className="mt-2 text-xs text-ink-soft">{s.semServidor}</p>
        {link && (
          <div className="mt-4 border-2 border-gold bg-parchment p-4">
            <label className="block font-semibold" htmlFor="tu-link">
              {s.linkPronto}
            </label>
            <input id="tu-link" readOnly value={link} onFocus={(e) => e.target.select()} className={`${campo} font-mono text-xs`} />
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <CopyButton text={link} label={s.copiarLink} done={s.copiado} />
              <a href={link} className="underline hover:text-oxblood">
                {s.abrirComoAluno}
              </a>
            </p>
            <p className="mt-2 font-mono text-xs">{fill(s.codigo, { codigo: codigoDaSequencia({ v: 1, titulo: titulo.trim(), aulas }) })}</p>
            <QrDoLink texto={link} rotulo={s.qr} />
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────── Professor: conferir comprovantes ─────────────

function ConferirComprovantes({ s, indice }: { s: S; indice: Indice | null }) {
  const [texto, setTexto] = useState("");
  const [lidos, setLidos] = useState<{ lidos: Comprovante[]; invalidos: number } | null>(null);
  const turmas = new Map(lerTurmas().map((t) => [t.codigo, t]));

  function csv() {
    if (!lidos) return;
    const linha = (c: string[]) => c.map((x) => `"${x.replace(/"/g, '""')}"`).join(";");
    const linhas = [linha([s.colNome, s.colTurma, s.colConcluidas, s.colData, s.colAulas])];
    for (const c of lidos.lidos) {
      const t = turmas.get(c.s);
      linhas.push(linha([c.n || "—", t?.titulo ?? c.s, `${c.c.length}/${c.t}`, c.d, t ? c.c.map((i) => nomeDaAula(indice, t.aulas[i] ?? "")).join(" | ") : c.c.map((i) => i + 1).join(", ")]));
    }
    baixar(`comprovantes-${hoje()}.csv`, `﻿${linhas.join("\r\n")}`, "text/csv");
  }

  return (
    <div className="mt-3">
      <label className="block" htmlFor="tu-comprovantes">
        {s.colarComprovantes}
      </label>
      <textarea id="tu-comprovantes" value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 200_000))} rows={5} className={`${campo} font-mono text-xs`} />
      <p className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className={botao} disabled={!texto.trim()} onClick={() => setLidos(lerComprovantes(texto))}>
          {s.conferirComprovantes}
        </button>
        {lidos && lidos.lidos.length > 0 && (
          <button type="button" className={claro} onClick={csv}>
            {s.baixarTabela}
          </button>
        )}
      </p>
      {lidos && (
        <div role="status" className="mt-4">
          {lidos.invalidos > 0 && <p className="text-oxblood">{fill(s.invalidos, { n: lidos.invalidos })}</p>}
          {lidos.lidos.length === 0 ? (
            <p className="text-ink-soft">{s.nenhumComprovante}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rule">
                    <th scope="col" className="py-1 pr-2">{s.colNome}</th>
                    <th scope="col" className="py-1 pr-2">{s.colTurma}</th>
                    <th scope="col" className="py-1 pr-2">{s.colConcluidas}</th>
                    <th scope="col" className="py-1">{s.colData}</th>
                  </tr>
                </thead>
                <tbody>
                  {lidos.lidos.map((c, i) => {
                    const t = turmas.get(c.s);
                    return (
                      <tr key={`${c.s}-${c.n}-${i}`} className="border-b border-rule align-top">
                        <td className="py-1 pr-2">{c.n || "—"}</td>
                        <td className="py-1 pr-2">{t?.titulo ?? fill(s.turmaDesconhecida, { codigo: c.s })}</td>
                        <td className="py-1 pr-2">
                          {fill(s.deAulas, { a: c.c.length, b: c.t })}
                          {t && c.c.length < c.t && <span className="block text-ink-soft">{fill(s.faltam, { lista: t.aulas.filter((_, k) => !c.c.includes(k)).map((id) => nomeDaAula(indice, id)).join(", ") })}</span>}
                        </td>
                        <td className="py-1">{c.d}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-soft">{s.avisoComprovante}</p>
        </div>
      )}
    </div>
  );
}

// ───────────── Aluno: seguir a sequência ─────────────

function VistaDoAluno({ seq, fragmento, s, indice }: { seq: Sequencia; fragmento: string; s: S; indice: Indice | null }) {
  const feitas = useCompleted();
  const [nome, setNome] = useState("");
  const [comprovante, setComprovante] = useState("");
  const codigo = codigoDaSequencia(seq);
  // Guarda a turma em "Meu estudo" para a pessoa voltar a ela; uma vez por link aberto.
  useEffect(() => {
    lembrarTurma({ codigo, titulo: seq.titulo, link: fragmento, aulas: seq.aulas });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seq vem do próprio fragmento
  }, [codigo, fragmento]);
  const concluidas = seq.aulas.filter((id) => feitas.has(id)).length;
  const proxima = seq.aulas.find((id) => !feitas.has(id));

  return (
    <div className="mt-6 space-y-6">
      <section className={cartao} aria-labelledby="tu-seq">
        <p className="font-mono text-xs uppercase tracking-widest text-oxblood">{fill(s.daTurma, { codigo })}</p>
        <h2 id="tu-seq" className="mt-1 font-serif text-3xl font-semibold">
          {seq.titulo}
        </h2>
        {seq.recado && (
          <blockquote className="mt-3 border-l-4 border-gold pl-3">
            <p className="text-xs uppercase tracking-widest text-ink-soft">{s.recadoDoProfessor}</p>
            <p className="mt-1 whitespace-pre-line">{seq.recado}</p>
          </blockquote>
        )}
        <p className="mt-4">{fill(s.progresso, { a: concluidas, b: seq.aulas.length })}</p>
        <div className="mt-1">
          <Barra feito={concluidas} total={seq.aulas.length} rotulo={s.progressoRotulo} />
        </div>
        {proxima ? (
          <L href={`/trilhas/${proxima}`} className={`${botao} mt-4 inline-block`}>
            {fill(s.proxima, { aula: nomeDaAula(indice, proxima) })} →
          </L>
        ) : (
          <p className="mt-4 font-semibold text-ok">{s.tudoFeito}</p>
        )}
      </section>

      <section className={cartao} aria-labelledby="tu-aulas">
        <h2 id="tu-aulas" className="font-serif text-2xl font-semibold">
          {s.aulasDaSequencia}
        </h2>
        <ol className="mt-3 space-y-1">
          {seq.aulas.map((id, i) => {
            const feita = feitas.has(id);
            const aula = indice?.aulas.get(id);
            return (
              <li key={id} className="flex gap-3 border-b border-rule py-1.5">
                <span className={`w-6 shrink-0 font-mono text-xs ${feita ? "text-ok" : "text-ink-soft"}`}>{feita ? "✓" : String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <L href={`/trilhas/${id}`} className="underline hover:text-oxblood">
                    {aula?.titulo ?? id}
                  </L>
                  {feita && <span className="sr-only"> ({s.feita})</span>}
                  {aula && <span className="block text-xs text-ink-soft">{aula.tituloDaTrilha}</span>}
                  {indice && !aula && <span className="block text-xs text-oxblood">{s.aulaSumiu}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-ink-soft">{s.progressoNoAparelho}</p>
      </section>

      <section className={cartao} aria-labelledby="tu-comprovante">
        <h2 id="tu-comprovante" className="font-serif text-2xl font-semibold">
          {s.comprovanteTitulo}
        </h2>
        <p className="mt-1 text-ink-soft">{s.comprovanteLead}</p>
        <label className="mt-3 block max-w-md">
          {s.seuNome}
          <input value={nome} onChange={(e) => { setNome(e.target.value.slice(0, 80)); setComprovante(""); }} className={campo} autoComplete="name" />
        </label>
        <button type="button" className={`${botao} mt-3`} onClick={() => setComprovante(gerarComprovante(seq, feitas, nome, hoje()))}>
          {s.gerarComprovante}
        </button>
        {comprovante && (
          <div className="mt-4">
            <label htmlFor="tu-codigo" className="block font-semibold">
              {fill(s.comprovantePronto, { a: concluidas, b: seq.aulas.length })}
            </label>
            <textarea id="tu-codigo" readOnly value={comprovante} rows={3} onFocus={(e) => e.target.select()} className={`${campo} font-mono text-xs`} />
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <CopyButton text={comprovante} label={s.copiarComprovante} done={s.copiado} />
              <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => baixar(`comprovante-${codigo}.txt`, `${seq.titulo}\n${nome}\n${comprovante}\n`, "text/plain")}>
                {s.baixarComprovante}
              </button>
            </p>
            <p className="mt-2 text-xs text-ink-soft">{s.nadaEnviado}</p>
          </div>
        )}
      </section>

      <p>
        <a href={window.location.pathname} className="underline hover:text-oxblood">
          {s.montarOutra}
        </a>
      </p>
    </div>
  );
}

/**
 * Modo turma, sem cadastro e sem servidor (lib/turma.ts). Com uma sequência no endereço (#t=…), mostra a trilha da
 * turma e o comprovante; sem, mostra as ferramentas do professor: montar a sequência e conferir comprovantes.
 */
export function Turma({ s }: { s: S }) {
  const { lang } = useI18n();
  const hidratado = useHydrated();
  const indice = useIndice(lang);
  const [fragmento, setFragmento] = useState("");
  useEffect(() => {
    const ler = () => setFragmento(window.location.hash.replace(/^#/, ""));
    ler();
    window.addEventListener("hashchange", ler);
    return () => window.removeEventListener("hashchange", ler);
  }, []);

  const seq = useMemo(() => (fragmento ? lerSequencia(fragmento) : null), [fragmento]);
  if (!hidratado) return null;
  if (fragmento && !seq)
    return (
      <p className="mt-6 border-l-4 border-oxblood pl-3 font-sans text-sm">
        {s.linkQuebrado}{" "}
        <a href={window.location.pathname} className="underline hover:text-oxblood">
          {s.montarOutra}
        </a>
      </p>
    );
  if (seq) return <div className="font-sans text-sm"><VistaDoAluno seq={seq} fragmento={fragmento} s={s} indice={indice} /></div>;

  return (
    <div className="mt-6 space-y-6 font-sans text-sm">
      <section className={cartao} aria-labelledby="tu-montar">
        <h2 id="tu-montar" className="font-serif text-2xl font-semibold">
          {s.montarTitulo}
        </h2>
        <p className="mt-1 text-ink-soft">{s.montarLead}</p>
        <MontarSequencia s={s} indice={indice} />
      </section>
      <section className={cartao} aria-labelledby="tu-conferir">
        <h2 id="tu-conferir" className="font-serif text-2xl font-semibold">
          {s.conferirTitulo}
        </h2>
        <p className="mt-1 text-ink-soft">{s.conferirLead}</p>
        <ConferirComprovantes s={s} indice={indice} />
      </section>
    </div>
  );
}
