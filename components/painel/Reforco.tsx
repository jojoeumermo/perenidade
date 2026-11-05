// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, Mail, Undo2, UserCheck } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../I18n";
import { agirOtimista, Aviso, data, useAcao, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { Botao, Campo, Faixa, Selo, Vazio } from "./ui";

interface Pedido {
  id: string;
  disciplina: string;
  assunto: string;
  duvida: string;
  status: "aberto" | "em_atendimento";
  criado_em: string;
  nome: string;
  meu: boolean;
  mentor: string;
  email: string;
}

/** A chave da lista da tela (a mesma do useLista), para os remendos otimistas. */
const FILA = { funcao: "reforco_fila" };

/**
 * Fila da aula de reforço. Quem assume um pedido passa a ver o e-mail da pessoa e responde pelo
 * e-mail de trabalho do instituto. Ao concluir, o endereço é apagado do banco. No molde Fila: a lista à esquerda, o
 * pedido aberto à direita, e na paleta (Ctrl K) assumir, responder, concluir e devolver à fila.
 */
export function Reforco() {
  const { t } = useI18n();
  const lista = useLista<Pedido[]>("reforco_fila");
  const acao = useAcao(lista.recarregar);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const area = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const carta = (pedido: Pedido) =>
    `mailto:${pedido.email}?subject=${encodeURIComponent(`Instituto Lúcia — reforço de ${area(pedido.disciplina)}: ${pedido.assunto}`)}&body=${encodeURIComponent(
      `Olá!\n\nRecebemos a sua dúvida:\n\n"${pedido.duvida}"\n\n[escreva aqui a explicação]\n\nBons estudos,\nEquipe de reforço do Instituto Lúcia`,
    )}`;

  // Assumir e devolver mudam só a situação do pedido: a tela muda na hora e volta sozinha se o banco recusar.
  const assumir = (pedido: Pedido) =>
    agirOtimista<Pedido[]>({
      lista: FILA,
      remendo: (dados) => dados.map((p) => (p.id === pedido.id ? { ...p, status: "em_atendimento", meu: true } : p)),
      funcao: "reforco_assumir",
      argumentos: { p_id: pedido.id },
      sucesso: "Pedido assumido: o e-mail da pessoa aparece abaixo.",
    });
  const soltar = (pedido: Pedido) =>
    agirOtimista<Pedido[]>({
      lista: FILA,
      remendo: (dados) => dados.map((p) => (p.id === pedido.id ? { ...p, status: "aberto", meu: false, mentor: "", email: "" } : p)),
      funcao: "reforco_soltar",
      argumentos: { p_id: pedido.id },
      sucesso: "Pedido devolvido à fila.",
    });
  const concluir = (pedido: Pedido) => acao.agir("reforco_concluir", { p_id: pedido.id, p_nota: notas[pedido.id] ?? "" }, "Pedido concluído. O e-mail da pessoa foi apagado do banco.");
  const situacao = (pedido: Pedido) => (pedido.status === "aberto" ? "aguardando" : `em atendimento por ${pedido.meu ? "você" : pedido.mentor}`);

  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        Responda sempre pelo e-mail de trabalho do instituto, nunca pelo seu endereço pessoal. Explique o caminho, não só a resposta; indique a aula do site que trata do assunto. Não peça dados pessoais e não marque encontro fora do e-mail.
      </p>
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro}
        </Faixa>
      )}
      <Aviso texto={acao.aviso} />
      <MoldeFila<Pedido>
        id="reforco"
        rotulo="Aula de reforço"
        itens={lista.dados ?? []}
        carregando={!lista.dados && !lista.erro}
        chave={(p) => p.id}
        vazio={<Vazio titulo="Nenhum pedido aguardando nas suas disciplinas." />}
        linha={(pedido) => (
          <>
            <span className="pn-rotulo-mono">
              {area(pedido.disciplina)} · {data(pedido.criado_em)}
            </span>
            <strong>{pedido.assunto}</strong>
            <span>
              <Selo tom={pedido.status === "aberto" ? "bordo" : pedido.meu ? "ok" : "neutro"} ponto>
                {situacao(pedido)}
              </Selo>
            </span>
          </>
        )}
        comandos={(pedido) => [
          ...(pedido.status === "aberto" ? [{ id: "assumir", nome: "Assumir este pedido", simbolo: UserCheck, fazer: () => void assumir(pedido) }] : []),
          ...(pedido.meu && pedido.status === "em_atendimento"
            ? [
                { id: "responder", nome: "Responder", sobre: "abrir no programa de e-mail", simbolo: Mail, fazer: () => void window.open(carta(pedido), "_self") },
                { id: "concluir", nome: "Já respondi: concluir", simbolo: Check, fazer: () => void concluir(pedido) },
                { id: "liberar", nome: "Liberar", sobre: "Não posso responder: devolver à fila", simbolo: Undo2, fazer: () => void soltar(pedido) },
              ]
            : []),
        ]}
        detalhe={(pedido) => (
          <article className="pn-secao">
            <p className="pn-rotulo-mono">
              {area(pedido.disciplina)} · {data(pedido.criado_em)} · {situacao(pedido)}
            </p>
            <h2 className="pn-cartao-titulo">{pedido.assunto}</h2>
            <p className="whitespace-pre-line font-serif text-lg" data-original>
              {pedido.duvida}
            </p>
            <p className="pn-ajuda">Pedido de {pedido.nome || "pessoa sem nome no perfil"}</p>
            {pedido.status === "aberto" && (
              <div>
                <Botao variante="principal" simbolo={UserCheck} onClick={() => void assumir(pedido)}>
                  Assumir este pedido
                </Botao>
              </div>
            )}
            {pedido.meu && pedido.status === "em_atendimento" && (
              <div className="pn-secao">
                <p>
                  Responder para: <span className="font-mono">{pedido.email}</span>{" "}
                  <a href={carta(pedido)} className="pn-elo">
                    abrir no programa de e-mail
                  </a>
                </p>
                <Campo
                  rotulo="Anotação para a pessoa ver no site (opcional)"
                  value={notas[pedido.id] ?? ""}
                  onChange={(e) => setNotas({ ...notas, [pedido.id]: e.target.value })}
                  maxLength={1000}
                  placeholder="Ex.: respondido por e-mail; veja também a aula tal"
                />
                <div className="flex flex-wrap gap-2">
                  <Botao variante="principal" simbolo={Check} carregando={acao.ocupado} disabled={acao.ocupado} onClick={() => void concluir(pedido)}>
                    Já respondi: concluir
                  </Botao>
                  <Botao simbolo={Undo2} disabled={acao.ocupado} onClick={() => void soltar(pedido)}>
                    Não posso responder: devolver à fila
                  </Botao>
                </div>
              </div>
            )}
          </article>
        )}
      />
    </div>
  );
}
