// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { ArrowUpRight } from "lucide-react";
import { useLista } from "./comum";
import { Abas, Botao, CabecalhoDeSecao, Esqueleto, Estatistica, Estatisticas, Faixa, Selecao, Selo, Vazio } from "./ui";

// O retorno dos alunos (uma das ideias do painel): as contagens anônimas de cada aula (abriu, terminou, fez o teste,
// acertou, "ajudou" e "não ajudou"), que o site já guarda sem identificar ninguém (aulas_funcionam, docs/MEDIR-SE-AS-AULAS-FUNCIONAM.md).
// Aqui viram uma tabela que aponta as aulas que precisam de cuidado: muita gente abre e pouca termina, ou muita gente
// diz que não ajudou.

interface Linha {
  aula: string;
  abriu: number;
  terminou: number;
  teste: number;
  acertou: number;
  ajudou: number;
  nao_ajudou: number;
}
type Ordem = "abertas" | "conclusao" | "nao_ajudou";

const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : null);

export function RetornoDosAlunos() {
  const { lang } = useI18n();
  const [dias, setDias] = useState(90);
  const lista = useLista<Linha[]>("aulas_funcionam", { p_dias: dias });
  const trilhas = useTrackOptions(lang);
  const [ordem, setOrdem] = useState<Ordem>("abertas");
  const titulos = useMemo(() => {
    const mapa = new Map<string, { aula: string; trilha: string }>();
    for (const t of trilhas) for (const l of t.lessons ?? []) mapa.set(`${t.slug}/${l.slug}`, { aula: l.title, trilha: t.title });
    return mapa;
  }, [trilhas]);
  const linhas = [...(lista.dados ?? [])].filter((l) => l.abriu >= 5);
  linhas.sort((a, b) =>
    ordem === "abertas" ? b.abriu - a.abriu : ordem === "conclusao" ? (pct(a.terminou, a.abriu) ?? 0) - (pct(b.terminou, b.abriu) ?? 0) : b.nao_ajudou - b.ajudou - (a.nao_ajudou - a.ajudou),
  );
  const cuidado = (l: Linha) => (pct(l.terminou, l.abriu) ?? 100) < 25 || (l.nao_ajudou >= 3 && l.nao_ajudou > l.ajudou);

  const abertas = linhas.reduce((n, l) => n + l.abriu, 0);
  const terminadas = linhas.reduce((n, l) => n + l.terminou, 0);
  const comCuidado = linhas.filter(cuidado).length;

  return (
    <section aria-labelledby="retorno" className="pn-secao mt-10">
      <CabecalhoDeSecao
        id="retorno"
        titulo="Retorno dos alunos"
        sobre="Contagens anônimas de cada aula: quantas vezes foi aberta, terminada, quantos fizeram o teste e acertaram, e quantos disseram que ajudou ou não. Ninguém é identificado. Só entram aulas abertas pelo menos cinco vezes."
      />
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div className="w-36">
          <Selecao rotulo="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>1 ano</option>
          </Selecao>
        </div>
        <div className="min-w-0 flex-1">
          <Abas
            rotulo="Ordenar"
            valor={ordem}
            aoMudar={setOrdem}
            opcoes={[
              { id: "abertas", nome: "Mais abertas" },
              { id: "conclusao", nome: "Menos terminadas" },
              { id: "nao_ajudou", nome: "Mais “não ajudou”" },
            ]}
          />
        </div>
      </div>
      {lista.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={lista.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lista.erro}
        </Faixa>
      )}
      {lista.dados === null && !lista.erro && <Esqueleto forma="tabela" linhas={5} />}
      {lista.dados && linhas.length === 0 && <Vazio titulo="Ainda não há aulas com cinco aberturas neste período." />}
      {linhas.length > 0 && (
        <Estatisticas rotulo="Retorno dos alunos">
          <Estatistica rotulo="Abriram" valor={abertas.toLocaleString(lang)} />
          <Estatistica rotulo="Terminaram" valor={`${pct(terminadas, abertas) ?? "—"}%`} />
          <Estatistica rotulo="precisa de cuidado" valor={comCuidado} tom={comCuidado ? "bordo" : "neutro"} />
        </Estatisticas>
      )}
      {linhas.length > 0 && (
        <div className="pn-tabela-caixa overflow-x-auto">
          <table className="pn-tabela w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left">
                <th scope="col" className="py-2 pr-3">
                  Aula
                </th>
                <th scope="col" className="px-2 text-right">
                  Abriram
                </th>
                <th scope="col" className="px-2 text-right">
                  Terminaram
                </th>
                <th scope="col" className="px-2 text-right">
                  Acertaram o teste
                </th>
                <th scope="col" className="px-2 text-right">
                  Ajudou / não
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, 60).map((l) => {
                const t = titulos.get(l.aula);
                return (
                  <tr key={l.aula}>
                    <td className="py-2 pr-3">
                      <a href={`/${lang}/trilhas/${l.aula}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-prelo-texto">
                        {t?.aula ?? l.aula}
                        <ArrowUpRight aria-hidden width={13} height={13} />
                      </a>
                      {t && <span className="block text-xs text-ink-soft">{t.trilha}</span>}
                      {cuidado(l) && (
                        <Selo tom="erro" className="mt-1">
                          precisa de cuidado
                        </Selo>
                      )}
                    </td>
                    <td className="px-2 text-right font-mono">{l.abriu}</td>
                    <td className="px-2 text-right font-mono">{pct(l.terminou, l.abriu) ?? "—"}%</td>
                    <td className="px-2 text-right font-mono">{l.teste ? `${pct(l.acertou, l.teste)}%` : "—"}</td>
                    <td className="px-2 text-right font-mono">
                      {l.ajudou} / {l.nao_ajudou}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}