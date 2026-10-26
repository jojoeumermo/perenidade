// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useState } from "react";
import { porNivel, type Role } from "@/lib/backend";
import { Avatar } from "./Avatar";
import { data, papeis } from "./comum";

// A lista de pessoas de "Voluntários e convites", como na prancheta "Painel — Pessoas": os números no alto, os filtros,
// a tabela com o departamento por cor e a situação (ativa, nova, sumida, suspensa), a seleção em lote e a ficha ao lado.
// As ações de cada pessoa (confiar e retirar função, a ficha da coordenação, o histórico) vêm de Pessoas.tsx.

export interface PessoaDaLista {
  id: string;
  nome: string;
  email: string;
  suspenso: boolean;
  trocar_senha?: boolean;
  visto_em: string;
  criado_em?: string;
  nivel: number;
  papeis: Role[];
}

/** O departamento principal de cada função (o mesmo das conversas e da página Departamentos). */
const DEPARTAMENTO: Partial<Record<Role["papel"], [string, string]>> = {
  coordenacao: ["Coordenação", "#1f1a14"],
  vice: ["Coordenação", "#1f1a14"],
  supervisao: ["Supervisão", "#5a4e3c"],
  jornalismo: ["Comunicação", "#c21f16"],
  marketing: ["Comunicação", "#c21f16"],
  porta_voz: ["Comunicação", "#c21f16"],
  design: ["Design", "#d4a24c"],
  educacao: ["Pedagógico", "#2f6f4f"],
  educacao_secundaria: ["Pedagógico", "#2f6f4f"],
  mentoria: ["Reforço", "#4f8a6b"],
  curadoria: ["Acervo e curadoria", "#6e1f1a"],
  revisao: ["Revisão", "#8a5a2b"],
  traducao: ["Tradução", "#3d5a80"],
  mediacao: ["Comunidade e mediação", "#7b4b94"],
  desenvolvimento: ["Desenvolvimento", "#1f3a5f"],
  saude: ["Mural de Saúde", "#b5446e"],
};
const NOMES_REPRESENTANTE: Record<string, string> = { jornalismo: "jornalismo", marketing: "marketing", saude: "saude" };

export function departamentoDa(pessoa: PessoaDaLista): [string, string] | null {
  for (const papel of porNivel(pessoa.papeis)) {
    if (papel.papel === "representante" && papel.disciplina) {
      const d = DEPARTAMENTO[(NOMES_REPRESENTANTE[papel.disciplina] ?? papel.disciplina) as Role["papel"]];
      if (d) return d;
      if (papel.disciplina.startsWith("grupo-")) return DEPARTAMENTO.educacao ?? null;
    }
    const d = DEPARTAMENTO[papel.papel];
    if (d) return d;
  }
  return null;
}

/** "bi••••@gmail.com": o e-mail aparece escondido na lista; inteiro, só dentro da ficha. */
export const mascarar = (email: string) => {
  const [nome, dominio] = email.split("@");
  return dominio ? `${nome.slice(0, 2)}••••@${dominio}` : "";
};

type Situacao = "ativa" | "nova" | "sumida" | "suspensa" | "senha";
const SITUACAO: Record<Situacao, [string, string]> = {
  ativa: ["Ativa", "bg-ok/20 text-ink"],
  nova: ["Nova", "bg-[#dbe8f5] text-[#1f3a5f]"],
  sumida: ["Sumida", "bg-gold/30 text-ink"],
  suspensa: ["Suspensa", "bg-oxblood/15 text-oxblood"],
  senha: ["Trocando a senha", "bg-parchment-deep text-ink"],
};

export function situacaoDe(p: PessoaDaLista, agora: number): Situacao {
  if (p.suspenso) return "suspensa";
  if (p.trocar_senha) return "senha";
  const dias = (agora - new Date(p.visto_em).getTime()) / 86_400_000;
  if (p.papeis.length > 0 && dias > 30) return "sumida";
  if (p.criado_em && (agora - new Date(p.criado_em).getTime()) / 86_400_000 < 14) return "nova";
  return "ativa";
}

export function ListaDePessoas({
  pessoas,
  eu,
  candidaturas,
  verCandidaturas,
  nomeDaArea,
  ficha,
  emLote,
}: {
  pessoas: PessoaDaLista[];
  eu: string;
  candidaturas: number;
  verCandidaturas: () => void;
  nomeDaArea: (slug: string | null) => string;
  /** A ficha de uma pessoa (funções com o retirar, a ficha da coordenação, o histórico), montada por Pessoas.tsx. */
  ficha: (pessoa: PessoaDaLista) => ReactNode;
  /** Dar uma função a várias pessoas de uma vez. */
  emLote: (ids: string[]) => void;
}) {
  const [agora] = useState(() => Date.now());
  const [busca, setBusca] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [funcao, setFuncao] = useState("");
  const [situacao, setSituacao] = useState<Situacao | "">("");
  const [grupo, setGrupo] = useState<"equipe" | "comunidade">("equipe");
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);

  const equipe = pessoas.filter((p) => p.papeis.length > 0);
  const sumidas = equipe.filter((p) => situacaoDe(p, agora) === "sumida").length;
  const contagem = new Map<string, number>();
  for (const p of equipe) {
    const d = departamentoDa(p)?.[0];
    if (d) contagem.set(d, (contagem.get(d) ?? 0) + 1);
  }
  const poucos = [...new Set(Object.values(DEPARTAMENTO).map((d) => d![0]))].filter((d) => (contagem.get(d) ?? 0) <= 1);

  const termo = busca.trim().toLowerCase();
  const vistas = pessoas
    .filter((p) => (grupo === "equipe" ? p.papeis.length > 0 : p.papeis.length === 0))
    .filter((p) => !termo || `${p.nome} ${p.email}`.toLowerCase().includes(termo))
    .filter((p) => !departamento || departamentoDa(p)?.[0] === departamento)
    .filter((p) => !funcao || p.papeis.some((papel) => papel.papel === funcao))
    .filter((p) => !situacao || situacaoDe(p, agora) === situacao);
  const fichaAberta = pessoas.find((p) => p.id === aberta) ?? null;
  const ultimoAcesso = (iso: string) => {
    const dias = Math.floor((agora - new Date(iso).getTime()) / 86_400_000);
    return dias > 30 ? `há ${dias} dias` : data(iso);
  };
  const filtro = "painel-campo rounded-full border-2 border-ink bg-folha px-3 py-1.5 text-[0.82rem] font-semibold";

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            [String(equipe.length), "na equipe", null],
            [String(candidaturas), candidaturas === 1 ? "candidatura esperando" : "candidaturas esperando", verCandidaturas],
            [String(sumidas), "sumidas há mais de 30 dias", sumidas ? () => { setGrupo("equipe"); setSituacao("sumida"); } : null],
            [String(poucos.length), poucos.length === 1 ? "departamento com pouca gente" : "departamentos com pouca gente", null],
          ] as [string, string, (() => void) | null][]
        ).map(([valor, nome, fazer]) => {
          const miolo = (
            <>
              <dd className="font-serif text-3xl font-semibold leading-none">{valor}</dd>
              <dt className="mt-1 text-xs text-ink-soft">{nome}</dt>
            </>
          );
          return fazer ? (
            <button key={nome} type="button" onClick={fazer} className="cursor-pointer border-2 border-ink bg-folha p-3 text-left shadow-[3px_3px_0_var(--sombra)] hover:shadow-[3px_3px_0_var(--prelo)]">{miolo}</button>
          ) : (
            <div key={nome} className="border-2 border-ink bg-folha p-3 shadow-[3px_3px_0_var(--sombra)]" title={nome.includes("pouca") ? poucos.join(", ") : undefined}>{miolo}</div>
          );
        })}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" aria-label="Buscar pessoa" className={`${filtro} min-w-0 flex-1 font-normal`} />
        <select value={departamento} onChange={(e) => setDepartamento(e.target.value)} aria-label="Departamento" className={filtro}>
          <option value="">Todos os departamentos</option>
          {[...new Set(Object.values(DEPARTAMENTO).map((d) => d![0]))].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={funcao} onChange={(e) => setFuncao(e.target.value)} aria-label="Função" className={filtro}>
          <option value="">Todas as funções</option>
          {(Object.keys(papeis) as Role["papel"][]).map((p) => (
            <option key={p} value={p}>{papeis[p]}</option>
          ))}
        </select>
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as Situacao | "")} aria-label="Situação" className={filtro}>
          <option value="">Qualquer situação</option>
          {(Object.keys(SITUACAO) as Situacao[]).map((s) => (
            <option key={s} value={s}>{SITUACAO[s][0]}</option>
          ))}
        </select>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Quem mostrar">
        {([["equipe", `Equipe (${equipe.length})`], ["comunidade", `Comunidade, não equipe (${pessoas.length - equipe.length})`]] as const).map(([valor, nome]) => (
          <button key={valor} type="button" aria-pressed={grupo === valor} onClick={() => { setGrupo(valor); setEscolhidas([]); }} className={`cursor-pointer border-2 px-3 py-1 text-sm ${grupo === valor ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
            {nome}
          </button>
        ))}
        {escolhidas.length > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-2 border-2 border-ink bg-[#f9e7a6] px-3 py-1 text-sm text-[#1f1a14]">
            <strong>{escolhidas.length} {escolhidas.length === 1 ? "selecionada" : "selecionadas"}</strong>
            <button type="button" className="cursor-pointer font-semibold underline" onClick={() => emLote(escolhidas)}>Dar uma função</button>
            <button type="button" className="cursor-pointer underline" onClick={() => void navigator.clipboard?.writeText(pessoas.filter((p) => escolhidas.includes(p.id)).map((p) => p.nome).join(", "))}>Copiar os nomes</button>
            <button type="button" className="cursor-pointer underline" onClick={() => setEscolhidas([])}>Limpar</button>
          </span>
        )}
      </p>

      <div className={`mt-3 grid gap-5 ${fichaAberta ? "2xl:grid-cols-[minmax(0,1fr)_24rem]" : ""}`}>
        <div className="min-w-0 overflow-x-auto border-2 border-ink">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="bg-parchment-deep text-left font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-soft">
                <th className="w-8 border-b-2 border-ink px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas as pessoas da lista"
                    checked={vistas.length > 0 && vistas.every((p) => escolhidas.includes(p.id))}
                    onChange={(e) => setEscolhidas(e.target.checked ? vistas.filter((p) => p.id !== eu).map((p) => p.id) : [])}
                  />
                </th>
                <th className="border-b-2 border-ink px-3 py-2">Pessoa</th>
                <th className="border-b-2 border-ink px-3 py-2">Departamento</th>
                <th className="border-b-2 border-ink px-3 py-2">Funções</th>
                <th className="border-b-2 border-ink px-3 py-2">Último acesso</th>
                <th className="border-b-2 border-ink px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {vistas.map((p) => {
                const d = departamentoDa(p);
                const s = situacaoDe(p, agora);
                const funcoes = porNivel(p.papeis);
                return (
                  <tr key={p.id} className={`cursor-pointer border-b border-rule hover:bg-parchment ${aberta === p.id ? "bg-[#fdf1d8]" : "bg-folha"}`} onClick={() => setAberta(aberta === p.id ? null : p.id)}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {p.id !== eu && (
                        <input type="checkbox" aria-label={`Selecionar ${p.nome}`} checked={escolhidas.includes(p.id)} onChange={(e) => setEscolhidas(e.target.checked ? [...escolhidas, p.id] : escolhidas.filter((x) => x !== p.id))} />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2.5">
                        <Avatar nome={p.nome} className="h-8 w-8 rounded-lg" texto="text-[0.68rem]" />
                        <span className="min-w-0">
                          <button type="button" className="block cursor-pointer text-left font-semibold hover:text-prelo-texto" aria-expanded={aberta === p.id}>
                            {p.nome}{p.id === eu && <span className="font-normal text-ink-soft"> (você)</span>}
                          </button>
                          {p.email && <span className="block font-mono text-[0.7rem] text-ink-soft">{mascarar(p.email)}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {d ? (
                        <span className="inline-flex items-center gap-1.5 text-[0.8rem]">
                          <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d[1] }} />
                          {d[0]}
                        </span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {funcoes.slice(0, 2).map((papel) => (
                        <span key={papel.id} className="mr-1 mb-0.5 inline-block border border-rule bg-parchment px-1.5 py-0.5 text-[0.72rem]">
                          {papeis[papel.papel]}{papel.disciplina ? ` · ${nomeDaArea(papel.disciplina)}` : ""}
                        </span>
                      ))}
                      {funcoes.length > 2 && <span className="text-xs text-ink-soft">+{funcoes.length - 2}</span>}
                      {funcoes.length === 0 && <span className="text-xs text-ink-soft">sem função</span>}
                    </td>
                    <td className={`px-3 py-2 font-mono text-xs ${s === "sumida" ? "text-oxblood" : ""}`}>{ultimoAcesso(p.visto_em)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${SITUACAO[s][1]}`}>{SITUACAO[s][0]}</span>
                    </td>
                  </tr>
                );
              })}
              {vistas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-soft">Ninguém com esses filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="border-t border-rule bg-parchment-deep px-3 py-2 text-xs text-ink-soft">Os e-mails aparecem escondidos. O endereço inteiro, só a coordenação vê, dentro da ficha.</p>
        </div>
        {fichaAberta && (
          <aside aria-label={`Ficha de ${fichaAberta.nome}`} className="min-w-0 self-start border-2 border-ink bg-folha p-4 shadow-[4px_4px_0_var(--sombra)] 2xl:sticky 2xl:top-24">
            <div className="flex items-start gap-3">
              <Avatar nome={fichaAberta.nome} className="h-12 w-12 rounded-xl" texto="text-sm" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl font-semibold leading-tight">{fichaAberta.nome}</p>
                <p className="text-xs text-ink-soft">
                  {fichaAberta.criado_em ? `no site desde ${data(fichaAberta.criado_em)} · ` : ""}último acesso {ultimoAcesso(fichaAberta.visto_em)}
                </p>
                {fichaAberta.email && <p className="mt-0.5 select-all break-all font-mono text-xs">{fichaAberta.email}</p>}
              </div>
              <button type="button" aria-label="Fechar a ficha" className="cursor-pointer px-1 text-lg leading-none hover:text-oxblood" onClick={() => setAberta(null)}>✕</button>
            </div>
            <div className="mt-3">{ficha(fichaAberta)}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
