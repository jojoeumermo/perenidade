// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createContext, useContext } from "react";
import { type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import type { EscolaEuDentro } from "@/lib/escola/contratos";
import { BarraDeBaixo, CabecaDoCelular } from "./BarraDeBaixo";
import { ColunaDaEscola } from "./ColunaDaEscola";
import { FaixaDeCores } from "./FaixaDeCores";
import { useModoDiscreto } from "./ModoDiscreto";

const EuDaEscola = createContext<EscolaEuDentro | null>(null);

/** O militante que está na Escola (só existe dentro da casca, que só monta depois de escola_eu dizer que é militante). */
export function useEuDaEscola(): EscolaEuDentro {
  const eu = useContext(EuDaEscola);
  if (!eu) throw new Error("useEuDaEscola fora da casca da Escola");
  return eu;
}

/**
 * A casca da Escola de Formação (prancha Hoje e Cel-Hoje): a faixa de cores, a coluna lateral no computador (logo,
 * as 6 telas, "Tirar uma dúvida", o modo discreto e o cartão de quem está estudando) e, no celular (até 767 px), a
 * cabeça com o "?" e a barra de baixo "Hoje · Formação · Núcleo · Biblioteca · Eu". O conteúdo de cada tela entra no meio.
 *
 * As telas novas são escuras (marcam-se com data-escola-escura). As páginas antigas da Escola, de papel claro, ganham
 * uma folha de papel (#FBFAF6) dentro da casca até a frente dona refazê-las ou a F7 levá-las ao site aberto.
 */
export function Casca({ lang, t, eu, children }: { lang: Locale; t: TextosDaFormacaoBase["casca"]; eu: EscolaEuDentro; children: React.ReactNode }) {
  const discreto = useModoDiscreto(t.tituloNeutro);
  return (
    <EuDaEscola.Provider value={eu}>
      <div className="ef-casca" data-escola-formacao="" data-escola-casca="">
        <FaixaDeCores />
        <CabecaDoCelular lang={lang} t={t} discreto={discreto.ligado} />
        <div className="ef-casca-corpo">
          <ColunaDaEscola lang={lang} t={t} eu={eu} discreto={discreto} />
          <div className="ef-conteudo">{children}</div>
        </div>
        <BarraDeBaixo lang={lang} t={t} discreto={discreto.ligado} />
      </div>
    </EuDaEscola.Provider>
  );
}
