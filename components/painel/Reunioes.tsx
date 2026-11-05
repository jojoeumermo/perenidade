// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { CalendarDays, Check, Clock, DoorOpen, ExternalLink, LogOut, Pencil, Play, Radio, Send, Video, X } from "lucide-react";
import { useState } from "react";
import { can, type Me, rpc } from "@/lib/backend";
import { JITSI_DOMINIO } from "@/lib/jitsi";
import { JitsiSala } from "../JitsiSala";
import { useI18n } from "../I18n";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Aviso, dataHora, rotulo, textoDoErro, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";
import { Abas, Area, Botao, CabecalhoDeSecao, Campo, Cartao, Esqueleto, Faixa, Lista, Selecao, Selo, type TomDoSelo, Vazio, confirmarFrase } from "./ui";

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
/** O tom do selo de cada situação (a palavra continua dizendo o estado; a cor só acompanha). */
const tomDaSituacao: Record<Reuniao["status"], TomDoSelo> = { agendada: "info", ao_vivo: "bordo", encerrada: "neutro", cancelada: "aviso" };
const tomDaProposta: Record<Proposta["status"], TomDoSelo> = { pendente: "aviso", aprovada: "ok", recusada: "erro", reagendada: "info" };
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
        <CabecalhoDeSecao
          nivel={2}
          rotulo={naSala.status === "ao_vivo" ? "Ao vivo" : "Sala"}
          titulo={naSala.titulo}
          simbolo={Video}
          acoes={
            <>
              {naSala.conduzo && naSala.status === "agendada" && <Botao variante="principal" simbolo={Play} disabled={acao.ocupado} onClick={() => acao.agir("reuniao_estado", { p_id: naSala.id, p_status: "ao_vivo" }, "A reunião começou: a equipe foi avisada.").then(() => setNaSala({ ...naSala, status: "ao_vivo" }))}>Começar a reunião</Botao>}
              {naSala.conduzo && naSala.status === "ao_vivo" && <Botao perigo disabled={acao.ocupado} onClick={async () => { if ((await confirmarFrase("Encerrar a reunião para todos?"))) { await acao.agir("reuniao_estado", { p_id: naSala.id, p_status: "encerrada" }, "Reunião encerrada."); void sair(); } }}>Encerrar para todos</Botao>}
              <Botao simbolo={LogOut} onClick={() => void sair()}>Sair da sala</Botao>
            </>
          }
        />
        <JitsiSala sala={naSala.sala ?? ""} nome={me.nome} conduzo={naSala.conduzo} lang={lang} assunto={naSala.titulo} aoSair={() => void sair()} />
        {naSala.pauta && <Cartao><p className={rotulo}>Pauta</p><p className="mt-1 whitespace-pre-wrap" data-original>{naSala.pauta}</p></Cartao>}
        <p className="pn-ajuda">Nada de áudio ou vídeo fica no servidor do instituto; só quem entrou e quando. Quem abre a reunião entra primeiro e modera.</p>
        <Aviso texto={acao.aviso} />
      </div>
    );
  }

  const cartao = (r: Reuniao) => (
    <Cartao as="article" key={r.id} variante={r.status === "ao_vivo" ? "destaque" : "padrao"}>
      <p className="flex flex-wrap items-center gap-2">
        <Selo tom={tomDaSituacao[r.status]} ponto={r.status === "ao_vivo"}>{situacoes[r.status]}</Selo>
        <span className={rotulo}>{tipos[r.tipo]}</span>
        {r.recorrencia && <span className={rotulo}>· {r.recorrencia}</span>}
      </p>
      <h3 className="pn-cartao-titulo mt-2">{r.titulo}</h3>
      <p className="pn-ajuda tabular-nums">{dataHora(r.inicio)} · {r.duracao} min · {r.organizador.nome}{r.convidados.length > 0 ? ` · ${r.convidados.length} convidados` : ""}{r.presentes > 0 ? ` · ${r.presentes} presentes` : ""}</p>
      {r.pauta && <p className="pn-ajuda mt-2 line-clamp-3 whitespace-pre-wrap" data-original>{r.pauta}</p>}
      {r.link_pauta && <p className="mt-1"><a href={r.link_pauta} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1">Documento da pauta <ExternalLink aria-hidden className="h-3.5 w-3.5" /></a></p>}
      <p className="mt-3 flex flex-wrap gap-2">
        {r.sala && (r.status === "ao_vivo" || r.conduzo) && <Botao variante={r.status === "ao_vivo" ? "principal" : "padrao"} simbolo={DoorOpen} onClick={() => void entrar(r)}>{r.status === "ao_vivo" ? "Entrar" : "Abrir a sala"}</Botao>}
        {r.status === "agendada" && <Botao variante="discreto" pequeno simbolo={CalendarDays} onClick={() => baixarIcs(r)}>Agenda (.ics)</Botao>}
        {r.conduzo && r.status === "agendada" && <Botao variante="discreto" pequeno simbolo={Pencil} onClick={() => { setEditando(r); setAba("nova"); }}>Editar</Botao>}
        {r.conduzo && r.status !== "cancelada" && r.status !== "encerrada" && <Botao variante="discreto" pequeno perigo simbolo={X} disabled={acao.ocupado} onClick={async () => { if ((await confirmarFrase("Cancelar esta reunião?"))) void acao.agir("reuniao_estado", { p_id: r.id, p_status: "cancelada" }, "Reunião cancelada."); }}>Cancelar</Botao>}
      </p>
    </Cartao>
  );

  return (
    <div>
      <Abas
        rotulo="Reuniões"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { id: "agora" as const, nome: "Agora e próximas", conta: aoVivo.length },
          { id: "propostas" as const, nome: "Propostas", conta: gere ? pendentes : undefined },
          ...(gere ? [{ id: "nova" as const, nome: editando ? "Editar reunião" : "Nova reunião" }] : []),
          { id: "historico" as const, nome: "Histórico" },
        ]}
      />
      <div className="mt-4 space-y-2">
        {lista.erro && <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>{lista.erro}</Faixa>}
        <Aviso texto={acao.aviso} />
      </div>
      <div hidden={aba !== "agora"}>
        {gere && (
          <div className="mb-6">
            <AbrirAgora entrar={(r) => { lista.recarregar(); void entrar(r); }} />
          </div>
        )}
        {lista.dados === null && !lista.erro && <Esqueleto forma="cartoes" linhas={2} rotulo="Carregando as reuniões" />}
        {aoVivo.length > 0 && (
          <section>
            <CabecalhoDeSecao nivel={2} titulo="Ao vivo agora" simbolo={Radio} />
            <div className="mt-4 grid gap-4">{aoVivo.map(cartao)}</div>
          </section>
        )}
        {lista.dados !== null && (
          <section className={aoVivo.length > 0 ? "mt-8" : ""}>
            <CabecalhoDeSecao nivel={2} titulo="Próximas" simbolo={CalendarDays} />
            {proximas.length === 0 ? (
              <div className="mt-4"><Vazio simbolo={CalendarDays} titulo="Nenhuma reunião marcada." texto={gere ? "Crie uma em “Nova reunião”." : "Proponha uma em “Propostas”."} /></div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">{proximas.map(cartao)}</div>
            )}
          </section>
        )}
        <p className="pn-ajuda mt-8">As reuniões acontecem pelo Jitsi Meet (código aberto) em {JITSI_DOMINIO}, dentro do painel, sem limite de tempo e sem conta de moderador. Cada reunião tem uma sala de nome sorteado, que só quem pode entrar recebe. Guardamos só quem entrou e quando; nada de áudio ou vídeo.</p>
      </div>
      <div hidden={aba !== "propostas"}>
        <Propostas gere={gere} propostas={propostas.dados ?? []} erro={propostas.erro} carregando={propostas.dados === null} recarregar={() => { propostas.recarregar(); lista.recarregar(); }} />
      </div>
      {gere && (
        <div hidden={aba !== "nova"}>
          <NovaReuniao key={editando?.id ?? "nova"} editando={editando} depois={() => { setEditando(null); lista.recarregar(); setAba("agora"); }} cancelar={() => { setEditando(null); setAba("agora"); }} />
        </div>
      )}
      <div hidden={aba !== "historico"}>
        {/* Enquanto a lista não chega, esqueleto (e não "Nenhuma reunião passada"); com erro, a faixa do alto já avisa. */}
        {lista.dados === null ? !lista.erro && <Esqueleto forma="cartoes" linhas={2} rotulo="Carregando o histórico" /> : <Historico reunioes={passadas} recarregar={lista.recarregar} />}
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
    <Cartao className="max-w-3xl" titulo={editando ? "Editar reunião" : "Nova reunião"}>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Campo rotulo="Título" value={form.titulo} onChange={(e) => mudar("titulo", e.target.value)} maxLength={140} /></div>
        <div className="sm:col-span-2"><Area rotulo="Pauta" value={form.pauta} onChange={(e) => mudar("pauta", e.target.value)} rows={4} maxLength={4000} /></div>
        <Campo rotulo="Data e hora" type="datetime-local" value={form.inicio} onChange={(e) => mudar("inicio", e.target.value)} />
        <Campo rotulo="Duração (minutos)" type="number" min={15} max={480} step={15} value={form.duracao} onChange={(e) => mudar("duracao", Number(e.target.value))} />
        <Selecao rotulo="Quem entra" value={form.tipo} onChange={(e) => mudar("tipo", e.target.value as Reuniao["tipo"])}>
          {(Object.keys(tipos) as Reuniao["tipo"][]).map((t) => <option key={t} value={t}>{tipos[t]}</option>)}
        </Selecao>
        <Selecao rotulo="Recorrência" value={form.recorrencia} onChange={(e) => mudar("recorrencia", e.target.value as Reuniao["recorrencia"])}>
          <option value="">Uma vez</option>
          <option value="semanal">Semanal</option>
          <option value="quinzenal">Quinzenal</option>
        </Selecao>
        <div className="sm:col-span-2"><Campo rotulo="Documento da pauta (https, opcional)" value={form.link_pauta} onChange={(e) => mudar("link_pauta", e.target.value)} placeholder="https://" maxLength={500} className="font-mono" /></div>
      </div>
      <fieldset className="pn-cartao pn-cartao-plano mt-4 p-3">
        <legend className="px-1 font-semibold">Convidados {form.tipo === "convidados" ? "(só eles entram)" : "(recebem o aviso)"}</legend>
        {convidados.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {convidados.map((c) => (
              <li key={c.id} className="pn-etiqueta gap-1">
                <span>{c.nome}</span>
                <Botao variante="discreto" pequeno icone simbolo={X} aria-label={`Tirar ${c.nome}`} onClick={() => setConvidados(convidados.filter((x) => x.id !== c.id))} />
              </li>
            ))}
          </ul>
        )}
        <div className="relative mt-2 max-w-md">
          <BuscaDePessoa rotulo="Convidar" entre={candidatos} escolhida={null} escolher={(pessoa) => pessoa && setConvidados([...convidados, pessoa])} />
        </div>
      </fieldset>
      <p className="mt-4 flex flex-wrap gap-3">
        <Botao variante="principal" simbolo={Check} carregando={acao.ocupado} disabled={form.titulo.trim().length < 3} onClick={() => void salvar()}>{editando ? "Guardar" : "Marcar a reunião"}</Botao>
        <Botao onClick={cancelar}>Cancelar</Botao>
      </p>
      <Aviso texto={acao.aviso} />
    </Cartao>
  );
}

export function Propostas({ gere, propostas, erro, recarregar, carregando = false }: { gere: boolean; propostas: Proposta[]; erro: string; recarregar: () => void; /** A lista ainda não chegou: esqueleto no lugar de "Nenhuma proposta". */ carregando?: boolean }) {
  const acao = useAcao(recarregar);
  const [form, setForm] = useState({ titulo: "", assunto: "", inicio: daquiAUmaHora(), duracao: 60, convidados: "" });
  const [resposta, setResposta] = useState<Record<string, string>>({});
  const [outro, setOutro] = useState<Record<string, string>>({});
  const situacao: Record<Proposta["status"], string> = { pendente: "pendente", aprovada: "aprovada", recusada: "recusada", reagendada: "outro horário sugerido" };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Cartao titulo="Propor uma reunião" sobre="A proposta vai para a coordenação, a coordenação pedagógica e a supervisão, que aprovam, recusam ou sugerem outro horário. Você é avisado no painel.">
        <div className="mt-3 grid gap-3">
          <Campo rotulo="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={140} />
          <Area rotulo="Assunto" value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} rows={3} maxLength={2000} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Data e hora sugeridas" type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            <Campo rotulo="Duração (min)" type="number" min={15} max={480} step={15} value={form.duracao} onChange={(e) => setForm({ ...form, duracao: Number(e.target.value) })} />
          </div>
          <Campo rotulo="Quem você gostaria de convidar (nomes ou departamentos)" value={form.convidados} onChange={(e) => setForm({ ...form, convidados: e.target.value })} maxLength={500} />
        </div>
        <Botao variante="principal" className="mt-3" simbolo={Send} carregando={acao.ocupado} disabled={form.titulo.trim().length < 3} onClick={async () => { if (await acao.agir("reuniao_propor", { p: { ...form, inicio: new Date(form.inicio).toISOString() } }, "Proposta enviada. A coordenação foi avisada.")) setForm({ titulo: "", assunto: "", inicio: daquiAUmaHora(), duracao: 60, convidados: "" }); }}>Enviar a proposta</Botao>
        <Aviso texto={acao.aviso} />
      </Cartao>
      <section>
        <CabecalhoDeSecao nivel={2} titulo={gere ? "Fila de propostas" : "Minhas propostas"} simbolo={Clock} />
        {erro && <Faixa tom="erro" className="mt-2" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>{erro}</Faixa>}
        {carregando && !erro && <div className="mt-4"><Esqueleto forma="cartoes" linhas={2} rotulo="Carregando as propostas" /></div>}
        {propostas.length === 0 && !erro && !carregando && <div className="mt-4"><Vazio simbolo={CalendarDays} titulo="Nenhuma proposta ainda." /></div>}
        <div className="mt-4 space-y-3">
          {propostas.map((p) => (
            <Cartao as="article" key={p.id} variante={p.status !== "pendente" ? "plano" : "padrao"}>
              <p className="flex flex-wrap items-center gap-2">
                <Selo tom={tomDaProposta[p.status]}>{situacao[p.status]}</Selo>
                <span className={rotulo}>{p.autor}{p.minha ? " (você)" : ""}</span>
              </p>
              <h3 className="pn-cartao-titulo mt-2">{p.titulo}</h3>
              <p className="pn-ajuda tabular-nums">{dataHora(p.inicio)} · {p.duracao} min{p.convidados ? ` · convidar: ${p.convidados}` : ""}</p>
              {p.assunto && <p className="mt-1 whitespace-pre-wrap" data-original>{p.assunto}</p>}
              {p.resposta && <Faixa tom="info" semSimbolo className="mt-2">{p.resposta}</Faixa>}
              {gere && p.status === "pendente" && (
                <div className="mt-3 space-y-2 border-t border-rule pt-3">
                  <Campo rotulo="Motivo curto ou recado (opcional)" value={resposta[p.id] ?? ""} onChange={(e) => setResposta({ ...resposta, [p.id]: e.target.value })} maxLength={500} placeholder="Motivo curto ou recado (opcional)" />
                  <div className="flex flex-wrap items-end gap-2">
                    <Botao variante="principal" simbolo={Check} disabled={acao.ocupado} onClick={() => acao.agir("reuniao_proposta_decidir", { p_id: p.id, p_status: "aprovada", p_resposta: resposta[p.id] ?? "" }, "Aprovada: virou reunião de convidados.")}>Aprovar</Botao>
                    <Botao perigo simbolo={X} disabled={acao.ocupado} onClick={() => acao.agir("reuniao_proposta_decidir", { p_id: p.id, p_status: "recusada", p_resposta: resposta[p.id] ?? "" }, "Recusada; a pessoa foi avisada.")}>Recusar</Botao>
                    <Campo rotulo="Outro horário" type="datetime-local" value={outro[p.id] ?? paraCampo(p.inicio)} onChange={(e) => setOutro({ ...outro, [p.id]: e.target.value })} />
                    <Botao simbolo={CalendarDays} disabled={acao.ocupado} onClick={() => acao.agir("reuniao_proposta_decidir", { p_id: p.id, p_status: "reagendada", p_resposta: resposta[p.id] ?? "", p_inicio: new Date(outro[p.id] ?? paraCampo(p.inicio)).toISOString() }, "Outro horário sugerido; a pessoa foi avisada.")}>Sugerir este horário</Botao>
                  </div>
                </div>
              )}
            </Cartao>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Historico({ reunioes, recarregar }: { reunioes: Reuniao[]; recarregar: () => void }) {
  const [atas, setAtas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");
  if (reunioes.length === 0) return <Vazio simbolo={Clock} titulo="Nenhuma reunião passada ainda." />;
  return (
    <div className="space-y-4">
      {reunioes.map((r) => (
        <Cartao as="article" key={r.id}>
          <p className="flex flex-wrap items-center gap-2">
            <Selo tom={tomDaSituacao[r.status]}>{situacoes[r.status]}</Selo>
            <span className={rotulo}>{tipos[r.tipo]}</span>
          </p>
          <h3 className="pn-cartao-titulo mt-2">{r.titulo}</h3>
          <p className="pn-ajuda tabular-nums">{dataHora(r.inicio)} · {r.duracao} min · {r.organizador.nome}</p>
          {r.pauta && <details className="mt-2"><summary className="pn-elo cursor-pointer text-sm">Pauta</summary><p className="pn-ajuda mt-1 whitespace-pre-wrap" data-original>{r.pauta}</p></details>}
          {r.presencas.length > 0 && (
            <details className="mt-2">
              <summary className="pn-elo cursor-pointer text-sm">Presença ({r.presencas.length})</summary>
              <Lista rotulo="Presença" plana className="mt-1 text-sm">
                {r.presencas.map((p, i) => <li key={i} className="pn-item tabular-nums">{p.nome} · {dataHora(p.entrou_em)}{p.saiu_em ? ` → ${dataHora(p.saiu_em)}` : ""}</li>)}
              </Lista>
            </details>
          )}
          {r.conduzo ? (
            <div className="mt-3">
              <Area rotulo="Ata" value={atas[r.id] ?? r.ata} onChange={(e) => setAtas({ ...atas, [r.id]: e.target.value })} rows={4} maxLength={20000} />
              <Botao className="mt-2" simbolo={Check} disabled={atas[r.id] === undefined || atas[r.id] === r.ata} onClick={async () => { try { await rpc("reuniao_ata", { p_id: r.id, p_ata: atas[r.id] ?? "" }); setAviso("Ata guardada."); recarregar(); } catch (e) { setAviso(textoDoErro(e)); } }}>Guardar a ata</Botao>
            </div>
          ) : (
            r.ata && <div className="mt-2"><p className={rotulo}>Ata</p><p className="mt-1 whitespace-pre-wrap" data-original>{r.ata}</p></div>
          )}
        </Cartao>
      ))}
      <Aviso texto={aviso} />
    </div>
  );
}

/**
 * Abrir uma sala na hora, sem marcar antes: cria a reunião começando agora, já ao vivo (quem pode entrar é avisado) e
 * entra nela. Só a coordenação e a supervisão abrem salas; os outros propõem uma reunião. "escuro" é o desenho dentro
 * da sala das Conversas (lá os tokens do painel seguem as cores da sala).
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
  if (!aberto) {
    return (
      <Botao variante="principal" simbolo={Play} onClick={() => setAberto(true)}>
        Abrir uma sala agora
      </Botao>
    );
  }
  return (
    <form
      className={`pn-cartao flex flex-wrap items-end gap-3 p-3 ${escuro ? "pn-cartao-plano" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        void abrir();
      }}
    >
      <div className="min-w-48 flex-1">
        <Campo rotulo="Nome da sala" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} />
      </div>
      <Selecao rotulo="Quem pode entrar" value={tipo} onChange={(e) => setTipo(e.target.value as Reuniao["tipo"])}>
        <option value="aberta">{tipos.aberta}</option>
        <option value="coordenacao">{tipos.coordenacao}</option>
      </Selecao>
      <Botao type="submit" variante="principal" simbolo={DoorOpen} carregando={ocupado} disabled={titulo.trim().length < 3}>
        {ocupado ? "Abrindo…" : "Abrir e entrar"}
      </Botao>
      <Botao variante="discreto" onClick={() => setAberto(false)}>
        Cancelar
      </Botao>
      {aviso && <Faixa tom="erro" className="w-full">{aviso}</Faixa>}
    </form>
  );
}
