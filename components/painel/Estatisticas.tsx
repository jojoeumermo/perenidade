// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BookOpen, ChartColumn, Download, Gauge, Lightbulb } from "lucide-react";
import { useI18n } from "../I18n";
import { dataHora, papeis, useLista } from "./comum";
import { Botao, CabecalhoDeSecao, Cartao, type ColumnDef, Esqueleto, Estatistica, Estatisticas as GradeDeEstatisticas, Faixa, ItemDeLista, Lista, Selo, Tabela, Vazio } from "./ui";

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

/** O retrato geral: equipe, revisão, reforço e o que está esperando alguém (quadros de número, com o tom de alerta quando passa do prazo). */
function Retrato({ p }: { p: Panorama }) {
  const papeisEmOrdem = Object.entries(p.por_papel).sort((a, b) => b[1] - a[1]);
  const tiposEmOrdem = Object.entries(p.por_tipo_365d).sort((a, b) => b[1] - a[1]);
  const maiorTipo = Math.max(1, ...tiposEmOrdem.map(([, n]) => n));
  return (
    <section className="pn-secao" aria-labelledby="est-panorama">
      <CabecalhoDeSecao id="est-panorama" titulo="Panorama" simbolo={Gauge} />
      <GradeDeEstatisticas rotulo="Panorama">
        <Estatistica valor={p.equipe} rotulo="Pessoas na equipe" detalhe="Com algum cargo e conta ativa." />
        <Estatistica valor={p.na_fila} rotulo="Na fila de revisão" detalhe={p.na_fila ? `A mais antiga espera há ${p.fila_mais_antiga_dias} dia(s).` : "Fila vazia."} tom={p.fila_mais_antiga_dias > 14 ? "erro" : "neutro"} />
        <Estatistica valor={tempo(p.revisao_mediana_horas)} rotulo="Tempo típico de revisão" detalhe="Mediana entre o envio e a decisão, nos últimos 180 dias." />
        <Estatistica valor={porcento(p.aprovadas_180d, p.aprovadas_180d + p.recusadas_180d)} rotulo="Aprovação" detalhe={`${p.aprovadas_180d} aprovadas e ${p.recusadas_180d} recusadas em 180 dias.`} />
        <Estatistica valor={porcento(p.reforco_atendidos_90d, p.reforco_validos_90d)} rotulo="Reforço atendido" detalhe={`${p.reforco_atendidos_90d} de ${p.reforco_validos_90d} pedidos em 90 dias (sem os cancelados).`} />
        <Estatistica valor={tempo(p.reforco_espera_mediana_horas)} rotulo="Espera típica do reforço" detalhe="Mediana entre o pedido e o atendimento." />
        <Estatistica valor={p.reforco_aberto_mais_antigo_dias ? `${p.reforco_aberto_mais_antigo_dias} d` : "—"} rotulo="Reforço aberto mais antigo" detalhe="Dias desde o pedido que ainda espera." tom={p.reforco_aberto_mais_antigo_dias > 7 ? "erro" : "neutro"} />
        <Estatistica valor={p.erros_abertos} rotulo="Erros relatados em aberto" detalhe={`Mural de Saúde: ${p.saude_publicados} publicados, ${p.saude_aguardando} aguardando.`} tom={p.erros_abertos > 0 ? "aviso" : "neutro"} />
      </GradeDeEstatisticas>
      <div className="grid gap-4 md:grid-cols-2">
        <Cartao titulo="Equipe por cargo" nivelDoTitulo={3}>
          {papeisEmOrdem.length === 0 ? (
            <p className="text-ink-soft">Ninguém com cargo ainda.</p>
          ) : (
            <Lista rotulo="Equipe por cargo" plana>
              {papeisEmOrdem.map(([papel, n]) => (
                <ItemDeLista key={papel} titulo={papeis[papel as keyof typeof papeis] ?? papel} selo={<span className="tabular-nums">{n}</span>} />
              ))}
            </Lista>
          )}
        </Cartao>
        <Cartao titulo="O que chegou nos últimos 12 meses" nivelDoTitulo={3}>
          <ul className="space-y-1.5 text-sm">
            {tiposEmOrdem.map(([tipo, n]) => (
              <li key={tipo} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2">
                <span className="truncate">{TIPOS[tipo] ?? tipo}</span>
                <span className="h-3 rounded-sm" style={{ width: `${Math.max(2, (n / maiorTipo) * 100)}%`, background: "var(--pn-texto)" }} />
                <span className="text-right tabular-nums">{n}</span>
              </li>
            ))}
            {tiposEmOrdem.length === 0 && <li className="text-ink-soft">Nada enviado ainda.</li>}
          </ul>
        </Cartao>
      </div>
    </section>
  );
}

type Ordem = keyof Omit<Disciplina, "disciplina">;

/** As três séries do gráfico dos meses, com a cor de cada uma vinda dos tokens (tinta, bordô e ouro). */
const SERIES = [
  ["aulas", "var(--pn-texto)", "Aulas enviadas"],
  ["reforco", "var(--pn-destaque)", "Pedidos de reforço"],
  ["duvidas", "var(--pn-ouro)", "Dúvidas na comunidade"],
] as const;

/**
 * O que os estudantes procuram e o que a equipe produz, por disciplina: a base para a coordenação pedagógica decidir
 * que disciplinas entram, quais precisam de educador e onde falta aula. Só contagens, nenhum dado de pessoa.
 */
export function Estatisticas() {
  const { t } = useI18n();
  const dados = useLista<Dados>("painel_estatisticas");
  // A ordem de partida (e a da planilha): o reforço pedido em 90 dias. Na tabela, o título de cada coluna reordena.
  const ordem: Ordem = "reforco_90d";
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  if (dados.erro) {
    return (
      <Faixa
        tom="erro"
        acao={
          <Botao pequeno onClick={dados.recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {dados.erro}
      </Faixa>
    );
  }
  if (!dados.dados) return <Esqueleto forma="cartoes" linhas={4} rotulo="Carregando…" />;
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
  const definicoes: ColumnDef<Disciplina>[] = [
    { id: "disciplina", header: "Disciplina", accessorFn: (x) => nomeDaArea(x.disciplina), cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
    {
      id: "aprovacao",
      header: "Aprovação",
      accessorFn: (x) => (x.aulas_aprovadas + x.aulas_recusadas ? x.aulas_aprovadas / (x.aulas_aprovadas + x.aulas_recusadas) : -1),
      cell: ({ row }) => <span className="tabular-nums">{porcento(row.original.aulas_aprovadas, row.original.aulas_aprovadas + row.original.aulas_recusadas)}</span>,
    },
    ...colunas.map(
      ([k, nome]): ColumnDef<Disciplina> => ({
        id: k,
        header: nome,
        accessorFn: (x) => x[k],
        sortDescFirst: true,
        // Disciplina sem educador fica marcada em selo (o zero e a cor de erro), e a faixa do alto diz o que isso quer dizer.
        cell: ({ row }) =>
          k === "educadores" && row.original[k] === 0 ? (
            <Selo tom="erro" ponto>
              0
            </Selo>
          ) : (
            <span className="tabular-nums">{row.original[k]}</span>
          ),
      }),
    ),
  ];
  const semEducador = lista.filter((x) => x.educadores === 0 && (x.reforco_90d > 0 || x.duvidas_comunidade > 0));
  return (
    <div className="pn-tela">
      {d.panorama && <Retrato p={d.panorama} />}

      <section className="pn-secao" aria-labelledby="est-meses">
        <CabecalhoDeSecao id="est-meses" titulo="Últimos seis meses" simbolo={ChartColumn} />
        <Cartao>
          <div className="grid grid-cols-6 gap-2">
            {d.meses.map((m) => (
              <div key={m.mes} className="flex flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  {SERIES.map(([k, cor, nome]) => (
                    <span key={k} title={`${nome}: ${m[k]}`} className="relative w-3 rounded-t-sm sm:w-5" style={{ height: `${Math.max(2, (m[k] / maior) * 100)}%`, background: cor }}>
                      {m[k] > 0 && <span className="absolute -top-4 left-1/2 hidden -translate-x-1/2 font-mono text-[0.6rem] text-ink tabular-nums sm:block">{m[k]}</span>}
                    </span>
                  ))}
                </div>
                <span className="pn-rotulo-mono">
                  {m.mes.slice(5)}/{m.mes.slice(2, 4)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
            {SERIES.map(([k, cor, nome]) => (
              <span key={k}>
                <span aria-hidden className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: cor }} />
                {nome}
              </span>
            ))}
          </p>
        </Cartao>
      </section>

      {semEducador.length > 0 && (
        <Faixa tom="aviso" titulo="Procura sem educador:">
          {semEducador.map((x) => nomeDaArea(x.disciplina)).join(", ")}. Estudantes pedem reforço ou tiram dúvidas nessas disciplinas e ninguém da equipe as assina.
        </Faixa>
      )}

      <section className="pn-secao" aria-labelledby="est-disciplinas">
        <CabecalhoDeSecao
          id="est-disciplinas"
          titulo="Por disciplina"
          simbolo={BookOpen}
          sobre="Clique no título de uma coluna para ordenar por ela. “Aprovação” conta aulas aprovadas sobre aprovadas e recusadas."
          acoes={
            lista.length > 0 && (
              <Botao simbolo={Download} onClick={() => baixarCsv(lista, colunas, nomeDaArea)}>
                Baixar planilha (CSV)
              </Botao>
            )
          }
        />
        <Tabela dados={lista} colunas={definicoes} legenda="Por disciplina" densa vazio={<Vazio titulo="Ainda não há números." />} />
      </section>

      <section className="pn-secao" aria-labelledby="est-pedidos">
        <CabecalhoDeSecao id="est-pedidos" titulo="Pedidos de disciplinas novas" simbolo={Lightbulb} sobre="Sugestões enviadas pelo público e pela equipe pelo formulário de contribuição (tipo “sugestão”)." />
        {d.pedidos_de_disciplina.length === 0 ? (
          <Vazio titulo="Nenhum pedido ainda." />
        ) : (
          <div className="grid gap-3">
            {d.pedidos_de_disciplina.map((p, i) => (
              <Cartao key={i} as="article">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {p.titulo}
                  <span className="font-normal text-ink-soft">· {dataHora(p.criado_em)}</span>
                  <Selo>{p.status}</Selo>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-ink-soft" data-original>
                  {p.corpo}
                </p>
              </Cartao>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
