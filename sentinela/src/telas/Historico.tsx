// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useState } from "react";
import { Barras, Linha } from "../componentes/graficos.tsx";
import { Aviso, Cartao, Figura, Titulo } from "../componentes/ui.tsx";
import { rpc, textoDoErro } from "../lib/backend.ts";
import { dataHora, dia, nomeEstado, nomeGravidade, nomeRegra, numero, porcento } from "../lib/formato.ts";
import { csv, salvarArquivo } from "../lib/nativo.ts";

interface Relatorio {
  periodo: { desde: string; ate: string; gerado_em: string; por: string };
  disponibilidade: { total: number; no_ar: number; percentual: number; ms_mediana: number | null; ms_p95: number | null };
  trafego: { requisicoes: number; bloqueios: number; desafios: number };
  trafego_por_dia: { dia: string; requisicoes: number; bloqueios: number }[];
  eventos_por_fonte: Record<string, number>;
  alertas: { id: number; em: string; regra: string; gravidade: string; titulo: string; estado: string }[];
  incidentes: { numero: number; titulo: string; gravidade: string; estado: string; aberto_em: string; resolvido_em: string | null; aberto_nome: string | null }[];
  acoes: { tipo: string; alvo: string; motivo: string; estado: string; proposta_em: string; proposta_nome: string | null; confirmada_nome: string | null }[];
  ips_top: { ip: string; pais: string; asn_nome: string; total: number }[];
  postura: { em: string; nota: number }[];
  deploys: { estado: string; ramo: string; criado_em: string }[];
  certificados_novos: { emissor: string; nomes: string[]; visto_em: string }[];
}

const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export function Historico() {
  const [desde, setDesde] = useState(diasAtras(30));
  const [ate, setAte] = useState(diasAtras(0));
  const [r, setR] = useState<Relatorio | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function gerar() {
    setOcupado(true);
    setAviso("");
    try {
      setR(await rpc<Relatorio>("relatorio", { p_desde: `${desde}T00:00:00Z`, p_ate: `${ate}T23:59:59Z` }));
    } catch (e) {
      setAviso(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const texto = r ? relatorioEmMarkdown(r) : "";
  return (
    <div>
      <Titulo sub="Um período, os números e tudo o que aconteceu, para guardar ou mostrar. Cada exportação fica no registro.">Histórico e relatório</Titulo>
      <div className="mb-4 flex flex-wrap items-end gap-2 font-sans text-sm">
        <label>De<input type="date" className="campo !mt-0" value={desde} max={ate} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Até<input type="date" className="campo !mt-0" value={ate} min={desde} onChange={(e) => setAte(e.target.value)} /></label>
        {[7, 30, 90].map((n) => <button key={n} type="button" className="botao-claro !py-1.5 !text-xs" onClick={() => { setDesde(diasAtras(n)); setAte(diasAtras(0)); }}>{n} dias</button>)}
        <button type="button" className="botao" disabled={ocupado} onClick={() => void gerar()}>{ocupado ? "Gerando…" : "Gerar relatório"}</button>
      </div>
      <Aviso texto={aviso} />
      {r && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 font-sans text-xs">
            <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void salvarArquivo(`sentinela-${desde}-a-${ate}.md`, texto, "text/markdown")}>Salvar relatório (.md)</button>
            <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void salvarArquivo(`sentinela-${desde}-a-${ate}.json`, JSON.stringify(r, null, 2), "application/json")}>Salvar dados (.json)</button>
            <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void salvarArquivo(`sentinela-alertas-${desde}-a-${ate}.csv`, csv(r.alertas), "text/csv")}>Alertas (.csv)</button>
            <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void salvarArquivo(`sentinela-origens-${desde}-a-${ate}.csv`, csv(r.ips_top), "text/csv")}>Origens (.csv)</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Cartao><Figura rotulo="Disponibilidade" valor={porcento(r.disponibilidade.percentual, 3)} detalhe={`${numero(r.disponibilidade.no_ar)} de ${numero(r.disponibilidade.total)} coletas no ar`} /></Cartao>
            <Cartao><Figura rotulo="Tempo de resposta" valor={`${numero(r.disponibilidade.ms_mediana)} ms`} detalhe={`mediana · p95 ${numero(r.disponibilidade.ms_p95)} ms`} /></Cartao>
            <Cartao><Figura rotulo="Requisições" valor={numero(r.trafego.requisicoes)} detalhe={`${numero(r.trafego.bloqueios)} bloqueios · ${numero(r.trafego.desafios)} desafios`} /></Cartao>
            <Cartao><Figura rotulo="Incidentes e alertas" valor={`${r.incidentes.length} · ${r.alertas.length}`} detalhe={`${r.acoes.length} ações de resposta`} /></Cartao>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Cartao titulo="Requisições e bloqueios por dia"><Barras dados={r.trafego_por_dia.map((t) => ({ em: dia(t.dia), requisicoes: t.requisicoes, bloqueios: t.bloqueios }))} series={[{ chave: "requisicoes", nome: "requisições" }, { chave: "bloqueios", nome: "bloqueios" }]} /></Cartao>
            <Cartao titulo="Índice de postura por dia"><Linha dados={r.postura} chave="nota" nome="postura" /></Cartao>
          </div>
          <Cartao titulo="Prévia do relatório"><pre className="mono max-h-[28rem] overflow-auto whitespace-pre-wrap border border-rule bg-parchment p-3 text-xs">{texto}</pre></Cartao>
        </div>
      )}
    </div>
  );
}

export function relatorioEmMarkdown(r: Relatorio): string {
  const l: string[] = [];
  l.push(`# Sentinela Lúcia — relatório de ${dataHora(r.periodo.desde).slice(0, 10)} a ${dataHora(r.periodo.ate).slice(0, 10)}`, "", `Gerado em ${dataHora(r.periodo.gerado_em)} por ${r.periodo.por}.`, "");
  l.push("## Disponibilidade e desempenho", "", `- Disponibilidade: **${porcento(r.disponibilidade.percentual, 3)}** (${r.disponibilidade.no_ar} de ${r.disponibilidade.total} coletas no ar)`, `- Tempo de resposta: mediana ${numero(r.disponibilidade.ms_mediana)} ms, p95 ${numero(r.disponibilidade.ms_p95)} ms`, "");
  l.push("## Tráfego", "", `- Requisições: ${r.trafego.requisicoes.toLocaleString("pt-BR")}`, `- Bloqueios do WAF: ${r.trafego.bloqueios.toLocaleString("pt-BR")}`, `- Desafios: ${r.trafego.desafios.toLocaleString("pt-BR")}`, "");
  l.push("## Eventos por fonte", "", ...Object.entries(r.eventos_por_fonte).map(([f, n]) => `- ${f}: ${n}`), "");
  l.push("## Origens mais insistentes", "", "| IP | País | Rede | Eventos |", "| --- | --- | --- | --- |", ...r.ips_top.slice(0, 15).map((i) => `| ${i.ip} | ${i.pais} | ${i.asn_nome} | ${i.total} |`), "");
  l.push("## Alertas", "", "| Quando | Gravidade | Regra | Título | Estado |", "| --- | --- | --- | --- | --- |", ...r.alertas.map((a) => `| ${dataHora(a.em)} | ${nomeGravidade[a.gravidade]} | ${nomeRegra[a.regra] ?? a.regra} | ${a.titulo} | ${nomeEstado[a.estado]} |`), "");
  l.push("## Incidentes", "", ...(r.incidentes.length ? r.incidentes.map((i) => `- #${i.numero} **${i.titulo}** — ${nomeGravidade[i.gravidade]}, ${nomeEstado[i.estado]}; aberto em ${dataHora(i.aberto_em)} por ${i.aberto_nome ?? "—"}${i.resolvido_em ? `, resolvido em ${dataHora(i.resolvido_em)}` : ""}`) : ["Nenhum."]), "");
  l.push("## Ações de resposta", "", ...(r.acoes.length ? r.acoes.map((a) => `- ${dataHora(a.proposta_em)}: ${a.tipo} ${a.alvo} (${a.motivo}) — ${nomeEstado[a.estado]}; proposta por ${a.proposta_nome ?? "—"}${a.confirmada_nome ? `, confirmada por ${a.confirmada_nome}` : ""}`) : ["Nenhuma."]), "");
  l.push("## Deploys", "", ...(r.deploys.length ? r.deploys.map((d) => `- ${dataHora(d.criado_em)}: ${d.estado} (${d.ramo})`) : ["Nenhum no período."]), "");
  l.push("## Certificados novos vistos nos CT logs", "", ...(r.certificados_novos.length ? r.certificados_novos.map((c) => `- ${dataHora(c.visto_em)}: ${c.emissor} para ${c.nomes.join(", ")}`) : ["Nenhum."]), "");
  l.push("## Índice de postura", "", ...r.postura.map((p) => `- ${dataHora(p.em).slice(0, 10)}: ${p.nota}`), "");
  return l.join("\n");
}
