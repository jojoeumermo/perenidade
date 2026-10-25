// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import { Avatar } from "./Avatar";
import { Abas, Aviso, botao, botaoClaro, campo, data, elo, papeis, textoDoErro, useAcao } from "./comum";

// A página de cada departamento (prancheta "Painel — Departamento"): para que serve, a meta do mês, o quadro da semana,
// os pedidos de outros departamentos com prazo, quem responde, como trabalhamos e a passagem de bastão. O banco está
// em supabase/install.sql, "Departamentos".

export const NOMES_DOS_DEPARTAMENTOS: Record<string, string> = {
  jornalismo: "Comunicação",
  design: "Design",
  educacao: "Pedagógico",
  mentoria: "Reforço",
  curadoria: "Acervo e curadoria",
  revisao: "Revisão",
  traducao: "Tradução",
  mediacao: "Comunidade e mediação",
  desenvolvimento: "Desenvolvimento",
  saude: "Saúde Solidária",
  coordenacao: "Coordenação",
};
const nomeDe = (id: string) => NOMES_DOS_DEPARTAMENTOS[id] ?? id;

interface Resumo {
  id: string;
  descricao: string;
  pessoas: number;
  pedidos: number;
  meu: boolean;
  respondo: boolean;
}
interface Pedido {
  id: string;
  de: string;
  para: string;
  titulo: string;
  detalhe: string;
  prazo: string | null;
  status: "aberto" | "aceito" | "feito" | "recusado";
  resposta: string;
  autor: string;
  responsavel: string;
  criado_em: string;
  meu: boolean;
}
interface Cartao {
  id: string;
  titulo: string;
  etiqueta: string;
  coluna: Coluna;
  prazo: string | null;
  pedido: string | null;
  dono: string | null;
  dono_nome: string;
}
interface Pessoa {
  id: string;
  nome: string;
  avatar: string | null;
  responde: boolean;
  ferias_ate: string | null;
  oficios?: string[];
  /** Desde quando está numa função deste departamento. */
  desde?: string | null;
  papeis: { papel: keyof typeof papeis; disciplina: string | null }[];
}
interface Departamento {
  id: string;
  descricao: string;
  como: string;
  meta_titulo: string;
  meta_alvo: number | null;
  meta_feito: number;
  meu: boolean;
  respondo: boolean;
  pessoas: Pessoa[];
  recebidos: Pedido[];
  enviados: Pedido[];
  quadro: Cartao[];
  feitos_no_mes: number;
  bastoes: { id: string; texto: string; autor: string; criado_em: string; meu: boolean }[];
}
type Coluna = "fazer" | "fazendo" | "aprovacao" | "feito";
type Aba = "geral" | "pedidos" | "quadro" | "pessoas" | "como";

const COLUNAS: [Coluna, string][] = [
  ["fazer", "A fazer"],
  ["fazendo", "Fazendo"],
  ["aprovacao", "Esperando aprovação"],
  ["feito", "Feito"],
];
const SITUACAO: Record<Pedido["status"], string> = { aberto: "esperando", aceito: "aceito", feito: "feito", recusado: "recusado" };
const TOM: Record<Pedido["status"], string> = { aberto: "bg-gold/25", aceito: "bg-[#dbe8f5] text-[#1f3a5f]", feito: "bg-ok/20", recusado: "bg-oxblood/15 text-oxblood" };
const caixa = "border-2 border-ink bg-folha p-4 shadow-[4px_4px_0_var(--sombra)]";
const chapeu = "font-mono text-[0.66rem] uppercase tracking-[0.2em] text-prelo-texto";
const dia = (iso: string) => data(`${iso}T12:00:00`);

export function Departamentos({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const [resumo, setResumo] = useState<Resumo[] | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("d")));
  const [dep, setDep] = useState<Departamento | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<Aba>("geral");
  const [pedindo, setPedindo] = useState(false);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    rpc<Resumo[]>("departamentos_resumo")
      .then((lista) => {
        // Na ordem do trabalho (a mesma de NOMES_DOS_DEPARTAMENTOS), não na alfabética do código interno.
        const ordem = Object.keys(NOMES_DOS_DEPARTAMENTOS);
        lista.sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
        setResumo(lista);
        setEscolhido((atual) => atual ?? lista.find((d) => d.meu)?.id ?? lista.find((d) => d.respondo)?.id ?? lista[0]?.id ?? null);
      })
      .catch((e) => setErro(textoDoErro(e)));
  }, [versao]);
  useEffect(() => {
    if (!escolhido) return;
    let vivo = true;
    rpc<Departamento>("departamento_ver", { p_id: escolhido })
      .then((d) => vivo && setDep(d))
      .catch((e) => vivo && setErro(textoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [escolhido, versao]);

  const meus = (resumo ?? []).filter((d) => d.meu).map((d) => d.id);
  const atual = dep && dep.id === escolhido ? dep : null;
  const abertos = atual?.recebidos.filter((p) => p.status === "aberto" || p.status === "aceito") ?? [];
  const mexe = Boolean(atual && (atual.meu || atual.respondo));

  return (
    <div>
      <Aviso texto={erro} />
      <nav aria-label="Departamentos" className="mb-6 flex flex-wrap gap-1.5">
        {(resumo ?? []).map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === escolhido}
            onClick={() => {
              setEscolhido(d.id);
              setAba("geral");
              setPedindo(false);
            }}
            className={`relative cursor-pointer border-2 px-3 py-1.5 text-[0.82rem] font-semibold ${d.id === escolhido ? "border-ink bg-ink text-parchment" : d.meu ? "border-ink bg-folha" : "border-rule bg-parchment hover:border-ink"}`}
          >
            {nomeDe(d.id)}
            {d.pedidos > 0 && <span className="ml-1.5 bg-[#c21f16] px-1 font-mono text-[0.62rem] text-white">{d.pedidos}</span>}
          </button>
        ))}
      </nav>

      {!atual ? (
        <p className="text-ink-soft" role="status">Carregando o departamento…</p>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-double border-ink pb-5">
            <div className="min-w-0 max-w-2xl">
              <p className={chapeu}>Departamento{atual.meu ? " · o seu" : ""}</p>
              <h2 className="mt-1 font-serif text-[2.4rem] font-semibold leading-none">{nomeDe(atual.id)}</h2>
              {atual.descricao && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{atual.descricao}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex -space-x-2" aria-label={`${atual.pessoas.length} pessoas`}>
                {atual.pessoas.slice(0, 4).map((p) => (
                  <Avatar key={p.id} nome={p.nome} avatar={p.avatar} className="h-9 w-9 rounded-full border-2 border-parchment" texto="text-[0.7rem]" />
                ))}
                {atual.pessoas.length > 4 && <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-parchment bg-ink font-mono text-[0.68rem] text-parchment">+{atual.pessoas.length - 4}</span>}
              </span>
              {!atual.meu && (
                <button type="button" className="cursor-pointer border-2 border-ink bg-[#c21f16] px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--sombra)] hover:bg-[#a51810]" onClick={() => setPedindo(!pedindo)}>
                  Pedir algo {atual.id === "jornalismo" || atual.id === "coordenacao" || atual.id === "mediacao" ? "à" : "ao"} {nomeDe(atual.id)}
                </button>
              )}
            </div>
          </header>

          {pedindo && <NovoPedido para={atual.id} meus={meus} fechar={() => setPedindo(false)} depois={recarregar} />}

          <div className="mt-6">
            <Abas<Aba>
              opcoes={[
                { id: "geral", nome: "Visão geral" },
                { id: "pedidos", nome: `Pedidos${abertos.length ? ` · ${abertos.length}` : ""}` },
                { id: "quadro", nome: "Quadro" },
                { id: "pessoas", nome: `Pessoas · ${atual.pessoas.length}` },
                { id: "como", nome: "Como trabalhamos" },
              ]}
              atual={aba}
              escolher={setAba}
            />
          </div>

          {aba === "geral" && <VisaoGeral dep={atual} abertos={abertos} irPara={setAba} ir={ir} />}
          {aba === "pedidos" && <Pedidos dep={atual} mexe={mexe} depois={recarregar} />}
          {aba === "quadro" && <Quadro dep={atual} mexe={mexe} depois={recarregar} />}
          {aba === "pessoas" && <Pessoas dep={atual} />}
          {aba === "como" && <ComoTrabalhamos dep={atual} me={me} depois={recarregar} />}
        </>
      )}
    </div>
  );
}

function VisaoGeral({ dep, abertos, irPara, ir }: { dep: Departamento; abertos: Pedido[]; irPara: (aba: Aba) => void; ir: (aba: string) => void }) {
  const respondem = dep.pessoas.filter((p) => p.responde);
  const pct = dep.meta_alvo ? Math.min(100, Math.round((dep.meta_feito / dep.meta_alvo) * 100)) : 0;
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className={caixa}>
            <p className={chapeu}>Meta do mês</p>
            {dep.meta_alvo ? (
              <>
                <p className="mt-1 font-serif text-2xl font-semibold">{dep.meta_feito} / {dep.meta_alvo}</p>
                <p className="text-xs text-ink-soft">{dep.meta_titulo}</p>
                <div className="mt-2 h-2 border border-ink bg-parchment" aria-hidden>
                  <div className="h-full bg-[#c21f16]" style={{ width: `${pct}%` }} />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">Sem meta definida. Quem responde pelo departamento põe em Como trabalhamos.</p>
            )}
          </div>
          <div className={caixa}>
            <p className={chapeu}>Feito este mês</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{dep.feitos_no_mes}</p>
            <p className="text-xs text-ink-soft">cartões do quadro que chegaram ao fim</p>
          </div>
          <button type="button" className={`${caixa} cursor-pointer text-left hover:shadow-[4px_4px_0_var(--prelo)]`} onClick={() => irPara("pedidos")}>
            <span className={chapeu}>Pedidos abertos</span>
            <span className="mt-1 block font-serif text-2xl font-semibold">{abertos.length}</span>
            <span className="text-xs text-ink-soft">de outros departamentos</span>
          </button>
        </div>

        <section aria-labelledby="quadro-semana">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="quadro-semana" className="font-serif text-2xl font-semibold">Quadro da semana</h3>
            <button type="button" className={`${elo} text-sm font-bold`} onClick={() => irPara("quadro")}>Abrir o quadro →</button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {COLUNAS.filter(([c]) => c !== "feito").map(([coluna, nome]) => {
              const cartoes = dep.quadro.filter((q) => q.coluna === coluna);
              return (
                <div key={coluna} className="border-2 border-ink bg-parchment-deep p-3">
                  <p className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">{nome} · {cartoes.length}</p>
                  <ul className="mt-2 space-y-2">
                    {cartoes.slice(0, 3).map((q) => (
                      <li key={q.id} className="border border-ink bg-folha p-2 text-sm">
                        {q.etiqueta && <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-prelo-texto">{q.etiqueta}</span>}
                        <span className="block font-semibold leading-snug">{q.titulo}</span>
                        <span className="text-xs text-ink-soft">{q.prazo ? `prazo ${dia(q.prazo)}` : "sem prazo"} · {q.dono_nome || "sem dono"}</span>
                      </li>
                    ))}
                    {cartoes.length === 0 && <li className="text-xs text-ink-soft">Nada aqui.</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className={caixa} aria-labelledby="pedidos-outros">
          <p id="pedidos-outros" className={chapeu}>Pedidos de outros departamentos</p>
          {abertos.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Nenhum pedido esperando.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {abertos.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-soft">{nomeDe(p.de)}</span>
                  <span className="block font-semibold leading-snug">{p.titulo}</span>
                  <span className="text-xs text-ink-soft">pedido em {data(p.criado_em)}{p.prazo ? ` · prazo ${dia(p.prazo)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {abertos.length > 3 && <button type="button" className={`${elo} mt-2 text-sm`} onClick={() => irPara("pedidos")}>Ver os {abertos.length} pedidos →</button>}
        </section>
        <section className={caixa} aria-labelledby="quem-responde">
          <p id="quem-responde" className={chapeu}>Quem responde</p>
          {respondem.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Ainda sem representante: a coordenação responde por enquanto.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {respondem.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Avatar nome={p.nome} avatar={p.avatar} className="h-7 w-7 rounded-full" texto="text-[0.62rem]" />
                  <span><strong>{p.nome}</strong> · representa o departamento</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={`${elo} mt-2 text-sm`} onClick={() => ir("conversas")}>Falar no canal do departamento →</button>
        </section>
        <section className="border-2 border-dashed border-ink bg-parchment p-4 text-sm" aria-labelledby="chegou-agora">
          <p id="chegou-agora" className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-ink-soft">Chegou agora?</p>
          <p className="mt-1 leading-snug">Leia o “como trabalhamos” e as passagens de bastão de quem veio antes: é o caminho mais curto.</p>
          <button type="button" className={`${elo} mt-2 font-bold`} onClick={() => irPara("como")}>Começar →</button>
        </section>
      </aside>
    </div>
  );
}

function NovoPedido({ para, meus, fechar, depois }: { para: string; meus: string[]; fechar: () => void; depois: () => void }) {
  const acao = useAcao(depois);
  const [de, setDe] = useState(meus[0] ?? "geral");
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [prazo, setPrazo] = useState("");
  return (
    <form
      className="mt-5 space-y-3 border-2 border-ink bg-folha p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await acao.agir("departamento_pedir", { p_para: para, p_de: de, p_titulo: titulo, p_detalhe: detalhe, p_prazo: prazo || null }, "Pedido enviado. Quem responde pelo departamento foi avisado.");
        if (ok !== null) fechar();
      }}
    >
      <p className="font-semibold">Pedir algo {para === "jornalismo" ? "à" : "ao departamento de"} {nomeDe(para)}</p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="block text-sm">
          O que você precisa
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} className={campo} placeholder="Arte para a trilha de Alemão" />
        </label>
        <label className="block text-sm">
          Prazo (opcional)
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={campo} />
        </label>
      </div>
      <label className="block text-sm">
        Detalhes
        <textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} maxLength={2000} rows={3} className={campo} placeholder="Para quê, onde vai ser usado, referências." />
      </label>
      {meus.length > 1 && (
        <label className="block text-sm">
          Em nome de
          <select value={de} onChange={(e) => setDe(e.target.value)} className={`${campo} w-auto`}>
            {meus.map((id) => (
              <option key={id} value={id}>{nomeDe(id)}</option>
            ))}
          </select>
        </label>
      )}
      <Aviso texto={acao.aviso} />
      <p className="flex flex-wrap gap-2">
        <button type="submit" className={botao} disabled={acao.ocupado || titulo.trim().length < 3}>Enviar o pedido</button>
        <button type="button" className={botaoClaro} onClick={fechar}>Cancelar</button>
      </p>
    </form>
  );
}

function Pedidos({ dep, mexe, depois }: { dep: Departamento; mexe: boolean; depois: () => void }) {
  const acao = useAcao(depois);
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const linha = (p: Pedido, recebido: boolean) => (
    <li key={p.id} className="border-2 border-ink bg-folha p-4">
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`px-1.5 py-0.5 font-semibold ${TOM[p.status]}`}>{SITUACAO[p.status]}</span>
        <span className="font-mono uppercase tracking-[0.14em] text-ink-soft">{recebido ? `de ${nomeDe(p.de)}` : `para ${nomeDe(p.para)}`}</span>
        <span className="text-ink-soft">· {p.autor || "alguém"} · {data(p.criado_em)}</span>
        {p.prazo && <span className={`font-semibold ${p.status !== "feito" && p.prazo < hoje ? "text-oxblood" : ""}`}>· prazo {dia(p.prazo)}</span>}
      </p>
      <p className="mt-1 font-serif text-lg font-semibold leading-snug">{p.titulo}</p>
      {p.detalhe && <p className="mt-1 whitespace-pre-line text-sm" data-original>{p.detalhe}</p>}
      {p.resposta && <p className="mt-2 border-l-2 border-gold pl-2 text-sm">Resposta: {p.resposta}</p>}
      {p.responsavel && <p className="mt-1 text-xs text-ink-soft">Com {p.responsavel}</p>}
      {recebido && mexe && (p.status === "aberto" || p.status === "aceito") && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {p.status === "aberto" && <button type="button" className={`${botao} px-3 py-1.5 text-sm`} disabled={acao.ocupado} onClick={() => void acao.agir("departamento_pedido_mudar", { p_id: p.id, p_status: "aceito" }, "Pedido aceito: quem pediu foi avisado.")}>Aceitar</button>}
          <button type="button" className={`${botaoClaro} px-3 py-1 text-sm`} disabled={acao.ocupado} onClick={() => void acao.agir("departamento_quadro_salvar", { p_id: null, p: { departamento: dep.id, titulo: p.titulo.slice(0, 140), etiqueta: nomeDe(p.de).slice(0, 30), pedido: p.id, prazo: p.prazo ?? "" } }, "Posto no quadro da semana.")}>
            Pôr no quadro
          </button>
          <button type="button" className={`${botaoClaro} px-3 py-1 text-sm`} disabled={acao.ocupado} onClick={() => void acao.agir("departamento_pedido_mudar", { p_id: p.id, p_status: "feito", p_resposta: respostas[p.id] ?? "" }, "Marcado como feito.")}>Feito</button>
          <input value={respostas[p.id] ?? ""} onChange={(e) => setRespostas({ ...respostas, [p.id]: e.target.value })} maxLength={1000} placeholder="Resposta (obrigatória para recusar)" aria-label={`Resposta ao pedido ${p.titulo}`} className="painel-campo min-w-0 flex-1 border-2 border-ink bg-parchment-deep px-2 py-1 text-sm" />
          <button type="button" className={`${elo} text-sm text-oxblood`} disabled={acao.ocupado || (respostas[p.id] ?? "").trim().length < 5} onClick={() => void acao.agir("departamento_pedido_mudar", { p_id: p.id, p_status: "recusado", p_resposta: respostas[p.id] }, "Pedido recusado, com a sua resposta.")}>Recusar</button>
        </div>
      )}
    </li>
  );
  return (
    <div className="space-y-8">
      <Aviso texto={acao.aviso} />
      <section>
        <h3 className="font-serif text-2xl font-semibold">Recebidos</h3>
        {dep.recebidos.length === 0 ? <p className="mt-2 text-ink-soft">Nenhum pedido nos últimos 30 dias.</p> : <ul className="mt-3 space-y-3">{dep.recebidos.map((p) => linha(p, true))}</ul>}
      </section>
      <section>
        <h3 className="font-serif text-2xl font-semibold">Enviados pelo departamento</h3>
        {dep.enviados.length === 0 ? <p className="mt-2 text-ink-soft">O departamento não pediu nada a ninguém nos últimos 30 dias.</p> : <ul className="mt-3 space-y-3">{dep.enviados.map((p) => linha(p, false))}</ul>}
      </section>
    </div>
  );
}

function Quadro({ dep, mexe, depois }: { dep: Departamento; mexe: boolean; depois: () => void }) {
  const acao = useAcao(depois);
  const [novo, setNovo] = useState<{ coluna: Coluna; titulo: string; etiqueta: string; prazo: string; dono: string } | null>(null);
  const mover = (q: Cartao, passo: 1 | -1) => {
    const i = COLUNAS.findIndex(([c]) => c === q.coluna);
    const destino = COLUNAS[i + passo]?.[0];
    if (destino) void acao.agir("departamento_quadro_salvar", { p_id: q.id, p: { coluna: destino } }, destino === "feito" ? "Feito! Se era um pedido, quem pediu foi avisado." : "Cartão movido.");
  };
  return (
    <div>
      <Aviso texto={acao.aviso} />
      {!mexe && <p className="mb-3 text-sm text-ink-soft">Você vê o quadro; quem é do departamento mexe nele. Para pedir algo, use “Pedir algo”.</p>}
      <div className="grid gap-3 lg:grid-cols-4">
        {COLUNAS.map(([coluna, nome], i) => {
          const cartoes = dep.quadro.filter((q) => q.coluna === coluna);
          return (
            <section key={coluna} aria-label={nome} className="min-w-0 border-2 border-ink bg-parchment-deep p-3">
              <p className="flex items-center justify-between font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">
                {nome} · {cartoes.length}
                {mexe && coluna !== "feito" && (
                  <button type="button" className="cursor-pointer font-sans text-sm font-bold normal-case tracking-normal text-ink hover:text-prelo-texto" onClick={() => setNovo({ coluna, titulo: "", etiqueta: "", prazo: "", dono: "" })}>
                    ＋
                  </button>
                )}
              </p>
              {novo?.coluna === coluna && (
                <form
                  className="mt-2 space-y-1.5 border border-ink bg-folha p-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await acao.agir("departamento_quadro_salvar", { p_id: null, p: { departamento: dep.id, coluna, titulo: novo.titulo, etiqueta: novo.etiqueta, prazo: novo.prazo, dono: novo.dono } }, "Cartão criado.");
                    if (ok !== null) setNovo(null);
                  }}
                >
                  <input autoFocus value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} maxLength={140} placeholder="O que fazer" aria-label="O que fazer" className="painel-campo w-full border border-ink bg-parchment px-2 py-1 text-sm" />
                  <input value={novo.etiqueta} onChange={(e) => setNovo({ ...novo, etiqueta: e.target.value })} maxLength={30} placeholder="Etiqueta (Instagram, Jornal…)" aria-label="Etiqueta" className="painel-campo w-full border border-ink bg-parchment px-2 py-1 text-sm" />
                  <input type="date" value={novo.prazo} onChange={(e) => setNovo({ ...novo, prazo: e.target.value })} aria-label="Prazo" className="painel-campo w-full border border-ink bg-parchment px-2 py-1 text-sm" />
                  <select value={novo.dono} onChange={(e) => setNovo({ ...novo, dono: e.target.value })} aria-label="Quem faz" className="painel-campo w-full border border-ink bg-parchment px-2 py-1 text-sm">
                    <option value="">Sem dono (qualquer um pega)</option>
                    {dep.pessoas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  <p className="flex gap-2">
                    <button type="submit" className={`${botao} px-3 py-1 text-sm`} disabled={acao.ocupado || novo.titulo.trim().length < 3}>Criar</button>
                    <button type="button" className={`${elo} text-sm`} onClick={() => setNovo(null)}>Cancelar</button>
                  </p>
                </form>
              )}
              <ul className="mt-2 space-y-2">
                {cartoes.map((q) => (
                  <li key={q.id} className="border border-ink bg-folha p-2 text-sm">
                    {q.etiqueta && <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-prelo-texto">{q.etiqueta}</span>}
                    <span className="block font-semibold leading-snug">{q.titulo}</span>
                    <span className="block text-xs text-ink-soft">{q.prazo ? `prazo ${dia(q.prazo)}` : "sem prazo"} · {q.dono_nome || "sem dono"}{q.pedido ? " · pedido" : ""}</span>
                    {mexe && (
                      <span className="mt-1.5 flex flex-wrap gap-x-3 text-xs">
                        {i > 0 && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => mover(q, -1)}>← voltar</button>}
                        {i < COLUNAS.length - 1 && <button type="button" className={`${elo} font-bold`} disabled={acao.ocupado} onClick={() => mover(q, 1)}>avançar →</button>}
                        <button type="button" className={`${elo} text-ink-soft`} disabled={acao.ocupado} onClick={() => void acao.agir("departamento_quadro_apagar", { p_id: q.id }, "Cartão apagado.")}>apagar</button>
                      </span>
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

function Pessoas({ dep }: { dep: Departamento }) {
  const [agora] = useState(() => Date.now());
  const meses = (desde?: string | null) => (desde ? Math.floor((agora - new Date(desde).getTime()) / (30 * 86_400_000)) : 0);
  if (dep.pessoas.length === 0) return <p className="text-ink-soft">Ninguém neste departamento ainda. A coordenação confia funções em Voluntários e convites.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {dep.pessoas.map((p) => (
        <li key={p.id} className="flex items-start gap-3 border-2 border-ink bg-folha p-3">
          <Avatar nome={p.nome} avatar={p.avatar} className="h-10 w-10 rounded-full" texto="text-[0.75rem]" />
          <span className="min-w-0">
            <span className="block font-semibold">
              {p.nome}
              {p.responde && <span className="ml-1.5 bg-ink px-1 text-[0.62rem] font-semibold text-parchment">responde</span>}
              {p.ferias_ate && <span className="ml-1.5 bg-[#f9e7a6] px-1 text-[0.62rem] font-semibold text-[#1f1a14]">de férias até {dia(p.ferias_ate)}</span>}
            </span>
            <span className="block text-xs text-ink-soft">
              {(p.papeis ?? []).map((papel) => papeis[papel.papel] ?? papel.papel).join(" · ")}
              {p.desde && ` · ${meses(p.desde) < 1 ? "chegou este mês" : meses(p.desde) === 1 ? "há 1 mês" : `há ${meses(p.desde)} meses`}`}
            </span>
            {p.oficios && p.oficios.length > 0 && <span className="block text-xs text-prelo-texto">Sabe: {p.oficios.join(", ")}</span>}
            {/* Rodízio de funções: depois de um ano, a sugestão (só para quem responde) é ensinar alguém a fazer junto. */}
            {dep.respondo && meses(p.desde) >= 12 && <span className="mt-0.5 block text-xs italic text-ink-soft">Mais de um ano na função: que tal ensinar alguém a fazer junto (rodízio)?</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ComoTrabalhamos({ dep, me, depois }: { dep: Departamento; me: Me; depois: () => void }) {
  const acao = useAcao(depois);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ descricao: dep.descricao, como: dep.como, meta_titulo: dep.meta_titulo, meta_alvo: dep.meta_alvo ? String(dep.meta_alvo) : "", meta_feito: String(dep.meta_feito) });
  const [bastao, setBastao] = useState("");
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-2xl font-semibold">Como trabalhamos</h3>
          {dep.respondo && !editando && <button type="button" className={`${elo} text-sm font-bold`} onClick={() => setEditando(true)}>Editar</button>}
        </div>
        <Aviso texto={acao.aviso} />
        {editando ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await acao.agir("departamento_salvar", { p_id: dep.id, p: { ...form, meta_alvo: form.meta_alvo ? Number(form.meta_alvo) : 0, meta_feito: Number(form.meta_feito || 0) } }, "Guardado.");
              if (ok !== null) setEditando(false);
            }}
          >
            <label className="block text-sm">
              Para que serve o departamento (uma ou duas frases)
              <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={400} rows={2} className={campo} />
            </label>
            <label className="block text-sm">
              Como trabalhamos: reuniões, combinados, onde ficam as coisas, quem aprova o quê
              <textarea value={form.como} onChange={(e) => setForm({ ...form, como: e.target.value })} maxLength={6000} rows={10} className={campo} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                Meta do mês: o quê
                <input value={form.meta_titulo} onChange={(e) => setForm({ ...form, meta_titulo: e.target.value })} maxLength={80} className={campo} placeholder="posts publicados" />
              </label>
              <label className="block text-sm">
                Quanto
                <input type="number" min={0} value={form.meta_alvo} onChange={(e) => setForm({ ...form, meta_alvo: e.target.value })} className={campo} />
              </label>
              <label className="block text-sm">
                Feito até agora
                <input type="number" min={0} value={form.meta_feito} onChange={(e) => setForm({ ...form, meta_feito: e.target.value })} className={campo} />
              </label>
            </div>
            <p className="flex gap-2">
              <button type="submit" className={botao} disabled={acao.ocupado}>Guardar</button>
              <button type="button" className={botaoClaro} onClick={() => setEditando(false)}>Cancelar</button>
            </p>
          </form>
        ) : dep.como ? (
          <p className="mt-3 max-w-3xl whitespace-pre-line text-[1.02rem] leading-relaxed" data-original>{dep.como}</p>
        ) : (
          <p className="mt-3 text-ink-soft">Ainda não escrito. {dep.respondo ? "Conte como o departamento funciona: quem chega lê aqui primeiro." : "Quem responde pelo departamento escreve aqui."}</p>
        )}
      </section>
      <aside className="space-y-4">
        <section className={caixa} aria-labelledby="bastao">
          <p id="bastao" className={chapeu}>Passagem de bastão</p>
          <p className="mt-1 text-xs text-ink-soft">Quem sai de uma função (ou vai ficar fora um tempo) deixa aqui o que estava fazendo, onde estão as coisas e quem procurar.</p>
          {(dep.meu || dep.respondo) && (
            <form
              className="mt-2 space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await acao.agir("departamento_bastao_deixar", { p_departamento: dep.id, p_texto: bastao }, "Passagem de bastão guardada. Obrigado por cuidar de quem chega.");
                if (ok !== null) setBastao("");
              }}
            >
              <textarea value={bastao} onChange={(e) => setBastao(e.target.value)} maxLength={4000} rows={4} className={campo} placeholder={`${me.nome.split(" ")[0]}, o que quem chegar precisa saber?`} aria-label="Passagem de bastão" />
              <button type="submit" className={`${botao} px-3 py-1.5 text-sm`} disabled={acao.ocupado || bastao.trim().length < 10}>Deixar o bastão</button>
            </form>
          )}
          <ul className="mt-3 space-y-3">
            {dep.bastoes.map((b) => (
              <li key={b.id} className="border-l-2 border-gold pl-2 text-sm">
                <p className="text-xs text-ink-soft">{b.autor || "Alguém"} · {data(b.criado_em)}</p>
                <p className="mt-0.5 whitespace-pre-line" data-original>{b.texto}</p>
              </li>
            ))}
            {dep.bastoes.length === 0 && <li className="text-xs text-ink-soft">Nenhuma passagem de bastão ainda.</li>}
          </ul>
        </section>
      </aside>
    </div>
  );
}
