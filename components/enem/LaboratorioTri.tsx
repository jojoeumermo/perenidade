// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { type AreaDoEnem, corrigirLetras, estimarEap, estimarMl, faixaPorAcertos, itensDaArea, notaDeTheta, type ProvaDoArquivo } from "@/lib/enem-tri";
import type { TextosDoEstudo } from "@/lib/textos-estudo";

type S = TextosDoEstudo["enem"]["tri"];
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood";
const campo = "border-2 border-ink bg-parchment px-2 py-1.5";
const pontos = (x: number) => String(Math.round(x));
const dec = (x: number, casas = 2) => x.toFixed(casas).replace(".", ",");
const ANOS = Array.from({ length: 15 }, (_, i) => 2023 - i);
const AREAS: AreaDoEnem[] = ["linguagens", "humanas", "natureza", "matematica"];

/**
 * O laboratório da TRI com itens reais: a pessoa escolhe uma prova do Enem (2009 a 2023) e uma área, marca o que
 * acertou (ou cola as letras das respostas, corrigidas pelo gabarito oficial) e vê a nota estimada pelo método do Inep
 * (modelo de 3 parâmetros, EAP, escala 500 e 100), com os parâmetros que o Inep publica nos microdados. Tudo roda no
 * aparelho; o único pedido de rede é o arquivo estático da prova (public/tri/enem-AAAA.json). Aviso fixo: é uma estimativa.
 */
export function LaboratorioTri({ s, hrefProvas }: { s: S; hrefProvas: string }) {
  const [ano, setAno] = useState(2022);
  const [area, setArea] = useState<AreaDoEnem>("matematica");
  const [idioma, setIdioma] = useState<"ingles" | "espanhol">("ingles");
  const [D, setD] = useState(1.7);
  const [prova, setProva] = useState<ProvaDoArquivo | null>(null);
  const [erro, setErro] = useState(false);
  const [marcas, setMarcas] = useState<Record<string, number[]>>({});
  const [letras, setLetras] = useState("");
  const [n, setN] = useState(20);
  const cache = useRef(new Map<number, ProvaDoArquivo>());

  useEffect(() => {
    let vivo = true;
    const guardada = cache.current.get(ano);
    if (guardada) {
      setProva(guardada);
      setErro(false);
      return;
    }
    setProva(null);
    setErro(false);
    fetch(`/tri/enem-${ano}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ProvaDoArquivo>) : Promise.reject(new Error(String(r.status)))))
      .then((p) => {
        cache.current.set(ano, p);
        if (vivo) setProva(p);
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [ano]);

  const chave = `${ano}-${area}-${idioma}`;
  const bloco = prova?.areas[area];
  const itens = useMemo(() => (bloco ? itensDaArea(bloco, idioma) : []), [bloco, idioma]);
  const contados = useMemo(() => itens.filter((i) => !i.fora), [itens]);
  const marcados = useMemo(() => new Set(marcas[chave] ?? []), [marcas, chave]);
  const definir = (cos: number[]) => setMarcas((m) => ({ ...m, [chave]: cos }));

  const resposta = itens.map((i) => (i.fora ? null : marcados.has(i.co)));
  const itensModelo = itens.map((i) => ({ a: i.a ?? 1, b: i.b ?? 0, c: i.c ?? 0 }));
  const est = useMemo(() => (itens.length ? estimarEap(itensModelo, resposta, { D }) : null), [itens, marcados, D]); // eslint-disable-line react-hooks/exhaustive-deps
  const ml = itens.length ? estimarMl(itensModelo, resposta, D) : null;
  const total = contados.length;
  const acertos = contados.filter((i) => marcados.has(i.co)).length;
  const faixa = useMemo(() => (total ? faixaPorAcertos(contados.map((i) => ({ a: i.a as number, b: i.b as number, c: i.c as number })), { D }) : []), [contados, total, D]);
  const f = faixa[acertos];
  const fora = itens.length - total;
  const porDificuldade = [...contados].sort((x, y) => (x.b as number) - (y.b as number));
  const quantos = Math.max(0, Math.min(total, n));

  return (
    <div className="mt-8 font-sans text-sm">
      <p className="border-2 border-oxblood bg-parchment p-4 font-semibold">{s.aviso}</p>

      <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">{s.escolha}</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 font-semibold">
            {s.ano}
            <select className={campo} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-semibold">
            {s.area}
            <select className={campo} value={area} onChange={(e) => setArea(e.target.value as AreaDoEnem)}>
              {AREAS.map((a) => <option key={a} value={a}>{s.areas[a]}</option>)}
            </select>
          </label>
          {area === "linguagens" && (
            <label className="flex flex-col gap-1 font-semibold">
              {s.idioma}
              <select className={campo} value={idioma} onChange={(e) => setIdioma(e.target.value as "ingles" | "espanhol")}>
                <option value="ingles">{s.ingles}</option>
                <option value="espanhol">{s.espanhol}</option>
              </select>
            </label>
          )}
        </div>
        {erro && <p className="mt-3 font-semibold text-oxblood" role="alert">{s.erroCarregar}</p>}
        {!prova && !erro && <p className="mt-3" role="status">{s.carregando}</p>}
        {bloco && (
          <div className="mt-3 space-y-1">
            <p>{fill(s.caderno, { cor: bloco.cor.toLowerCase(), prova: bloco.prova })}</p>
            {bloco.ligadas > 0 && <p>{fill(s.ligadas, { n: bloco.ligadas })} <a href={hrefProvas} className="underline hover:text-oxblood">{s.provas}</a></p>}
            {fora > 0 && <p>{fill(s.foraDaConta, { n: fora })}</p>}
          </div>
        )}
      </section>

      {bloco && est && (
        <>
          <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
            <h2 className="font-serif text-2xl font-semibold">{s.marcar}</h2>
            <p className="mt-1">{s.marcarTexto}</p>

            <div className="mt-4">
              <label className="block font-semibold" htmlFor="tri-colar">{s.colar}</label>
              <p className="text-xs">{s.colarAjuda}</p>
              <textarea id="tri-colar" className={`${campo} mt-1 w-full font-mono`} rows={2} spellCheck={false} autoComplete="off" value={letras} onChange={(e) => setLetras(e.target.value)} />
              <p className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={claro} onClick={() => { const certas = corrigirLetras(itens, letras); definir(itens.filter((it, i) => !it.fora && certas[i]).map((it) => it.co)); }}>{s.corrigir}</button>
                <button type="button" className={claro} onClick={() => { definir([]); setLetras(""); }}>{s.limpar}</button>
              </p>
            </div>

            <div className="mt-4 border-t border-rule pt-4">
              <h3 className="font-semibold">{s.prontos}</h3>
              <p className="mt-1">{fill(s.prontosTexto, { n: quantos })}</p>
              <p className="mt-2 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 font-semibold">
                  {s.acertosQtd}
                  <input type="number" min={0} max={total} className={`${campo} w-24 font-mono`} value={n} onChange={(e) => setN(Number(e.target.value) || 0)} />
                </label>
                <button type="button" className={claro} onClick={() => definir(porDificuldade.slice(0, quantos).map((i) => i.co))}>{s.maisFaceis}</button>
                <button type="button" className={claro} onClick={() => definir(porDificuldade.slice(total - quantos).map((i) => i.co))}>{s.maisDificeis}</button>
              </p>
            </div>

            <fieldset className="mt-4">
              <legend className="sr-only">{s.marcar}</legend>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-rule">
                      <th className="py-1 pr-2">{s.item}</th>
                      <th className="py-1 pr-2">{s.dificuldade}</th>
                      <th className="py-1 pr-2">{s.discriminacao}</th>
                      <th className="py-1 pr-2">{s.chute}</th>
                      <th className="py-1">{s.acertou}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, i) => (
                      <tr key={it.co} className="border-b border-rule">
                        <td className="py-1 pr-2 font-mono">{i + 1}{it.q ? <span className="ml-1 text-xs" title={s.noSite}>•</span> : null}</td>
                        {it.fora ? (
                          <td className="py-1 pr-2" colSpan={3}>{s.fora}</td>
                        ) : (
                          <>
                            <td className="py-1 pr-2 font-mono">{pontos(notaDeTheta(it.b as number))}</td>
                            <td className="py-1 pr-2 font-mono">{dec(it.a as number)}</td>
                            <td className="py-1 pr-2 font-mono">{dec(it.c as number)}</td>
                          </>
                        )}
                        <td className="py-1">
                          <input
                            type="checkbox"
                            aria-label={fill(s.acertouItem, { n: i + 1 })}
                            disabled={it.fora}
                            checked={!it.fora && marcados.has(it.co)}
                            onChange={(e) => definir(e.target.checked ? [...marcados, it.co] : [...marcados].filter((x) => x !== it.co))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </fieldset>
          </section>

          <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
            <h2 className="font-serif text-2xl font-semibold">{s.resultado}</h2>
            <div role="status" aria-live="polite">
              <p className="mt-2 font-serif text-4xl font-semibold">{fill(s.notaEstimada, { nota: pontos(est.nota) })}</p>
              <p className="mt-1 font-semibold">{fill(s.intervalo, { min: pontos(est.ic95[0]), max: pontos(est.ic95[1]) })}</p>
              <p className="mt-1">{fill(s.contagem, { n: acertos, total })}</p>
              {f && f.max - f.min >= 1 && <p className="mt-1">{fill(s.faixa, { n: acertos, min: pontos(f.min), max: pontos(f.max) })}</p>}
              <p className="mt-1">{ml === null ? s.mlNao : fill(s.ml, { nota: pontos(notaDeTheta(ml)) })}</p>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold">{s.avancado}</summary>
              <fieldset className="mt-2">
                <legend className="font-semibold">{s.constante}</legend>
                <label className="mr-4 inline-flex items-center gap-2"><input type="radio" name="tri-d" checked={D === 1.7} onChange={() => setD(1.7)} />{s.d17}</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="tri-d" checked={D === 1} onChange={() => setD(1)} />{s.d1}</label>
                <p className="mt-1 text-xs">{s.constanteAviso}</p>
              </fieldset>
            </details>
          </section>
        </>
      )}

      <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">{s.compare}</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          {s.explicacoes.map((e) => <li key={e}>{e}</li>)}
        </ul>
        <h3 className="mt-4 font-semibold">{s.metodo}</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          {s.passos.map((p) => <li key={p}>{p}</li>)}
        </ol>
        <p className="mt-3 font-mono text-xs">{s.formula}</p>
        <h3 className="mt-4 font-semibold">{s.limites}</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {s.limitesLista.map((e) => <li key={e}>{e}</li>)}
        </ul>
        <h3 className="mt-4 font-semibold">{s.fontesTitulo}</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {s.fontes.map((fo) => <li key={fo.url}><a href={fo.url} className="underline hover:text-oxblood" rel="noopener noreferrer">{fo.titulo}</a></li>)}
        </ul>
      </section>
    </div>
  );
}
