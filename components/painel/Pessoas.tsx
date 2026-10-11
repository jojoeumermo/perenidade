// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { leads, type Me, type Role } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, data, elo, oQueFaz, papeis, rotulo, useAcao, useLista } from "./comum";

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

interface Pessoa {
  id: string;
  nome: string;
  email: string;
  suspenso: boolean;
  visto_em: string;
  papeis: Role[];
}

/** Liderança e vice-liderança: aceitar pedidos de voluntariado, confiar papéis e disciplinas, suspender contas. */
export function Pessoas({ me }: { me: Me }) {
  const { t } = useI18n();
  const lider = leads(me);
  // A liderança não se concede por aqui (muda de mãos em Segurança e sucessão); a vice-liderança, só a liderança nomeia.
  const concediveis = (Object.keys(papeis) as Role["papel"][]).filter((papel) => papel !== "coordenacao" && (papel !== "vice" || lider));
  const pedidos = useLista<Candidatura[]>("candidaturas_listar");
  const pessoas = useLista<Pessoa[]>("voluntarios_listar");
  const acao = useAcao(() => {
    pedidos.recarregar();
    pessoas.recarregar();
  });
  const [novo, setNovo] = useState<{ usuario: string; papel: Role["papel"]; disciplina: string }>({ usuario: "", papel: "educacao", disciplina: "" });
  const [filtro, setFiltro] = useState("");
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "todo o site");
  const pendentes = pedidos.dados?.filter((pedido) => pedido.status === "pendente") ?? [];
  const visiveis = pessoas.dados?.filter((pessoa) => `${pessoa.nome} ${pessoa.email}`.toLowerCase().includes(filtro.toLowerCase())) ?? [];

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Pedidos de voluntariado</h2>
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

      <section>
        <h2 className="font-serif text-2xl font-semibold">Confiar um papel</h2>
        <p className="mt-1 text-ink-soft">A pessoa precisa ter entrado no site pelo menos uma vez para aparecer na lista.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            Pessoa
            <select value={novo.usuario} onChange={(e) => setNovo({ ...novo, usuario: e.target.value })} className={campo}>
              <option value="">Escolha…</option>
              {pessoas.dados?.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome} ({pessoa.email})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Papel
            <select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as Role["papel"] })} className={campo}>
              {concediveis.map((papel) => (
                <option key={papel} value={papel}>
                  {papeis[papel]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Disciplina{novo.papel === "educacao" ? "" : " (opcional)"}
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
          disabled={acao.ocupado || !novo.usuario || (novo.papel === "educacao" && !novo.disciplina)}
          onClick={() => acao.agir("papel_conceder", { p_usuario: novo.usuario, p_papel: novo.papel, p_disciplina: novo.disciplina || null }, "Papel confiado.")}
        >
          Confiar papel
        </button>
        <p className="mt-2 text-ink-soft">
          <strong>{papeis[novo.papel]}:</strong> {oQueFaz[novo.papel]}
        </p>
        <p className="mt-2 text-ink-soft">
          Para criar a conta de alguém da equipe com e-mail e senha definidos por você, use o painel do serviço de contas (o passo a passo está no guia de manutenção). Depois que a pessoa entrar uma vez, ela aparece aqui para receber o papel.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Pessoas</h2>
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
                    <button type="button" title="Retirar papel" aria-label={`Retirar ${papeis[papel.papel]} de ${pessoa.nome}`} className="cursor-pointer px-1 hover:text-oxblood" onClick={() => acao.agir("papel_remover", { p_id: papel.id }, "Papel retirado.")}>
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
