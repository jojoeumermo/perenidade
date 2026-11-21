// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { MailCheck, Power } from "lucide-react";
import { Aviso, useAcao, useLista } from "./comum";
import { Botao, Cartao, Esqueleto, Faixa, Selecao } from "./ui";

/**
 * O e-mail das pendências (supabase/migracoes/20261126-p5-equipe.sql): quando há tarefa esperando a pessoa no painel, um resumo
 * que só diz quantas ("3 itens esperando revisão") e leva ao painel. Cada pessoa escolhe a frequência ou desliga; quem está de
 * férias não recebe. A chave geral começa desligada e só a coordenação liga.
 */

interface Estado {
  frequencia: "diario" | "semanal" | "desligado";
  ultimo: string | null;
  ligado: boolean;
  de_ferias: boolean;
  pode_ligar: boolean;
  previa: { assunto: string; linhas: string[] } | null;
}

export function PendenciasPorEmail() {
  const estado = useLista<Estado>("pendencias_email_ver", {}, { quieta: true });
  const acao = useAcao(estado.recarregar);
  const e = estado.dados;
  if (estado.erro) return null;
  return (
    <Cartao titulo="E-mail das tarefas pendentes" nivelDoTitulo={3} sobre="Quando há algo esperando você no painel (revisão, assinatura de certificado, aula a fazer na sua disciplina…), chega um resumo por e-mail que só diz quantas coisas são e leva ao painel. Nada do conteúdo vai no e-mail.">
      {!e ? (
        <Esqueleto linhas={2} />
      ) : (
        <div className="mt-2 space-y-3">
          {!e.ligado && <Faixa tom="info">O envio ainda está desligado para todo mundo: a coordenação liga quando o serviço de e-mail estiver pronto. A sua escolha já fica guardada.</Faixa>}
          {e.de_ferias && <Faixa tom="aviso">Você está de férias: não recebe nada até voltar.</Faixa>}
          <div className="max-w-xs">
            <Selecao rotulo="Receber" value={e.frequencia} disabled={acao.ocupado} onChange={(ev) => void acao.agir("pendencias_email_definir", { p_frequencia: ev.target.value }, "Guardado.")}>
              <option value="diario">Um resumo por dia (só quando houver pendência)</option>
              <option value="semanal">Um resumo por semana, às segundas</option>
              <option value="desligado">Não receber</option>
            </Selecao>
          </div>
          <div>
            <p className="pn-rotulo-mono">Se fosse hoje</p>
            {e.previa ? (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {e.previa.linhas.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="pn-ajuda">Nada esperando você agora: não sairia e-mail.</p>
            )}
          </div>
          {e.pode_ligar && (
            <p className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--pn-borda-forte)] pt-3">
              <span className="text-sm">
                Chave geral (só a coordenação): <strong>{e.ligado ? "ligada" : "desligada"}</strong>.
              </span>
              <Botao pequeno simbolo={e.ligado ? Power : MailCheck} disabled={acao.ocupado} onClick={() => void acao.agir("pendencias_email_ligar", { p_ligado: !e.ligado }, e.ligado ? "Desligado para todo mundo." : "Ligado. O primeiro resumo sai amanhã às 8h.")}>
                {e.ligado ? "Desligar para todo mundo" : "Ligar para todo mundo"}
              </Botao>
            </p>
          )}
          <Aviso texto={acao.aviso} />
        </div>
      )}
    </Cartao>
  );
}
