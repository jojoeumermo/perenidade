// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useState } from "react";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, data, elo, rotulo, useAcao, useLista } from "./comum";

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

/**
 * Fila da aula de reforço. Quem assume um pedido passa a ver o e-mail da pessoa e responde pelo
 * e-mail de trabalho do instituto. Ao concluir, o endereço é apagado do banco.
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

  return (
    <div>
      <p className="max-w-3xl text-ink-soft">
        Responda sempre pelo e-mail de trabalho do instituto, nunca pelo seu endereço pessoal. Explique o caminho, não só a resposta; indique a aula do site que trata do assunto. Não peça dados pessoais e não marque encontro fora do e-mail.
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhum pedido aguardando nas suas disciplinas.</p>}
      <ul className="mt-2 space-y-5">
        {lista.dados?.map((pedido) => (
          <li key={pedido.id} className="border border-rule bg-parchment-deep p-5">
            <p className={rotulo}>
              {area(pedido.disciplina)} · {data(pedido.criado_em)} · {pedido.status === "aberto" ? "aguardando" : `em atendimento por ${pedido.meu ? "você" : pedido.mentor}`}
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold">{pedido.assunto}</p>
            <p className="mt-2 whitespace-pre-line font-serif text-lg">{pedido.duvida}</p>
            <p className="mt-1 text-ink-soft">Pedido de {pedido.nome || "pessoa sem nome no perfil"}</p>
            {pedido.status === "aberto" && (
              <button type="button" className={`mt-3 ${botao}`} disabled={acao.ocupado} onClick={() => acao.agir("reforco_assumir", { p_id: pedido.id }, "Pedido assumido: o e-mail da pessoa aparece abaixo.")}>
                Assumir este pedido
              </button>
            )}
            {pedido.meu && pedido.status === "em_atendimento" && (
              <div className="mt-3 space-y-3">
                <p>
                  Responder para: <span className="font-mono">{pedido.email}</span>{" "}
                  <a href={carta(pedido)} className={elo}>
                    abrir no programa de e-mail
                  </a>
                </p>
                <label className="block">
                  Anotação para a pessoa ver no site (opcional)
                  <input value={notas[pedido.id] ?? ""} onChange={(e) => setNotas({ ...notas, [pedido.id]: e.target.value })} maxLength={1000} placeholder="Ex.: respondido por e-mail; veja também a aula tal" className={campo} />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("reforco_concluir", { p_id: pedido.id, p_nota: notas[pedido.id] ?? "" }, "Pedido concluído. O e-mail da pessoa foi apagado do banco.")}>
                    Já respondi: concluir
                  </button>
                  <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("reforco_soltar", { p_id: pedido.id }, "Pedido devolvido à fila.")}>
                    Não posso responder: devolver à fila
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
