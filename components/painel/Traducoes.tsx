// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../I18n";
import { Aviso, campo, data, elo, rotulo, situacoes, useLista } from "./comum";

interface Trilha {
  slug: string;
  title: string;
  area: string;
  lessons: { slug: string; title: string; faltam: string[] }[];
}

interface Andamento {
  alvo: string;
  idioma: string;
  status: string;
  nome: string;
  criado_em: string;
  minha: boolean;
}

const idiomas: Record<string, string> = { en: "inglês", es: "espanhol", zh: "chinês", ru: "russo" };

/**
 * O que falta traduzir e o que já está a caminho. A lista de aulas sai de um arquivo montado junto com o site; o que já
 * foi enviado e ainda não foi ao ar vem do banco, para dois tradutores não fazerem a mesma aula no mesmo idioma.
 */
export function Traducoes({ irEscrever }: { irEscrever: () => void }) {
  const { t } = useI18n();
  const andamento = useLista<Andamento[]>("traducoes_andamento");
  const [trilhas, setTrilhas] = useState<Trilha[] | null>(null);
  const [erro, setErro] = useState("");
  const [idioma, setIdioma] = useState("en");
  const [area, setArea] = useState("");

  useEffect(() => {
    let cancelado = false;
    fetch("/pt/traducoes.json")
      .then((resposta) => (resposta.ok ? (resposta.json() as Promise<Trilha[]>) : Promise.reject(new Error())))
      .then((lista) => {
        if (!cancelado) setTrilhas(lista);
      })
      .catch(() => {
        if (!cancelado) setErro("A lista de aulas não carregou. Ela é montada junto com o site: tente de novo depois da próxima publicação.");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const caminhando = new Set((andamento.dados ?? []).filter((item) => item.idioma === idioma).map((item) => item.alvo.replace(/^\/(pt|en|es|zh|ru)(?=\/)/, "")));
  const areas = [...new Set((trilhas ?? []).map((trilha) => trilha.area))];
  const faltando = (trilhas ?? [])
    .filter((trilha) => !area || trilha.area === area)
    .map((trilha) => ({ ...trilha, lessons: trilha.lessons.filter((aula) => aula.faltam.includes(idioma)) }))
    .filter((trilha) => trilha.lessons.length > 0);
  const total = faltando.reduce((soma, trilha) => soma + trilha.lessons.length, 0);
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Já a caminho</h2>
        <p className="mt-1 text-ink-soft">Traduções enviadas que ainda não foram ao ar. Antes de começar uma aula, confira se ela não está aqui.</p>
        <Aviso texto={andamento.erro} />
        {andamento.dados?.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma tradução esperando.</p>}
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {andamento.dados?.map((item) => (
            <li key={`${item.alvo}-${item.idioma}-${item.criado_em}`} className="py-2">
              <span className={rotulo}>{idiomas[item.idioma] ?? item.idioma} · {situacoes[item.status] ?? item.status} · {data(item.criado_em)}</span>
              <p>
                <a href={`/pt${item.alvo.replace(/^\/(pt|en|es|zh|ru)(?=\/)/, "")}`} target="_blank" rel="noopener noreferrer" className={elo}>{item.alvo}</a> · {item.minha ? "sua" : item.nome || "de outra pessoa"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Aulas sem tradução</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            Idioma
            <select value={idioma} onChange={(e) => setIdioma(e.target.value)} className={campo}>
              {Object.entries(idiomas).map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Disciplina
            <select value={area} onChange={(e) => setArea(e.target.value)} className={campo}>
              <option value="">Todas</option>
              {areas.map((slug) => (
                <option key={slug} value={slug}>{nomeDaArea(slug)}</option>
              ))}
            </select>
          </label>
        </div>
        <Aviso texto={erro} />
        {trilhas && (
          <p className="mt-2">
            {total} {total === 1 ? "aula ainda sem" : "aulas ainda sem"} tradução para o {idiomas[idioma]}. Escolha uma, abra o original, e envie em{" "}
            <button type="button" className={elo} onClick={irEscrever}>Escrever → Tradução</button>, com o endereço da aula.
          </p>
        )}
        <div className="mt-4 space-y-5">
          {faltando.map((trilha) => (
            <div key={trilha.slug}>
              <p className={rotulo}>{nomeDaArea(trilha.area)}</p>
              <h3 className="font-serif text-xl font-semibold">{trilha.title}</h3>
              <ul className="mt-1 space-y-1">
                {trilha.lessons.map((aula) => {
                  const caminho = `/trilhas/${trilha.slug}/${aula.slug}`;
                  return (
                    <li key={aula.slug} className="flex flex-wrap items-baseline gap-x-3">
                      <a href={`/pt${caminho}`} target="_blank" rel="noopener noreferrer" className={elo}>{aula.title}</a>
                      <button type="button" className="cursor-pointer font-mono text-xs text-ink-soft hover:text-oxblood" onClick={() => void navigator.clipboard?.writeText(caminho)} title="Copiar o endereço para o formulário">
                        {caminho}
                      </button>
                      {caminhando.has(caminho) && <span className="text-xs text-oxblood">já tem tradução a caminho</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
