// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useState } from "react";
import { atalhosDaFuncao, dadosDaFuncao, dasPendencias, dosAvisosDeSeguranca, type FuncaoDaMesa, FUNCOES_DA_MESA, NOME_DA_PARTE, type ParteDaMesa, type Pendencia, somar, type TipoDePendencia } from "./mesa-funcoes";
import { Botao, Vazio } from "./ui";

// A Mesa organizada (Etapa 8, B39). Muita informação para a coordenação, mas em cinco partes que nunca se misturam:
// pendências (o que espera por você), recados (o que te disseram), avisos de segurança, saúde da casa e atalhos.
// A ordem muda com a função (mesa-funcoes.ts); o que cada parte mostra vem de Painel.tsx pelas "peças", para não
// duplicar nenhum componente que já existia. Só classes pn-* e tokens: nenhuma cor escrita aqui.

const CHAVE_DA_FUNCAO = "lucia:mesa-funcao";
const nomeDoTipo: Record<TipoDePendencia, string> = { revisar: "Revisar", responder: "Responder", fazer: "Fazer" };
const acaoDoTipo: Record<TipoDePendencia, string> = { revisar: "Revisar", responder: "Abrir", fazer: "Fazer" };

function lerFuncao(permitidas: FuncaoDaMesa[]): FuncaoDaMesa | null {
  try {
    const guardada = window.localStorage.getItem(CHAVE_DA_FUNCAO);
    return permitidas.find((f) => f === guardada) ?? null;
  } catch {
    return null;
  }
}

/** As peças que Painel.tsx monta e esta tela só posiciona. Qualquer uma pode faltar (a pessoa não vê essa parte). */
export interface PecasDaMesa {
  /** A saudação, a data de luta e as funções da pessoa. */
  cabeca: ReactNode;
  /** Aula ao vivo agora, férias, primeira semana: avisos que vêm antes da lista. */
  agora?: ReactNode;
  /** O último rascunho e as horas do certificado. */
  continuar?: ReactNode;
  /** As tarefas de 5, 15 ou 30 minutos (se sobrar tempo). */
  tarefas?: ReactNode;
  /** Os recados do painel. */
  recados?: ReactNode;
  /** Os agradecimentos da equipe. */
  agradecimentos?: ReactNode;
  /** Como está a casa: a equipe, os envios e a faixa do alto. */
  casa?: ReactNode;
  /** O termômetro da semana, as conquistas e o movimento do site. */
  movimento?: ReactNode;
  /** As seções fixadas e as usadas por último. */
  fixadas?: ReactNode;
  /** Sugerir ao marketing, pedir função, guia de primeiros passos e dica do tutorial. */
  apoio?: ReactNode;
}

/** Lista de pendências, com o filtro por tipo. A linha inteira é o botão: um clique leva ao trabalho. */
function ListaDePendencias({ itens, ir, alerta = false, rotulo }: { itens: Pendencia[]; ir: (aba: string) => void; alerta?: boolean; rotulo: string }) {
  const [filtro, setFiltro] = useState<TipoDePendencia | "tudo">("tudo");
  const tipos = (["revisar", "responder", "fazer"] as TipoDePendencia[]).filter((t) => itens.some((i) => i.tipo === t));
  const vistas = filtro === "tudo" || !tipos.includes(filtro) ? itens : itens.filter((i) => i.tipo === filtro);
  return (
    <div className="grid gap-2.5">
      {tipos.length > 1 && (
        <div role="group" aria-label={`Filtrar: ${rotulo}`} className="flex flex-wrap gap-1.5">
          {(["tudo", ...tipos] as const).map((t) => (
            <Botao key={t} pequeno variante={filtro === t ? "padrao" : "discreto"} aria-pressed={filtro === t} onClick={() => setFiltro(t)}>
              {t === "tudo" ? "Tudo" : nomeDoTipo[t]}
            </Botao>
          ))}
        </div>
      )}
      <ul aria-label={rotulo} className={`pn-cartao ${alerta ? "pn-cartao-alerta" : ""} grid gap-0 p-0`}>
        {vistas.map((p, i) => (
          <li key={p.chave} className={i ? "border-t border-[var(--pn-borda)]" : ""}>
            <button type="button" onClick={() => ir(p.vai)} className="pn-fila-item flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-left">
              <span className="pn-rotulo w-20 shrink-0">{nomeDoTipo[p.tipo]}</span>
              <span className="flex min-w-0 flex-[1_1_14rem] flex-col">
                <span className="font-semibold">{p.titulo}</span>
                <span className="pn-ajuda">
                  {p.n} {p.n === 1 ? "item" : "itens"}
                </span>
              </span>
              <span className="pn-selo-neutro pn-selo">{acaoDoTipo[p.tipo]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Parte({ id, parte, conta, children }: { id: string; parte: ParteDaMesa; conta?: number; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="pn-secao scroll-mt-24">
      <h2 id={`${id}-titulo`} className="pn-secao-titulo flex items-center gap-2">
        {NOME_DA_PARTE[parte]}
        {Boolean(conta) && <span className="pn-selo">{conta}</span>}
      </h2>
      {children}
    </section>
  );
}

export function MesaOrganizada({
  funcoes,
  todasAsFuncoes = false,
  pendencias,
  carregando,
  abre,
  nomeDe,
  ir,
  recadosNovos,
  icone,
  pecas,
}: {
  /** As funções da pessoa (de mesa-funcoes.ts), a de maior responsabilidade primeiro. */
  funcoes: FuncaoDaMesa[];
  /** A coordenação pode olhar a Mesa de qualquer função. */
  todasAsFuncoes?: boolean;
  /** Já montadas por `montarPendencias` para a função de agora (o pai remonta quando a função muda). */
  pendencias: (funcao: FuncaoDaMesa) => Pendencia[];
  carregando: boolean;
  abre: (secao: string) => boolean;
  /** O nome de uma seção, do registro do painel. */
  nomeDe: (secao: string) => string;
  ir: (aba: string) => void;
  recadosNovos: number;
  icone: (id: string) => ReactNode;
  pecas: PecasDaMesa;
}) {
  const permitidas = todasAsFuncoes ? FUNCOES_DA_MESA.map((f) => f.id) : [...new Set<FuncaoDaMesa>([...funcoes, "geral"])];
  const [escolhida, setEscolhida] = useState<FuncaoDaMesa | null>(null);
  // A escolha fica só neste aparelho; no primeiro desenho vale a função principal (igual no servidor e no navegador).
  useEffect(() => {
    const guardada = lerFuncao(permitidas);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (guardada) setEscolhida(guardada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const funcao = escolhida && permitidas.includes(escolhida) ? escolhida : funcoes[0];
  const dados = dadosDaFuncao(funcao);
  const trocar = (id: FuncaoDaMesa) => {
    setEscolhida(id);
    try {
      window.localStorage.setItem(CHAVE_DA_FUNCAO, id);
    } catch {
      // Sem espaço guardado: vale até fechar o painel.
    }
  };

  const todas = pendencias(funcao);
  const trabalho = dasPendencias(todas);
  const seguranca = dosAvisosDeSeguranca(todas);
  const totalTrabalho = somar(trabalho);
  const totalSeguranca = somar(seguranca);
  const atalhos = atalhosDaFuncao(funcao, abre);

  const mostra: Record<ParteDaMesa, boolean> = {
    pendencias: true,
    recados: true,
    seguranca: dados.segurancaAberta || seguranca.length > 0,
    casa: Boolean(pecas.casa || pecas.movimento),
    atalhos: true,
  };
  const partes = dados.ordem.filter((p) => mostra[p]);
  const contaDe: Record<ParteDaMesa, number> = { pendencias: totalTrabalho, recados: recadosNovos, seguranca: totalSeguranca, casa: 0, atalhos: 0 };
  const irParaParte = (p: ParteDaMesa) => document.getElementById(`mesa-${p}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  const conteudo: Record<ParteDaMesa, ReactNode> = {
    pendencias: (
      <Parte id="mesa-pendencias" parte="pendencias" conta={totalTrabalho}>
        {pecas.agora}
        {carregando && <p className="pn-ajuda" role="status">Carregando…</p>}
        {!carregando && trabalho.length === 0 && <Vazio titulo="Nada esperando por você." texto="Bom momento para escrever, revisar uma aula ou agradecer alguém da equipe." />}
        {trabalho.length > 0 && (
          <>
            <ListaDePendencias itens={trabalho} ir={ir} rotulo="Pendências" />
            <p className="pn-ajuda">Feito o que dá, a lista some. Nada aqui é obrigatório: é só o que chegou para você.</p>
          </>
        )}
        {pecas.continuar}
        {pecas.tarefas}
      </Parte>
    ),
    seguranca: (
      <Parte id="mesa-seguranca" parte="seguranca" conta={totalSeguranca}>
        {seguranca.length > 0 ? <ListaDePendencias itens={seguranca} ir={ir} alerta rotulo="Avisos de segurança" /> : <Vazio titulo="Nenhum aviso de segurança." texto="Contas suspensas, publicação parada, denúncias e pedidos da supervisão aparecem aqui assim que houver." />}
      </Parte>
    ),
    recados: (
      <Parte id="mesa-recados" parte="recados" conta={recadosNovos}>
        {recadosNovos === 0 && <p className="pn-ajuda">Nenhum recado novo. Os anteriores aparecem aqui quando houver.</p>}
        {/* A peça traz o próprio título "Recados"; aqui o título da parte já diz isso. */}
        <div className="[&_#recados]:hidden">{pecas.recados}</div>
        {pecas.agradecimentos}
      </Parte>
    ),
    casa: (
      <Parte id="mesa-casa" parte="casa">
        {pecas.casa}
        {pecas.movimento}
      </Parte>
    ),
    atalhos: (
      <Parte id="mesa-atalhos" parte="atalhos">
        <ul className="flex flex-wrap gap-2" aria-label={`Atalhos da Mesa de ${dados.nome}`}>
          {atalhos.map((id) => (
            <li key={id}>
              <Botao onClick={() => ir(id)}>
                {icone(id)} {nomeDe(id)}
              </Botao>
            </li>
          ))}
        </ul>
        {pecas.fixadas}
        {pecas.apoio}
      </Parte>
    ),
  };

  return (
    <div className="pn-tela" data-tour="mesa" data-mesa={funcao}>
      {pecas.cabeca}

      <div className="pn-cartao grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="pn-rotulo">Mesa de</p>
            <p className="font-semibold">{dados.nome}</p>
            <p className="pn-ajuda max-w-xl">{dados.sobre}</p>
          </div>
          {permitidas.length > 1 && (
            <label className="grid gap-1">
              <span className="pn-rotulo">Trocar de Mesa</span>
              <select className="pn-campo" value={funcao} onChange={(e) => trocar(e.target.value as FuncaoDaMesa)}>
                {permitidas.map((id) => (
                  <option key={id} value={id}>
                    {dadosDaFuncao(id).nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <nav aria-label="Partes da Mesa" className="flex flex-wrap gap-1.5">
          {partes.map((p) => (
            <Botao key={p} pequeno variante="discreto" onClick={() => irParaParte(p)}>
              {NOME_DA_PARTE[p]}
              {contaDe[p] > 0 && <span className="pn-selo">{contaDe[p]}</span>}
            </Botao>
          ))}
        </nav>
      </div>

      {partes.map((p) => (
        <div key={p}>{conteudo[p]}</div>
      ))}
    </div>
  );
}
