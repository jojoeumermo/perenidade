// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { TextosDaBiblioteca } from "@/i18n/escola/biblioteca";
import { esquecerEscola, lerDaEscola, useDaEscola, type LidoDaEscola } from "@/lib/escola/acesso";
import type { FrenteDeAtuacao, FrentesSomadas } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { useEuDaEscola } from "../casca/Casca";
import { chamarDaEscola } from "../duvida/chamar";
import { avisoDaEscolha, frenteMarcada, frentesNaTela, proximaEscolha } from "./frentes";

/**
 * As 7 frentes de atuação (prancha Frente): botões, com a do militante em destaque ("· a sua"). Tocar escolhe a frente
 * (public.escola_frente_escolher, F6); tocar de novo na sua tira. O número de cada frente vem de
 * public.escola_frentes_somadas, que só soma (nunca nomes) e esconde frente com menos de 3 pessoas, lida de novo depois
 * de cada escolha. A frente marcada vem de escola_eu (F1) lido de novo a cada montagem (a casca lê uma vez por aba e fica
 * velha depois de uma escolha: frenteMarcada); até ele chegar, os botões esperam. Sem as funções no banco, os botões
 * avisam com honestidade e nada muda.
 */
export function EscolherFrente({ t }: { t: TextosDaBiblioteca["frente"] }) {
  const eu = useEuDaEscola();
  // undefined: nada escolhido nesta montagem.
  const [escolhidaAqui, setEscolhidaAqui] = useState<FrenteDeAtuacao | null | undefined>(undefined);
  const euLido = useDaEscola("escola_eu");
  const { frente: sua, pronta } = frenteMarcada(escolhidaAqui, euLido, eu.frente);
  const [guardando, setGuardando] = useState<FrenteDeAtuacao | null>(null);
  const [aviso, setAviso] = useState("");
  // As somas: lidas ao montar e de novo depois de cada escolha (vez muda), para o número acompanhar a escolha.
  const [vez, setVez] = useState(0);
  const [somadas, setSomadas] = useState<LidoDaEscola<FrentesSomadas> | null>(null);
  useEffect(() => {
    let vivo = true;
    lerDaEscola("escola_frentes_somadas").then((lido) => vivo && setSomadas(lido));
    return () => {
      vivo = false;
    };
  }, [vez]);
  const frentes = frentesNaTela(sua, somadas?.ok ? somadas.dados : null);
  const temConta = frentes.some((f) => f.conta !== null);

  async function tocar(frente: FrenteDeAtuacao) {
    if (guardando || !pronta) return;
    const nova = proximaEscolha(sua, frente);
    setGuardando(frente);
    setAviso(t.guardando);
    const r = await chamarDaEscola("escola_frente_escolher", { p_frente: nova });
    setGuardando(null);
    if (r.ok) {
      setEscolhidaAqui(nova);
      esquecerEscola();
      setVez((v) => v + 1);
      setAviso(nova ? preencher(t.escolhida, { frente: t.nomes[nova] }) : t.tirada);
    } else setAviso(t[avisoDaEscolha(r.codigo)]);
  }

  return (
    <>
      <p className="ef6-frentes-texto">
        {t.frentesTexto} {t.escolher}
      </p>
      <ul className="ef6-frentes">
        {frentes.map((f) => (
          <li key={f.frente}>
            <button
              type="button"
              className="ef6-frente"
              data-sua={f.sua ? "" : undefined}
              aria-pressed={f.sua}
              disabled={guardando !== null || !pronta}
              aria-busy={guardando === f.frente}
              onClick={() => tocar(f.frente)}
            >
              <span>
                {t.nomes[f.frente]}
                {f.sua && ` · ${t.aSua}`}
              </span>
              {f.conta !== null && (
                <span className="ef6-frente-conta">
                  <span aria-hidden>{f.conta}</span>
                  <span className="sr-only">{preencher(t.quantos, { n: f.conta })}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {temConta && <p className="ef6-aviso">{t.contagem}</p>}
      <p className="ef6-aviso" role="status" aria-live="polite">
        {aviso}
      </p>
    </>
  );
}
