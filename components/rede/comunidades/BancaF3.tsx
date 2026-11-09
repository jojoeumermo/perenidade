// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import type { Situacao } from "@/lib/rede/tipos";
import { Casca } from "../Casca";
import TelaDaConversaAlumia from "../conversa/TelaDaConversaAlumia";
import { BuscaDaColuna, ComunidadesAtivas } from "./ComunidadesAtivas";
import { PaginaDaComunidadeAlumia } from "./PaginaDaComunidadeAlumia";

const SITUACAO: Situacao = { logado: true, membro: true, regras_versao: 1 };
const nada = () => undefined;

/**
 * A banca da F3 (só na prévia): a tela dentro da casca de verdade da Alumia (no celular, com a barra de baixo, para conferir que
 * nada fica escondido atrás dela) e, no computador, a busca e "Comunidades ativas" logo abaixo, como na coluna da prancha.
 */
export function BancaF3({ lang, s, sc, tela }: { lang: string; s: TextosDaRede; sc: TextosDeComunidades; tela: "comunidade" | "conversa" }) {
  const ctx = { lang, s, situacao: SITUACAO };
  return (
    <div className="al3" style={{ minHeight: "100vh" }}>
      <Casca lang={lang} s={s} situacao={SITUACAO} ativo="comunidades" aoEscrever={nada}>
        {tela === "comunidade" ? (
          <PaginaDaComunidadeAlumia slug="passe-livre-sp" lang={lang} s={s} sc={sc} situacao={SITUACAO} aoEscrever={nada} aoCarregar={nada} />
        ) : (
          <TelaDaConversaAlumia id="00000000-0000-4000-8000-0000000000c1" lang={lang} s={s} situacao={SITUACAO} />
        )}
        <aside className="al3-banca-coluna">
          <BuscaDaColuna {...ctx} />
          <ComunidadesAtivas {...ctx} />
        </aside>
      </Casca>
    </div>
  );
}
