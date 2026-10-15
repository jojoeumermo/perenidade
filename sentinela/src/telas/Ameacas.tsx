// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useEffect, useState } from "react";
import { BarrasHorizontais, Linhas } from "../componentes/graficos.tsx";
import { Abas, Aviso, Cartao, Carregando, Gravidade, Tabela, Titulo } from "../componentes/ui.tsx";
import { analista, avisarMudanca, rpc, textoDoErro, useDados, type Eu } from "../lib/backend.ts";
import { dataHora, faz, nomeFonte, nomeTipoAcao, numero } from "../lib/formato.ts";

interface Resumo {
  ips: { ip: string; pais: string; asn: string; asn_nome: string; total: number; bloqueios: number; primeiro: string; ultimo: string; abuso: number }[];
  paises: { pais: string; total: number }[];
  caminhos: { caminho: string; total: number }[];
  regras: { regra: string; acao: string; total: number }[];
  logins_falhos: { em: string; total: number }[];
  por_hora: { em: string; waf: number; isca: number; auth: number }[];
}
interface Evento {
  id: number; em: string; fonte: string; tipo: string; gravidade: string; ip: string; pais: string; asn: string; asn_nome: string; caminho: string; agente: string; acao: string; regra: string; detalhes: Record<string, unknown>;
}

export function Ameacas({ eu }: { eu: Eu }) {
  const [horas, setHoras] = useState(24);
  const [aba, setAba] = useState<"origens" | "eventos" | "logins">("origens");
  const [filtro, setFiltro] = useState({ fonte: "", busca: "", ip: "" });
  const resumo = useDados<Resumo>("ameacas_resumo", { p_horas: horas });
  const eventos = useDados<Evento[]>("eventos_listar", { p: { horas, fonte: filtro.fonte || undefined, busca: filtro.busca || undefined, ip: filtro.ip || undefined } });
  const [proposta, setProposta] = useState<{ tipo: string; alvo: string } | null>(null);
  useEffect(() => {
    void rpc("tela_vista", { p_tela: "ameacas" }).catch(() => null);
  }, []);

  if (!resumo.dados) return <Carregando erro={resumo.erro} />;
  const r = resumo.dados;
  return (
    <div>
      <Titulo sub="O que o WAF da Cloudflare bloqueou, quem insiste, de onde e por qual caminho. Só o que os logs já trazem.">Ameaças</Titulo>
      <div className="mb-4 flex flex-wrap items-center gap-2 font-sans text-xs">
        <span className="rotulo mr-1">Período</span>
        {[6, 24, 72, 168].map((h) => <button key={h} type="button" className={`border px-2 py-1 ${horas === h ? "border-ink bg-ink text-parchment" : "border-rule"}`} onClick={() => setHoras(h)}>{h < 48 ? `${h} h` : `${h / 24} dias`}</button>)}
      </div>
      <Cartao titulo="Eventos por hora" className="mb-4">
        <Linhas dados={r.por_hora} series={[{ chave: "waf", nome: "WAF" }, { chave: "isca", nome: "iscas" }, { chave: "auth", nome: "entradas erradas" }]} />
      </Cartao>
      <Abas opcoes={[{ id: "origens", nome: "Origens" }, { id: "eventos", nome: "Eventos", conta: eventos.dados?.length }, { id: "logins", nome: "Entradas erradas" }]} atual={aba} escolher={setAba} />

      {aba === "origens" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Cartao titulo="Origens mais insistentes" className="xl:col-span-2">
            <Tabela
              linhas={r.ips}
              chave={(o) => o.ip}
              colunas={[
                { nome: "IP", valor: (o) => <button type="button" className="mono underline" onClick={() => { setFiltro({ ...filtro, ip: o.ip }); setAba("eventos"); }}>{o.ip}</button> },
                { nome: "País", valor: (o) => o.pais || "—" },
                { nome: "Rede (ASN)", valor: (o) => <span title={o.asn}>{o.asn_nome || o.asn || "—"}</span> },
                { nome: "Eventos", valor: (o) => <span className="mono">{numero(o.total)}</span> },
                { nome: "Bloqueios", valor: (o) => <span className="mono">{numero(o.bloqueios)}</span> },
                { nome: "Reputação", valor: (o) => (o.abuso < 0 ? <span className="text-ink-soft">—</span> : <span className="mono" style={{ color: o.abuso >= 80 ? "var(--estado-critico)" : o.abuso >= 40 ? "var(--estado-atencao)" : "inherit" }}>{o.abuso}</span>) },
                { nome: "Último", valor: (o) => <span className="mono text-xs">{faz(o.ultimo)}</span> },
                { nome: "", valor: (o) => (analista(eu) ? <button type="button" className="font-sans text-xs underline" onClick={() => setProposta({ tipo: "bloquear_ip", alvo: o.ip })}>sugerir bloqueio</button> : null) },
              ]}
              vazio="Nenhuma origem registrada no período."
            />
            {proposta && <Propor proposta={proposta} fechar={() => setProposta(null)} />}
          </Cartao>
          <div className="space-y-4">
            <Cartao titulo="Países"><BarrasHorizontais dados={r.paises} rotulo="pais" valor="total" /></Cartao>
            <Cartao titulo="Rotas visadas"><BarrasHorizontais dados={r.caminhos} rotulo="caminho" valor="total" /></Cartao>
            <Cartao titulo="Regras do WAF"><BarrasHorizontais dados={r.regras.map((x) => ({ ...x, nome: `${x.regra || "?"} · ${x.acao}` }))} rotulo="nome" valor="total" /></Cartao>
          </div>
        </div>
      )}

      {aba === "eventos" && (
        <Cartao titulo="Eventos">
          <div className="mb-3 flex flex-wrap gap-2 font-sans text-xs">
            <select className="campo !mt-0 !w-auto" value={filtro.fonte} onChange={(e) => setFiltro({ ...filtro, fonte: e.target.value })} aria-label="Fonte">
              <option value="">todas as fontes</option>
              {Object.entries(nomeFonte).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="campo !mt-0 !w-56" placeholder="caminho, IP, rede, país…" value={filtro.busca} onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })} aria-label="Buscar" />
            {filtro.ip && <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => setFiltro({ ...filtro, ip: "" })}>IP {filtro.ip} ✕</button>}
          </div>
          {eventos.erro && <Aviso texto={eventos.erro} />}
          <Tabela
            linhas={eventos.dados ?? []}
            chave={(e) => e.id}
            colunas={[
              { nome: "Quando", valor: (e) => <span className="mono text-xs">{dataHora(e.em)}</span> },
              { nome: "Fonte", valor: (e) => nomeFonte[e.fonte] ?? e.fonte },
              { nome: "Grav.", valor: (e) => <Gravidade valor={e.gravidade} /> },
              { nome: "Origem", valor: (e) => <span className="mono text-xs">{e.ip}{e.pais ? ` · ${e.pais}` : ""}</span> },
              { nome: "Caminho / tipo", valor: (e) => <span className="break-all">{e.caminho || e.tipo}</span> },
              { nome: "Ação", valor: (e) => <span className="mono text-xs">{e.acao}{e.regra ? ` · ${e.regra}` : ""}</span> },
            ]}
            vazio="Nenhum evento com esses filtros."
          />
        </Cartao>
      )}

      {aba === "logins" && (
        <Cartao titulo="Entradas recusadas no serviço de contas do site, por hora">
          <Linhas dados={r.logins_falhos} series={[{ chave: "total", nome: "entradas erradas" }]} />
          <p className="mt-2 font-sans text-xs text-ink-soft">Vem dos registros do Supabase do site (precisa do token da Management API no coletor). Sem ele, esta aba fica vazia.</p>
        </Cartao>
      )}
    </div>
  );
}

/** Propor bloqueio: outra pessoa confirma; o coletor aplica na Cloudflare. */
export function Propor({ proposta, fechar, incidente }: { proposta: { tipo: string; alvo: string }; fechar: () => void; incidente?: string }) {
  const [tipo, setTipo] = useState(proposta.tipo);
  const [alvo, setAlvo] = useState(proposta.alvo);
  const [motivo, setMotivo] = useState("");
  const [horas, setHoras] = useState(24);
  const [aviso, setAviso] = useState("");
  const [ok, setOk] = useState(false);
  async function enviar() {
    setAviso("");
    try {
      await rpc("acao_propor", { p: { tipo, alvo, motivo, duracao_horas: horas, incidente } });
      setOk(true);
      avisarMudanca();
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  if (ok) return <p className="aviso aviso-ok mt-3">Proposta registrada. Outra pessoa da equipe (dono ou analista) precisa confirmar em Incidentes → Ações antes de o coletor aplicar na Cloudflare.</p>;
  return (
    <form className="quadro mt-3 space-y-2 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      <p className="rotulo">Sugerir bloqueio na Cloudflare</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label>Tipo<select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>{Object.entries(nomeTipoAcao).filter(([k]) => k !== "desbloquear").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Alvo<input className="campo mono" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder={tipo === "bloquear_asn" ? "AS64500" : tipo === "bloquear_pais" ? "BR" : "203.0.113.9"} required /></label>
        <label>Duração (horas)<input type="number" className="campo" min={1} max={2160} value={horas} onChange={(e) => setHoras(Number(e.target.value))} /></label>
      </div>
      <label className="block">Motivo (fica no registro)<input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={5} maxLength={500} required /></label>
      <div className="flex gap-2"><button type="submit" className="botao" disabled={motivo.length < 5}>Propor</button><button type="button" className="botao-claro" onClick={fechar}>Cancelar</button></div>
      <Aviso texto={aviso} />
      <p className="text-xs text-ink-soft">Nada é aplicado agora: a proposta espera a confirmação de outra pessoa. O bloqueio é desfeito sozinho quando a duração vence.</p>
    </form>
  );
}
