// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { Role } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Abas, Aviso, botao, botaoClaro, campo, data, papeis, rotulo, useAcao, useLista } from "./comum";

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
  if (!p) return <Aviso texto={estado.erro || "Carregando…"} />;
  const cartao = "border border-rule bg-parchment-deep p-5";
  const alerta = "border-2 border-oxblood bg-parchment-deep p-5";
  const vermelho = "cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={p.pausa ? alerta : cartao}>
        <h2 className="font-serif text-xl font-semibold">Pausa geral de envios</h2>
        <p className="mt-1 text-ink-soft">Fecha na hora tudo o que o público envia (comunidade, mural, reforço, boletim, contribuições) e o cadastro. Ler e estudar continua normal, e a equipe continua trabalhando.</p>
        <p className="mt-3 font-semibold">{p.pausa ? "Os envios estão pausados." : "Os envios estão abertos."}</p>
        {!p.pausa && (
          <label className="mt-3 block">
            Recado para quem visita (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ex.: Voltamos a receber mensagens em breve." className={campo} />
          </label>
        )}
        <p className="mt-3">
          {p.pausa ? (
            <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("site_pausa", { p_pausa: false, p_motivo: "" }, "Envios reabertos. A coordenação foi avisada.")}>Reabrir os envios</button>
          ) : (
            <button type="button" className={vermelho} disabled={acao.ocupado} onClick={() => { if (window.confirm("Pausar agora tudo o que o público pode enviar?")) void acao.agir("site_pausa", { p_pausa: true, p_motivo: motivo.trim() }, "Envios pausados. A coordenação foi avisada."); }}>
              Pausar os envios
            </button>
          )}
        </p>
      </section>

      <section className={p.aprovacao_manual ? alerta : cartao}>
        <h2 className="font-serif text-xl font-semibold">Modo de segurança da Comunidade</h2>
        <p className="mt-1 text-ink-soft">Ligado, toda mensagem nova na Comunidade espera a leitura de quem cuida dela antes de aparecer. Não apaga nada do que já está no ar.</p>
        <p className="mt-3 font-semibold">{p.aprovacao_manual ? "Ligado: só aprovação manual." : "Desligado: vale a avaliação automática."}</p>
        <p className="mt-3">
          <button type="button" className={p.aprovacao_manual ? botaoClaro : vermelho} disabled={acao.ocupado} onClick={() => acao.agir("comunidade_modo_seguranca", { p_ligar: !p.aprovacao_manual }, p.aprovacao_manual ? "Modo de segurança desligado. A coordenação foi avisada." : "Modo de segurança ligado. A coordenação foi avisada.")}>
            {p.aprovacao_manual ? "Desligar o modo de segurança" : "Ligar o modo de segurança"}
          </button>
        </p>
      </section>
      <div className="lg:col-span-2">
        <Aviso texto={acao.aviso} />
        <p className="text-ink-soft">A faixa do alto, o cadastro aberto, a interdição do site e o expurgo continuam com a coordenação; a interdição e o expurgo a supervisão pode pedir, em Interdição e expurgo.</p>
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
    <div>
      <p className="max-w-3xl text-ink-soft">
        Suspender é o freio de emergência para conta tomada, vazamento ou ataque: a conta continua lendo, mas não envia nada. Escreva o motivo (vai para o registro e para a coordenação, que é avisada na hora). A
        supervisão reativa só o que ela mesma suspendeu; o resto é com a coordenação.
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
      <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nome" aria-label="Filtrar a equipe" className={campo} />
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {visiveis.map((membro) => {
          const podeSuspender = !membro.eu && !membro.protegida && !membro.suspenso;
          const podeReativar = membro.suspenso && membro.suspensao === "supervisao";
          return (
            <li key={membro.id} className="py-3">
              <p className="font-serif text-xl font-semibold">
                {membro.nome} {membro.eu && <span className="font-sans text-sm text-ink-soft">(você)</span>} {membro.suspenso && <span className="font-sans text-sm text-oxblood">(suspensa)</span>}
              </p>
              <p className="text-ink-soft">
                {membro.papeis.map((papel) => `${papeis[papel.papel]}${papel.disciplina ? ` · ${nomeDaArea(papel.disciplina)}` : ""}`).join(" · ")} · passou pelo painel em {data(membro.visto_em)}
              </p>
              {podeReativar && (
                <button type="button" className={`mt-2 ${botaoClaro}`} disabled={acao.ocupado} onClick={() => acao.agir("usuario_suspender", { p_usuario: membro.id, p_suspenso: false, p_motivo: "Reativada pela supervisão" }, "Conta reativada. A coordenação foi avisada.")}>
                  Reativar a conta
                </button>
              )}
              {podeSuspender &&
                (aberta === membro.id ? (
                  <div className="mt-2 max-w-xl">
                    <label className="block">
                      Motivo da suspensão (obrigatório)
                      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} className={campo} />
                    </label>
                    <p className="mt-2 flex gap-3">
                      <button type="button" className="cursor-pointer bg-oxblood px-5 py-2 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50" disabled={acao.ocupado || motivo.trim().length < 5} onClick={() => acao.agir("usuario_suspender", { p_usuario: membro.id, p_suspenso: true, p_motivo: motivo.trim() }, "Conta suspensa. A coordenação foi avisada.")}>
                        Suspender agora
                      </button>
                      <button type="button" className={botaoClaro} onClick={() => setAberta(null)}>Cancelar</button>
                    </p>
                  </div>
                ) : (
                  <button type="button" className="mt-1 cursor-pointer underline hover:text-oxblood" onClick={() => { setAberta(membro.id); setMotivo(""); }}>
                    Suspender em emergência
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Pedidos de voluntariado esperando a coordenação. A supervisão só acompanha: quem decide é a coordenação. */
function PedidosPendentes() {
  const { t } = useI18n();
  const lista = useLista<Pedido[]>("pedidos_supervisao");
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "todo o site");
  return (
    <div>
      <p className="max-w-3xl text-ink-soft">Só para acompanhar: quem aceita ou recusa é a coordenação. Se a fila crescer, lembre a coordenação pelo Mural da equipe.</p>
      <Aviso texto={lista.erro} />
      {lista.dados?.length === 0 && <p className="mt-2 text-ink-soft">Nenhum pedido esperando.</p>}
      <ul className="mt-3 space-y-3">
        {lista.dados?.map((pedido) => (
          <li key={pedido.id} className="border border-rule bg-parchment-deep p-4">
            <p className={rotulo}>
              {papeis[pedido.papel]} · {nomeDaArea(pedido.disciplina)} · {pedido.origem === "formulario" ? "formulário do site" : "pedido pelo painel"} · {data(pedido.criado_em)}
            </p>
            <p className="mt-1 font-serif text-xl font-semibold">{pedido.nome}</p>
            <p className="mt-1 whitespace-pre-line" data-original>{pedido.mensagem}</p>
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
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "freios" as const, nome: "Proteções" },
          { id: "equipe" as const, nome: "Equipe" },
          { id: "pedidos" as const, nome: "Pedidos de voluntariado", conta: pedidos.dados?.length },
        ]}
      />
      {aba === "freios" && <Freios />}
      {aba === "equipe" && <EquipeSupervisionada />}
      {aba === "pedidos" && <PedidosPendentes />}
    </div>
  );
}
