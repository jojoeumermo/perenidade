// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, type Me, rpc } from "@/lib/backend";
import { JITSI_DOMINIO } from "@/lib/jitsi";
import { JitsiSala } from "../JitsiSala";
import { useI18n } from "../I18n";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, elo, rotulo, textoDoErro, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";

export interface Reuniao {
  id: string;
  titulo: string;
  pauta: string;
  inicio: string;
  duracao: number;
  tipo: "aberta" | "coordenacao" | "convidados";
  recorrencia: "" | "semanal" | "quinzenal";
  link_pauta: string;
  status: "agendada" | "ao_vivo" | "encerrada" | "cancelada";
  ata: string;
  organizador: { id: string; nome: string };
  conduzo: boolean;
  posso_entrar: boolean;
  sala: string | null;
  convidados: { id: string; nome: string }[];
  presentes: number;
  presencas: { nome: string; entrou_em: string; saiu_em: string | null }[];
}
export interface Proposta {
  id: string;
  titulo: string;
  assunto: string;
  inicio: string;
  duracao: number;
  convidados: string;
  status: "pendente" | "aprovada" | "recusada" | "reagendada";
  resposta: string;
  reuniao: string | null;
  criado_em: string;
  minha: boolean;
  autor: string;
}

export const tipos: Record<Reuniao["tipo"], string> = { aberta: "Aberta a toda a equipe", coordenacao: "Só coordenação e supervisão", convidados: "Convidados" };
const situacoes: Record<Reuniao["status"], string> = { agendada: "agendada", ao_vivo: "AO VIVO", encerrada: "encerrada", cancelada: "cancelada" };
const daquiAUmaHora = () => {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const paraCampo = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** Um convite .ics para a agenda de cada pessoa (gerado no aparelho). */
export function baixarIcs(r: Reuniao) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const inicio = new Date(r.inicio);
  const fim = new Date(inicio.getTime() + r.duracao * 60_000);
  const texto = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Instituto Lucia//Reunioes//PT", "BEGIN:VEVENT", `UID:${r.id}@institutolucia.org`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(inicio)}`, `DTEND:${f(fim)}`, `SUMMARY:${r.titulo.replace(/[,;]/g, " ")}`, `DESCRIPTION:${r.pauta.replace(/\n/g, "\\n").slice(0, 500)}`, `URL:${location.origin}/pt/painel?aba=reunioes`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: "text/calendar;charset=utf-8" }));
  a.download = `${r.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 40) || "reuniao"}.ics`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/**
 * Reuniões por vídeo da equipe, sem big tech: Jitsi Meet (código aberto) no servidor configurado, com a sala aberta
 * dentro do painel. A liderança cria e conduz; qualquer voluntário propõe; a presença é anotada; a ata fica no histórico.
 */
export function Reunioes({ me }: { me: Me }) {
  const { lang } = useI18n();
  const gere = can(me, "coordenacao", "supervisao");
  const lista = useLista<Reuniao[]>("reunioes_listar");
  const propostas = useLista<Proposta[]>("reunioes_propostas");
  const [aba, setAba] = useState<"agora" | "propostas" | "nova" | "historico">("agora");
  const [naSala, setNaSala] = useState<Reuniao | null>(null);
  const [editando, setEditando] = useState<Reuniao | null>(null);
  const acao = useAcao(() => { lista.recarregar(); propostas.recarregar(); });
  // A hora de referência é lida uma vez por montagem (o filtro das próximas tolera uma hora de atraso).
  const [agora] = useState(() => Date.now());
  const reunioes = lista.dados ?? [];
  const aoVivo = reunioes.filter((r) => r.status === "ao_vivo");
  const proximas = reunioes.filter((r) => r.status === "agendada" && new Date(r.inicio).getTime() > agora - 3600_000).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const passadas = reunioes.filter((r) => r.status === "encerrada" || r.status === "cancelada" || (r.status === "agendada" && new Date(r.inicio).getTime() <= agora - 3600_000));
  const pendentes = (propostas.dados ?? []).filter((p) => p.status === "pendente").length;

  async function entrar(r: Reuniao) {
    setNaSala(r);
    try {
      await rpc("reuniao_presenca", { p_id: r.id, p_entrou: true });
    } catch {
      // a presença é um registro; a sala abre mesmo assim
    }
  }
  async function sair() {
    const r = naSala;
    setNaSala(null);
    if (r) {
      try {
        await rpc("reuniao_presenca", { p_id: r.id, p_entrou: false });
      } catch {
        // idem
      }
      lista.recarregar();
    }
  }

  if (naSala) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={rotulo}>{naSala.status === "ao_vivo" ? "Ao vivo" : "Sala"}</p>
            <h2 className="font-serif text-2xl font-semibold">{naSala.titulo}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {naSala.conduzo && naSala.status === "agendada" && <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("reuniao_estado", { p_id: naSala.id, p_status: "ao_vivo" }, "A reunião começou: a equipe foi avisada.").then(() => setNaSala({ ...naSala, status: "ao_vivo" }))}>Começar a reunião</button>}
            {naSala.conduzo && naSala.status === "ao_vivo" && <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={async () => { if (window.confirm("Encerrar a reunião para todos?")) { await acao.agir("reuniao_estado", { p_id: naSala.id, p_status: "encerrada" }, "Reunião encerrada."); void sair(); } }}>Encerrar para todos</button>}
            <button type="button" className={botaoClaro} onClick={() => void sair()}>Sair da sala</button>
          </div>
        </div>
        <JitsiSala sala={naSala.sala ?? ""} nome={me.nome} conduzo={naSala.conduzo} lang={lang} assunto={naSala.titulo} aoSair={() => void sair()} />
        {naSala.pauta && <div className="painel-cartao p-4"><p className={rotulo}>Pauta</p><p className="mt-1 whitespace-pre-wrap" data-original>{naSala.pauta}</p></div>}
        <p className="text-xs text-ink-soft">Nada de áudio ou vídeo fica no servidor do instituto; só quem entrou e quando. Quem abre a reunião entra primeiro e modera.</p>
        <Aviso texto={acao.aviso} />
      </div>
    );
  }

  const cartao = (r: Reuniao) => (
    <article key={r.id} className={`painel-cartao p-4 ${r.status === "ao_vivo" ? "border-[#c21f16]" : ""}`}>
      <p className="flex flex-wrap items-center gap-2 font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">
        {r.status === "ao_vivo" ? <span className="bg-[#c21f16] px-1.5 py-0.5 text-white">AO VIVO</span> : <span>{situacoes[r.status]}</span>}
        <span>· {tipos[r.tipo]}</span>
        {r.recorrencia && <span>· {r.recorrencia}</span>}
      </p>
      <h3 className="mt-1 font-serif text-xl font-semibold">{r.titulo}</h3>
      <p className="text-ink-soft">{dataHora(r.inicio)} · {r.duracao} min · {r.organizador.nome}{r.convidados.length > 0 ? ` · ${r.convidados.length} convidados` : ""}{r.presentes > 0 ? ` · ${r.presentes} presentes` : ""}</p>
      {r.pauta && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-ink-soft" data-original>{r.pauta}</p>}
      {r.link_pauta && <p className="mt-1"><a href={r.link_pauta} target="_blank" rel="noopener noreferrer" className={elo}>Documento da pauta ↗</a></p>}
      <p className="mt-3 flex flex-wrap gap-2">
        {r.sala && (r.status === "ao_vivo" || r.conduzo) && <button type="button" className={r.status === "ao_vivo" ? botao : botaoClaro} onClick={() => void entrar(r)}>{r.status === "ao_vivo" ? "Entrar" : "Abrir a sala"}</button>}
        {r.status === "agendada" && <button type="button" className={elo} onClick={() => baixarIcs(r)}>Agenda (.ics)</button>}
        {r.conduzo && r.status === "agendada" && <button type="button" className={elo} onClick={() => { setEditando(r); setAba("nova"); }}>Editar</button>}
        {r.conduzo && r.status !== "cancelada" && r.status !== "encerrada" && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm("Cancelar esta reunião?")) void acao.agir("reuniao_estado", { p_id: r.id, p_status: "cancelada" }, "Reunião cancelada."); }}>Cancelar</button>}
      </p>
    </article>
  );

  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "agora" as const, nome: "Agora e próximas", conta: aoVivo.length },
          { id: "propostas" as const, nome: "Propostas", conta: gere ? pendentes : undefined },
          ...(gere ? [{ id: "nova" as const, nome: editando ? "Editar reunião" : "Nova reunião" }] : []),
          { id: "historico" as const, nome: "Histórico" },
        ]}
      />
      <Aviso texto={lista.erro || acao.aviso} />
      <div hidden={aba !== "agora"}>
        {gere && (
          <div className="mb-6">
            <AbrirAgora entrar={(r) => { lista.recarregar(); void entrar(r); }} />
          </div>
        )}
        {aoVivo.length > 0 && (
          <section>
            <h2 className="jornal-secao"><span className="jornal-editoria">Ao vivo agora</span></h2>
            <div className="mt-4 grid gap-4">{aoVivo.map(cartao)}</div>
          </section>
        )}
        <section className={aoVivo.length > 0 ? "mt-8" : ""}>
          <h2 className="jornal-secao"><span className="jornal-editoria">Próximas</span></h2>
          {proximas.length === 0 ? <p className="mt-4 text-ink-soft">Nenhuma reunião marcada. {gere ? "Crie uma em “Nova reunião”." : "Proponha uma em “Propostas”."}</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{proximas.map(cartao)}</div>}
        </section>
        <p className="mt-8 text-xs text-ink-soft">As reuniões acontecem pelo Jitsi Meet (código aberto) em {JITSI_DOMINIO}, dentro do painel, sem limite de tempo e sem conta de moderador. Cada reunião tem uma sala de nome sorteado, que só quem pode entrar recebe. Guardamos só quem entrou e quando; nada de áudio ou vídeo.</p>
      </div>
      <div hidden={aba !== "propostas"}>
        <Propostas gere={gere} propostas={propostas.dados ?? []} erro={propostas.erro} recarregar={() => { propostas.recarregar(); lista.recarregar(); }} />
      </div>
      {gere && (
        <div hidden={aba !== "nova"}>
          <NovaReuniao key={editando?.id ?? "nova"} editando={editando} depois={() => { setEditando(null); lista.recarregar(); setAba("agora"); }} cancelar={() => { setEditando(null); setAba("agora"); }} />
        </div>
      )}
      <div hidden={aba !== "historico"}>
        <Historico reunioes={passadas} recarregar={lista.recarregar} />
      </div>
    </div>
  );
}

export function NovaReuniao({ editando, depois, cancelar }: { editando: Reuniao | null; depois: () => void; cancelar: () => void }) {
  const membros = useLista<Membro[]>("equipe_membros");
  const [form, setForm] = useState({ titulo: editando?.titulo ?? "", pauta: editando?.pauta ?? "", inicio: editando ? paraCampo(editando.inicio) : daquiAUmaHora(), duracao: editando?.duracao ?? 60, tipo: (editando?.tipo ?? "aberta") as Reuniao["tipo"], recorrencia: (editando?.recorrencia ?? "") as Reuniao["recorrencia"], link_pauta: editando?.link_pauta ?? "" });
  const [convidados, setConvidados] = useState<PessoaAchada[]>(editando?.convidados.map((c) => ({ id: c.id, nome: c.nome, email: "" })) ?? []);
  const acao = useAcao();
  const mudar = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const candidatos = (membros.dados ?? []).filter((m) => !m.eu && !convidados.some((c) => c.id === m.id)).map((m) => ({ id: m.id, nome: m.nome, email: "" }));
  async function salvar() {
    const r = await acao.agir("reuniao_salvar", { p_id: editando?.id ?? null, p: { ...form, inicio: new Date(form.inicio).toISOString(), convidados: convidados.map((c) => c.id) } }, editando ? "Reunião alterada." : "Reunião marcada. Os convidados foram avisados.");
    if (r) depois();
  }
  return (
    <section className="painel-cartao max-w-3xl p-5">
      <h2 className="font-serif text-xl font-semibold">{editando ? "Editar reunião" : "Nova reunião"}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">Título<input value={form.titulo} onChange={(e) => mudar("titulo", e.target.value)} maxLength={140} className={campo} /></label>
        <label className="block sm:col-span-2">Pauta<textarea value={form.pauta} onChange={(e) => mudar("pauta", e.target.value)} rows={4} maxLength={4000} className={campo} /></label>
        <label className="block">Data e hora<input type="datetime-local" value={form.inicio} onChange={(e) => mudar("inicio", e.target.value)} className={campo} /></label>
        <label className="block">Duração (minutos)<input type="number" min={15} max={480} step={15} value={form.duracao} onChange={(e) => mudar("duracao", Number(e.target.value))} className={campo} /></label>
        <label className="block">Quem entra
          <select value={form.tipo} onChange={(e) => mudar("tipo", e.target.value as Reuniao["tipo"])} className={campo}>
            {(Object.keys(tipos) as Reuniao["tipo"][]).map((t) => <option key={t} value={t}>{tipos[t]}</option>)}
          </select>
        </label>
        <label className="block">Recorrência
          <select value={form.recorrencia} onChange={(e) => mudar("recorrencia", e.target.value as Reuniao["recorrencia"])} className={campo}>
            <option value="">Uma vez</option>
            <option value="semanal">Semanal</option>
            <option value="quinzenal">Quinzenal</option>
          </select>
        </label>
        <label className="block sm:col-span-2">Documento da pauta (https, opcional)<input value={form.link_pauta} onChange={(e) => mudar("link_pauta", e.target.value)} placeholder="https://" maxLength={500} className={`${campo} font-mono`} /></label>
      </div>
      <fieldset className="mt-4 border border-rule p-3">
        <legend className="px-1 font-semibold">Convidados {form.tipo === "convidados" ? "(só eles entram)" : "(recebem o aviso)"}</legend>
        {convidados.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {convidados.map((c) => (
              <li key={c.id} className="flex items-center gap-2 border border-ink px-2 py-1"><span>{c.nome}</span><button type="button" className={elo} aria-label={`Tirar ${c.nome}`} onClick={() => setConvidados(convidados.filter((x) => x.id !== c.id))}>✕</button></li>
            ))}
          </ul>
        )}
        <div className="relative mt-2 max-w-md">
          <BuscaDePessoa rotulo="Convidar" entre={candidatos} escolhida={null} escolher={(pessoa) => pessoa && setConvidados([...convidados, pessoa])} />
        </div>
      </fieldset>
      <p className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={botao} disabled={acao.ocupado || form.titulo.trim().length < 3} onClick={() => void salvar()}>{editando ? "Guardar" : "Marcar a reunião"}</button>
        <button type="button" className={botaoClaro} onClick={cancelar}>Cancelar</button>
      </p>
      <Aviso texto={acao.aviso} />
    </section>
  );
}

export function Propostas({ gere, propostas, erro, recarregar }: { gere: boolean; propostas: Proposta[]; erro: string; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const [form, setForm] = useState({ titulo: "", assunto: "", inicio: daquiAUmaHora(), duracao: 60, convidados: "" });
  const [resposta, setResposta] = useState<Record<string, string>>({});
  const [outro, setOutro] = useState<Record<string, string>>({});
  const situacao: Record<Proposta["status"], string> = { pendente: "pendente", aprovada: "aprovada", recusada: "recusada", reagendada: "outro horário sugerido" };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="painel-cartao p-5">
        <h2 className="font-serif text-xl font-semibold">Propor uma reunião</h2>
        <p className="mt-1 text-ink-soft">A proposta vai para a coordenação, a coordenação pedagógica e a supervisão, que aprovam, recusam ou sugerem outro horário. Você é avisado no painel.</p>
        <label className="mt-3 block">Título<input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={140} className={campo} /></label>
        <label className="mt-2 block">Assunto<textarea value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} rows={3} maxLength={2000} className={campo} /></label>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">Data e hora sugeridas<input type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} className={campo} /></label>
          <label className="block">Duração (min)<input type="number" min={15} max={480} step={15} value={form.duracao} onChange={(e) => setForm({ ...form, duracao: Number(e.target.value) })} className={campo} /></label>
        </div>
        <label className="mt-2 block">Quem você gostaria de convidar (nomes ou departamentos)<input value={form.convidados} onChange={(e) => setForm({ ...form, convidados: e.target.value })} maxLength={500} className={campo} /></label>
        <button type="button" className={`mt-3 ${botao}`} disabled={acao.ocupado || form.titulo.trim().length < 3} onClick={async () => { if (await acao.agir("reuniao_propor", { p: { ...form, inicio: new Date(form.inicio).toISOString() } }, "Proposta enviada. A coordenação foi avisada.")) setForm({ titulo: "", assunto: "", inicio: daquiAUmaHora(), duracao: 60, convidados: "" }); }}>Enviar a proposta</button>
        <Aviso texto={acao.aviso} />
      </section>
      <section>
        <h2 className="jornal-secao"><span className="jornal-editoria">{gere ? "Fila de propostas" : "Minhas propostas"}</span></h2>
        <Aviso texto={erro} />
        {propostas.length === 0 && <p className="mt-4 text-ink-soft">Nenhuma proposta ainda.</p>}
        <ul className="mt-4 space-y-3">
          {propostas.map((p) => (
            <li key={p.id} className={`painel-cartao p-4 ${p.status !== "pendente" ? "opacity-80" : ""}`}>
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">{situacao[p.status]} · {p.autor}{p.minha ? " (você)" : ""}</p>
              <h3 className="mt-1 font-serif text-lg font-semibold">{p.titulo}</h3>
              <p className="text-ink-soft">{dataHora(p.inicio)} · {p.duracao} min{p.convidados ? ` · convidar: ${p.convidados}` : ""}</p>
              {p.assunto && <p className="mt-1 whitespace-pre-wrap" data-original>{p.assunto}</p>}
              {p.resposta && <p className="mt-2 border-l-4 border-gold pl-3 text-ink-soft">{p.resposta}</p>}
              {gere && p.status === "pendente" && (
                <div className="mt-3 space-y-2 border-t border-rule pt-3">
                  <input value={resposta[p.id] ?? ""} onChange={(e) => setResposta({ ...resposta, [p.id]: e.target.value })} maxLength={500} placeholder="Motivo curto ou recado (opcional)" className={campo} />
                  <div className="flex flex-wrap items-end gap-2">
                    <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("reuniao_proposta_decidir", { p_id: p.id, p_status: "aprovada", p_resposta: resposta[p.id] ?? "" }, "Aprovada: virou reunião de convidados.")}>Aprovar</button>
                    <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("reuniao_proposta_decidir", { p_id: p.id, p_status: "recusada", p_resposta: resposta[p.id] ?? "" }, "Recusada; a pessoa foi avisada.")}>Recusar</button>
                    <label className="block text-xs">Outro horário<input type="datetime-local" value={outro[p.id] ?? paraCampo(p.inicio)} onChange={(e) => setOutro({ ...outro, [p.id]: e.target.value })} className={`${campo} mt-0`} /></label>
                    <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("reuniao_proposta_decidir", { p_id: p.id, p_status: "reagendada", p_resposta: resposta[p.id] ?? "", p_inicio: new Date(outro[p.id] ?? paraCampo(p.inicio)).toISOString() }, "Outro horário sugerido; a pessoa foi avisada.")}>Sugerir este horário</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Historico({ reunioes, recarregar }: { reunioes: Reuniao[]; recarregar: () => void }) {
  const [atas, setAtas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");
  if (reunioes.length === 0) return <p className="text-ink-soft">Nenhuma reunião passada ainda.</p>;
  return (
    <ul className="space-y-4">
      {reunioes.map((r) => (
        <li key={r.id} className="painel-cartao p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">{situacoes[r.status]} · {tipos[r.tipo]}</p>
          <h3 className="mt-1 font-serif text-lg font-semibold">{r.titulo}</h3>
          <p className="text-ink-soft">{dataHora(r.inicio)} · {r.duracao} min · {r.organizador.nome}</p>
          {r.pauta && <details className="mt-2"><summary className="cursor-pointer text-sm underline">Pauta</summary><p className="mt-1 whitespace-pre-wrap text-ink-soft" data-original>{r.pauta}</p></details>}
          {r.presencas.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm underline">Presença ({r.presencas.length})</summary>
              <ul className="mt-1 text-sm text-ink-soft">{r.presencas.map((p, i) => <li key={i}>{p.nome} · {dataHora(p.entrou_em)}{p.saiu_em ? ` → ${dataHora(p.saiu_em)}` : ""}</li>)}</ul>
            </details>
          )}
          {r.conduzo ? (
            <div className="mt-3">
              <label className="block text-sm">Ata<textarea value={atas[r.id] ?? r.ata} onChange={(e) => setAtas({ ...atas, [r.id]: e.target.value })} rows={4} maxLength={20000} className={campo} /></label>
              <button type="button" className={`mt-2 ${botaoClaro}`} disabled={atas[r.id] === undefined || atas[r.id] === r.ata} onClick={async () => { try { await rpc("reuniao_ata", { p_id: r.id, p_ata: atas[r.id] ?? "" }); setAviso("Ata guardada."); recarregar(); } catch (e) { setAviso(textoDoErro(e)); } }}>Guardar a ata</button>
            </div>
          ) : (
            r.ata && <div className="mt-2"><p className={rotulo}>Ata</p><p className="mt-1 whitespace-pre-wrap" data-original>{r.ata}</p></div>
          )}
        </li>
      ))}
      <Aviso texto={aviso} />
    </ul>
  );
}

/**
 * Abrir uma sala na hora, sem marcar antes: cria a reunião começando agora, já ao vivo (quem pode entrar é avisado) e
 * entra nela. Só a coordenação e a supervisão abrem salas; os outros propõem uma reunião.
 */
export function AbrirAgora({ entrar, escuro = false }: { entrar: (r: Reuniao) => void; escuro?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("Reunião rápida");
  const [tipo, setTipo] = useState<Reuniao["tipo"]>("aberta");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  async function abrir() {
    setOcupado(true);
    setAviso("");
    try {
      const criada = await rpc<Reuniao>("reuniao_salvar", { p_id: null, p: { titulo: titulo.trim() || "Reunião rápida", pauta: "", inicio: new Date().toISOString(), duracao: 60, tipo, recorrencia: "", link_pauta: "", convidados: [] } });
      const aoVivo = await rpc<Reuniao>("reuniao_estado", { p_id: criada.id, p_status: "ao_vivo" });
      setAberto(false);
      entrar(aoVivo);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }
  const botaoPrincipal = escuro
    ? "cursor-pointer rounded-md bg-[#c21f16] px-4 py-2 text-sm font-bold text-white hover:bg-[#a51810] disabled:opacity-50"
    : `${botao} disabled:opacity-50`;
  if (!aberto) {
    return (
      <button type="button" className={botaoPrincipal} onClick={() => setAberto(true)}>
        ▶ Abrir uma sala agora
      </button>
    );
  }
  return (
    <form
      className={`flex flex-wrap items-end gap-3 p-3 ${escuro ? "rounded-lg border border-s-linha bg-s-lado" : "painel-cartao"}`}
      onSubmit={(e) => {
        e.preventDefault();
        void abrir();
      }}
    >
      <label className="block min-w-48 flex-1 text-sm">
        Nome da sala
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} className={escuro ? "mt-1 w-full rounded-md border border-s-linha bg-s-campo px-3 py-2" : campo} />
      </label>
      <label className="block text-sm">
        Quem pode entrar
        <select value={tipo} onChange={(e) => setTipo(e.target.value as Reuniao["tipo"])} className={escuro ? "mt-1 block rounded-md border border-s-linha bg-s-campo px-3 py-2" : campo}>
          <option value="aberta">{tipos.aberta}</option>
          <option value="coordenacao">{tipos.coordenacao}</option>
        </select>
      </label>
      <button type="submit" className={botaoPrincipal} disabled={ocupado || titulo.trim().length < 3}>
        {ocupado ? "Abrindo…" : "Abrir e entrar"}
      </button>
      <button type="button" className={escuro ? "cursor-pointer text-sm underline" : elo} onClick={() => setAberto(false)}>
        Cancelar
      </button>
      {aviso && <p role="alert" className="w-full text-sm text-[#e0837a]">{aviso}</p>}
    </form>
  );
}
