// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Aviso, dataHora, rotulo, useLista } from "./comum";

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
 * Cada linha diz o que olhar quando algo parece parado.
 */
export function Tecnico() {
  const estado = useLista<Diagnostico>("diagnostico");
  const d = estado.dados;
  if (!d) return <Aviso texto={estado.erro || "Carregando…"} />;
  // A rotina de publicação roda de hora em hora: aprovado há mais de três horas quer dizer que ela parou.
  const publicacaoParada = d.aprovadas > 0 && horas(d.aprovada_mais_antiga) > 3;
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
  return (
    <div>
      <p className="max-w-3xl text-ink-soft">O que liga o banco ao site. Nenhum dado de pessoa aparece aqui. Pedidos de ajuda para o desenvolvimento chegam pelo Mural da equipe, no canal Pedidos de ajuda.</p>
      <dl className="mt-4 divide-y divide-rule border-y border-rule">
        {linhas.map(([nome, valor, alerta, dica]) => (
          <div key={nome} className={`grid gap-1 py-3 sm:grid-cols-[18rem_minmax(0,1fr)] ${alerta ? "text-oxblood" : ""}`}>
            <dt className={alerta ? "font-semibold" : rotulo}>{nome}</dt>
            <dd>
              {valor}
              {alerta && dica && <span className="block text-sm">{dica}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
