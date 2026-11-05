// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { dataHora, useLista } from "./comum";
import { PublicarAgora } from "./controles/PublicarAgora";
import { Botao, Cartao, Esqueleto, Faixa, Selo } from "./ui";

interface Diagnostico {
  aprovadas: number;
  aprovada_mais_antiga: string | null;
  ultima_publicacao: string | null;
  arquivos_aprovados: number;
  segunda_avaliacao: { habilitada: boolean; verificacao: { em: string; ok: boolean; falha: string } | null; ultima: { em: string; ok: boolean; falha: string } | null };
  esperando_avaliacao: number;
  faxina_agendada: boolean;
  pgcrypto: boolean;
  iscas_24h: number;
  armadilhas_7d: number;
}

const horas = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : 0);

/**
 * O estado técnico do que liga o banco ao site, para quem cuida do código: só contagens e datas, nenhum dado de pessoa.
 * Cada linha diz o que olhar quando algo parece parado. O que pede atenção sobe para uma faixa no alto (e fica marcado
 * na linha com um selo, nunca só pela cor).
 */
export function Tecnico() {
  const estado = useLista<Diagnostico>("diagnostico");
  const d = estado.dados;
  if (!d) {
    return estado.erro ? (
      <Faixa
        tom="erro"
        acao={
          <Botao pequeno onClick={estado.recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {estado.erro}
      </Faixa>
    ) : (
      <Esqueleto forma="linhas" linhas={8} rotulo="Carregando…" />
    );
  }
  // A rotina de publicação roda uma vez por dia: aprovado há mais de 26 horas (um dia e a folga do agendador do GitHub)
  // quer dizer que ela parou.
  const publicacaoParada = d.aprovadas > 0 && horas(d.aprovada_mais_antiga) > 26;
  const linhas: [string, string, boolean, string][] = [
    ["Aprovadas esperando a publicação", `${d.aprovadas}${d.aprovada_mais_antiga ? ` · a mais antiga desde ${dataHora(d.aprovada_mais_antiga)}` : ""}`, publicacaoParada, "Veja a rotina “Publicar contribuições aprovadas” no GitHub (Actions) e a variável PUBLICAR."],
    ["Última publicação", d.ultima_publicacao ? dataHora(d.ultima_publicacao) : "nenhuma ainda", false, ""],
    ["Arquivos aprovados esperando publicação", String(d.arquivos_aprovados), false, "Saem na mesma rotina de publicação."],
    ["Segunda avaliação da Comunidade", d.segunda_avaliacao.habilitada ? "habilitada no banco" : "desligada", false, ""],
    [
      "Último teste da segunda avaliação",
      d.segunda_avaliacao.verificacao ? `${d.segunda_avaliacao.verificacao.ok ? "funcionou" : `falhou (${d.segunda_avaliacao.verificacao.falha})`} · ${dataHora(d.segunda_avaliacao.verificacao.em)}` : "nunca testado",
      Boolean(d.segunda_avaliacao.habilitada && d.segunda_avaliacao.verificacao && !d.segunda_avaliacao.verificacao.ok),
      "Confira os segredos e o registro da função avaliar-comunidade no Supabase.",
    ],
    ["Mensagens esperando a segunda avaliação", String(d.esperando_avaliacao), d.esperando_avaliacao > 20, "Muitas paradas: a função não está respondendo. A Fila de revisão tem o botão para reavaliar."],
    ["Faxina automática (pg_cron)", d.faxina_agendada ? "agendada" : "sem pg_cron: nada é descartado sozinho", false, "Ligue a extensão pg_cron no Supabase e rode o install.sql de novo."],
    ["Extensão de senhas (pgcrypto)", d.pgcrypto ? "ligada" : "ausente: a coordenação não consegue redefinir senhas", !d.pgcrypto, "Rode o install.sql de novo no SQL Editor."],
    ["Endereços-isca nas últimas 24 horas", String(d.iscas_24h), d.iscas_24h > 200, "Muitas visitas a iscas costumam ser varredura automática; o site não é afetado."],
    ["Funções-isca chamadas em 7 dias", String(d.armadilhas_7d), d.armadilhas_7d > 0, "Alguém com conta tentou vasculhar o banco: veja quem no Registro de atividades (a coordenação já foi avisada)."],
  ];
  const alertas = linhas.filter(([, , alerta]) => alerta);
  return (
    <div className="pn-tela">
      <p className="pn-sobre">O que liga o banco ao site. Nenhum dado de pessoa aparece aqui. Pedidos de ajuda para o desenvolvimento chegam pelo Mural da equipe, no canal Pedidos de ajuda.</p>
      <div>
        <PublicarAgora explicar />
      </div>
      {alertas.map(([nome, , , dica]) => (
        <Faixa key={nome} tom="aviso" titulo={nome}>
          {dica}
        </Faixa>
      ))}
      <Cartao>
        <dl className="pn-definicoes" style={{ marginTop: 0 }}>
          {linhas.map(([nome, valor, alerta, dica]) => (
            <div key={nome} className="sm:grid-cols-[18rem_minmax(0,1fr)]">
              <dt className={alerta ? "" : "pn-rotulo-mono"}>{nome}</dt>
              <dd>
                {alerta && (
                  <Selo tom="aviso" className="mr-2">
                    Atenção
                  </Selo>
                )}
                {valor}
                {alerta && dica && <span className="block text-sm">{dica}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </Cartao>
    </div>
  );
}
