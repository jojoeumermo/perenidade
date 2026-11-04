// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Aviso, botao, botaoClaro, campo, dataHora, rotulo, useAcao, useLista } from "./comum";

interface Proposta {
  id: string;
  slug: string;
  nome: string;
  objetivo: string;
  regras: string;
  situacao: "aberta" | "aprovada" | "recusada";
  motivo: string;
  criado_em: string;
  autor: string;
  moderadores: string[];
}

const SITUACAO: Record<Proposta["situacao"], string> = { aberta: "Aguardando decisão", aprovada: "Aprovada", recusada: "Não aprovada" };

/**
 * "Rede: propostas de comunidade" (Rede Lúcia v2, R4 item 37, decisão 4 da ESPEC): comunidade nova só nasce por proposta aprovada
 * pela coordenação. Cada proposta traz o objetivo, as regras e os dois moderadores indicados (só codinomes: a Rede não mostra nome
 * civil). Aprovar cria a comunidade, com as regras e os moderadores, e avisa quem propôs; recusar pede o motivo (ao menos 10
 * letras), que quem propôs lê. O banco confere o papel de coordenação de novo em cada função.
 */
export function RedePropostas() {
  const lista = useLista<{ itens: Proposta[] }>("rede_com_propostas_fila");
  const acao = useAcao(lista.recarregar);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const itens = lista.dados?.itens ?? [];
  const abertas = itens.filter((p) => p.situacao === "aberta");
  const decididas = itens.filter((p) => p.situacao !== "aberta");

  return (
    <div>
      <p className="max-w-3xl text-ink-soft">
        Comunidade nova da Rede Lúcia só nasce por proposta, e a coordenação decide. Leia o objetivo e as regras, confira os moderadores indicados e aprove ou recuse com o motivo. Aprovada, a comunidade entra entre as lutas, aberta a quem está na Rede, e os dois
        moderadores recebem um aviso (eles podem sair quando quiserem).
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados && abertas.length === 0 && <p className="text-ink-soft">Nenhuma proposta esperando.</p>}
      <ul className="mt-2 space-y-5">
        {abertas.map((p) => (
          <li key={p.id} className="border border-rule bg-parchment-deep p-5">
            <p className={rotulo}>
              {dataHora(p.criado_em)} · proposta de {p.autor} · endereço /{p.slug}
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold">{p.nome}</p>
            <p className="mt-2 whitespace-pre-line">{p.objetivo}</p>
            <p className={`${rotulo} mt-3`}>Regras</p>
            <p className="whitespace-pre-line">{p.regras}</p>
            <p className="mt-3 text-sm">Moderação indicada: {p.moderadores.join(", ")}</p>
            <label className="mt-3 block text-sm text-ink-soft">
              Motivo da recusa (obrigatório, ao menos 10 letras)
              <textarea value={motivos[p.id] ?? ""} onChange={(e) => setMotivos((m) => ({ ...m, [p.id]: e.target.value }))} rows={2} maxLength={500} className={campo} />
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" disabled={acao.ocupado} onClick={() => acao.agir("rede_com_decidir", { p_id: p.id, p_aprova: true, p_motivo: "" }, "Aprovada: a comunidade já está no ar.")} className={botao}>
                Aprovar
              </button>
              <button
                type="button"
                disabled={acao.ocupado || (motivos[p.id] ?? "").trim().length < 10}
                onClick={() => acao.agir("rede_com_decidir", { p_id: p.id, p_aprova: false, p_motivo: (motivos[p.id] ?? "").trim() }, "Recusada: quem propôs recebe o motivo.")}
                className={botaoClaro}
              >
                Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {decididas.length > 0 && (
        <section className="mt-8" aria-labelledby="decididas">
          <h3 id="decididas" className="font-serif text-xl font-semibold">Decididas nos últimos 60 dias</h3>
          <ul className="mt-2 divide-y divide-rule">
            {decididas.map((p) => (
              <li key={p.id} className="py-2">
                <p className="font-semibold">
                  {p.nome} · {SITUACAO[p.situacao]}
                </p>
                <p className="text-sm text-ink-soft">
                  {dataHora(p.criado_em)} · {p.autor}
                  {p.motivo ? ` · ${p.motivo}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
