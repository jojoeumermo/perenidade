// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Archive, CheckCheck, Clock, Mail } from "lucide-react";
import { useState } from "react";
import { agirOtimista, dataHora, dia, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { Area, Botao, Faixa, Selecao, Selo, type TomDoSelo, Vazio } from "./ui";

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
const TOM_DO_STATUS: Record<Pedido["status"], TomDoSelo> = { novo: "bordo", em_andamento: "aviso", respondido: "ok", arquivado: "neutro" };

/**
 * Caixa de imprensa (Etapa 8, backend-2; molde Fila): os pedidos de jornalistas feitos em /imprensa, para o porta-voz e a
 * coordenação. Mostra nome, veículo, e-mail e o pedido, só a quem lida com a imprensa. Respondido ou arquivado, o pedido é
 * eliminado em 180 dias (LGPD, arts. 15, I, e 16). O porta-voz responde pelo e-mail do instituto; o painel não envia nada em nome de ninguém.
 * Mudar a situação é otimista (a tela muda na hora e volta se o banco recusar), e vai também pela paleta (Ctrl K).
 */
export function CaixaDeImprensa() {
  const [filtro, setFiltro] = useState("");
  const argumentos = { p_status: filtro || null };
  const lista = useLista<Pedido[]>("imprensa_listar", argumentos);
  // A anotação em edição é do pedido aberto: trocar de pedido começa do que está guardado.
  const [nota, setNota] = useState<{ id: string; texto: string } | null>(null);

  function mudar(p: Pedido, status: Pedido["status"]) {
    const texto = nota?.id === p.id && nota.texto !== "" ? nota.texto : p.nota;
    return agirOtimista<Pedido[]>({
      lista: { funcao: "imprensa_listar", argumentos },
      // Com um filtro de situação, o pedido que muda sai da lista; sem filtro, só troca o selo.
      remendo: (dados) => (filtro && filtro !== status ? dados.filter((x) => x.id !== p.id) : dados.map((x) => (x.id === p.id ? { ...x, status, nota: texto } : x))),
      funcao: "imprensa_atender",
      argumentos: { p_id: p.id, p_status: status, p_nota: texto },
      sucesso: status === "respondido" || status === "arquivado" ? "Anotado. O pedido some do banco em 180 dias." : "Anotado.",
    });
  }

  return (
    <div className="pn-tela">
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro}
        </Faixa>
      )}
      <MoldeFila<Pedido>
        id="imprensa"
        rotulo="Pedidos"
        itens={lista.dados ?? []}
        carregando={!lista.dados && !lista.erro}
        chave={(p) => p.id}
        barra={
          <Selecao rotulo="Mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos</option>
            {(Object.keys(NOME_DO_STATUS) as Pedido["status"][]).map((s) => (
              <option key={s} value={s}>
                {NOME_DO_STATUS[s]}
              </option>
            ))}
          </Selecao>
        }
        vazio={<Vazio titulo="Nenhum pedido" texto="Os pedidos feitos em /imprensa chegam aqui, e a equipe de imprensa recebe um e-mail avisando (sem o conteúdo)." />}
        linha={(p) => (
          <>
            <strong>{p.assunto}</strong>
            <span className="pn-ajuda">
              {p.veiculo || p.nome}
              {p.prazo ? ` · prazo ${dia(p.prazo)}` : ""}
            </span>
            <span>
              <Selo tom={TOM_DO_STATUS[p.status]} ponto>
                {NOME_DO_STATUS[p.status]}
              </Selo>
            </span>
          </>
        )}
        comandos={(p) => [
          { id: "responder", nome: "Responder", sobre: p.email, simbolo: Mail, fazer: () => void window.open(`mailto:${p.email}`, "_self") },
          { id: "andamento", nome: "Em andamento", simbolo: Clock, fazer: () => void mudar(p, "em_andamento") },
          { id: "respondido", nome: "Respondido", simbolo: CheckCheck, fazer: () => void mudar(p, "respondido") },
          { id: "arquivar", nome: "Arquivar", simbolo: Archive, fazer: () => void mudar(p, "arquivado") },
        ]}
        detalhe={(atual) => (
          <article className="pn-secao">
            <h2 className="pn-cartao-titulo">{atual.assunto}</h2>
            <p>
              <strong>{atual.nome}</strong>
              {atual.veiculo ? `, ${atual.veiculo}` : ""}
              <br />
              <a className="pn-elo" href={`mailto:${atual.email}`}>
                {atual.email}
              </a>
            </p>
            <p className="pn-ajuda">
              Chegou em {dataHora(atual.criado_em)}
              {atual.prazo ? `. Prazo: ${dia(atual.prazo)}` : ""}.{atual.responsavel ? ` Último a mexer: ${atual.responsavel}.` : ""}
              {atual.apagar_em ? ` Será eliminado em ${dia(atual.apagar_em)}.` : ""}
            </p>
            <p className="whitespace-pre-wrap">{atual.mensagem}</p>
            <Area rotulo="Anotação da equipe (a pessoa não vê)" rows={3} maxLength={1000} defaultValue={atual.nota} key={atual.id + atual.status} onChange={(e) => setNota({ id: atual.id, texto: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Botao simbolo={Clock} onClick={() => void mudar(atual, "em_andamento")}>
                Em andamento
              </Botao>
              <Botao variante="principal" simbolo={CheckCheck} onClick={() => void mudar(atual, "respondido")}>
                Respondido
              </Botao>
              <Botao variante="discreto" simbolo={Archive} onClick={() => void mudar(atual, "arquivado")}>
                Arquivar
              </Botao>
            </div>
          </article>
        )}
      />
    </div>
  );
}
