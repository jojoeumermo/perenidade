// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { PainelApagamentos } from "@/components/rede/meusdados/PainelApagamentos";
import { EspacoDeMidia } from "@/components/rede/operacao/EspacoDeMidia";
import { SaudeDoServicoDeContas } from "@/components/rede/seguranca/SaudeDoServicoDeContas";
import { Botao } from "@/components/rede/ui/Botao";
import { ligado, type Recurso, RECURSOS } from "@/lib/recursos";
import { nomeDaAcaoNoRegistro } from "@/lib/rede/admin/tipos";
import { VERSAO_ESPERADA_DO_BANCO, VERSAO_ESPERADA_DO_PAINEL } from "@/lib/rede/painel/tipos";
import { nomeDaFuncao } from "./nomes-das-funcoes";
import { Etiqueta, Ladrilho, Nota, quando, Quadro, Titulo, usePainelDaAlumia } from "./pecas";

/** Os recursos que são da Alumia (a mesma regra do banco: interno.alumia_painel_recurso_da_alumia). */
export const RECURSOS_DA_ALUMIA = (Object.keys(RECURSOS) as Recurso[]).filter((n) => n.startsWith("alumia-") || n === "rede-v2" || n === "fediverso-total" || n === "fediverso-grupos");

/**
 * O recurso está valendo? A decisão gravada no banco vence (ligado liga, desligado desliga); sem decisão, vale o que o código
 * desta montagem diz (lib/recursos.ts).
 */
export const recursoValendo = (nome: Recurso, decisao: boolean | null | undefined) => (typeof decisao === "boolean" ? decisao : ligado(nome));

function LinhaDeSaude({ nome, valor, bom, nota }: { nome: string; valor: string; bom: boolean | null; nota?: string }) {
  return (
    <li className="ap-linha">
      <span className="ap-linha-texto">
        <span className="ap-forte">{nome}</span>
        {nota ? <span className="ap-miudo">{nota}</span> : null}
      </span>
      <Etiqueta tom={bom === null ? undefined : bom ? "papel" : "vermelho"}>{valor}</Etiqueta>
    </li>
  );
}

/** A primeira tela: o que espera decisão (ladrilhos acesos), a saúde do banco e das chaves, e as últimas ações do painel. */
export function Geral() {
  const { geral, ir, atualizar } = usePainelDaAlumia();
  if (!geral) return null;
  const n = geral.numeros;
  const s = geral.saude;
  const bancoCerto = s.versao >= VERSAO_ESPERADA_DO_BANCO;
  const painelCerto = s.painel >= VERSAO_ESPERADA_DO_PAINEL;
  const ligados = RECURSOS_DA_ALUMIA.filter((nome) => recursoValendo(nome, s.decisoes[nome]));

  return (
    <div className="ap-tela">
      <Titulo nome="Visão geral" sobre="Ladrilho aceso é coisa esperando decisão. Os números são do banco, agora: nenhum deles diz quem é quem.">
        <Botao variante="contorno" tamanho="p" onClick={atualizar}>
          Atualizar
        </Botao>
      </Titulo>

      <div className="ap-ladrilhos">
        <Ladrilho numero={n.fila} nome="Pedidos na fila" nota="cadastros esperando" aceso={n.fila > 0} aoAbrir={() => ir("cadastros")} />
        <Ladrilho numero={n.denuncias} nome="Denúncias abertas" nota={n.denuncias_urgentes > 0 ? `${n.denuncias_urgentes} de prioridade 1` : "nenhuma urgente"} aceso={n.denuncias_urgentes > 0 ? "urgente" : n.denuncias > 0} aoAbrir={() => ir("denuncias")} />
        <Ladrilho numero={n.selos_esperando} nome="Pedidos de selo" nota="organizações" aceso={n.selos_esperando > 0} aoAbrir={() => ir("comunidades", "organizacoes")} />
        <Ladrilho numero={n.contas} nome="Contas na Alumia" nota={`${n.aprovadas} aprovadas na entrada`} aoAbrir={() => ir("pessoas")} />
        <Ladrilho numero={n.posts_hoje} nome="Posts de hoje" nota="posts e respostas" aoAbrir={() => ir("conteudo")} />
        <Ladrilho numero={n.comunidades} nome="Comunidades" aoAbrir={() => ir("comunidades")} />
        <Ladrilho numero={n.organizacoes} nome="Organizações" aoAbrir={() => ir("comunidades", "organizacoes")} />
        <Ladrilho numero={n.sancoes} nome="Sanções em vigor" nota="suspensões e banimentos" aoAbrir={() => ir("pessoas")} />
        <Ladrilho numero={n.redes_barradas} nome="Redes barradas" nota="banimentos por rede" aoAbrir={() => ir("pessoas", "redes")} />
        <Ladrilho numero={n.lixeira} nome="Na lixeira" nota="posts que ainda voltam" aoAbrir={() => ir("conteudo", "lixeira")} />
        <Ladrilho numero={s.mediadores} nome="Mediação" nota="moderam pelo papel do Instituto" aoAbrir={() => ir("papeis")} />
        <Ladrilho numero={ligados.length} nome="Funções ligadas" nota={`de ${RECURSOS_DA_ALUMIA.length}`} aoAbrir={() => ir("funcoes")} />
      </div>

      <div className="ap-duas">
        <Quadro titulo="Saúde">
          <ul className="ap-lista">
            <LinhaDeSaude nome="Banco da Alumia" valor={`esperada ${VERSAO_ESPERADA_DO_BANCO} · instalada ${s.versao}`} bom={bancoCerto} nota={bancoCerto ? "O SQL das ondas está no banco." : "Falta rodar o SQL da onda no SQL Editor (as migrações, na ordem do fim do install.sql)."} />
            <LinhaDeSaude nome="Funções do painel" valor={`esperada ${VERSAO_ESPERADA_DO_PAINEL} · instalada ${s.painel}`} bom={painelCerto} nota={painelCerto ? undefined : "Falta rodar 20261113-alumia-o7-painel.sql."} />
            <LinhaDeSaude nome="Trava da entrada" valor={s.trava ? "ligada" : "desligada"} bom={null} nota={s.trava ? `Só conta aprovada e com o segundo fator vê a rede${s.trava_desde ? ` (ligada pela primeira vez em ${quando(s.trava_desde)})` : ""}.` : "A Alumia está aberta como antes da triagem."} />
            <LinhaDeSaude nome="Agendador do banco" valor={s.agendador ? "ligado" : "sem agendador"} bom={s.agendador} nota={s.agendador ? "Prazos vencidos (sanções, redes, avisos, lixeira) se encerram sozinhos a cada 15 minutos." : "Sem o pg_cron, os prazos vencidos só se encerram quando alguém abre este painel."} />
            <LinhaDeSaude nome="Banimento por rede" valor={s.redes_vistas > 0 ? `${s.redes_vistas} redes vistas em 30 dias` : "nenhuma rede vista"} bom={s.redes_vistas > 0 ? true : null} nota={s.redes_vistas > 0 ? "O servidor calcula a impressão de quem entra. O endereço em si não é guardado em lugar nenhum, nem para a coordenação." : "Se já há gente entrando, confira no servidor a variável ALUMIA_IMPRESSAO_SEGREDO: sem ela não há o que barrar."} />
            <LinhaDeSaude nome="Admin da Alumia" valor={s.admin ? "nomeado" : "ninguém"} bom={null} />
          </ul>
        </Quadro>

        <Quadro
          titulo="Funções ligadas agora"
          lado={
            <Botao variante="contorno" tamanho="p" onClick={() => ir("funcoes")}>
              Ligar e desligar
            </Botao>
          }
        >
          <ul className="ap-lista">
            {RECURSOS_DA_ALUMIA.map((nome) => {
              const aceso = ligados.includes(nome);
              return (
                <li key={nome} className="ap-linha">
                  <span className="ap-linha-texto">
                    <span className="ap-forte">
                      <span className="ap-luz" data-ligado={aceso} aria-hidden>
                        <span />
                        <span />
                        <span />
                      </span>
                      {nomeDaFuncao(nome).nome}
                    </span>
                  </span>
                  <span className="ap-etiquetas">
                    {nome in s.decisoes ? <Etiqueta tom="dourado">decisão do painel</Etiqueta> : null}
                    <Etiqueta tom={aceso ? "papel" : undefined}>{aceso ? "ligada" : "desligada"}</Etiqueta>
                  </span>
                </li>
              );
            })}
          </ul>
        </Quadro>
      </div>

      {/* Onda 14: o que o banco consegue no serviço de contas e as variáveis secretas do servidor (só o nome e se estão postas). */}
      <SaudeDoServicoDeContas />

      {/* Onda 8: o espaço de mídia (cota e faxina) e as contas no prazo de arrependimento do apagamento. Só números. */}
      <div className="ap-duas">
        <EspacoDeMidia />
        <PainelApagamentos />
      </div>

      <Quadro
        titulo="Últimas ações do painel"
        lado={
          <Botao variante="contorno" tamanho="p" onClick={() => ir("registro")}>
            Ver o registro inteiro
          </Botao>
        }
      >
        {geral.ultimas.length === 0 ? (
          <Nota>Nenhuma ação ainda. A primeira coisa que alguém fizer por aqui aparece nesta lista.</Nota>
        ) : (
          <div className="ap-tabela-caixa">
            <table className="ap-tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>O quê</th>
                  <th>Em quem ou em quê</th>
                  <th>Por quê</th>
                </tr>
              </thead>
              <tbody>
                {geral.ultimas.map((l) => (
                  <tr key={l.id}>
                    <td data-nome="Quando">{quando(l.quando)}</td>
                    <td data-nome="Quem">{l.quem || "—"}</td>
                    <td data-nome="O quê" className="ap-forte">
                      {nomeDaAcaoNoRegistro(l.acao)}
                    </td>
                    <td data-nome="Em quem ou em quê">{l.alvo || "—"}</td>
                    <td data-nome="Por quê" className="ap-quebra">
                      {l.motivo || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Quadro>
    </div>
  );
}
