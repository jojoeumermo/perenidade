// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Link2, Unlink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import territoriosDoSite from "@/content/territorios.json";
import { can, type Me, rpc } from "@/lib/backend";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Aviso, useAcao } from "./comum";
import { Botao, Cartao, Selecao } from "./ui";

/**
 * Os parceiros nos territórios (09/11/2026, supabase/migracoes/20261109-territorios-parceiros.sql), na seção
 * Departamentos, só para a coordenação: escolher a pessoa e o território do coletivo dela. Ligada, a pessoa entra em
 * Parcerias e posta as novidades do território, que aparecem na página dele e na seção "Dos territórios" do Jornal.
 */

interface Vinculo {
  territorio: string;
  usuario: string;
  nome: string;
}

const TERRITORIOS = (territoriosDoSite.territorios as { slug: string; nome: string }[]).map((t) => ({ slug: t.slug, nome: t.nome }));
const nomeDo = (slug: string) => TERRITORIOS.find((t) => t.slug === slug)?.nome ?? slug;

export function ParceirosDosTerritorios({ me }: { me: Me }) {
  const coordena = can(me, "coordenacao") || can(me, "vice");
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null);
  const [pessoa, setPessoa] = useState<PessoaAchada | null>(null);
  const [territorio, setTerritorio] = useState(TERRITORIOS[0]?.slug ?? "");
  const carregar = useCallback(() => {
    void rpc<Vinculo[]>("territorio_parceiros_listar")
      .then(setVinculos)
      .catch(() => setVinculos([]));
  }, []);
  useEffect(() => {
    if (coordena) carregar();
  }, [coordena, carregar]);
  const acao = useAcao(carregar);
  if (!coordena) return null;
  return (
    <Cartao titulo="Parceiros dos territórios" sobre="Quem posta as novidades de cada território. Ligar uma pessoa a um território a põe em Parcerias; as postagens vão ao ar na hora, e a coordenação tira do ar quando precisar.">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
        <BuscaDePessoa escolhida={pessoa} escolher={setPessoa} rotulo="Pessoa" />
        <Selecao rotulo="Território" value={territorio} onChange={(e) => setTerritorio(e.target.value)}>
          {TERRITORIOS.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.nome}
            </option>
          ))}
        </Selecao>
        <Botao
          variante="principal"
          simbolo={Link2}
          disabled={!pessoa || !territorio || acao.ocupado}
          onClick={() => pessoa && void acao.agir("territorio_parceiro_definir", { p_usuario: pessoa.id, p_territorio: territorio, p_ligar: true }, `${pessoa.nome} agora posta em ${nomeDo(territorio)}.`).then(() => setPessoa(null))}
        >
          Ligar
        </Botao>
      </div>
      {vinculos && vinculos.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--pn-borda)]">
          {vinculos.map((v) => (
            <li key={`${v.territorio}-${v.usuario}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <strong>{v.nome}</strong> <span className="pn-ajuda">· {nomeDo(v.territorio)}</span>
              </span>
              <Botao pequeno simbolo={Unlink} disabled={acao.ocupado} onClick={() => void acao.agir("territorio_parceiro_definir", { p_usuario: v.usuario, p_territorio: v.territorio, p_ligar: false }, "Desligado.")}>
                Desligar
              </Botao>
            </li>
          ))}
        </ul>
      )}
      <Aviso texto={acao.aviso} />
    </Cartao>
  );
}
