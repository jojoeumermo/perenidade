// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Pause, Play, RotateCcw, ShieldAlert, ShieldCheck, ShieldOff, UserX } from "lucide-react";
import { useState } from "react";
import type { Role } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Aviso, data, papeis, useAcao, useLista } from "./comum";
import { Abas, Botao, Busca, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, Lista, Selo, Vazio } from "./ui";

interface Protecoes {
  pausa: boolean;
  motivo: string;
  aprovacao_manual: boolean;
}

interface Membro {
  id: string;
  nome: string;
  suspenso: boolean;
  /** Quem suspendeu: a supervisão só reativa o que ela mesma suspendeu. */
  suspensao: string;
  visto_em: string;
  eu: boolean;
  /** Coordenação, vice-coordenação e supervisão: a supervisão não suspende. */
  protegida: boolean;
  papeis: Role[];
}

interface Pedido {
  id: string;
  origem: "formulario" | "painel";
  nome: string;
  papel: Role["papel"];
  disciplina: string | null;
  mensagem: string;
  criado_em: string;
}

/** As proteções que a supervisão pode ligar sozinha: valem na hora, avisam a coordenação e se desfazem com um clique. */
function Freios() {
  const estado = useLista<Protecoes>("protecoes");
  const [motivo, setMotivo] = useState("");
  const acao = useAcao(estado.recarregar);
  const p = estado.dados;
  if (!p) {
    return estado.erro ? (
      <Faixa tom="erro" acao={<Botao pequeno simbolo={RotateCcw} onClick={estado.recarregar}>Tentar de novo</Botao>}>
        {estado.erro}
      </Faixa>
    ) : (
      <Esqueleto forma="cartoes" linhas={2} rotulo="Carregando…" />
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Cartao
        variante={p.pausa ? "alerta" : "padrao"}
        titulo="Pausa geral de envios"
        sobre="Fecha na hora tudo o que o público envia (comunidade, mural, reforço, boletim, contribuições) e o cadastro. Ler e estudar continua normal, e a equipe continua trabalhando."
        acoes={p.pausa ? <Selo tom="erro" ponto>Os envios estão pausados.</Selo> : <Selo tom="ok" ponto>Os envios estão abertos.</Selo>}
      >
        {!p.pausa && (
          <div className="mt-3">
            <Campo rotulo="Recado para quem visita (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ex.: Voltamos a receber mensagens em breve." />
          </div>
        )}
        <p className="mt-3">
          {p.pausa ? (
            <Botao variante="principal" simbolo={Play} carregando={acao.ocupado} onClick={() => acao.agir("site_pausa", { p_pausa: false, p_motivo: "" }, "Envios reabertos. A coordenação foi avisada.")}>
              Reabrir os envios
            </Botao>
          ) : (
            <Botao
              perigo
              simbolo={Pause}
              carregando={acao.ocupado}
              onClick={async () => {
                if (await confirmarFrase("Pausar agora tudo o que o público pode enviar?")) void acao.agir("site_pausa", { p_pausa: true, p_motivo: motivo.trim() }, "Envios pausados. A coordenação foi avisada.");
              }}
            >
              Pausar os envios
            </Botao>
          )}
        </p>
      </Cartao>

      <Cartao
        variante={p.aprovacao_manual ? "alerta" : "padrao"}
        titulo="Modo de segurança da Comunidade"
        sobre="Ligado, toda mensagem nova na Comunidade espera a leitura de quem cuida dela antes de aparecer. Não apaga nada do que já está no ar."
        acoes={p.aprovacao_manual ? <Selo tom="aviso" ponto>Ligado: só aprovação manual.</Selo> : <Selo ponto>Desligado: vale a avaliação automática.</Selo>}
      >
        <p className="mt-3">
          <Botao
            perigo={!p.aprovacao_manual}
            simbolo={p.aprovacao_manual ? ShieldOff : ShieldCheck}
            carregando={acao.ocupado}
            onClick={() => acao.agir("comunidade_modo_seguranca", { p_ligar: !p.aprovacao_manual }, p.aprovacao_manual ? "Modo de segurança desligado. A coordenação foi avisada." : "Modo de segurança ligado. A coordenação foi avisada.")}
          >
            {p.aprovacao_manual ? "Desligar o modo de segurança" : "Ligar o modo de segurança"}
          </Botao>
        </p>
      </Cartao>
      <div className="space-y-2 lg:col-span-2">
        <Aviso texto={acao.aviso} />
        <Faixa tom="info">A faixa do alto, o cadastro aberto, a interdição do site e o expurgo continuam com a coordenação; a interdição e o expurgo a supervisão pode pedir, em Interdição e expurgo.</Faixa>
      </div>
    </div>
  );
}

/** A equipe vista pela supervisão: sem e-mail de ninguém. Suspender é freio de emergência, com motivo e aviso à coordenação. */
function EquipeSupervisionada() {
  const { t } = useI18n();
  const lista = useLista<Membro[]>("equipe_supervisao");
  const [aberta, setAberta] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const acao = useAcao(() => {
    lista.recarregar();
    setAberta(null);
    setMotivo("");
  });
  const [filtro, setFiltro] = useState("");
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "todo o site");
  const visiveis = lista.dados?.filter((membro) => membro.nome.toLowerCase().includes(filtro.toLowerCase())) ?? [];
  return (
    <div className="space-y-3">
      <Faixa tom="aviso">
        Suspender é o freio de emergência para conta tomada, vazamento ou ataque: a conta continua lendo, mas não envia nada. Escreva o motivo (vai para o registro e para a coordenação, que é avisada na hora). A
        supervisão reativa só o que ela mesma suspendeu; o resto é com a coordenação.
      </Faixa>
      <Aviso texto={lista.erro || acao.aviso} />
      <Busca rotulo="Filtrar a equipe" valor={filtro} aoMudar={setFiltro} placeholder="Filtrar por nome" />
      {!lista.dados && !lista.erro && <Esqueleto forma="fila" linhas={5} />}
      <Lista rotulo="Equipe">
        {visiveis.map((membro) => {
          const podeSuspender = !membro.eu && !membro.protegida && !membro.suspenso;
          const podeReativar = membro.suspenso && membro.suspensao === "supervisao";
          return (
            <li key={membro.id} className="pn-item" style={{ display: "block", height: "auto", paddingBlock: "0.7rem" }}>
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {membro.nome} {membro.eu && <Selo>(você)</Selo>} {membro.suspenso && <Selo tom="erro">(suspensa)</Selo>}
              </p>
              <p className="pn-item-meta">
                {membro.papeis.map((papel) => `${papeis[papel.papel]}${papel.disciplina ? ` · ${nomeDaArea(papel.disciplina)}` : ""}`).join(" · ")} · passou pelo painel em {data(membro.visto_em)}
              </p>
              {podeReativar && (
                <Botao pequeno className="mt-2" simbolo={RotateCcw} carregando={acao.ocupado} onClick={() => acao.agir("usuario_suspender", { p_usuario: membro.id, p_suspenso: false, p_motivo: "Reativada pela supervisão" }, "Conta reativada. A coordenação foi avisada.")}>
                  Reativar a conta
                </Botao>
              )}
              {podeSuspender &&
                (aberta === membro.id ? (
                  <div className="mt-2 max-w-xl">
                    <Campo rotulo="Motivo da suspensão (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
                    <p className="mt-2 flex gap-3">
                      <Botao perigo simbolo={UserX} disabled={motivo.trim().length < 5} carregando={acao.ocupado} onClick={() => acao.agir("usuario_suspender", { p_usuario: membro.id, p_suspenso: true, p_motivo: motivo.trim() }, "Conta suspensa. A coordenação foi avisada.")}>
                        Suspender agora
                      </Botao>
                      <Botao onClick={() => setAberta(null)}>Cancelar</Botao>
                    </p>
                  </div>
                ) : (
                  <Botao
                    variante="discreto"
                    pequeno
                    className="mt-1"
                    simbolo={ShieldAlert}
                    onClick={() => {
                      setAberta(membro.id);
                      setMotivo("");
                    }}
                  >
                    Suspender em emergência
                  </Botao>
                ))}
            </li>
          );
        })}
      </Lista>
    </div>
  );
}

/** Pedidos de voluntariado esperando a coordenação. A supervisão só acompanha: quem decide é a coordenação. */
function PedidosPendentes() {
  const { t } = useI18n();
  const lista = useLista<Pedido[]>("pedidos_supervisao");
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "todo o site");
  return (
    <div className="space-y-3">
      <Faixa tom="info">Só para acompanhar: quem aceita ou recusa é a coordenação. Se a fila crescer, lembre a coordenação pelo Mural da equipe.</Faixa>
      <Aviso texto={lista.erro} />
      {!lista.dados && !lista.erro && <Esqueleto forma="cartoes" linhas={3} />}
      {lista.dados?.length === 0 && <Vazio titulo="Nenhum pedido esperando." />}
      <ul className="space-y-3">
        {lista.dados?.map((pedido) => (
          <li key={pedido.id}>
            <Cartao as="article" titulo={pedido.nome} nivelDoTitulo={3}>
              <p className="pn-rotulo-mono">
                {papeis[pedido.papel]} · {nomeDaArea(pedido.disciplina)} · {pedido.origem === "formulario" ? "formulário do site" : "pedido pelo painel"} · {data(pedido.criado_em)}
              </p>
              <p className="mt-2 whitespace-pre-line" data-original>
                {pedido.mensagem}
              </p>
            </Cartao>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Supervisão: logo abaixo da coordenação e da vice-coordenação. Faz o painel andar e impede o caos quando as duas
 * estão ausentes, sem plenos poderes. Cada botão daqui é conferido de novo no banco.
 */
export function Supervisao() {
  const [aba, setAba] = useState<"freios" | "equipe" | "pedidos">("freios");
  const pedidos = useLista<Pedido[]>("pedidos_supervisao");
  return (
    <div className="pn-tela">
      <Abas
        rotulo="Supervisão"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { id: "freios" as const, nome: "Proteções" },
          { id: "equipe" as const, nome: "Equipe" },
          { id: "pedidos" as const, nome: "Pedidos de voluntariado", conta: pedidos.dados?.length },
        ]}
        painel={(id) => (id === "freios" ? <Freios /> : id === "equipe" ? <EquipeSupervisionada /> : <PedidosPendentes />)}
      />
    </div>
  );
}
