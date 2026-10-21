// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useI18n } from "../I18n";
import { botaoClaro, dataHora, papeis, useLista } from "./comum";

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
interface Panorama {
  equipe: number;
  por_papel: Record<string, number>;
  por_tipo_365d: Record<string, number>;
  na_fila: number;
  fila_mais_antiga_dias: number;
  revisao_mediana_horas: number;
  aprovadas_180d: number;
  recusadas_180d: number;
  reforco_atendidos_90d: number;
  reforco_validos_90d: number;
  reforco_espera_mediana_horas: number;
  reforco_aberto_mais_antigo_dias: number;
  erros_abertos: number;
  saude_publicados: number;
  saude_aguardando: number;
}
interface Dados {
  disciplinas: Disciplina[];
  meses: { mes: string; aulas: number; reforco: number; duvidas: number }[];
  pedidos_de_disciplina: { titulo: string; corpo: string; criado_em: string; status: string }[];
  /** Pode faltar enquanto o banco não recebe a versão nova do install.sql. */
  panorama?: Panorama;
}

/** Nome, no painel, de cada tipo de contribuição guardado no banco. */
const TIPOS: Record<string, string> = {
  aula: "Aulas", avulso: "Materiais avulsos", questao: "Questões", obra: "Obras do acervo", artigo: "Artigos", checagem: "Checagens",
  debate: "Debates", verbete: "Verbetes", memorial: "Memorial", video: "Vídeos", frase: "Frases", traducao: "Traduções",
  correcao: "Correções", sugestao: "Sugestões", temas: "Temas",
};

/** Horas em texto curto: "5 h", "2,5 dias". */
function tempo(horas: number) {
  if (!horas) return "—";
  return horas < 48 ? `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : `${(horas / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}
const porcento = (parte: number, todo: number) => (todo ? `${Math.round((parte / todo) * 100)}%` : "—");

/** A tabela por disciplina em CSV, para abrir em planilha. Só contagens, como na tela. */
function baixarCsv(linhas: Disciplina[], colunas: [keyof Disciplina, string][], nomeDaArea: (slug: string) => string) {
  const celula = (v: string | number) => (typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`);
  const texto = [["Disciplina", ...colunas.map(([, nome]) => nome)].map(celula).join(","),
    ...linhas.map((x) => [nomeDaArea(x.disciplina), ...colunas.map(([k]) => x[k])].map(celula).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `estatisticas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Numero({ valor, nome, nota, alerta = false }: { valor: string | number; nome: string; nota?: string; alerta?: boolean }) {
  return (
    <div className={`border-2 p-3 ${alerta ? "border-oxblood" : "border-ink"} bg-parchment-deep`}>
      <p className={`font-serif text-3xl font-semibold tabular-nums ${alerta ? "text-oxblood" : ""}`}>{valor}</p>
      <p className="mt-1 text-sm font-semibold">{nome}</p>
      {nota && <p className="mt-0.5 text-xs text-ink-soft">{nota}</p>}
    </div>
  );
}

/** O retrato geral: equipe, revisão, reforço e o que está esperando alguém. */
function Retrato({ p }: { p: Panorama }) {
  const papeisEmOrdem = Object.entries(p.por_papel).sort((a, b) => b[1] - a[1]);
  const tiposEmOrdem = Object.entries(p.por_tipo_365d).sort((a, b) => b[1] - a[1]);
  const maiorTipo = Math.max(1, ...tiposEmOrdem.map(([, n]) => n));
  return (
    <section>
      <h2 className="jornal-secao"><span className="jornal-editoria">Panorama</span></h2>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero valor={p.equipe} nome="Pessoas na equipe" nota="Com algum cargo e conta ativa." />
        <Numero valor={p.na_fila} nome="Na fila de revisão" nota={p.na_fila ? `A mais antiga espera há ${p.fila_mais_antiga_dias} dia(s).` : "Fila vazia."} alerta={p.fila_mais_antiga_dias > 14} />
        <Numero valor={tempo(p.revisao_mediana_horas)} nome="Tempo típico de revisão" nota="Mediana entre o envio e a decisão, nos últimos 180 dias." />
        <Numero valor={porcento(p.aprovadas_180d, p.aprovadas_180d + p.recusadas_180d)} nome="Aprovação" nota={`${p.aprovadas_180d} aprovadas e ${p.recusadas_180d} recusadas em 180 dias.`} />
        <Numero valor={porcento(p.reforco_atendidos_90d, p.reforco_validos_90d)} nome="Reforço atendido" nota={`${p.reforco_atendidos_90d} de ${p.reforco_validos_90d} pedidos em 90 dias (sem os cancelados).`} />
        <Numero valor={tempo(p.reforco_espera_mediana_horas)} nome="Espera típica do reforço" nota="Mediana entre o pedido e o atendimento." />
        <Numero valor={p.reforco_aberto_mais_antigo_dias ? `${p.reforco_aberto_mais_antigo_dias} d` : "—"} nome="Reforço aberto mais antigo" nota="Dias desde o pedido que ainda espera." alerta={p.reforco_aberto_mais_antigo_dias > 7} />
        <Numero valor={p.erros_abertos} nome="Erros relatados em aberto" nota={`Saúde Solidária: ${p.saude_publicados} na vitrine, ${p.saude_aguardando} aguardando.`} alerta={p.erros_abertos > 0} />
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">Equipe por cargo</h3>
          <ul className="mt-2 divide-y divide-rule border-y border-rule text-sm">
            {papeisEmOrdem.map(([papel, n]) => (
              <li key={papel} className="flex justify-between gap-3 py-1.5"><span>{papeis[papel as keyof typeof papeis] ?? papel}</span><span className="tabular-nums">{n}</span></li>
            ))}
            {papeisEmOrdem.length === 0 && <li className="py-1.5 text-ink-soft">Ninguém com cargo ainda.</li>}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">O que chegou nos últimos 12 meses</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {tiposEmOrdem.map(([tipo, n]) => (
              <li key={tipo} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2">
                <span className="truncate">{TIPOS[tipo] ?? tipo}</span>
                <span className="h-3 bg-ink" style={{ width: `${Math.max(2, (n / maiorTipo) * 100)}%` }} />
                <span className="text-right tabular-nums">{n}</span>
              </li>
            ))}
            {tiposEmOrdem.length === 0 && <li className="text-ink-soft">Nada enviado ainda.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
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
      {d.panorama && <Retrato p={d.panorama} />}

      <section>
        <h2 className="jornal-secao"><span className="jornal-editoria">Últimos seis meses</span></h2>
        <div className="mt-4 grid grid-cols-6 gap-2 border-2 border-ink bg-parchment-deep p-4">
          {d.meses.map((m) => (
            <div key={m.mes} className="flex flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                {([["aulas", "#17130e", "Aulas enviadas"], ["reforco", "#c21f16", "Pedidos de reforço"], ["duvidas", "#8a5a16", "Dúvidas na comunidade"]] as const).map(([k, cor, nome]) => (
                  <span key={k} title={`${nome}: ${m[k]}`} className="relative w-3 sm:w-5" style={{ height: `${Math.max(2, (m[k] / maior) * 100)}%`, background: cor }}>
                    {m[k] > 0 && <span className="absolute -top-4 left-1/2 hidden -translate-x-1/2 font-mono text-[0.6rem] text-ink sm:block">{m[k]}</span>}
                  </span>
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-soft">Clique no título de uma coluna para ordenar por ela. “Aprovação” conta aulas aprovadas sobre aprovadas e recusadas.</p>
          {lista.length > 0 && <button type="button" onClick={() => baixarCsv(lista, colunas, nomeDaArea)} className={botaoClaro}>Baixar planilha (CSV)</button>}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="py-2 pr-3">Disciplina</th>
                <th className="py-2 pr-3">Aprovação</th>
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
                  <td className="py-2 pr-3 tabular-nums">{porcento(x.aulas_aprovadas, x.aulas_aprovadas + x.aulas_recusadas)}</td>
                  {colunas.map(([k]) => (
                    <td key={k} className={`py-2 pr-3 tabular-nums ${k === "educadores" && x[k] === 0 ? "font-semibold text-oxblood" : ""}`}>{x[k]}</td>
                  ))}
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={colunas.length + 2} className="py-4 text-ink-soft">Ainda não há números.</td></tr>}
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
