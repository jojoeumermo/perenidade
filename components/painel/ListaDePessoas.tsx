// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ClipboardCopy, Eraser, UserPlus, Users, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { porNivel, type Role } from "@/lib/backend";
import { Avatar } from "./Avatar";
import { data, papeis } from "./comum";
import { LIMITE_DE_POUCA_GENTE } from "./mesa-funcoes";
import { Botao, Busca, type ColumnDef, Estatistica, Estatisticas, Faixa, Selecao, Selo, Tabela, type TomDoSelo, Vazio } from "./ui";

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

/** O departamento principal de cada função (o mesmo das conversas e da página Departamentos), com a cor do ponto em token do tema. */
const DEPARTAMENTO: Partial<Record<Role["papel"], [string, string]>> = {
  coordenacao: ["Coordenação", "var(--pn-texto)"],
  vice: ["Coordenação", "var(--pn-texto)"],
  supervisao: ["Supervisão", "var(--pn-texto-suave)"],
  jornalismo: ["Comunicação", "var(--pn-destaque-vivo)"],
  marketing: ["Comunicação", "var(--pn-destaque-vivo)"],
  porta_voz: ["Comunicação", "var(--pn-destaque-vivo)"],
  design: ["Comunicação", "var(--pn-destaque-vivo)"],
  educacao: ["Pedagógico", "var(--pn-ok)"],
  educacao_secundaria: ["Pedagógico", "var(--pn-ok)"],
  mentoria: ["Reforço", "color-mix(in srgb, var(--pn-ok) 55%, var(--pn-superficie))"],
  curadoria: ["Acervo e curadoria", "var(--pn-destaque-hover)"],
  revisao: ["Revisão", "var(--pn-ouro)"],
  traducao: ["Tradução", "var(--pn-info)"],
  mediacao: ["Comunidade e mediação", "color-mix(in srgb, var(--pn-info) 50%, var(--pn-destaque-vivo))"],
  desenvolvimento: ["UI/UX e Desenvolvimento", "color-mix(in srgb, var(--pn-info) 60%, var(--pn-texto))"],
  saude: ["Mural de Saúde", "color-mix(in srgb, var(--pn-destaque-vivo) 55%, var(--pn-superficie))"],
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
const SITUACAO: Record<Situacao, [string, TomDoSelo]> = {
  ativa: ["Ativa", "ok"],
  nova: ["Nova", "info"],
  sumida: ["Sumida", "aviso"],
  suspensa: ["Suspensa", "erro"],
  senha: ["Trocando a senha", "neutro"],
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
  const [vendoPoucos, setVendoPoucos] = useState(false);

  const equipe = pessoas.filter((p) => p.papeis.length > 0);
  const sumidas = equipe.filter((p) => situacaoDe(p, agora) === "sumida").length;
  const contagem = new Map<string, number>();
  for (const p of equipe) {
    const d = departamentoDa(p)?.[0];
    if (d) contagem.set(d, (contagem.get(d) ?? 0) + 1);
  }
  const poucos = [...new Set(Object.values(DEPARTAMENTO).map((d) => d![0]))].filter((d) => (contagem.get(d) ?? 0) <= LIMITE_DE_POUCA_GENTE);

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
  const todasVistas = vistas.length > 0 && vistas.every((p) => escolhidas.includes(p.id));

  const colunas: ColumnDef<PessoaDaLista>[] = [
    {
      id: "escolher",
      enableSorting: false,
      header: () => <input type="checkbox" aria-label="Selecionar todas as pessoas da lista" checked={todasVistas} onChange={(e) => setEscolhidas(e.target.checked ? vistas.filter((p) => p.id !== eu).map((p) => p.id) : [])} />,
      cell: ({ row: { original: p } }) =>
        p.id !== eu ? (
          // O clique na caixa não abre a ficha (a linha inteira abre).
          <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <input type="checkbox" aria-label={`Selecionar ${p.nome}`} checked={escolhidas.includes(p.id)} onChange={(e) => setEscolhidas(e.target.checked ? [...escolhidas, p.id] : escolhidas.filter((x) => x !== p.id))} />
          </span>
        ) : null,
    },
    {
      id: "pessoa",
      header: "Pessoa",
      accessorFn: (p) => p.nome,
      cell: ({ row: { original: p } }) => (
        <span className="flex items-center gap-2.5">
          <Avatar nome={p.nome} className="h-8 w-8 rounded-lg" texto="text-[0.68rem]" />
          <span className="min-w-0">
            <button
              type="button"
              className="block cursor-pointer text-left font-semibold hover:underline"
              aria-expanded={aberta === p.id}
              onClick={(e) => {
                e.stopPropagation();
                setAberta(aberta === p.id ? null : p.id);
              }}
            >
              {p.nome}
              {p.id === eu && <span className="font-normal text-ink-soft"> (você)</span>}
            </button>
            {p.email && <span className="block font-mono text-[0.7rem] text-ink-soft">{mascarar(p.email)}</span>}
          </span>
        </span>
      ),
    },
    {
      id: "departamento",
      header: "Departamento",
      accessorFn: (p) => departamentoDa(p)?.[0] ?? "",
      cell: ({ row: { original: p } }) => {
        const d = departamentoDa(p);
        return d ? (
          <span className="inline-flex items-center gap-1.5 text-[0.8rem]">
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d[1] }} />
            {d[0]}
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        );
      },
    },
    {
      id: "funcoes",
      header: "Funções",
      enableSorting: false,
      accessorFn: (p) => porNivel(p.papeis).map((papel) => papeis[papel.papel]).join(" "),
      cell: ({ row: { original: p } }) => {
        const funcoes = porNivel(p.papeis);
        return (
          <span className="flex flex-wrap items-center gap-1">
            {funcoes.slice(0, 2).map((papel) => (
              <Selo key={papel.id}>
                {papeis[papel.papel]}
                {papel.disciplina ? ` · ${nomeDaArea(papel.disciplina)}` : ""}
              </Selo>
            ))}
            {funcoes.length > 2 && <span className="pn-ajuda">+{funcoes.length - 2}</span>}
            {funcoes.length === 0 && <span className="pn-ajuda">sem função</span>}
          </span>
        );
      },
    },
    {
      id: "acesso",
      header: "Último acesso",
      accessorFn: (p) => p.visto_em,
      cell: ({ row: { original: p } }) => <span className={`whitespace-nowrap font-mono text-xs tabular-nums ${situacaoDe(p, agora) === "sumida" ? "text-oxblood" : ""}`}>{ultimoAcesso(p.visto_em)}</span>,
    },
    {
      id: "situacao",
      header: "Situação",
      accessorFn: (p) => SITUACAO[situacaoDe(p, agora)][0],
      cell: ({ row: { original: p } }) => {
        const s = situacaoDe(p, agora);
        return (
          <Selo tom={SITUACAO[s][1]} ponto>
            {SITUACAO[s][0]}
          </Selo>
        );
      },
    },
  ];

  return (
    <div className="pn-tela">
      <Estatisticas>
        <Estatistica rotulo="na equipe" valor={equipe.length} />
        <Estatistica rotulo={candidaturas === 1 ? "candidatura esperando" : "candidaturas esperando"} valor={candidaturas} tom={candidaturas ? "bordo" : "neutro"} aoClicar={verCandidaturas} />
        <Estatistica
          rotulo="sumidas há mais de 30 dias"
          valor={sumidas}
          tom={sumidas ? "aviso" : "neutro"}
          aoClicar={
            sumidas
              ? () => {
                  setGrupo("equipe");
                  setSituacao("sumida");
                }
              : undefined
          }
        />
        {/* B14: o quadro dos departamentos com pouca gente abre a lista deles (botão com aria-expanded, para o leitor de tela). */}
        {poucos.length ? (
          <button type="button" data-tom="aviso" className="pn-estatistica" onClick={() => setVendoPoucos((v) => !v)} aria-expanded={vendoPoucos} aria-controls="departamentos-com-pouca-gente" title={poucos.join(", ")}>
            <span className="pn-rotulo-mono">{poucos.length === 1 ? "departamento com pouca gente" : "departamentos com pouca gente"}</span>
            <span className="pn-estatistica-valor">{poucos.length}</span>
          </button>
        ) : (
          <Estatistica rotulo="departamentos com pouca gente" valor={0} />
        )}
      </Estatisticas>

      {vendoPoucos && poucos.length > 0 && (
        <section id="departamentos-com-pouca-gente" aria-label="Departamentos com pouca gente" className="pn-cartao">
          <p className="text-sm text-ink-soft">Departamentos com {LIMITE_DE_POUCA_GENTE === 1 ? "uma pessoa ou nenhuma" : `até ${LIMITE_DE_POUCA_GENTE} pessoas`} na equipe. Quem ajuda aqui faz diferença: escolha um para ver quem está lá.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {poucos.map((d) => {
              const n = contagem.get(d) ?? 0;
              return (
                <li key={d}>
                  <Botao
                    pequeno
                    simbolo={Users}
                    aria-pressed={departamento === d}
                    onClick={() => {
                      setGrupo("equipe");
                      setSituacao("");
                      setFuncao("");
                      setBusca("");
                      setDepartamento(d);
                    }}
                  >
                    {d} · {n === 0 ? "ninguém ainda" : n === 1 ? "1 pessoa" : `${n} pessoas`}
                  </Botao>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="pn-barra-ferramentas grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:items-end">
        <Busca rotulo="Buscar pessoa" valor={busca} aoMudar={setBusca} placeholder="Buscar pessoa" />
        <Selecao rotulo="Departamento" value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
          <option value="">Todos os departamentos</option>
          {[...new Set(Object.values(DEPARTAMENTO).map((d) => d![0]))].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Função" value={funcao} onChange={(e) => setFuncao(e.target.value)}>
          <option value="">Todas as funções</option>
          {(Object.keys(papeis) as Role["papel"][]).map((p) => (
            <option key={p} value={p}>
              {papeis[p]}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value as Situacao | "")}>
          <option value="">Qualquer situação</option>
          {(Object.keys(SITUACAO) as Situacao[]).map((s) => (
            <option key={s} value={s}>
              {SITUACAO[s][0]}
            </option>
          ))}
        </Selecao>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        {/* Um grupo de botões (não abas: a tabela é a mesma, só o filtro muda); o escolhido fica com aria-pressed. */}
        <div role="group" aria-label="Quem mostrar" className="flex flex-wrap gap-1">
          {(
            [
              ["equipe", `Equipe (${equipe.length})`],
              ["comunidade", `Comunidade, não equipe (${pessoas.length - equipe.length})`],
            ] as const
          ).map(([valor, nome]) => (
            <Botao
              key={valor}
              pequeno
              variante={grupo === valor ? "padrao" : "discreto"}
              aria-pressed={grupo === valor}
              onClick={() => {
                setGrupo(valor);
                setEscolhidas([]);
              }}
            >
              {nome}
            </Botao>
          ))}
        </div>
        {escolhidas.length > 0 && (
          <Faixa
            tom="bordo"
            semSimbolo
            acao={
              <span className="flex flex-wrap gap-1">
                <Botao pequeno variante="principal" simbolo={UserPlus} onClick={() => emLote(escolhidas)}>
                  Dar uma função
                </Botao>
                <Botao pequeno variante="discreto" simbolo={ClipboardCopy} onClick={() => void navigator.clipboard?.writeText(pessoas.filter((p) => escolhidas.includes(p.id)).map((p) => p.nome).join(", "))}>
                  Copiar os nomes
                </Botao>
                <Botao pequeno variante="discreto" simbolo={Eraser} onClick={() => setEscolhidas([])}>
                  Limpar
                </Botao>
              </span>
            }
          >
            <strong>
              {escolhidas.length} {escolhidas.length === 1 ? "selecionada" : "selecionadas"}
            </strong>
          </Faixa>
        )}
      </div>

      <div className={`grid gap-5 ${fichaAberta ? "2xl:grid-cols-[minmax(0,1fr)_24rem]" : ""}`}>
        <div className="min-w-0 space-y-1">
          <Tabela dados={vistas} colunas={colunas} legenda="Voluntários" porPagina={50} alturaMaxima="70vh" aoClicarLinha={(p) => setAberta(aberta === p.id ? null : p.id)} vazio={<Vazio simbolo={Users} titulo="Ninguém com esses filtros." />} />
          <p className="pn-ajuda">Os e-mails aparecem escondidos. O endereço inteiro, só a coordenação vê, dentro da ficha.</p>
        </div>
        {fichaAberta && (
          <aside aria-label={`Ficha de ${fichaAberta.nome}`} className="pn-cartao min-w-0 self-start 2xl:sticky 2xl:top-24">
            <div className="flex items-start gap-3">
              <Avatar nome={fichaAberta.nome} className="h-12 w-12 rounded-xl" texto="text-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold leading-tight" style={{ fontFamily: "var(--pn-fonte-titulo)" }}>{fichaAberta.nome}</p>
                <p className="pn-ajuda">
                  {fichaAberta.criado_em ? `no site desde ${data(fichaAberta.criado_em)} · ` : ""}último acesso {ultimoAcesso(fichaAberta.visto_em)}
                </p>
                {fichaAberta.email && <p className="mt-0.5 select-all break-all font-mono text-xs">{fichaAberta.email}</p>}
              </div>
              <Botao variante="discreto" pequeno icone simbolo={X} aria-label="Fechar a ficha" dica="Fechar a ficha" onClick={() => setAberta(null)} />
            </div>
            <div className="mt-3">{ficha(fichaAberta)}</div>
          </aside>
        )}
      </div>
    </div>
  );
}