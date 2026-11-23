// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { Estado, Etiqueta, Nota, Quadro } from "@/components/painel/alumia/pecas";
import { Botao } from "@/components/rede/ui/Botao";
import { getClient, hasBackend } from "@/lib/backend";
import type { SaudeDaFederacao } from "@/lib/rede/fediverso/saude";
import type { SituacaoDaVariavel } from "@/lib/rede/seguranca/variaveis";

export interface SaudeDoServico {
  banco: {
    sessoes_legiveis: boolean;
    sessoes_apagaveis: boolean;
    aviso_de_entrada: "gatilho" | "servidor";
    cortes_em_vigor: number | string;
    enderecos: Record<string, { gatilho: boolean; com_endereco: number | null }>;
  };
  variaveis: { nome: string; semEla: string; situacao: SituacaoDaVariavel }[];
  /** As peças da federação (P5, A7). Ausente num servidor de antes. */
  federacao?: SaudeDaFederacao;
}

const TABELAS: Record<string, string> = {
  sessions: "Sessões (auth.sessions)",
  mfa_challenges: "Desafios do segundo fator (auth.mfa_challenges)",
  audit_log_entries: "Registro de auditoria (auth.audit_log_entries)",
};

function Linha({ nome, valor, bom, nota }: { nome: string; valor: string; bom: boolean | null; nota?: string }) {
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

/** O que o quadro mostra (separado para a prévia e o teste). */
export function VistaDaSaude({ dado }: { dado: SaudeDoServico }) {
  const b = dado.banco;
  const faltam = dado.variaveis.filter((v) => v.situacao !== "presente" && v.situacao !== "dispensada");
  return (
    <>
      <ul className="ap-lista">
        <Linha
          nome="Sessões das contas"
          valor={b.sessoes_legiveis ? "o banco lê" : "o banco não lê"}
          bom={b.sessoes_legiveis}
          nota={b.sessoes_legiveis
            ? "Sessão desconectada para na porta da Alumia na hora."
            : "A porta confere o prazo do token e a lista de sessões cortadas pela Alumia; a lista de aparelhos fica indisponível na tela de segurança."}
        />
        <Linha
          nome="Desconectar aparelhos"
          valor={b.sessoes_apagaveis ? "pelo banco e pelo servidor" : "só pelo servidor"}
          bom={b.sessoes_apagaveis ? true : null}
          nota={b.sessoes_apagaveis ? undefined : "O banco não apaga sessões: o servidor do site encerra pelo serviço de contas (sair dos outros aparelhos, pânico, código de recuperação)."}
        />
        <Linha
          nome="Aviso de entrada nova"
          valor={b.aviso_de_entrada === "gatilho" ? "em toda entrada" : "na porta da Alumia"}
          bom={b.aviso_de_entrada === "gatilho" ? true : null}
          nota={b.aviso_de_entrada === "gatilho" ? undefined : "Sem o gatilho em auth.sessions, o aviso sai quando a pessoa entra pela porta da Alumia; quem entra por outro caminho do site não é avisado."}
        />
        <Linha nome="Sessões cortadas em vigor" valor={String(b.cortes_em_vigor)} bom={null} nota="Cortes de desconectar e de pânico que ainda param token antigo na porta. Somem sozinhos." />
        {Object.entries(b.enderecos).map(([tabela, e]) => (
          <Linha
            key={tabela}
            nome={`Endereço de rede · ${TABELAS[tabela] ?? tabela}`}
            valor={e.gatilho ? (e.com_endereco ? `${e.com_endereco} linhas antigas` : "zerado ao gravar") : e.com_endereco === null ? "não dá para conferir" : `${e.com_endereco} linhas com endereço`}
            bom={e.gatilho && !e.com_endereco ? true : false}
            nota={e.gatilho ? undefined : "O serviço de contas guarda o endereço aqui e o banco não pode zerar: peça ao Supabase ou rode o trecho 3b de 20261114-alumia-o8-conta.sql como dono do esquema auth."}
          />
        ))}
      </ul>
      <ul className="ap-lista">
        {dado.variaveis.map((v) => (
          <Linha key={v.nome} nome={v.nome} valor={v.situacao === "presente" ? "posta" : v.situacao === "curta" ? "curta demais" : v.situacao === "dispensada" ? "vazia (só na troca)" : "falta"} bom={v.situacao === "presente" || v.situacao === "dispensada"} nota={v.situacao === "presente" || v.situacao === "dispensada" ? undefined : v.semEla} />
        ))}
      </ul>
      {dado.federacao ? <VistaDaFederacao f={dado.federacao} /> : null}
      {faltam.length === 0 ? <Nota>Todas as variáveis secretas do servidor estão postas. O valor delas nunca sai do servidor.</Nota> : null}
    </>
  );
}

/** A federação: o que o painel liga (o recurso) e o que o servidor precisa para ela andar de verdade. */
function VistaDaFederacao({ f }: { f: SaudeDaFederacao }) {
  const pronta = f.faltam.length === 0;
  return (
    <>
      <ul className="ap-lista" aria-label="Federação no servidor">
        <Linha
          nome="Federação no servidor"
          valor={pronta ? "pronta" : "falta peça"}
          bom={pronta}
          nota={pronta ? "O recurso, o endereço, o segredo no servidor e o banco conferem." : "O painel pode dizer \"Fediverso: ligada\" e a tela da Alumia dizer que a federação não está ligada no servidor: a decisão do painel é só uma das peças."}
        />
        {f.banco ? <Linha nome="Fediverso ligado no painel" valor={f.banco.total ? "ligado" : "desligado"} bom={f.banco.total ? true : null} /> : null}
        <Linha nome="Endereço próprio da Alumia em https" valor={f.endereco ? "sim" : "não"} bom={f.endereco} />
        <Linha nome="ALUMIA_FEDIVERSO_SEGREDO no servidor" valor={f.segredo === "presente" ? "posto" : f.segredo === "curta" ? "curto demais" : "falta"} bom={f.segredo === "presente"} />
        {f.banco ? <Linha nome="Segredo e endereço de entrega no banco" valor={f.banco.segredo_guardado && f.banco.url_entrega ? "guardados" : "falta"} bom={f.banco.segredo_guardado && f.banco.url_entrega} /> : null}
        {f.banco_reconhece !== null ? <Linha nome="O banco reconhece o segredo do servidor" valor={f.banco_reconhece ? "sim" : "não"} bom={f.banco_reconhece} /> : null}
      </ul>
      {pronta ? null : (
        <Nota>
          {f.faltam.map((x, i) => (
            <span key={x} className="block">
              {i + 1}. {x}
            </span>
          ))}
        </Nota>
      )}
    </>
  );
}

/** Lê a saúde no servidor do site. Lança com o texto que o quadro mostra. */
async function lerSaude(): Promise<SaudeDoServico> {
  if (!hasBackend) throw new Error("Sem banco nesta montagem.");
  const token = (await (await getClient()).auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("Entre de novo para ler a saúde do serviço de contas.");
  const r = await fetch("/api/alumia/painel/saude", { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (r.status === 404) throw new Error("O servidor não respondeu: falta rodar 20261120-alumia-o14-conta.sql, ou esta montagem ainda não tem a rota.");
  if (!r.ok) throw new Error("O servidor não respondeu agora.");
  return (await r.json()) as SaudeDoServico;
}
const textoDoErro = (e: unknown) => (e instanceof Error ? e.message : "O servidor não respondeu agora.");

/**
 * Para a Visão geral do painel da Alumia: o que o banco consegue no serviço de contas (ler e apagar as sessões, o aviso de entrada
 * nova, o endereço de rede que o serviço grava) e quais variáveis secretas do servidor estão postas, pelo nome (o valor nunca
 * sai do servidor). Lê app/api/alumia/painel/saude. Só sim, não e números.
 */
export function SaudeDoServicoDeContas() {
  const [dado, setDado] = useState<SaudeDoServico | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const recarregar = () => {
    setCarregando(true);
    setErro("");
    lerSaude().then(setDado, (e: unknown) => setErro(textoDoErro(e))).finally(() => setCarregando(false));
  };

  useEffect(() => {
    let vivo = true;
    lerSaude().then((d) => vivo && setDado(d), (e: unknown) => vivo && setErro(textoDoErro(e))).finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <Quadro
      titulo="Serviço de contas e servidor"
      lado={
        <Botao variante="contorno" tamanho="p" onClick={recarregar}>
          Atualizar
        </Botao>
      }
    >
      <Estado leitura={{ erro, carregando, recarregar }} />
      {dado ? <VistaDaSaude dado={dado} /> : null}
    </Quadro>
  );
}
