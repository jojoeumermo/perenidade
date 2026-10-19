// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useI18n } from "../I18n";
import { dataHora, useLista } from "./comum";

interface Disciplina {
  disciplina: string;
  aulas_aprovadas: number;
  aulas_pendentes: number;
  aulas_recusadas: number;
  aulas_90d: number;
  reforco_abertos: number;
  reforco_total: number;
  reforco_90d: number;
  videoaulas: number;
  aulas_ao_vivo: number;
  inscricoes_ao_vivo: number;
  duvidas_comunidade: number;
  educadores: number;
}
interface Dados {
  disciplinas: Disciplina[];
  meses: { mes: string; aulas: number; reforco: number; duvidas: number }[];
  pedidos_de_disciplina: { titulo: string; corpo: string; criado_em: string; status: string }[];
}

type Ordem = keyof Omit<Disciplina, "disciplina">;

/**
 * O que os estudantes procuram e o que a equipe produz, por disciplina: a base para a coordenação pedagógica decidir
 * que disciplinas entram, quais precisam de educador e onde falta aula. Só contagens, nenhum dado de pessoa.
 */
export function Estatisticas() {
  const { t } = useI18n();
  const dados = useLista<Dados>("painel_estatisticas");
  const [ordem, setOrdem] = useState<Ordem>("reforco_90d");
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  if (dados.erro) return <p className="text-oxblood">{dados.erro}</p>;
  if (!dados.dados) return <p className="painel-carregando text-ink-soft">Carregando…</p>;
  const d = dados.dados;
  const lista = [...d.disciplinas].sort((a, b) => b[ordem] - a[ordem]);
  const maior = Math.max(1, ...d.meses.flatMap((m) => [m.aulas, m.reforco, m.duvidas]));
  const colunas: [Ordem, string][] = [
    ["educadores", "Educadores"],
    ["aulas_aprovadas", "Aulas no ar"],
    ["aulas_pendentes", "Na fila"],
    ["aulas_90d", "Aulas em 90 dias"],
    ["reforco_90d", "Reforço em 90 dias"],
    ["reforco_abertos", "Reforço aberto"],
    ["duvidas_comunidade", "Dúvidas"],
    ["videoaulas", "Vídeos"],
    ["aulas_ao_vivo", "Ao vivo"],
    ["inscricoes_ao_vivo", "Inscritos"],
  ];
  const semEducador = lista.filter((x) => x.educadores === 0 && (x.reforco_90d > 0 || x.duvidas_comunidade > 0));
  return (
    <div className="space-y-10">
      <section>
        <h2 className="jornal-secao"><span className="jornal-editoria">Últimos seis meses</span></h2>
        <div className="mt-4 grid grid-cols-6 gap-2 border-2 border-ink bg-parchment-deep p-4">
          {d.meses.map((m) => (
            <div key={m.mes} className="flex flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                {([["aulas", "#17130e", "Aulas enviadas"], ["reforco", "#c21f16", "Pedidos de reforço"], ["duvidas", "#8a5a16", "Dúvidas na comunidade"]] as const).map(([k, cor, nome]) => (
                  <span key={k} title={`${nome}: ${m[k]}`} className="w-3 sm:w-5" style={{ height: `${Math.max(2, (m[k] / maior) * 100)}%`, background: cor }} />
                ))}
              </div>
              <span className="font-mono text-[0.62rem] uppercase text-ink-soft">{m.mes.slice(5)}/{m.mes.slice(2, 4)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
          <span><span className="mr-1 inline-block h-3 w-3 bg-ink align-middle" />Aulas enviadas</span>
          <span><span className="mr-1 inline-block h-3 w-3 bg-[#c21f16] align-middle" />Pedidos de reforço</span>
          <span><span className="mr-1 inline-block h-3 w-3 bg-[#8a5a16] align-middle" />Dúvidas na comunidade</span>
        </p>
      </section>

      {semEducador.length > 0 && (
        <section className="border-l-4 border-oxblood bg-parchment-deep px-4 py-3">
          <strong>Procura sem educador:</strong> {semEducador.map((x) => nomeDaArea(x.disciplina)).join(", ")}. Estudantes pedem reforço ou tiram dúvidas nessas disciplinas e ninguém da equipe as assina.
        </section>
      )}

      <section>
        <h2 className="jornal-secao"><span className="jornal-editoria">Por disciplina</span></h2>
        <p className="mt-2 text-ink-soft">Clique no título de uma coluna para ordenar por ela.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="py-2 pr-3">Disciplina</th>
                {colunas.map(([k, nome]) => (
                  <th key={k} className="py-2 pr-3">
                    <button type="button" onClick={() => setOrdem(k)} aria-pressed={ordem === k} className={`cursor-pointer text-left ${ordem === k ? "underline decoration-oxblood decoration-2" : ""}`}>{nome}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.disciplina} className="border-b border-rule">
                  <td className="py-2 pr-3 font-semibold">{nomeDaArea(x.disciplina)}</td>
                  {colunas.map(([k]) => (
                    <td key={k} className={`py-2 pr-3 tabular-nums ${k === "educadores" && x[k] === 0 ? "font-semibold text-oxblood" : ""}`}>{x[k]}</td>
                  ))}
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={colunas.length + 1} className="py-4 text-ink-soft">Ainda não há números.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="jornal-secao"><span className="jornal-editoria">Pedidos de disciplinas novas</span></h2>
        <p className="mt-2 text-ink-soft">Sugestões enviadas pelo público e pela equipe pelo formulário de contribuição (tipo “sugestão”).</p>
        {d.pedidos_de_disciplina.length === 0 ? (
          <p className="mt-3 text-ink-soft">Nenhum pedido ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {d.pedidos_de_disciplina.map((p, i) => (
              <li key={i} className="border border-rule bg-parchment-deep p-3">
                <p className="font-semibold">{p.titulo} <span className="font-normal text-ink-soft">· {dataHora(p.criado_em)} · {p.status}</span></p>
                <p className="mt-1 whitespace-pre-wrap text-ink-soft" data-original>{p.corpo}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
