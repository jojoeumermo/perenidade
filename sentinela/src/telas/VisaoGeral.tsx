// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useState } from "react";
import { Barras, Faisca, Linha, Medidor } from "../componentes/graficos.tsx";
import { Aviso, Cartao, Carregando, Dobra, Figura, Gravidade, NoAr, Titulo } from "../componentes/ui.tsx";
import { analista, avisarMudanca, textoDoErro, useDados, worker, type Eu } from "../lib/backend.ts";
import { dataHora, faz, nomeRegra, numero, porcento } from "../lib/formato.ts";

interface Resumo {
  agora: string;
  ultima_coleta: string | null;
  site: { no_ar: boolean; status: number; ms: number; em: string; nota: number } | null;
  disponibilidade: number | null;
  ms_mediana: number | null;
  tempos: { em: string; ms: number; no_ar: boolean }[];
  trafego: { em: string; requisicoes: number; bloqueios: number; desafios: number }[];
  totais: { requisicoes: number; bloqueios: number; desafios: number };
  postura: { nota: number; componentes: { nome: string; pontos: number; maximo: number; faltas: string[] }[]; em: string } | null;
  postura_historico: { em: string; nota: number }[];
  alertas_abertos: number;
  alertas_recentes: { id: number; em: string; regra: string; gravidade: string; titulo: string; estado: string }[];
  incidentes_abertos: number;
  eventos_por_fonte: Record<string, number>;
  supabase: { no_ar: boolean; ms: number; em: string } | null;
  ultimo_deploy: { estado: string; ramo: string; mensagem: string; autor: string; pronto_em: string | null } | null;
}

export function VisaoGeral({ eu, ir }: { eu: Eu; ir: (tela: string) => void }) {
  const [horas, setHoras] = useState(24);
  const { dados, erro, carregando, recarregar } = useDados<Resumo>("resumo", { p_horas: horas });
  const [aviso, setAviso] = useState("");
  const [coletando, setColetando] = useState(false);

  async function coletarAgora() {
    setColetando(true);
    setAviso("");
    try {
      const r = (await worker("/coletar")) as { partes?: Record<string, string> };
      setAviso(`Coleta feita: ${Object.entries(r.partes ?? {}).map(([k, v]) => `${k} — ${v}`).join(" · ")}`.slice(0, 400));
      avisarMudanca();
      recarregar();
    } catch (e) {
      setAviso(textoDoErro(e));
    } finally {
      setColetando(false);
    }
  }

  if (!dados) return <Carregando erro={erro} />;
  const trafegoAgrupado = agrupar(dados.trafego, horas > 48 ? 12 : horas > 24 ? 6 : 3);
  return (
    <div className={carregando ? "opacity-80 transition-opacity" : ""}>
      <Titulo sub={`Última coleta ${faz(dados.ultima_coleta)} · ${dataHora(dados.ultima_coleta)}`}>Visão geral</Titulo>
      <div className="mb-4 flex flex-wrap items-center gap-2 font-sans text-xs">
        <span className="rotulo mr-1">Período</span>
        {[6, 24, 72, 168].map((h) => (
          <button key={h} type="button" className={`border px-2 py-1 ${horas === h ? "border-ink bg-ink text-parchment" : "border-rule"}`} onClick={() => setHoras(h)}>{h < 48 ? `${h} h` : `${h / 24} dias`}</button>
        ))}
        {analista(eu) && <button type="button" className="botao-claro ml-auto !py-1 !text-xs" disabled={coletando} onClick={() => void coletarAgora()}>{coletando ? "Coletando…" : "Coletar agora"}</button>}
      </div>
      <Aviso texto={aviso} ok={!/Confira|não|Algo|permissão/.test(aviso)} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Cartao titulo="Site">
          <div className="flex items-end justify-between gap-2">
            <Figura rotulo="" valor={<NoAr valor={dados.site?.no_ar} />} />
            <p className="mono text-2xl font-semibold">{dados.site?.ms ?? "—"}<span className="ml-1 text-xs text-ink-soft">ms</span></p>
          </div>
          <p className="mt-2 font-sans text-xs text-ink-soft">Disponibilidade no período: <strong className="mono text-ink">{porcento(dados.disponibilidade)}</strong> · mediana <span className="mono">{numero(dados.ms_mediana)} ms</span></p>
          <div className="mt-2"><Faisca dados={dados.tempos} chave="ms" largura={220} /></div>
        </Cartao>
        <Cartao titulo="Requisições vs. bloqueios">
          <div className="flex items-baseline gap-3">
            <p className="numero-heroi">{numero(dados.totais.requisicoes)}</p>
            <p className="font-sans text-xs text-ink-soft">requisições<br /><strong className="mono text-ink">{numero(dados.totais.bloqueios)}</strong> bloqueios · <strong className="mono text-ink">{numero(dados.totais.desafios)}</strong> desafios</p>
          </div>
        </Cartao>
        <Cartao titulo="Índice de postura" acao={<span className="mono text-xs text-ink-soft">{dados.postura ? faz(dados.postura.em) : ""}</span>}>
          <div className="flex items-baseline gap-2">
            <p className="numero-heroi">{dados.postura?.nota ?? "—"}</p>
            <span className="font-sans text-xs text-ink-soft">/ 100</span>
          </div>
          <div className="mt-2"><Medidor valor={dados.postura?.nota ?? 0} /></div>
          <Dobra titulo="O que compõe a nota">
            <ul className="space-y-1 font-sans text-xs">
              {dados.postura?.componentes.map((c) => (
                <li key={c.nome}>
                  <span className="flex justify-between"><span>{c.nome}</span><span className="mono">{c.pontos}/{c.maximo}</span></span>
                  {c.faltas.map((f) => <span key={f} className="block pl-3 text-oxblood">· {f}</span>)}
                </li>
              ))}
            </ul>
          </Dobra>
        </Cartao>
        <Cartao titulo="Em aberto">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="text-left" onClick={() => ir("alertas")}><Figura rotulo="Alertas" valor={dados.alertas_abertos} detalhe="abrir a lista" /></button>
            <button type="button" className="text-left" onClick={() => ir("incidentes")}><Figura rotulo="Incidentes" valor={dados.incidentes_abertos} detalhe="acompanhar" /></button>
          </div>
          <p className="mt-3 font-sans text-xs text-ink-soft">Serviço de contas do site: <NoAr valor={dados.supabase?.no_ar} /> {dados.supabase ? <span className="mono">{dados.supabase.ms} ms</span> : null}</p>
          {dados.ultimo_deploy && <p className="mt-1 font-sans text-xs text-ink-soft">Último deploy: <span className="mono">{dados.ultimo_deploy.estado}</span> · {dados.ultimo_deploy.ramo} · {faz(dados.ultimo_deploy.pronto_em)}</p>}
        </Cartao>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Cartao titulo="Tempo de resposta (ms)"><Linha dados={dados.tempos} chave="ms" nome="tempo de resposta" unidade="" /></Cartao>
        <Cartao titulo="Requisições e bloqueios"><Barras dados={trafegoAgrupado} series={[{ chave: "requisicoes", nome: "requisições" }, { chave: "bloqueios", nome: "bloqueios" }]} /></Cartao>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Cartao titulo="Alertas recentes" className="xl:col-span-2" acao={<button type="button" className="font-sans text-xs underline" onClick={() => ir("alertas")}>todos</button>}>
          {dados.alertas_recentes.length === 0 ? <p className="font-sans text-sm text-ink-soft">Nenhum alerta ainda. Bom sinal.</p> : (
            <ul className="divide-y divide-rule font-sans text-sm">
              {dados.alertas_recentes.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <Gravidade valor={a.gravidade} />
                  <span className="flex-1">{a.titulo}</span>
                  <span className="mono text-xs text-ink-soft">{nomeRegra[a.regra] ?? a.regra} · {faz(a.em)}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Eventos no período">
          <ul className="space-y-1 font-sans text-sm">
            {Object.entries(dados.eventos_por_fonte).sort((a, b) => b[1] - a[1]).map(([f, n]) => <li key={f} className="flex justify-between"><span>{f}</span><span className="mono">{numero(n)}</span></li>)}
            {Object.keys(dados.eventos_por_fonte).length === 0 && <li className="text-ink-soft">Nenhum evento no período.</li>}
          </ul>
          <div className="mt-3"><p className="rotulo">Postura nos últimos 30 dias</p><Faisca dados={dados.postura_historico} chave="nota" largura={220} /></div>
        </Cartao>
      </div>
    </div>
  );
}

/** Junta janelas de 5 minutos em blocos maiores, para as barras caberem na tela. */
function agrupar(lista: { em: string; requisicoes: number; bloqueios: number; desafios: number }[], de: number) {
  const saida: { em: string; requisicoes: number; bloqueios: number; desafios: number }[] = [];
  for (let i = 0; i < lista.length; i += de) {
    const bloco = lista.slice(i, i + de);
    saida.push({ em: bloco[0].em, requisicoes: bloco.reduce((s, b) => s + b.requisicoes, 0), bloqueios: bloco.reduce((s, b) => s + b.bloqueios, 0), desafios: bloco.reduce((s, b) => s + b.desafios, 0) });
  }
  return saida;
}
