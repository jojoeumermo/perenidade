// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { dataHora, dia, textoDoErro, useLista } from "./comum";
import { Area, Botao, Selecao, Vazio, notificar } from "./ui";

interface Pedido {
  id: string;
  nome: string;
  veiculo: string;
  email: string;
  assunto: string;
  mensagem: string;
  prazo: string | null;
  status: "novo" | "em_andamento" | "respondido" | "arquivado";
  nota: string;
  criado_em: string;
  apagar_em: string | null;
  responsavel: string;
}

const NOME_DO_STATUS: Record<Pedido["status"], string> = { novo: "Novo", em_andamento: "Em andamento", respondido: "Respondido", arquivado: "Arquivado" };

/**
 * Caixa de imprensa (Etapa 8, backend-2; molde Fila): os pedidos de jornalistas feitos em /imprensa, para o porta-voz e a
 * coordenação. Mostra nome, veículo, e-mail e o pedido, só a quem lida com a imprensa. Respondido ou arquivado, o pedido é
 * eliminado em 180 dias (LGPD, arts. 15, I, e 16). O porta-voz responde pelo e-mail do instituto; o painel não envia nada em nome de ninguém.
 */
export function CaixaDeImprensa() {
  const [filtro, setFiltro] = useState("");
  const lista = useLista<Pedido[]>("imprensa_listar", { p_status: filtro || null });
  const [aberto, setAberto] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const atual = lista.dados?.find((p) => p.id === aberto) ?? null;

  async function mudar(p: Pedido, status: Pedido["status"]) {
    try {
      await rpc("imprensa_atender", { p_id: p.id, p_status: status, p_nota: nota !== "" ? nota : p.nota });
      notificar.ok(status === "respondido" || status === "arquivado" ? "Anotado. O pedido some do banco em 180 dias." : "Anotado.");
      lista.recarregar();
    } catch (e) {
      notificar.erro(textoDoErro(e));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="imp-fila" className="space-y-3">
        <h2 id="imp-fila" className="pn-secao-titulo">Pedidos</h2>
        <Selecao rotulo="Mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos</option>
          {(Object.keys(NOME_DO_STATUS) as Pedido["status"][]).map((s) => <option key={s} value={s}>{NOME_DO_STATUS[s]}</option>)}
        </Selecao>
        {lista.erro && <p role="alert" className="text-oxblood">{lista.erro}</p>}
        {lista.dados?.length === 0 && <Vazio titulo="Nenhum pedido" texto="Os pedidos feitos em /imprensa chegam aqui, e a equipe de imprensa recebe um e-mail avisando (sem o conteúdo)." />}
        <ul className="space-y-1">
          {lista.dados?.map((p) => (
            <li key={p.id}>
              <button type="button" aria-current={p.id === aberto} onClick={() => { setAberto(p.id); setNota(""); }} className="w-full cursor-pointer rounded-md border border-rule p-2 text-left">
                <span className="font-semibold">{p.assunto}</span>
                <span className="block pn-ajuda">{NOME_DO_STATUS[p.status]} · {p.veiculo || p.nome}{p.prazo ? ` · prazo ${dia(p.prazo)}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="imp-pedido" className="space-y-3">
        <h2 id="imp-pedido" className="pn-secao-titulo">Pedido aberto</h2>
        {!atual && <p className="pn-ajuda">Escolha um pedido na lista.</p>}
        {atual && (
          <div className="space-y-3">
            <p><strong>{atual.nome}</strong>{atual.veiculo ? `, ${atual.veiculo}` : ""}<br /><a className="underline" href={`mailto:${atual.email}`}>{atual.email}</a></p>
            <p className="pn-ajuda">Chegou em {dataHora(atual.criado_em)}{atual.prazo ? `. Prazo: ${dia(atual.prazo)}` : ""}.{atual.responsavel ? ` Último a mexer: ${atual.responsavel}.` : ""}{atual.apagar_em ? ` Será eliminado em ${dia(atual.apagar_em)}.` : ""}</p>
            <p className="whitespace-pre-wrap">{atual.mensagem}</p>
            <Area rotulo="Anotação da equipe (a pessoa não vê)" rows={3} maxLength={1000} defaultValue={atual.nota} key={atual.id + atual.status} onChange={(e) => setNota(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Botao onClick={() => void mudar(atual, "em_andamento")}>Em andamento</Botao>
              <Botao variante="principal" onClick={() => void mudar(atual, "respondido")}>Respondido</Botao>
              <Botao variante="discreto" onClick={() => void mudar(atual, "arquivado")}>Arquivar</Botao>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
