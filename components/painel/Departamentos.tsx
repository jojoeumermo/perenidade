// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowLeft, ArrowRight, Check, MessagesSquare, Pencil, Plus, Send, SquareKanban, Trash2, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import { Avatar } from "./Avatar";
import { RetornoDosAlunos } from "./RetornoDosAlunos";
import { NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO } from "./departamentos-do-instituto";
import { Aviso, data, papeis, textoDoErro, useAcao } from "./comum";
import { Abas, Area, Botao, CabecalhoDeSecao, Campo, Cartao, Esqueleto, Estatistica, Estatisticas, ItemDeLista, Lista, Selecao, Selo, type TomDoSelo, Vazio } from "./ui";

// A página de cada departamento (prancheta "Painel — Departamento"): para que serve, a meta do mês, o quadro da semana,
// os pedidos de outros departamentos com prazo, quem responde, como trabalhamos e a passagem de bastão. O banco está
// em supabase/install.sql, "Departamentos".

// Os nomes e a ordem vêm dos grupos da equipe (departamentos-do-instituto.ts); o id interno não muda.
export const NOMES_DOS_DEPARTAMENTOS: Record<string, string> = NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO;
const nomeDe = (id: string) => NOMES_DOS_DEPARTAMENTOS[id] ?? id;

interface Resumo {
  id: string;
  descricao: string;
  /** Nos Revolucionários, null para quem não é da coordenação nem do departamento (T33). */
  pessoas: number | null;
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
/** Um cartão do quadro da semana (o nome "Cartao" ficou para o componente de ui/). */
interface CartaoDoQuadro {
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
  quadro: CartaoDoQuadro[];
  feitos_no_mes: number;
  bastoes: { id: string; texto: string; autor: string; criado_em: string; meu: boolean }[];
  /** A lista de quem participa não aparece para esta pessoa (departamento sensível). */
  reservado?: boolean;
}
type Coluna = "fazer" | "fazendo" | "aprovacao" | "feito";
type Aba = "geral" | "pedidos" | "quadro" | "pessoas" | "como" | "retorno";

const COLUNAS: [Coluna, string][] = [
  ["fazer", "A fazer"],
  ["fazendo", "Fazendo"],
  ["aprovacao", "Esperando aprovação"],
  ["feito", "Feito"],
];
const SITUACAO: Record<Pedido["status"], string> = { aberto: "esperando", aceito: "aceito", feito: "feito", recusado: "recusado" };
const TOM: Record<Pedido["status"], TomDoSelo> = { aberto: "aviso", aceito: "info", feito: "ok", recusado: "erro" };
const dia = (iso: string) => data(`${iso}T12:00:00`);

/** Um cartão pequeno do quadro (na visão geral e nas colunas). */
function MiniCartao({ q, children }: { q: CartaoDoQuadro; children?: ReactNode }) {
  return (
    <li className="pn-cartao p-2.5 text-sm">
      {q.etiqueta && <span className="pn-rotulo-mono block">{q.etiqueta}</span>}
      <span className="block font-semibold leading-snug">{q.titulo}</span>
      <span className="pn-ajuda block">
        {q.prazo ? `prazo ${dia(q.prazo)}` : "sem prazo"} · {q.dono_nome || "sem dono"}
        {q.pedido ? " · pedido" : ""}
      </span>
      {children}
    </li>
  );
}

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
    <div className="pn-tela">
      <Aviso texto={erro} />
      {/* A escolha do departamento: abas com o número de pedidos esperando (o sublinhado bordô desliza de um a outro). */}
      {resumo && resumo.length > 0 && (
        <Abas
          rotulo="Departamentos"
          valor={escolhido ?? ""}
          aoMudar={(id) => {
            setEscolhido(id);
            setAba("geral");
            setPedindo(false);
          }}
          // Antes, o departamento da pessoa tinha moldura própria entre os botões; nas abas, a marca vira palavra (nunca só a cor).
          opcoes={resumo.map((d) => ({ id: d.id, nome: d.meu ? `${nomeDe(d.id)} · o seu` : nomeDe(d.id), conta: d.pedidos }))}
        />
      )}
      {!resumo && !erro && <Esqueleto linhas={1} />}

      {!atual ? (
        // Com erro, o Aviso do alto já diz o que houve: o esqueleto não fica girando para sempre.
        erro ? null : <Esqueleto forma="cartoes" linhas={3} rotulo="Carregando o departamento…" />
      ) : (
        <>
          <Cartao as="div">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0 max-w-2xl">
                <CabecalhoDeSecao rotulo={`Departamento${atual.meu ? " · o seu" : ""}`} titulo={nomeDe(atual.id)} sobre={atual.descricao || undefined} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex -space-x-2" aria-label={`${atual.pessoas.length} pessoas`}>
                  {atual.pessoas.slice(0, 4).map((p) => (
                    <Avatar key={p.id} nome={p.nome} avatar={p.avatar} className="h-9 w-9 rounded-full border-2 border-parchment" texto="text-[0.7rem]" />
                  ))}
                  {atual.pessoas.length > 4 && <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-parchment bg-parchment-deep font-mono text-[0.68rem] text-ink">+{atual.pessoas.length - 4}</span>}
                </span>
                {!atual.meu && (
                  <Botao variante="principal" simbolo={pedindo ? X : Send} aria-expanded={pedindo} onClick={() => setPedindo(!pedindo)}>
                    Pedir algo {atual.id === "jornalismo" || atual.id === "coordenacao" || atual.id === "mediacao" ? "à" : "ao"} {nomeDe(atual.id)}
                  </Botao>
                )}
              </div>
            </div>
          </Cartao>

          {pedindo && <NovoPedido para={atual.id} meus={meus} fechar={() => setPedindo(false)} depois={recarregar} />}

          <Abas<Aba>
            rotulo={`Departamento ${nomeDe(atual.id)}`}
            opcoes={[
              { id: "geral", nome: "Visão geral" },
              { id: "pedidos", nome: "Pedidos", conta: abertos.length },
              { id: "quadro", nome: "Quadro" },
              { id: "pessoas", nome: `Pessoas · ${atual.pessoas.length}` },
              { id: "como", nome: "Como trabalhamos" },
              // O retorno dos alunos é de quem cuida das aulas.
              ...(["educacao", "curadoria", "revisao"].includes(atual.id) ? [{ id: "retorno" as Aba, nome: "Retorno dos alunos" }] : []),
            ]}
            valor={aba}
            aoMudar={setAba}
            painel={(id) =>
              id === "geral" ? (
                <VisaoGeral dep={atual} abertos={abertos} irPara={setAba} ir={ir} />
              ) : id === "pedidos" ? (
                <Pedidos dep={atual} mexe={mexe} depois={recarregar} />
              ) : id === "quadro" ? (
                <Quadro dep={atual} mexe={mexe} depois={recarregar} />
              ) : id === "pessoas" ? (
                <Pessoas dep={atual} />
              ) : id === "como" ? (
                <ComoTrabalhamos dep={atual} me={me} depois={recarregar} />
              ) : (
                <RetornoDosAlunos />
              )
            }
          />
        </>
      )}
    </div>
  );
}

function VisaoGeral({ dep, abertos, irPara, ir }: { dep: Departamento; abertos: Pedido[]; irPara: (aba: Aba) => void; ir: (aba: string) => void }) {
  const respondem = dep.pessoas.filter((p) => p.responde);
  const pct = dep.meta_alvo ? Math.min(100, Math.round((dep.meta_feito / dep.meta_alvo) * 100)) : 0;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <Estatisticas>
          <Estatistica
            rotulo="Meta do mês"
            valor={dep.meta_alvo ? `${dep.meta_feito} / ${dep.meta_alvo}` : "—"}
            detalhe={
              dep.meta_alvo ? (
                <>
                  {dep.meta_titulo}
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-parchment-deep" aria-hidden>
                    <span className="block h-full rounded-full bg-oxblood" style={{ width: `${pct}%` }} />
                  </span>
                </>
              ) : (
                "Sem meta definida. Quem responde pelo departamento põe em Como trabalhamos."
              )
            }
          />
          <Estatistica rotulo="Feito este mês" valor={dep.feitos_no_mes} detalhe="cartões do quadro que chegaram ao fim" tom={dep.feitos_no_mes ? "ok" : "neutro"} />
          <Estatistica rotulo="Pedidos abertos" valor={abertos.length} detalhe="de outros departamentos" tom={abertos.length ? "bordo" : "neutro"} aoClicar={() => irPara("pedidos")} />
        </Estatisticas>

        <section aria-labelledby="quadro-semana" className="space-y-3">
          <CabecalhoDeSecao
            id="quadro-semana"
            titulo="Quadro da semana"
            simbolo={SquareKanban}
            acoes={
              <Botao variante="discreto" pequeno simboloFim={ArrowRight} onClick={() => irPara("quadro")}>
                Abrir o quadro
              </Botao>
            }
          />
          <div className="grid gap-3 md:grid-cols-3">
            {COLUNAS.filter(([c]) => c !== "feito").map(([coluna, nome]) => {
              const cartoes = dep.quadro.filter((q) => q.coluna === coluna);
              return (
                <div key={coluna} className="rounded-[var(--pn-raio-cartao)] border border-rule bg-parchment-deep p-3">
                  <p className="pn-rotulo-mono">
                    {nome} · {cartoes.length}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {cartoes.slice(0, 3).map((q) => (
                      <MiniCartao key={q.id} q={q} />
                    ))}
                    {cartoes.length === 0 && <li className="pn-ajuda">Nada aqui.</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <Cartao aria-labelledby="pedidos-outros">
          <p id="pedidos-outros" className="pn-rotulo-mono">
            Pedidos de outros departamentos
          </p>
          {abertos.length === 0 ? (
            <p className="pn-ajuda mt-2">Nenhum pedido esperando.</p>
          ) : (
            <Lista rotulo="Pedidos de outros departamentos" plana className="mt-2">
              {abertos.slice(0, 3).map((p) => (
                <ItemDeLista
                  key={p.id}
                  titulo={p.titulo}
                  meta={
                    <>
                      {nomeDe(p.de)} · pedido em {data(p.criado_em)}
                      {p.prazo ? ` · prazo ${dia(p.prazo)}` : ""}
                    </>
                  }
                />
              ))}
            </Lista>
          )}
          {abertos.length > 3 && (
            <Botao variante="discreto" pequeno className="mt-2" simboloFim={ArrowRight} onClick={() => irPara("pedidos")}>
              Ver os {abertos.length} pedidos
            </Botao>
          )}
        </Cartao>
        <Cartao aria-labelledby="quem-responde">
          <p id="quem-responde" className="pn-rotulo-mono">
            Quem responde
          </p>
          {respondem.length === 0 ? (
            <p className="pn-ajuda mt-2">Ainda sem representante: a coordenação responde por enquanto.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {respondem.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Avatar nome={p.nome} avatar={p.avatar} className="h-7 w-7 rounded-full" texto="text-[0.62rem]" />
                  <span>
                    <strong>{p.nome}</strong> · representa o departamento
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Botao variante="discreto" pequeno className="mt-2" simbolo={MessagesSquare} simboloFim={ArrowRight} onClick={() => ir("conversas")}>
            Falar no canal do departamento
          </Botao>
        </Cartao>
        <Cartao variante="plano" aria-labelledby="chegou-agora">
          <p id="chegou-agora" className="pn-rotulo-mono">
            Chegou agora?
          </p>
          <p className="mt-1 text-sm leading-snug">Leia o “como trabalhamos” e as passagens de bastão de quem veio antes: é o caminho mais curto.</p>
          <Botao variante="discreto" pequeno className="mt-2" simboloFim={ArrowRight} onClick={() => irPara("como")}>
            Começar
          </Botao>
        </Cartao>
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
    <Cartao as="div" variante="destaque" titulo={`Pedir algo ${para === "jornalismo" ? "à" : "ao departamento de"} ${nomeDe(para)}`} nivelDoTitulo={3}>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await acao.agir("departamento_pedir", { p_para: para, p_de: de, p_titulo: titulo, p_detalhe: detalhe, p_prazo: prazo || null }, "Pedido enviado. Quem responde pelo departamento foi avisado.");
          if (ok !== null) fechar();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Campo rotulo="O que você precisa" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} placeholder="Arte para a trilha de Alemão" />
          <Campo rotulo="Prazo (opcional)" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
        <Area rotulo="Detalhes" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} maxLength={2000} rows={3} placeholder="Para quê, onde vai ser usado, referências." />
        {meus.length > 1 && (
          <Selecao rotulo="Em nome de" value={de} onChange={(e) => setDe(e.target.value)} className="w-auto">
            {meus.map((id) => (
              <option key={id} value={id}>
                {nomeDe(id)}
              </option>
            ))}
          </Selecao>
        )}
        <Aviso texto={acao.aviso} />
        <p className="flex flex-wrap gap-2">
          <Botao type="submit" simbolo={Send} disabled={titulo.trim().length < 3} carregando={acao.ocupado}>
            Enviar o pedido
          </Botao>
          <Botao variante="discreto" onClick={fechar}>
            Cancelar
          </Botao>
        </p>
      </form>
    </Cartao>
  );
}

function Pedidos({ dep, mexe, depois }: { dep: Departamento; mexe: boolean; depois: () => void }) {
  const acao = useAcao(depois);
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const linha = (p: Pedido, recebido: boolean) => (
    <li key={p.id}>
      <Cartao as="article">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <Selo tom={TOM[p.status]} ponto>
            {SITUACAO[p.status]}
          </Selo>
          <span className="pn-rotulo-mono">{recebido ? `de ${nomeDe(p.de)}` : `para ${nomeDe(p.para)}`}</span>
          <span className="text-ink-soft">
            · {p.autor || "alguém"} · {data(p.criado_em)}
          </span>
          {p.prazo && <span className={`font-semibold ${p.status !== "feito" && p.prazo < hoje ? "text-oxblood" : ""}`}>· prazo {dia(p.prazo)}</span>}
        </p>
        <p className="mt-1.5 text-lg font-semibold leading-snug" style={{ fontFamily: "var(--pn-fonte-titulo)" }}>{p.titulo}</p>
        {p.detalhe && (
          <p className="mt-1 whitespace-pre-line text-sm" data-original>
            {p.detalhe}
          </p>
        )}
        {p.resposta && <p className="mt-2 border-l-2 border-gold pl-2 text-sm">Resposta: {p.resposta}</p>}
        {p.responsavel && <p className="pn-ajuda mt-1">Com {p.responsavel}</p>}
        {recebido && mexe && (p.status === "aberto" || p.status === "aceito") && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {p.status === "aberto" && (
              <Botao pequeno simbolo={Check} disabled={acao.ocupado} onClick={() => void acao.agir("departamento_pedido_mudar", { p_id: p.id, p_status: "aceito" }, "Pedido aceito: quem pediu foi avisado.")}>
                Aceitar
              </Botao>
            )}
            <Botao pequeno simbolo={SquareKanban} disabled={acao.ocupado} onClick={() => void acao.agir("departamento_quadro_salvar", { p_id: null, p: { departamento: dep.id, titulo: p.titulo.slice(0, 140), etiqueta: nomeDe(p.de).slice(0, 30), pedido: p.id, prazo: p.prazo ?? "" } }, "Posto no quadro da semana.")}>
              Pôr no quadro
            </Botao>
            <Botao pequeno simbolo={Check} disabled={acao.ocupado} onClick={() => void acao.agir("departamento_pedido_mudar", { p_id: p.id, p_status: "feito", p_resposta: respostas[p.id] ?? "" }, "Marcado como feito.")}>
              Feito
            </Botao>
            <input value={respostas[p.id] ?? ""} onChange={(e) => setRespostas({ ...respostas, [p.id]: e.target.value })} maxLength={1000} placeholder="Resposta (obrigatória para recusar)" aria-label={`Resposta ao pedido ${p.titulo}`} className="pn-campo min-w-0 flex-1 text-sm" />
            <Botao variante="discreto" pequeno perigo simbolo={X} disabled={acao.ocupado || (respostas[p.id] ?? "").trim().length < 5} onClick={() => void acao.agir("departamento_pedido_mudar", { p_id: p.id, p_status: "recusado", p_resposta: respostas[p.id] }, "Pedido recusado, com a sua resposta.")}>
              Recusar
            </Botao>
          </div>
        )}
      </Cartao>
    </li>
  );
  return (
    <div className="space-y-6">
      <Aviso texto={acao.aviso} />
      <section className="space-y-3">
        <CabecalhoDeSecao titulo="Recebidos" />
        {dep.recebidos.length === 0 ? <Vazio titulo="Nenhum pedido nos últimos 30 dias." /> : <ul className="space-y-3">{dep.recebidos.map((p) => linha(p, true))}</ul>}
      </section>
      <section className="space-y-3">
        <CabecalhoDeSecao titulo="Enviados pelo departamento" />
        {dep.enviados.length === 0 ? <Vazio titulo="O departamento não pediu nada a ninguém nos últimos 30 dias." /> : <ul className="space-y-3">{dep.enviados.map((p) => linha(p, false))}</ul>}
      </section>
    </div>
  );
}

function Quadro({ dep, mexe, depois }: { dep: Departamento; mexe: boolean; depois: () => void }) {
  const acao = useAcao(depois);
  const [novo, setNovo] = useState<{ coluna: Coluna; titulo: string; etiqueta: string; prazo: string; dono: string } | null>(null);
  const mover = (q: CartaoDoQuadro, passo: 1 | -1) => {
    const i = COLUNAS.findIndex(([c]) => c === q.coluna);
    const destino = COLUNAS[i + passo]?.[0];
    if (destino) void acao.agir("departamento_quadro_salvar", { p_id: q.id, p: { coluna: destino } }, destino === "feito" ? "Feito! Se era um pedido, quem pediu foi avisado." : "Cartão movido.");
  };
  return (
    <div className="space-y-3">
      <Aviso texto={acao.aviso} />
      {!mexe && <p className="pn-ajuda">Você vê o quadro; quem é do departamento mexe nele. Para pedir algo, use “Pedir algo”.</p>}
      <div className="grid gap-3 lg:grid-cols-4">
        {COLUNAS.map(([coluna, nome], i) => {
          const cartoes = dep.quadro.filter((q) => q.coluna === coluna);
          return (
            <section key={coluna} aria-label={nome} className="min-w-0 rounded-[var(--pn-raio-cartao)] border border-rule bg-parchment-deep p-3">
              <p className="flex items-center justify-between gap-2">
                <span className="pn-rotulo-mono">
                  {nome} · {cartoes.length}
                </span>
                {mexe && coluna !== "feito" && <Botao variante="discreto" pequeno icone simbolo={Plus} aria-label={`Novo cartão em ${nome}`} dica={`Novo cartão em ${nome}`} onClick={() => setNovo({ coluna, titulo: "", etiqueta: "", prazo: "", dono: "" })} />}
              </p>
              {novo?.coluna === coluna && (
                <form
                  className="pn-cartao mt-2 space-y-1.5 p-2.5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await acao.agir("departamento_quadro_salvar", { p_id: null, p: { departamento: dep.id, coluna, titulo: novo.titulo, etiqueta: novo.etiqueta, prazo: novo.prazo, dono: novo.dono } }, "Cartão criado.");
                    if (ok !== null) setNovo(null);
                  }}
                >
                  <input autoFocus value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} maxLength={140} placeholder="O que fazer" aria-label="O que fazer" className="pn-campo w-full text-sm" />
                  <input value={novo.etiqueta} onChange={(e) => setNovo({ ...novo, etiqueta: e.target.value })} maxLength={30} placeholder="Etiqueta (Instagram, Jornal…)" aria-label="Etiqueta" className="pn-campo w-full text-sm" />
                  <input type="date" value={novo.prazo} onChange={(e) => setNovo({ ...novo, prazo: e.target.value })} aria-label="Prazo" className="pn-campo w-full text-sm" />
                  <select value={novo.dono} onChange={(e) => setNovo({ ...novo, dono: e.target.value })} aria-label="Quem faz" className="pn-campo w-full text-sm">
                    <option value="">Sem dono (qualquer um pega)</option>
                    {dep.pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <p className="flex gap-2">
                    <Botao type="submit" pequeno disabled={novo.titulo.trim().length < 3} carregando={acao.ocupado}>
                      Criar
                    </Botao>
                    <Botao variante="discreto" pequeno onClick={() => setNovo(null)}>
                      Cancelar
                    </Botao>
                  </p>
                </form>
              )}
              <ul className="mt-2 space-y-2">
                {cartoes.map((q) => (
                  <MiniCartao key={q.id} q={q}>
                    {mexe && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {i > 0 && (
                          <Botao variante="discreto" pequeno simbolo={ArrowLeft} disabled={acao.ocupado} onClick={() => mover(q, -1)}>
                            voltar
                          </Botao>
                        )}
                        {i < COLUNAS.length - 1 && (
                          <Botao variante="discreto" pequeno simboloFim={ArrowRight} disabled={acao.ocupado} onClick={() => mover(q, 1)}>
                            avançar
                          </Botao>
                        )}
                        <Botao variante="discreto" pequeno perigo simbolo={Trash2} disabled={acao.ocupado} onClick={() => void acao.agir("departamento_quadro_apagar", { p_id: q.id }, "Cartão apagado.")}>
                          apagar
                        </Botao>
                      </span>
                    )}
                  </MiniCartao>
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
  // Revolucionários: quem participa é dado sensível (LGPD, art. 11). O banco já manda a lista vazia para quem não pode ver.
  if (dep.reservado) return <Vazio titulo="Lista reservada" texto="Quem participa deste departamento só aparece para a coordenação e para o próprio departamento." />;
  if (dep.pessoas.length === 0) return <Vazio titulo="Ninguém neste departamento ainda. A coordenação confia funções em Voluntários e convites." />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {dep.pessoas.map((p) => (
        <li key={p.id} className="pn-cartao flex items-start gap-3">
          <Avatar nome={p.nome} avatar={p.avatar} className="h-10 w-10 rounded-full" texto="text-[0.75rem]" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 font-semibold">
              {p.nome}
              {p.responde && <Selo tom="bordo">responde</Selo>}
              {p.ferias_ate && <Selo tom="aviso">de férias até {dia(p.ferias_ate)}</Selo>}
            </span>
            <span className="pn-ajuda block">
              {(p.papeis ?? []).map((papel) => papeis[papel.papel] ?? papel.papel).join(" · ")}
              {p.desde && ` · ${meses(p.desde) < 1 ? "chegou este mês" : meses(p.desde) === 1 ? "há 1 mês" : `há ${meses(p.desde)} meses`}`}
            </span>
            {p.oficios && p.oficios.length > 0 && <span className="block text-xs text-oxblood">Sabe: {p.oficios.join(", ")}</span>}
            {/* Rodízio de funções: depois de um ano, a sugestão (só para quem responde) é ensinar alguém a fazer junto. */}
            {dep.respondo && meses(p.desde) >= 12 && <span className="pn-ajuda mt-0.5 block italic">Mais de um ano na função: que tal ensinar alguém a fazer junto (rodízio)?</span>}
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Cartao className="min-w-0" aria-label="Como trabalhamos">
        <CabecalhoDeSecao
          titulo="Como trabalhamos"
          acoes={
            dep.respondo &&
            !editando && (
              <Botao variante="discreto" pequeno simbolo={Pencil} onClick={() => setEditando(true)}>
                Editar
              </Botao>
            )
          }
        />
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
            <Area rotulo="Para que serve o departamento (uma ou duas frases)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={400} rows={2} />
            <Area rotulo="Como trabalhamos: reuniões, combinados, onde ficam as coisas, quem aprova o quê" value={form.como} onChange={(e) => setForm({ ...form, como: e.target.value })} maxLength={6000} rows={10} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="Meta do mês: o quê" value={form.meta_titulo} onChange={(e) => setForm({ ...form, meta_titulo: e.target.value })} maxLength={80} placeholder="posts publicados" />
              <Campo rotulo="Quanto" type="number" min={0} value={form.meta_alvo} onChange={(e) => setForm({ ...form, meta_alvo: e.target.value })} />
              <Campo rotulo="Feito até agora" type="number" min={0} value={form.meta_feito} onChange={(e) => setForm({ ...form, meta_feito: e.target.value })} />
            </div>
            <p className="flex gap-2">
              <Botao type="submit" variante="principal" carregando={acao.ocupado}>
                Guardar
              </Botao>
              <Botao onClick={() => setEditando(false)}>Cancelar</Botao>
            </p>
          </form>
        ) : dep.como ? (
          <p className="mt-3 max-w-3xl whitespace-pre-line text-[1.02rem] leading-relaxed" data-original>
            {dep.como}
          </p>
        ) : (
          <p className="mt-3 text-ink-soft">Ainda não escrito. {dep.respondo ? "Conte como o departamento funciona: quem chega lê aqui primeiro." : "Quem responde pelo departamento escreve aqui."}</p>
        )}
      </Cartao>
      <aside className="space-y-4">
        <Cartao aria-labelledby="bastao">
          <p id="bastao" className="pn-rotulo-mono">
            Passagem de bastão
          </p>
          <p className="pn-ajuda mt-1">Quem sai de uma função (ou vai ficar fora um tempo) deixa aqui o que estava fazendo, onde estão as coisas e quem procurar.</p>
          {(dep.meu || dep.respondo) && (
            <form
              className="mt-2 space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await acao.agir("departamento_bastao_deixar", { p_departamento: dep.id, p_texto: bastao }, "Passagem de bastão guardada. Obrigado por cuidar de quem chega.");
                if (ok !== null) setBastao("");
              }}
            >
              <textarea value={bastao} onChange={(e) => setBastao(e.target.value)} maxLength={4000} rows={4} className="pn-campo w-full" placeholder={`${me.nome.split(" ")[0]}, o que quem chegar precisa saber?`} aria-label="Passagem de bastão" />
              <Botao type="submit" pequeno disabled={bastao.trim().length < 10} carregando={acao.ocupado}>
                Deixar o bastão
              </Botao>
            </form>
          )}
          <ul className="mt-3 space-y-3">
            {dep.bastoes.map((b) => (
              <li key={b.id} className="border-l-2 border-gold pl-2 text-sm">
                <p className="pn-ajuda">
                  {b.autor || "Alguém"} · {data(b.criado_em)}
                </p>
                <p className="mt-0.5 whitespace-pre-line" data-original>
                  {b.texto}
                </p>
              </li>
            ))}
            {dep.bastoes.length === 0 && <li className="pn-ajuda">Nenhuma passagem de bastão ainda.</li>}
          </ul>
        </Cartao>
      </aside>
    </div>
  );
}
