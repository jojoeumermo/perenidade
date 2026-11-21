// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { PropsDaTelaDoPacote } from "../registro";
import { CarregandoALei } from "./base";
import { Reaceite } from "./Reaceite";
import { TextoDaLei } from "./TextoDaLei";
import { useTextosDaLei } from "./usarTextos";

/**
 * Os termos de uso da Alumia (/alumia/termos), com a versão no alto e, para quem entrou e ainda não aceitou esta versão, o aceite no fim.
 * Dentro da janela dos termos (JanelaDosTermos.tsx), `semAceite`: o aceite fica no pé da janela.
 */
export default function TelaDosTermos({ lang, s, situacao, semAceite = false }: PropsDaTelaDoPacote & { semAceite?: boolean }) {
  const t = useTextosDaLei(lang);
  if (!t) return <CarregandoALei rotulo={s.estados.carregando} />;
  return (
    <TextoDaLei lang={lang} t={t} pagina="termos" titulo={t.termos.titulo} chamada={t.termos.chamada} secoes={t.termos.secoes}
      depois={situacao.logado && !semAceite ? <Reaceite lang={lang} naPagina /> : null} />
  );
}
