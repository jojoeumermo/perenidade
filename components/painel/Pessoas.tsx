// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { leads, type Me, type Role, rpc } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Abas, Aviso, botao, botaoClaro, campo, data, elo, oQueFaz, PAINEL_MUDOU, papeis, rotulo, textoDoErro, useAcao, useLista } from "./comum";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Convites } from "./Convites";

interface Candidatura {
  id: string;
  papel: Role["papel"];
  disciplina: string | null;
  mensagem: string;
  status: string;
  criado_em: string;
  nome: string;
  email: string;
}

/** Candidatura feita pelo formulário público, por quem ainda não tinha conta (ou não estava logado). */
interface Inscricao {
  id: string;
  nome: string;
  email: string;
  papel: Role["papel"];
  disciplina: string | null;
  mensagem: string;
  status: string;
  criado_em: string;
  tem_conta: boolean;
}

interface Pessoa {
  id: string;
  nome: string;
  email: string;
  suspenso: boolean;
  visto_em: string;
  papeis: Role[];
}

/** Coordenação e vice-coordenação: aceitar pedidos de voluntariado, confiar papéis e disciplinas, suspender contas. */
export function Pessoas({ me }: { me: Me }) {
  const { t } = useI18n();
  const lider = leads(me);
  // A coordenação não se concede por aqui (muda de mãos em Segurança e sucessão); a vice-coordenação, só a coordenação nomeia.
  const concediveis = (Object.keys(papeis) as Role["papel"][]).filter((papel) => papel !== "coordenacao" && (papel !== "vice" || lider));
  const pedidos = useLista<Candidatura[]>("candidaturas_listar");
  const pessoas = useLista<Pessoa[]>("voluntarios_listar");
  const inscricoes = useLista<Inscricao[]>("inscricoes_listar");
  const { lang } = useI18n();
  /** O convite recém-gerado para quem foi aceito: aparece uma vez só, para a coordenação mandar por e-mail. */
  const [aceite, setAceite] = useState<{ nome: string; email: string; link: string } | null>(null);
  const [avisoInscricao, setAvisoInscricao] = useState("");
  const novas = inscricoes.dados?.filter((item) => item.status === "pendente") ?? [];

  async function decidirInscricao(item: Inscricao, aceitar: boolean) {
    setAvisoInscricao("");
    try {
      const resposta = await rpc<{ codigo: string | null; email: string; nome: string }>("inscricao_decidir", { p_id: item.id, p_aceitar: aceitar });
      if (aceitar && resposta.codigo) setAceite({ nome: item.nome, email: item.email, link: `${window.location.origin}/${lang}/entrar?convite=${resposta.codigo}` });
      setAvisoInscricao(!aceitar ? "Candidatura recusada. O aviso por e-mail entrou na fila de envio." : resposta.codigo ? "Candidatura aceita. O convite entrou na fila de e-mails e sai sozinho para a pessoa; o link também está abaixo, se precisar mandar por outro caminho (veja em Controles do site se o envio está funcionando)." : "Candidatura aceita: a pessoa já tinha conta e recebeu a função na hora. O aviso por e-mail entrou na fila de envio.");
      inscricoes.recarregar();
      pessoas.recarregar();
      window.dispatchEvent(new Event(PAINEL_MUDOU));
    } catch (erro) {
      setAvisoInscricao(textoDoErro(erro));
    }
  }
  const acao = useAcao(() => {
    pedidos.recarregar();
    pessoas.recarregar();
  });
  const [novo, setNovo] = useState<{ papel: Role["papel"]; disciplina: string }>({ papel: "educacao", disciplina: "" });
  /** Quem vai receber a função: escolhida na busca, não numa lista com todo mundo. */
  const [quem, setQuem] = useState<PessoaAchada | null>(null);
  const [filtro, setFiltro] = useState("");
  const [aba, setAba] = useState<"equipe" | "funcao" | "convites" | "pedidos">("equipe");
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "todo o site");
  const pendentes = pedidos.dados?.filter((pedido) => pedido.status === "pendente") ?? [];
  const visiveis = pessoas.dados?.filter((pessoa) => `${pessoa.nome} ${pessoa.email}`.toLowerCase().includes(filtro.toLowerCase())) ?? [];

  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "equipe", nome: "Pessoas" },
          { id: "funcao", nome: "Confiar função" },
          { id: "convites", nome: "Convites" },
          { id: "pedidos", nome: "Candidaturas", conta: pendentes.length + novas.length },
        ]}
      />
      <div hidden={aba !== "convites"}>
        <Convites me={me} />
      </div>
      <section hidden={aba !== "pedidos"} className="mb-10">
        <h2 className="font-serif text-2xl font-semibold">Candidaturas pelo formulário</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">
          Quem preencheu o formulário de voluntariado no site, com nome e e-mail. Com o envio de e-mails ligado (Controles do site), a pessoa recebe um e-mail dizendo que o pedido chegou, e a coordenação recebe outro avisando do pedido. Ao aceitar, quem ainda não tem conta
          ganha um convite pessoal, que só serve para aquele e-mail e já traz a função, e ele vai sozinho por e-mail. Quem já tem conta recebe a função na hora. Ao recusar, a pessoa também é avisada por e-mail.
        </p>
        <Aviso texto={inscricoes.erro || avisoInscricao} />
        {aceite && (
          <div role="status" className="mt-3 border-2 border-ink bg-parchment p-4">
            <p className="font-serif text-xl font-semibold">Convite de {aceite.nome}</p>
            <p className="mt-1 text-ink-soft">Este endereço aparece uma vez só e vale por 14 dias. Mande para {aceite.email}.</p>
            <p className="mt-2 select-all break-all font-mono text-xs">{aceite.link}</p>
            <p className="mt-3 flex flex-wrap gap-4">
              <button type="button" className={botaoClaro} onClick={() => void navigator.clipboard?.writeText(aceite.link)}>Copiar o endereço</button>
              <a
                className={elo}
                href={`mailto:${aceite.email}?subject=${encodeURIComponent("Sua candidatura ao Instituto Lúcia foi aceita")}&body=${encodeURIComponent(`Olá, ${aceite.nome}.\n\nSua candidatura a voluntário no Instituto Lúcia foi aceita. Para criar a sua conta, já com a função combinada, abra este endereço (ele vale por 14 dias e só serve para este e-mail):\n\n${aceite.link}\n\nAté breve.`)}`}
              >
                Abrir no programa de e-mail
              </a>
              <button type="button" className={elo} onClick={() => setAceite(null)}>Já mandei</button>
            </p>
          </div>
        )}
        {novas.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma candidatura aguardando.</p>}
        <ul className="mt-3 space-y-4">
          {novas.map((item) => (
            <li key={item.id} className="border border-rule bg-parchment-deep p-4">
              <p className={rotulo}>
                {papeis[item.papel]} · {nomeDaArea(item.disciplina)} · {data(item.criado_em)}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold">{item.nome}</p>
              <p className="font-mono text-xs text-ink-soft">
                {item.email} · {item.tem_conta ? "já tem conta no site" : "ainda sem conta"}
              </p>
              <p className="mt-2 whitespace-pre-line">{item.mensagem}</p>
              <div className="mt-3 flex gap-3">
                <button type="button" className={botao} onClick={() => void decidirInscricao(item, true)}>Aceitar</button>
                <button type="button" className={botaoClaro} onClick={() => void decidirInscricao(item, false)}>Recusar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section hidden={aba !== "pedidos"}>
        <h2 className="font-serif text-2xl font-semibold">Pedidos feitos pelo painel</h2>
        <Aviso texto={pedidos.erro} />
        {pendentes.length === 0 && <p className="mt-2 text-ink-soft">Nenhum pedido aguardando.</p>}
        <ul className="mt-3 space-y-4">
          {pendentes.map((pedido) => (
            <li key={pedido.id} className="border border-rule bg-parchment-deep p-4">
              <p className={rotulo}>
                {papeis[pedido.papel]} · {nomeDaArea(pedido.disciplina)} · {data(pedido.criado_em)}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold">{pedido.nome}</p>
              <p className="font-mono text-xs text-ink-soft">{pedido.email}</p>
              <p className="mt-2">{pedido.mensagem}</p>
              <div className="mt-3 flex gap-3">
                <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("candidatura_decidir", { p_id: pedido.id, p_aceitar: true }, "Pedido aceito.")}>Aceitar</button>
                <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("candidatura_decidir", { p_id: pedido.id, p_aceitar: false }, "Pedido recusado.")}>Recusar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section hidden={aba !== "funcao"}>
        <h2 className="font-serif text-2xl font-semibold">Confiar uma função</h2>
        <p className="mt-1 text-ink-soft">Procure a pessoa pelo nome ou pelo e-mail. Ela precisa ter entrado no site pelo menos uma vez para aparecer na busca.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <span className="block">Pessoa</span>
            <BuscaDePessoa escolhida={quem} escolher={setQuem} reserva={pessoas.dados ?? []} />
          </div>
          <label className="block">
            Função
            <select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as Role["papel"] })} className={campo}>
              {concediveis.map((papel) => (
                <option key={papel} value={papel}>
                  {papeis[papel]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Disciplina{novo.papel === "educacao" || novo.papel === "educacao_secundaria" ? "" : " (opcional)"}
            <select value={novo.disciplina} onChange={(e) => setNovo({ ...novo, disciplina: e.target.value })} className={campo}>
              <option value="">Todo o site</option>
              {areaSlugs.map((area) => (
                <option key={area} value={area}>
                  {t.areas[area][0]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className={`mt-3 ${botao}`}
          disabled={acao.ocupado || !quem || ((novo.papel === "educacao" || novo.papel === "educacao_secundaria") && !novo.disciplina)}
          onClick={async () => {
            if (quem && (await acao.agir("papel_conceder", { p_usuario: quem.id, p_papel: novo.papel, p_disciplina: novo.disciplina || null }, `Função confiada a ${quem.nome}.`))) setQuem(null);
          }}
        >
          Confiar função
        </button>
        <p className="mt-2 text-ink-soft">
          <strong>{papeis[novo.papel]}:</strong> {oQueFaz[novo.papel]}
        </p>
        <p className="mt-2 text-ink-soft">
          Para criar a conta de alguém da equipe com e-mail e senha definidos por você, use o painel do serviço de contas (o passo a passo está no guia de manutenção). Depois que a pessoa entrar uma vez, ela aparece aqui para receber a função.
        </p>
      </section>

      <section hidden={aba !== "equipe"}>
        <Aviso texto={pessoas.erro} />
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nome ou e-mail" aria-label="Filtrar pessoas" className={campo} />
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {visiveis.map((pessoa) => (
            <li key={pessoa.id} className="py-3">
              <p className="font-serif text-xl font-semibold">
                {pessoa.nome} {pessoa.suspenso && <span className="font-sans text-sm text-oxblood">(suspensa)</span>}
              </p>
              <p className="font-mono text-xs text-ink-soft">
                {pessoa.email} · último acesso em {data(pessoa.visto_em)}
              </p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {pessoa.papeis.map((papel) => (
                  <li key={papel.id} className="border border-rule bg-parchment-deep px-2 py-1">
                    {papeis[papel.papel]} · {nomeDaArea(papel.disciplina)}{" "}
                    <button type="button" title="Retirar função" aria-label={`Retirar ${papeis[papel.papel]} de ${pessoa.nome}`} className="cursor-pointer px-1 hover:text-oxblood" onClick={() => acao.agir("papel_remover", { p_id: papel.id }, "Função retirada.")}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className={`mt-1 ${elo}`} onClick={() => acao.agir("usuario_suspender", { p_usuario: pessoa.id, p_suspenso: !pessoa.suspenso }, pessoa.suspenso ? "Conta reativada." : "Conta suspensa.")}>
                {pessoa.suspenso ? "Reativar conta" : "Suspender conta"}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <Aviso texto={acao.aviso} />
    </div>
  );
}
