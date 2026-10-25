// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import { Abas, Aviso, botao, botaoClaro, campo, elo, localDoPainel, textoDoErro, useAcao, useLista } from "./comum";

// O banco de pautas e o calendário editorial único (supabase/install.sql, "Banco de pautas e calendário editorial"):
// matéria, episódio, post, aula e vídeo num lugar só; e um calendário que junta pautas, posts, aulas ao vivo e reuniões.

interface Pauta {
  id: string;
  titulo: string;
  descricao: string;
  tipo: Tipo;
  status: Situacao;
  data_prevista: string | null;
  link: string;
  responsavel: string | null;
  responsavel_nome: string;
  criado_por: string;
  mexo: boolean;
}
interface Evento {
  tipo: "pauta" | "post" | "aula" | "reuniao";
  subtipo: string;
  id: string;
  titulo: string;
  dia: string;
  hora: string;
  situacao: string;
  quem: string;
}
type Tipo = "jornal" | "podcast" | "instagram" | "aula" | "video" | "radio" | "outro";
type Situacao = "ideia" | "apurando" | "produzindo" | "revisao" | "publicada" | "descartada";

const TIPOS: [Tipo, string][] = [
  ["jornal", "Jornal"],
  ["podcast", "Podcast"],
  ["instagram", "Instagram"],
  ["aula", "Aula"],
  ["video", "Vídeo"],
  ["radio", "Rádio"],
  ["outro", "Outro"],
];
const SITUACOES: [Situacao, string][] = [
  ["ideia", "Ideia"],
  ["apurando", "Apurando"],
  ["produzindo", "Produzindo"],
  ["revisao", "Em revisão"],
  ["publicada", "Publicada"],
  ["descartada", "Descartada"],
];
const nomeDoTipo = Object.fromEntries(TIPOS) as Record<Tipo, string>;
const COR: Record<Evento["tipo"], string> = { pauta: "bg-[#c21f16] text-white", post: "bg-[#d4a24c] text-[#1f1a14]", aula: "bg-ink text-parchment", reuniao: "bg-[#dbe8f5] text-[#1f3a5f]" };
const NOME_DO_EVENTO: Record<Evento["tipo"], string> = { pauta: "Pauta", post: "Post", aula: "Aula ao vivo", reuniao: "Reunião" };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function Pautas({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const [aba, setAba] = useState<"calendario" | "pautas">("calendario");
  return (
    <div>
      <Abas
        opcoes={[
          { id: "calendario" as const, nome: "Calendário" },
          { id: "pautas" as const, nome: "Banco de pautas" },
        ]}
        atual={aba}
        escolher={setAba}
      />
      {aba === "calendario" ? <Calendario ir={ir} /> : <BancoDePautas me={me} />}
    </div>
  );
}

function Calendario({ ir }: { ir: (aba: string) => void }) {
  const [inicio, setInicio] = useState(() => iso(new Date()));
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState("");
  const fim = iso(new Date(new Date(`${inicio}T12:00:00`).getTime() + 30 * 86_400_000));
  useEffect(() => {
    let vivo = true;
    rpc<Evento[]>("calendario_equipe", { p_de: inicio, p_ate: fim })
      .then((r) => vivo && setEventos(r))
      .catch((e) => vivo && setErro(textoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [inicio, fim]);
  const andar = (dias: number) => setInicio(iso(new Date(new Date(`${inicio}T12:00:00`).getTime() + dias * 86_400_000)));
  const dias = [...new Set((eventos ?? []).map((e) => e.dia))].sort();
  const destino: Record<Evento["tipo"], string> = { pauta: "pautas", post: "divulgacao", aula: "aovivo", reuniao: "conversas" };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Tudo o que a equipe tem com data, num lugar só: pautas, posts da divulgação, aulas ao vivo e reuniões. De {new Date(`${inicio}T12:00:00`).toLocaleDateString(localDoPainel())} a {new Date(`${fim}T12:00:00`).toLocaleDateString(localDoPainel())}.
        </p>
        <p className="flex gap-2">
          <button type="button" className={`${botaoClaro} px-3 py-1 text-sm`} onClick={() => andar(-30)}>← 30 dias</button>
          <button type="button" className={`${botaoClaro} px-3 py-1 text-sm`} onClick={() => setInicio(iso(new Date()))}>Hoje</button>
          <button type="button" className={`${botaoClaro} px-3 py-1 text-sm`} onClick={() => andar(30)}>30 dias →</button>
        </p>
      </div>
      <p className="mt-3 flex flex-wrap gap-2 text-xs">
        {(Object.keys(COR) as Evento["tipo"][]).map((t) => (
          <span key={t} className={`px-1.5 py-0.5 font-semibold ${COR[t]}`}>{NOME_DO_EVENTO[t]}</span>
        ))}
      </p>
      <Aviso texto={erro} />
      {eventos && dias.length === 0 && <p className="mt-6 text-ink-soft">Nada com data nestes 30 dias. Ponha a data prevista nas pautas e nos posts para aparecerem aqui.</p>}
      <ol className="mt-5 space-y-5">
        {dias.map((dia) => (
          <li key={dia} className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <p className="font-serif text-lg font-semibold first-letter:uppercase sm:pt-1">
              {new Date(`${dia}T12:00:00`).toLocaleDateString(localDoPainel(), { weekday: "long", day: "numeric", month: "short" })}
            </p>
            <ul className="space-y-1.5">
              {(eventos ?? []).filter((e) => e.dia === dia).map((e) => (
                <li key={`${e.tipo}-${e.id}`}>
                  <button type="button" onClick={() => ir(destino[e.tipo])} className="flex w-full cursor-pointer flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border border-rule bg-folha px-3 py-2 text-left hover:border-ink">
                    <span className={`px-1.5 py-0.5 text-[0.66rem] font-semibold ${COR[e.tipo]}`}>{e.tipo === "pauta" ? nomeDoTipo[e.subtipo as Tipo] ?? "Pauta" : NOME_DO_EVENTO[e.tipo]}</span>
                    {e.hora && <span className="font-mono text-xs">{e.hora}</span>}
                    <span className="font-semibold">{e.titulo}</span>
                    <span className="text-xs text-ink-soft">{[e.situacao, e.quem].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BancoDePautas({ me }: { me: Me }) {
  const lista = useLista<Pauta[]>("pautas_listar");
  const acao = useAcao(lista.recarregar);
  const [tipo, setTipo] = useState<Tipo | "">("");
  const [nova, setNova] = useState({ titulo: "", descricao: "", tipo: "jornal" as Tipo, data_prevista: "" });
  const [aberta, setAberta] = useState<string | null>(null);
  const pautas = (lista.dados ?? []).filter((p) => !tipo || p.tipo === tipo);
  return (
    <div className="space-y-6">
      <form
        className="border-2 border-ink bg-folha p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await acao.agir("pauta_salvar", { p_id: null, p: nova }, "Pauta no banco. Quem cuida do tipo vê na hora.");
          if (ok !== null) setNova({ titulo: "", descricao: "", tipo: nova.tipo, data_prevista: "" });
        }}
      >
        <p className="font-semibold">Propor uma pauta</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_11rem]">
          <label className="block text-sm">
            A ideia
            <input value={nova.titulo} onChange={(e) => setNova({ ...nova, titulo: e.target.value })} maxLength={160} className={campo} placeholder="A greve dos entregadores por aplicativo" />
          </label>
          <label className="block text-sm">
            Para
            <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value as Tipo })} className={campo}>
              {TIPOS.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Data prevista
            <input type="date" value={nova.data_prevista} onChange={(e) => setNova({ ...nova, data_prevista: e.target.value })} className={campo} />
          </label>
        </div>
        <label className="mt-2 block text-sm">
          Por que importa, fontes, quem ouvir (opcional)
          <textarea value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} maxLength={3000} rows={2} className={campo} />
        </label>
        <button type="submit" className={`${botao} mt-2`} disabled={acao.ocupado || nova.titulo.trim().length < 3}>Pôr no banco</button>
      </form>

      <p role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
        {([["", "Todas"], ...TIPOS] as [Tipo | "", string][]).map(([id, nome]) => (
          <button key={id || "todas"} type="button" aria-pressed={tipo === id} onClick={() => setTipo(id)} className={`cursor-pointer border-2 border-ink px-3 py-1 text-[0.82rem] font-semibold ${tipo === id ? "bg-ink text-parchment" : "bg-folha"}`}>
            {nome}
          </button>
        ))}
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
      <div className="grid gap-3 lg:grid-cols-5">
        {SITUACOES.filter(([s]) => s !== "descartada").map(([situacao, nome]) => {
          const daqui = pautas.filter((p) => p.status === situacao);
          return (
            <section key={situacao} aria-label={nome} className="min-w-0 border-2 border-ink bg-parchment-deep p-3">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">{nome} · {daqui.length}</p>
              <ul className="mt-2 space-y-2">
                {daqui.map((p) => (
                  <li key={p.id} className="border border-ink bg-folha p-2 text-sm">
                    <button type="button" className="w-full cursor-pointer text-left" aria-expanded={aberta === p.id} onClick={() => setAberta(aberta === p.id ? null : p.id)}>
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-prelo-texto">{nomeDoTipo[p.tipo]}</span>
                      <span className="block font-semibold leading-snug">{p.titulo}</span>
                      <span className="text-xs text-ink-soft">{p.data_prevista ? new Date(`${p.data_prevista}T12:00:00`).toLocaleDateString(localDoPainel()) : "sem data"} · {p.responsavel_nome || "sem quem cuide"}</span>
                    </button>
                    {aberta === p.id && (
                      <div className="mt-2 space-y-2 border-t border-rule pt-2">
                        {p.descricao && <p className="whitespace-pre-line text-xs" data-original>{p.descricao}</p>}
                        <p className="text-xs text-ink-soft">Proposta por {p.criado_por || "alguém"}</p>
                        {p.mexo ? (
                          <>
                            <select value={p.status} onChange={(e) => void acao.agir("pauta_salvar", { p_id: p.id, p: { status: e.target.value } }, "Situação mudada.")} aria-label="Situação" className="painel-campo w-full border border-ink bg-parchment px-2 py-1 text-xs">
                              {SITUACOES.map(([id, n]) => (
                                <option key={id} value={id}>{n}</option>
                              ))}
                            </select>
                            <input type="date" defaultValue={p.data_prevista ?? ""} onBlur={(e) => e.target.value !== (p.data_prevista ?? "") && void acao.agir("pauta_salvar", { p_id: p.id, p: { data_prevista: e.target.value } }, "Data mudada.")} aria-label="Data prevista" className="painel-campo w-full border border-ink bg-parchment px-2 py-1 text-xs" />
                            {p.responsavel !== me.id && <button type="button" className={`${elo} text-xs font-bold`} disabled={acao.ocupado} onClick={() => void acao.agir("pauta_salvar", { p_id: p.id, p: { responsavel: me.id } }, "Agora você cuida desta pauta.")}>Eu cuido desta</button>}
                          </>
                        ) : (
                          <p className="text-xs text-ink-soft">Quem cuida do tipo ({nomeDoTipo[p.tipo]}) mexe nesta pauta.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
