// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useState } from "react";
import { Abas, Aviso, Cartao, Carregando, Confirmar, Estado, Gravidade, Tabela, Titulo } from "../componentes/ui.tsx";
import { analista, avisarMudanca, rpc, textoDoErro, useDados, type Eu } from "../lib/backend.ts";
import { dataHora, faz, modelos, nomeFonte, nomeTipoAcao } from "../lib/formato.ts";
import { Propor } from "./Ameacas.tsx";

interface Incidente {
  id: string; numero: number; titulo: string; resumo: string; gravidade: string; estado: string; modelo: string; aberto_por: string | null; atribuido_a: string | null; aberto_em: string; atualizado_em: string; resolvido_em: string | null; aberto_nome: string | null; atribuido_nome: string | null; alertas: number; eventos: number; acoes: number;
}
interface Detalhe extends Incidente {
  notas: { id: number; texto: string; tipo: string; em: string; autor: string | null; nome: string | null }[];
  alertas_lista: { id: number; em: string; regra: string; gravidade: string; titulo: string; estado: string }[];
  eventos_lista: { id: number; em: string; fonte: string; tipo: string; gravidade: string; ip: string; pais: string; asn_nome: string; caminho: string; acao: string }[];
  acoes_lista: Acao[];
}
export interface Acao {
  id: string; incidente: string | null; incidente_numero: number | null; tipo: string; alvo: string; motivo: string; duracao_horas: number; estado: string; proposta_por: string | null; proposta_nome: string | null; proposta_em: string; confirmada_por: string | null; confirmada_nome: string | null; confirmada_em: string | null; executada_em: string | null; resultado: Record<string, unknown>; referencia: string;
}
interface Pessoa {
  id: string;
  nome: string;
  papel: string;
  ativo: boolean;
}

export function Incidentes({ eu }: { eu: Eu }) {
  const [aba, setAba] = useState<"ativos" | "resolvido" | "acoes">("ativos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const lista = useDados<Incidente[]>("incidentes_listar", { p_estado: aba === "acoes" ? "ativos" : aba });
  const acoes = useDados<Acao[]>("acoes_listar");
  if (aberto) return <Detalhe id={aberto} eu={eu} voltar={() => setAberto(null)} />;
  return (
    <div>
      <Titulo sub="Abrir, atribuir, acompanhar e fechar. Bloqueios na Cloudflare passam por duas pessoas e ficam todos no registro.">Incidentes</Titulo>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Abas opcoes={[{ id: "ativos", nome: "Em aberto" }, { id: "resolvido", nome: "Resolvidos" }, { id: "acoes", nome: "Ações", conta: acoes.dados?.filter((a) => a.estado === "proposta").length }]} atual={aba} escolher={setAba} />
        {analista(eu) && aba !== "acoes" && <button type="button" className="botao !py-1.5 !text-xs" onClick={() => setNovo(true)}>Abrir incidente</button>}
      </div>
      {novo && <Novo eu={eu} fechar={() => setNovo(false)} abrir={(id) => { setNovo(false); setAberto(id); }} />}
      {aba !== "acoes" && (
        <Cartao>
          {!lista.dados ? <Carregando erro={lista.erro} /> : (
            <Tabela linhas={lista.dados} chave={(i) => i.id} colunas={[
              { nome: "#", valor: (i) => <span className="mono">{i.numero}</span> },
              { nome: "Título", valor: (i) => <button type="button" className="text-left font-medium underline" onClick={() => setAberto(i.id)}>{i.titulo}</button> },
              { nome: "Grav.", valor: (i) => <Gravidade valor={i.gravidade} /> },
              { nome: "Estado", valor: (i) => <Estado valor={i.estado} /> },
              { nome: "Responsável", valor: (i) => i.atribuido_nome || <span className="text-ink-soft">ninguém</span> },
              { nome: "Ligações", valor: (i) => <span className="mono text-xs">{i.alertas} alertas · {i.eventos} eventos · {i.acoes} ações</span> },
              { nome: "Atualizado", valor: (i) => <span className="mono text-xs">{faz(i.atualizado_em)}</span> },
            ]} vazio={aba === "ativos" ? "Nenhum incidente em aberto." : "Nenhum incidente resolvido ainda."} />
          )}
        </Cartao>
      )}
      {aba === "acoes" && <Acoes eu={eu} acoes={acoes.dados ?? []} erro={acoes.erro} />}
    </div>
  );
}

function Novo({ fechar, abrir, alerta }: { eu: Eu; fechar: () => void; abrir: (id: string) => void; alerta?: number }) {
  const [p, setP] = useState({ titulo: "", resumo: "", gravidade: "media", modelo: "" });
  const [aviso, setAviso] = useState("");
  async function salvar() {
    try {
      const r = await rpc<{ id: string }>("incidente_abrir", { p: { ...p, alerta } });
      avisarMudanca();
      abrir(r.id);
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  return (
    <form className="quadro mb-4 space-y-2 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
      <p className="rotulo">Novo incidente</p>
      <label className="block">Título<input className="campo" value={p.titulo} onChange={(e) => setP({ ...p, titulo: e.target.value })} minLength={3} maxLength={160} required /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Gravidade<select className="campo" value={p.gravidade} onChange={(e) => setP({ ...p, gravidade: e.target.value })}><option value="baixa">baixa</option><option value="media">média</option><option value="alta">alta</option><option value="critica">crítica</option></select></label>
        <label>Modelo de resposta<select className="campo" value={p.modelo} onChange={(e) => setP({ ...p, modelo: e.target.value })}><option value="">nenhum</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}<option value="outro">outro</option></select></label>
      </div>
      <label className="block">Resumo<textarea className="campo" rows={3} value={p.resumo} onChange={(e) => setP({ ...p, resumo: e.target.value })} maxLength={4000} /></label>
      <div className="flex gap-2"><button type="submit" className="botao" disabled={p.titulo.length < 3}>Abrir</button><button type="button" className="botao-claro" onClick={fechar}>Cancelar</button></div>
      <Aviso texto={aviso} />
    </form>
  );
}

function Detalhe({ id, eu, voltar }: { id: string; eu: Eu; voltar: () => void }) {
  const { dados, erro, recarregar } = useDados<Detalhe>("incidente_ver", { p_id: id });
  const equipe = useDados<Pessoa[]>("equipe_listar", {}, 0);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");
  const [propondo, setPropondo] = useState(false);
  async function agir(fn: string, args: Record<string, unknown>) {
    setAviso("");
    try {
      await rpc(fn, args);
      avisarMudanca();
      recarregar();
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  if (!dados) return <Carregando erro={erro} />;
  const i = dados;
  const modelo = modelos.find((m) => m.id === i.modelo);
  const pode = analista(eu);
  return (
    <div>
      <button type="button" className="mb-3 font-sans text-xs underline" onClick={voltar}>← todos os incidentes</button>
      <Titulo sub={<>Aberto por {i.aberto_nome ?? "—"} em {dataHora(i.aberto_em)} · <Estado valor={i.estado} /> <Gravidade valor={i.gravidade} /></>}>#{i.numero} {i.titulo}</Titulo>
      <Aviso texto={aviso} />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Cartao titulo="Resumo">
            <p className="whitespace-pre-wrap font-sans text-sm">{i.resumo || <span className="text-ink-soft">Sem resumo.</span>}</p>
            {modelo && (
              <div className="mt-3 border-t border-rule pt-3">
                <p className="rotulo">Checklist: {modelo.nome}</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 font-sans text-sm">{modelo.passos.map((p) => <li key={p}>{p}</li>)}</ol>
              </div>
            )}
          </Cartao>
          <Cartao titulo="Linha do tempo">
            <ul className="space-y-2 font-sans text-sm">
              {i.notas.map((n) => (
                <li key={n.id} className={`border-l-2 pl-3 ${n.tipo === "sistema" ? "border-rule text-ink-soft" : "border-gold"}`}>
                  <span className="mono text-xs text-ink-soft">{dataHora(n.em)} · {n.nome ?? "sistema"}</span>
                  <p className="whitespace-pre-wrap">{n.texto}</p>
                </li>
              ))}
            </ul>
            {pode && (
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nota.trim()) { void agir("incidente_nota", { p_id: id, p_texto: nota }); setNota(""); } }}>
                <input className="campo !mt-0" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Anotar o que foi visto ou feito…" maxLength={4000} />
                <button type="submit" className="botao" disabled={!nota.trim()}>Anotar</button>
              </form>
            )}
          </Cartao>
          <Cartao titulo={`Eventos ligados (${i.eventos_lista.length})`}>
            <Tabela linhas={i.eventos_lista} chave={(e) => e.id} colunas={[
              { nome: "Quando", valor: (e) => <span className="mono text-xs">{dataHora(e.em)}</span> },
              { nome: "Fonte", valor: (e) => nomeFonte[e.fonte] ?? e.fonte },
              { nome: "Origem", valor: (e) => <span className="mono text-xs">{e.ip}{e.pais ? ` · ${e.pais}` : ""}</span> },
              { nome: "Caminho", valor: (e) => <span className="break-all">{e.caminho || e.tipo}</span> },
              { nome: "Ação", valor: (e) => <span className="mono text-xs">{e.acao}</span> },
            ]} vazio="Nenhum evento ligado. Em Ameaças → Eventos, selecione e vincule." />
          </Cartao>
        </div>
        <div className="space-y-4">
          {pode && (
            <Cartao titulo="Andamento">
              <div className="space-y-2 font-sans text-sm">
                <label className="block">Estado<select className="campo" value={i.estado} onChange={(e) => void agir("incidente_atualizar", { p_id: id, p: { estado: e.target.value } })}><option value="aberto">aberto</option><option value="investigando">investigando</option><option value="contido">contido</option><option value="resolvido">resolvido</option></select></label>
                <label className="block">Responsável<select className="campo" value={i.atribuido_a ?? ""} onChange={(e) => void agir("incidente_atualizar", { p_id: id, p: { atribuido_a: e.target.value } })}><option value="">ninguém</option>{(equipe.dados ?? []).filter((p) => p.ativo && p.papel !== "leitor").map((p) => <option key={p.id} value={p.id}>{p.nome || p.id.slice(0, 8)}</option>)}</select></label>
                <label className="block">Gravidade<select className="campo" value={i.gravidade} onChange={(e) => void agir("incidente_atualizar", { p_id: id, p: { gravidade: e.target.value } })}><option value="baixa">baixa</option><option value="media">média</option><option value="alta">alta</option><option value="critica">crítica</option></select></label>
              </div>
            </Cartao>
          )}
          <Cartao titulo={`Ações (${i.acoes_lista.length})`} acao={pode ? <button type="button" className="font-sans text-xs underline" onClick={() => setPropondo(true)}>sugerir bloqueio</button> : null}>
            {propondo && <Propor proposta={{ tipo: "bloquear_ip", alvo: i.eventos_lista[0]?.ip ?? "" }} fechar={() => setPropondo(false)} incidente={id} />}
            <ul className="mt-2 space-y-2 font-sans text-sm">
              {i.acoes_lista.map((a) => <li key={a.id}><LinhaAcao a={a} eu={eu} depois={recarregar} /></li>)}
              {i.acoes_lista.length === 0 && !propondo && <li className="text-ink-soft">Nenhuma ação proposta.</li>}
            </ul>
          </Cartao>
          <Cartao titulo={`Alertas ligados (${i.alertas_lista.length})`}>
            <ul className="space-y-1 font-sans text-sm">{i.alertas_lista.map((a) => <li key={a.id} className="flex items-center gap-2"><Gravidade valor={a.gravidade} /><span>{a.titulo}</span></li>)}{i.alertas_lista.length === 0 && <li className="text-ink-soft">Nenhum.</li>}</ul>
          </Cartao>
        </div>
      </div>
    </div>
  );
}

function LinhaAcao({ a, eu, depois }: { a: Acao; eu: Eu; depois: () => void }) {
  const [aviso, setAviso] = useState("");
  async function decidir(sim: boolean) {
    setAviso("");
    try {
      await rpc("acao_confirmar", { p_id: a.id, p_confirmar: sim });
      avisarMudanca();
      depois();
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  const podeConfirmar = analista(eu) && a.estado === "proposta" && a.proposta_por !== eu.id;
  return (
    <div className="border-l-2 border-rule pl-3">
      <p><strong>{nomeTipoAcao[a.tipo] ?? a.tipo}</strong> <span className="mono">{a.alvo}</span> · {a.duracao_horas} h · <Estado valor={a.estado} /></p>
      <p className="text-xs text-ink-soft">{a.motivo} — proposta por {a.proposta_nome ?? "—"} {faz(a.proposta_em)}{a.confirmada_nome ? `; ${a.estado === "recusada" ? "recusada" : "confirmada"} por ${a.confirmada_nome}` : ""}{a.incidente_numero && !location.hash.includes("incidente") ? ` · incidente #${a.incidente_numero}` : ""}</p>
      {a.estado === "falhou" && <p className="text-xs text-oxblood">{String(a.resultado.erro ?? "falhou na Cloudflare")}</p>}
      {podeConfirmar && <div className="mt-1 flex flex-wrap gap-2"><Confirmar texto="Confirmar" onConfirmar={() => void decidir(true)} /><button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void decidir(false)}>Recusar</button></div>}
      {a.estado === "proposta" && a.proposta_por === eu.id && <p className="text-xs text-ink-soft">Você propôs: outra pessoa precisa confirmar.</p>}
      <Aviso texto={aviso} />
    </div>
  );
}

function Acoes({ eu, acoes, erro }: { eu: Eu; acoes: Acao[]; erro: string }) {
  return (
    <Cartao titulo="Todas as ações (bloqueios propostos, confirmados, executados, desfeitos)">
      {erro && <Aviso texto={erro} />}
      <ul className="space-y-3 font-sans text-sm">{acoes.map((a) => <li key={a.id}><LinhaAcao a={a} eu={eu} depois={avisarMudanca} /></li>)}{acoes.length === 0 && <li className="text-ink-soft">Nenhuma ação ainda.</li>}</ul>
      <p className="mt-3 font-sans text-xs text-ink-soft">O coletor aplica as confirmadas na próxima passada (até 5 minutos) e desfaz sozinho quando a duração vence. Tudo fica no registro de atividades.</p>
    </Cartao>
  );
}

export { Novo as NovoIncidente };
